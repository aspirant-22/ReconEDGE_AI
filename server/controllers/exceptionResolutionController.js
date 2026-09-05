// Phase 12 — Human exception resolution workflow: detail, action, history.
//
// Every endpoint is protected by:
//   authenticated user (req.user._id)
//   + run ownership (findOwnedRun)
//   + exception ownership (runId-scoped record lookup)
//
// The AI can only explain; the human (via these endpoints) changes workflow state.

const logger = require('../utils/logger');
const ReconciliationRun = require('../models/ReconciliationRun');
const ReconciliationResult = require('../models/ReconciliationResult');
const ExceptionResolution = require('../models/ExceptionResolution');
const { findOwnedRun } = require('./reconciliationRunController');
const { createAuditEvent } = require('./auditLogController');
const {
  WORKFLOW_STATUSES,
  WORKFLOW_ACTIONS,
  RESOLUTION_CODES,
  isAllowedTransition,
  getSuccessorStatus,
  validateActionInput,
  sanitizeText,
} = require('../services/resolution/exceptionWorkflow');

const EXCEPTION_SEVERITY = {
  MISSING_BANK_TRANSACTION: 'HIGH',
  UNMATCHED_BANK_TRANSACTION: 'HIGH',
  DUPLICATE_BANK_TRANSACTION: 'HIGH',
  AMOUNT_MISMATCH: 'MEDIUM',
  DATE_MISMATCH: 'MEDIUM',
};

function audit(userId, userName, action, resourceId, status, metadata) {
  createAuditEvent({
    userId: userId ? String(userId) : null,
    userName: userName || null,
    action,
    resource: 'ReconciliationRun',
    resourceId: resourceId ? String(resourceId) : null,
    status,
    metadata: metadata || {},
  });
}

function exceptionRefOf(record) {
  return record.paymentId || record.bankTransactionId || record.invoiceId;
}

function serializeException(record, run) {
  return {
    resultId: record._id ? String(record._id) : null,
    exceptionId: exceptionRefOf(record),
    paymentId: record.paymentId,
    bankTransactionId: record.bankTransactionId,
    invoiceId: record.invoiceId,
    status: record.status,
    exceptionType: record.exceptionType,
    matchMethod: record.matchMethod,
    confidence: record.confidence,
    paymentAmount: record.paymentAmount,
    bankAmount: record.bankAmount,
    invoiceAmount: record.invoiceAmount,
    amountDifference: record.amountDifference,
    invoiceAmountDifference: record.invoiceAmountDifference,
    dateDifferenceDays: record.dateDifferenceDays,
    paymentDate: record.paymentDate,
    bankDate: record.bankDate,
    invoiceDate: record.invoiceDate,
    severity: record.exceptionType ? (EXCEPTION_SEVERITY[record.exceptionType] || 'MEDIUM') : null,
    // Human workflow state
    workflowStatus: record.workflowStatus || 'OPEN',
    lastAction: record.lastAction || null,
    resolutionCode: record.resolutionCode || null,
    resolutionReason: record.resolutionReason || null,
    resolutionNotes: record.resolutionNotes || null,
    resolvedBy: record.resolvedBy ? String(record.resolvedBy) : null,
    resolvedAt: record.resolvedAt || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    run: run
      ? {
          id: String(run._id),
          name: run.name,
          status: run.status,
          isArchived: !!run.isArchived,
          periodStart: run.periodStart || null,
          periodEnd: run.periodEnd || null,
        }
      : null,
  };
}

async function findExceptionRecord(run, exceptionId) {
  return ReconciliationResult.findOne({
    runId: run._id,
    $or: [{ paymentId: exceptionId }, { bankTransactionId: exceptionId }],
  }).lean();
}

function isMutableRun(run) {
  // Resolution requires an owned, completed, unarchived run.
  if (!run) return { ok: false, code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.', status: 404 };
  if (run.isArchived) return { ok: false, code: 'RUN_ARCHIVED', message: 'Archived runs are read-only. Restore the run before changing exception workflow state.', status: 409 };
  if (run.status !== 'COMPLETED') return { ok: false, code: 'RUN_NOT_RESOLVABLE', message: `Exception workflow can only be changed on completed runs (current: ${run.status || 'UNKNOWN'}).`, status: 409 };
  return { ok: true };
}

// GET /api/reconciliation/runs/:runId/exceptions/:exceptionId
exports.getExceptionDetail = async (req, res) => {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const record = await findExceptionRecord(run, req.params.exceptionId);
    if (!record) {
      return res.status(404).json({ success: false, error: { code: 'EXCEPTION_NOT_FOUND', message: `No exception record found for ID: ${req.params.exceptionId}` } });
    }

    if (record.status !== 'EXCEPTION') {
      return res.status(400).json({ success: false, error: { code: 'NOT_AN_EXCEPTION', message: 'The specified record is not an exception.' } });
    }

    res.json({ success: true, data: serializeException(record, run) });
  } catch (error) {
    logger.error(`Get exception detail error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load exception detail.' } });
  }
};

// POST /api/reconciliation/runs/:runId/exceptions/:exceptionId/action
// Body: { action, resolutionCode?, reason?, notes? }
exports.performExceptionAction = async (req, res) => {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    const mutable = isMutableRun(run);
    if (!mutable.ok) {
      return res.status(mutable.status).json({ success: false, error: { code: mutable.code, message: mutable.message } });
    }

    const { action } = req.body || {};
    const input = validateActionInput(action, req.body || {});
    if (!input.ok) {
      return res.status(input.code === 'INVALID_ACTION' || input.code === 'INVALID_STATE_TRANSITION' ? 400 : 422)
        .json({ success: false, error: { code: input.code, message: input.message } });
    }

    const record = await findExceptionRecord(run, req.params.exceptionId);
    if (!record) {
      return res.status(404).json({ success: false, error: { code: 'EXCEPTION_NOT_FOUND', message: `No exception record found for ID: ${req.params.exceptionId}` } });
    }

    if (record.status !== 'EXCEPTION') {
      return res.status(400).json({ success: false, error: { code: 'NOT_AN_EXCEPTION', message: 'The specified record is not an exception.' } });
    }

    const currentStatus = record.workflowStatus || 'OPEN';
    if (!isAllowedTransition(currentStatus, action)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE_TRANSITION', message: `Cannot perform ${action} from ${currentStatus}.` },
      });
    }

    // Build the update payload for the CURRENT workflow state only.
    // Financial evidence fields are never touched.
    const now = new Date();
    const codeForAction = action === 'RESOLVE' ? req.body.resolutionCode : null;
    const reasonForAction = sanitizeText(req.body.reason, 1000);
    const notes = sanitizeText(req.body.notes, 4000);
    const newStatus = getSuccessorStatus(action);

    const setFields = {
      workflowStatus: newStatus,
      lastAction: action,
      resolvedBy: req.user._id,
      resolvedAt: now,
    };
    if (action === 'RESOLVE') {
      setFields.resolutionCode = codeForAction;
      setFields.resolutionReason = reasonForAction;
      setFields.resolutionNotes = notes;
    } else if (action === 'REJECT' || action === 'ESCALATE') {
      setFields.resolutionCode = null;
      setFields.resolutionReason = reasonForAction;
      setFields.resolutionNotes = notes;
    }

    // Compare-and-set guard: only the first concurrent request wins the state
    // transition. Duplicate identical requests therefore never produce two
    // resolutions or two history entries.
    const updated = await ReconciliationResult.findOneAndUpdate(
      { _id: record._id, runId: run._id, workflowStatus: currentStatus },
      { $set: setFields },
      { new: true }
    );

    if (!updated) {
      // A competing request already committed a transition. Re-read to explain.
      const latest = await ReconciliationResult.findOne({ _id: record._id, runId: run._id }).lean();
      const latestStatus = latest ? latest.workflowStatus || 'OPEN' : currentStatus;
      return res.status(409).json({
        success: false,
        error: {
          code: 'WORKFLOW_CONFLICT',
          message: `This exception was already updated by another request. Current status: ${latestStatus}.`,
        },
      });
    }

    let resolution = null;
    try {
      resolution = await ExceptionResolution.create({
        runId: run._id,
        resultId: updated._id,
        exceptionRef: exceptionRefOf(record),
        userId: req.user._id,
        userName: req.user.name || null,
        action,
        previousStatus: currentStatus,
        newStatus,
        resolutionCode: codeForAction,
        reason: reasonForAction,
        notes,
      });
    } catch (histErr) {
      // History must never break the primary flow.
      logger.warn(`Resolution history write skipped: ${logger.sanitize(histErr.message)}`);
      resolution = null;
    }

    const auditAction =
      action === 'START_REVIEW' ? 'EXCEPTION_REVIEW_STARTED'
      : action === 'RESOLVE' ? 'EXCEPTION_RESOLVED'
      : action === 'REJECT' ? 'EXCEPTION_REJECTED'
      : action === 'ESCALATE' ? 'EXCEPTION_ESCALATED'
      : 'EXCEPTION_REOPENED';

    audit(req.user._id, req.user.name, auditAction, run._id, 'SUCCESS', {
      exceptionId: exceptionRefOf(record),
      action,
      previousStatus: currentStatus,
      newStatus,
      resolutionCode: codeForAction || null,
    });

    res.json({
      success: true,
      data: {
        exception: serializeException(updated, run),
        resolution: resolution
          ? {
              id: resolution._id ? String(resolution._id) : null,
              action,
              previousStatus: currentStatus,
              newStatus,
              timestamp: resolution.createdAt || now,
              resolutionCode: codeForAction || null,
            }
          : { action, previousStatus: currentStatus, newStatus, timestamp: now, resolutionCode: codeForAction || null },
      },
    });
  } catch (error) {
    logger.error(`Exception resolution action error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'RESOLUTION_ERROR', message: 'Unable to apply exception resolution.' } });
  }
};

// GET /api/reconciliation/runs/:runId/exceptions/:exceptionId/history
exports.getExceptionHistory = async (req, res) => {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const record = await findExceptionRecord(run, req.params.exceptionId);
    if (!record) {
      return res.status(404).json({ success: false, error: { code: 'EXCEPTION_NOT_FOUND', message: `No exception record found for ID: ${req.params.exceptionId}` } });
    }

    const history = await ExceptionResolution.find({ runId: run._id, resultId: record._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({
      success: true,
      data: history.map((h) => ({
        id: h._id ? String(h._id) : null,
        action: h.action,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        resolutionCode: h.resolutionCode || null,
        reason: h.reason || null,
        notes: h.notes || null,
        userName: h.userName || null,
        timestamp: h.createdAt || h.timestamp || null,
        exceptionId: exceptionRefOf(record),
      })),
    });
  } catch (error) {
    logger.error(`Get exception history error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load exception history.' } });
  }
};

module.exports.WORKFLOW_STATUSES = WORKFLOW_STATUSES;
module.exports.WORKFLOW_ACTIONS = WORKFLOW_ACTIONS;
module.exports.RESOLUTION_CODES = RESOLUTION_CODES;
module.exports.serializeException = serializeException;
module.exports.exceptionRefOf = exceptionRefOf;
module.exports.isMutableRun = isMutableRun;
module.exports.EXCEPTION_SEVERITY = EXCEPTION_SEVERITY;