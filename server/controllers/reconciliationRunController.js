const mongoose = require('mongoose');
const logger = require('../utils/logger');
const ReconciliationRun = require('../models/ReconciliationRun');
const PaymentRecord = require('../models/PaymentRecord');
const BankTransaction = require('../models/BankTransaction');
const Invoice = require('../models/Invoice');
const ReconciliationResult = require('../models/ReconciliationResult');
const { previewFile: previewFileService, validateWithMapping, MODULE_ERROR_CODES } = require('../services/fileProcessing');
const { getExtension, sanitizeFileName, isValidFileType } = require('../services/fileProcessing/fileValidator');
const { runReconciliation: executeReconciliation } = require('../services/reconciliationAdapter/runReconciliation');
const { createAuditEvent } = require('./auditLogController');
const { analyzeException } = require('../services/ai');

const FILE_TYPE_MODEL = {
  PAYMENTS: PaymentRecord,
  BANK_TRANSACTIONS: BankTransaction,
  INVOICES: Invoice,
};

const COUNT_FIELD = {
  PAYMENTS: 'validPaymentCount',
  BANK_TRANSACTIONS: 'validBankTransactionCount',
  INVOICES: 'validInvoiceCount',
};

const TOTAL_COUNT_FIELD = {
  PAYMENTS: 'paymentCount',
  BANK_TRANSACTIONS: 'bankTransactionCount',
  INVOICES: 'invoiceCount',
};

const FILE_META_FIELD = {
  PAYMENTS: 'paymentFile',
  BANK_TRANSACTIONS: 'bankFile',
  INVOICES: 'invoiceFile',
};

async function findOwnedRun(req, runId) {
  if (!mongoose.isValidObjectId(runId)) return null;
  const run = await ReconciliationRun.findOne({ _id: runId, userId: req.user._id });
  return run;
}

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

async function createRun(req, res) {
  try {
    const { name, periodStart, periodEnd } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_FAILED', message: 'Reconciliation name is required.' } });
    }

    const parsedStart = periodStart ? new Date(periodStart) : null;
    const parsedEnd = periodEnd ? new Date(periodEnd) : null;

    if (parsedStart && Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_FAILED', message: 'Period start date is invalid.' } });
    }
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_FAILED', message: 'Period end date is invalid.' } });
    }
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_FAILED', message: 'Period end must be after period start.' } });
    }

    const run = await ReconciliationRun.create({
      userId: req.user._id,
      name: name.trim(),
      periodStart: parsedStart,
      periodEnd: parsedEnd,
      status: 'CREATED',
    });

    audit(req.user._id, req.user.name, 'RECONCILIATION_CREATED', run._id, 'SUCCESS', {});

    res.status(201).json({ success: true, data: serializeRun(run) });
  } catch (error) {
    logger.error(`Create reconciliation run error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to create reconciliation run.' } });
  }
};

async function listRuns(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const query = { userId: req.user._id };

    // Archive filter: default to active runs only unless explicitly requested.
    if (req.query.archived === 'true' || req.query.archived === '1') {
      query.isArchived = true;
    } else if (req.query.archived === 'all') {
      // no-op: show both active and archived
    } else {
      query.isArchived = false;
    }

    const search = (req.query.search || '').trim();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.name = re;
    }

    if (req.query.status && ReconciliationRun.RUN_STATUSES.includes(req.query.status)) {
      query.status = req.query.status;
    }

    // Date filtering (applied to createdAt).
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (!Number.isNaN(from.getTime())) query.createdAt = { ...(query.createdAt || {}), $gte: from };
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (!Number.isNaN(to.getTime())) query.createdAt = { ...(query.createdAt || {}), $lte: to };
    }

    const sortField = ['createdAt', 'name', 'status', 'updatedAt'].includes(req.query.sortBy)
      ? req.query.sortBy
      : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const [total, runs] = await Promise.all([
      ReconciliationRun.countDocuments(query),
      ReconciliationRun.find(query)
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    res.json({
      success: true,
      data: runs.map(serializeRun),
      pagination: { total, page, limit, totalPages },
    });
  } catch (error) {
    logger.error(`List reconciliation runs error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load reconciliation runs.' } });
  }
};

async function getRun(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }
    res.json({ success: true, data: serializeRun(run) });
  } catch (error) {
    logger.error(`Get reconciliation run error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load reconciliation run.' } });
  }
};

async function archiveRun(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const shouldArchive = req.body && req.body.archive !== false;
    const archived = await ReconciliationRun.findOneAndUpdate(
      { _id: run._id, userId: req.user._id },
      shouldArchive
        ? { isArchived: true, archivedAt: new Date(), archivedBy: req.user._id }
        : { isArchived: false, archivedAt: null, archivedBy: null },
      { new: true }
    );

    audit(
      req.user._id,
      req.user.name,
      shouldArchive ? 'RECONCILIATION_ARCHIVED' : 'RECONCILIATION_UNARCHIVED',
      run._id,
      'SUCCESS',
      {}
    );

    res.json({ success: true, data: serializeRun(archived) });
  } catch (error) {
    logger.error(`Archive reconciliation run error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to update reconciliation run.' } });
  }
};

async function previewFile(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'No file provided.' } });
    }

    const fileType = (req.body.fileType || req.query.fileType || '').toUpperCase();
    if (!isValidFileType(fileType)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'fileType must be PAYMENTS, BANK_TRANSACTIONS or INVOICES.' } });
    }

    const result = previewFileService({
      buffer: req.file.buffer,
      originalname: sanitizeFileName(req.file.originalname),
      fileType,
      size: req.file.size,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    mapProcessingError(res, error, 'Unable to preview file.');
  }
};

async function uploadFile(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'No file provided.' } });
    }

    const fileType = (req.body.fileType || req.query.fileType || '').toUpperCase();
    if (!isValidFileType(fileType)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'fileType must be PAYMENTS, BANK_TRANSACTIONS or INVOICES.' } });
    }

    let mapping = null;
    if (req.body.mapping) {
      try {
        mapping = JSON.parse(req.body.mapping);
      } catch {
        return res.status(400).json({ success: false, error: { code: 'MAPPING_FAILED', message: 'Mapping payload is not valid JSON.' } });
      }
    }

    try {
      const result = validateWithMapping({
        buffer: req.file.buffer,
        originalname: sanitizeFileName(req.file.originalname),
        fileType,
        size: req.file.size,
        mapping,
      });

      if (!result.report.passed) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `${result.report.invalidRows} invalid row(s) detected. Fix them and re-upload.`,
          },
          data: result,
        });
      }

      const model = FILE_TYPE_MODEL[fileType];
      const docs = result.report.validRecords.map((rec) => ({
        runId: run._id,
        ...rec,
      }));

      // Replace existing records of this type for the run (supports re-upload).
      await model.deleteMany({ runId: run._id });
      if (docs.length > 0) {
        await model.insertMany(docs, { ordered: false });
      }

      const fileMeta = {
        fileName: sanitizeFileName(req.file.originalname),
        fileType,
        extension: getExtension(req.file.originalname),
        sizeBytes: req.file.size,
        totalRows: result.report.totalRows,
        validRows: result.report.validRows,
        invalidRows: result.report.invalidRows,
        uploadedAt: new Date(),
      };

      const update = {
        status: 'VALIDATING',
        [`${FILE_META_FIELD[fileType]}`]: fileMeta,
        [`${TOTAL_COUNT_FIELD[fileType]}`]: result.report.totalRows,
        [`${COUNT_FIELD[fileType]}`]: result.report.validRows,
        errorMessage: null,
      };

      const allCounts = await Promise.all(
        Object.keys(FILE_TYPE_MODEL).map((t) => (t === fileType
          ? Promise.resolve(docs.length)
          : FILE_TYPE_MODEL[t].countDocuments({ runId: run._id })))
      );

      const payments = allCounts[0];
      const banks = allCounts[1];
      const invoices = allCounts[2];

      const allValid = payments > 0 && banks > 0 && invoices > 0;
      update.status = allValid ? 'READY' : 'VALIDATING';

      const runData = await ReconciliationRun.findOneAndUpdate(
        { _id: run._id, userId: req.user._id },
        update,
        { new: true }
      );

      audit(req.user._id, req.user.name, 'FILE_UPLOADED', run._id, 'SUCCESS', {
        fileType,
        rowCount: result.report.totalRows,
        validRows: result.report.validRows,
        invalidRows: result.report.invalidRows,
      });
      audit(req.user._id, req.user.name, 'VALIDATION_COMPLETED', run._id, result.report.passed ? 'SUCCESS' : 'FAILED', {
        fileType,
        totalRows: result.report.totalRows,
        validRows: result.report.validRows,
        invalidRows: result.report.invalidRows,
        passed: result.report.passed,
      });

      res.json({ success: true, data: { fileMeta, report: result.report, run: serializeRun(runData) } });
    } catch (err) {
      await markRunFailed(run._id, err.message || 'File processing failed.');
      mapProcessingError(res, err, 'Unable to upload file.');
    }
  } catch (error) {
    logger.error(`Upload reconciliation file error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to process upload.' } });
  }
};

async function executeRun(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const payments = await PaymentRecord.countDocuments({ runId: run._id });
    const banks = await BankTransaction.countDocuments({ runId: run._id });
    const invoices = await Invoice.countDocuments({ runId: run._id });

    if (payments === 0 || banks === 0 || invoices === 0) {
      return res.status(422).json({ success: false, error: { code: 'VALIDATION_FAILED', message: 'All three datasets (Payments, Bank Transactions, Invoices) must be uploaded before running reconciliation.' } });
    }

    await ReconciliationRun.updateOne({ _id: run._id }, { status: 'PROCESSING', errorMessage: null });
    audit(req.user._id, req.user.name, 'RECONCILIATION_STARTED', run._id, 'SUCCESS', { payments, banks, invoices });

    const outcome = await executeReconciliation(run._id, {
      payments,
      bankTransactions: banks,
      invoices,
      total: payments + banks + invoices,
    });

    // Persist results (replace prior results for this run).
    await ReconciliationResult.deleteMany({ runId: run._id });
    if (outcome.results.length > 0) {
      const docs = outcome.results.map((r) => ({ ...r, runId: run._id }));
      await ReconciliationResult.insertMany(docs, { ordered: false });
    }

    const completedAt = new Date();
    await ReconciliationRun.updateOne(
      { _id: run._id },
      {
        status: 'COMPLETED',
        matchedCount: outcome.matchedCount,
        exceptionCount: outcome.exceptionCount,
        processingTimeMs: outcome.processingTimeMs,
        analytics: outcome.analytics,
        completedAt,
        errorMessage: null,
      }
    );

    audit(req.user._id, req.user.name, 'RECONCILIATION_COMPLETED', run._id, 'SUCCESS', {
      matchedCount: outcome.matchedCount,
      exceptionCount: outcome.exceptionCount,
      processingTimeMs: outcome.processingTimeMs,
    });

    res.json({
      success: true,
      data: {
        matchedCount: outcome.matchedCount,
        exceptionCount: outcome.exceptionCount,
        processingTimeMs: outcome.processingTimeMs,
        analytics: outcome.analytics,
      },
    });
  } catch (error) {
    logger.error(`Execute reconciliation run error: ${logger.sanitize(error.message)}`);
    if (req.params.runId) {
      await markRunFailed(req.params.runId, error.message);
      audit(req.user._id, req.user.name, 'RECONCILIATION_FAILED', req.params.runId, 'FAILED', { error: error.message });
    }
    res.status(500).json({ success: false, error: { code: 'PROCESSING_FAILED', message: 'Reconciliation failed. Please try again.' } });
  }
};

async function getResults(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const statusFilter = req.query.status;
    const typeFilter = req.query.exceptionType;
    const search = (req.query.search || '').trim();

    const query = { runId: run._id };
    if (statusFilter === 'MATCHED' || statusFilter === 'EXCEPTION') query.status = statusFilter;
    if (typeFilter) query.exceptionType = typeFilter;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { paymentId: re },
        { bankTransactionId: re },
        { invoiceId: re },
      ];
    }

    const [total, results] = await Promise.all([
      ReconciliationResult.countDocuments(query),
      ReconciliationResult.find(query)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: results.map(serializeResult),
      pagination: { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    logger.error(`Get reconciliation results error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load reconciliation results.' } });
  }
};

// Canonical severity mapping shared with the analytics layer.
const EXCEPTION_SEVERITY = {
  MISSING_BANK_TRANSACTION: 'HIGH',
  UNMATCHED_BANK_TRANSACTION: 'HIGH',
  DUPLICATE_BANK_TRANSACTION: 'HIGH',
  AMOUNT_MISMATCH: 'MEDIUM',
  DATE_MISMATCH: 'MEDIUM',
};

async function getExceptions(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const typeFilter = req.query.exceptionType;
    const severityFilter = req.query.severity;
    const search = (req.query.search || '').trim();

    const query = { runId: run._id, status: 'EXCEPTION' };
    if (typeFilter) query.exceptionType = typeFilter;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { paymentId: re },
        { bankTransactionId: re },
        { invoiceId: re },
      ];
    }

    let severityTypeFilter = null;
    if (severityFilter) {
      severityTypeFilter = Object.keys(EXCEPTION_SEVERITY)
        .filter((k) => EXCEPTION_SEVERITY[k] === severityFilter);
      if (severityTypeFilter.length > 0) {
        query.exceptionType = { $in: severityTypeFilter };
      }
    }

    const [total, results] = await Promise.all([
      ReconciliationResult.countDocuments(query),
      ReconciliationResult.find(query)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const items = results.map((r) => ({
      ...serializeResult(r),
      severity: r.exceptionType ? (EXCEPTION_SEVERITY[r.exceptionType] || 'MEDIUM') : null,
    }));

    res.json({
      success: true,
      data: items,
      pagination: { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    logger.error(`Get run exceptions error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load exceptions.' } });
  }
};

async function getAnalytics(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }
    if (!run.analytics) {
      return res.status(422).json({ success: false, error: { code: 'NOT_COMPLETED', message: 'This run has not been reconciled yet.' } });
    }
    res.json({ success: true, data: run.analytics });
  } catch (error) {
    logger.error(`Get reconciliation analytics error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Unable to load analytics.' } });
  }
};

async function analyzeExceptionAction(req, res) {
  try {
    const run = await findOwnedRun(req, req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
    }

    const { exceptionId } = req.params;
    const record = await ReconciliationResult.findOne({
      runId: run._id,
      $or: [{ paymentId: exceptionId }, { bankTransactionId: exceptionId }],
    }).lean();

    if (!record) {
      return res.status(404).json({ success: false, error: { code: 'EXCEPTION_NOT_FOUND', message: `No record found for ID: ${exceptionId}` } });
    }

    if (record.status !== 'EXCEPTION') {
      return res.status(400).json({ success: false, error: { code: 'NOT_AN_EXCEPTION', message: 'The specified record is not an exception.' } });
    }

    // A real run must never fall back to demo data. If the run-scoped record
    // cannot provide enough context to analyze (e.g. missing classification),
    // fail explicitly rather than build a context from anything else.
    if (!record.exceptionType) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'AI_CONTEXT_UNAVAILABLE',
          message: 'The exception record for this run is missing classification data and cannot be analyzed.',
        },
      });
    }

    // Construct a minimal, run-scoped context. The record is guaranteed to
    // belong to the authenticated user's run (findOwnedRun + runId filter).
    // Run metadata is attached so the AI can reason about period/status, but
    // the payload sent to Gemini is still constrained by buildAnalysisPayload
    // (prompts.js) and the ground-truth guardrail (exceptionAnalyzer.js).
    const scope = `${String(req.user._id)}:${String(run._id)}`;
    const runContext = {
      runName: run.name,
      runStatus: run.status,
      runPeriodStart: run.periodStart,
      runPeriodEnd: run.periodEnd,
    };
const analyzedRecord = { ...record, ...runContext };

    const result = await analyzeException(exceptionId, analyzedRecord, scope);

    if (!result.success) {
      audit(req.user._id, req.user.name, 'EXCEPTION_ANALYSIS', run._id, 'FAILED', { exceptionId });
      const statusCode = result.error.code === 'AI_REQUEST_INVALID' ? 400
        : result.error.code === 'AI_CONFIG_ERROR' ? 503
        : result.error.code === 'AI_TIMEOUT' ? 504
        : result.error.code === 'AI_UNAVAILABLE' ? 503
        : 500;
      return res.status(statusCode).json({ success: false, error: result.error });
    }

    audit(req.user._id, req.user.name, 'EXCEPTION_ANALYSIS', run._id, 'SUCCESS', {
      exceptionId,
      exceptionType: record.exceptionType,
    });

    res.json({
      success: true,
      runId: String(run._id),
      exceptionId,
      exceptionType: record.exceptionType,
      analysis: result.analysis,
      cached: result.cached || false,
    });
  } catch (error) {
    logger.error(`Analyze run exception error: ${logger.sanitize(error.message)}`);
    res.status(500).json({ success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' } });
  }
};

async function markRunFailed(runId, message) {
  try {
    await ReconciliationRun.updateOne(
      { _id: runId },
      { status: 'FAILED', errorMessage: (message || 'Processing failed.').slice(0, 500) }
    );
  } catch {
    // best-effort
  }
}

function mapProcessingError(res, error, fallback) {
  const code = (error && error.code) || (error && error.message);
  const map = {
    UNSUPPORTED_EXTENSION: ['UNSUPPORTED_EXTENSION', error.userMessage || 'Unsupported file format.'],
    EMPTY_FILE: ['EMPTY_FILE', 'File is empty.'],
    FILE_TOO_LARGE: ['FILE_TOO_LARGE', error.userMessage || 'File exceeds the maximum allowed size.'],
    INVALID_FILE_TYPE: ['INVALID_FILE_TYPE', error.userMessage || 'Invalid file type.'],
    INVALID_FILENAME: ['INVALID_FILENAME', 'Invalid file name.'],
    XLSX_CORRUPTED: ['XLSX_CORRUPTED', 'File is corrupted or not a valid spreadsheet.'],
    MALFORMED_CSV: ['MALFORMED_CSV', 'File could not be parsed as CSV.'],
    DUPLICATE_HEADERS: ['DUPLICATE_HEADERS', 'File contains duplicate column headers.'],
    NO_DATA: ['NO_DATA', 'File does not contain any data rows.'],
    MISSING_MAPPING: ['MAPPING_FAILED', 'Required columns are not mapped. Fix the mapping and try again.'],
    LIMIT_FILE_SIZE: ['FILE_TOO_LARGE', 'File exceeds the maximum allowed size.'],
    VALIDATION_FAILED: ['VALIDATION_FAILED', fallback],
  };
  if (map[code]) {
    return res.status(code === 'VALIDATION_FAILED' ? 422 : 400).json({
      success: false,
      error: { code: map[code][0], message: map[code][1] },
    });
  }
  logger.error(`File processing error: ${logger.sanitize(String(error.message))}`);
  return res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message: fallback } });
}

function serializeRun(run) {
  const doc = run.toObject ? run.toObject() : run;
  return {
    id: doc._id,
    name: doc.name,
    status: doc.status,
    periodStart: doc.periodStart || null,
    periodEnd: doc.periodEnd || null,
    paymentFile: doc.paymentFile || null,
    bankFile: doc.bankFile || null,
    invoiceFile: doc.invoiceFile || null,
    paymentCount: doc.paymentCount || 0,
    bankTransactionCount: doc.bankTransactionCount || 0,
    invoiceCount: doc.invoiceCount || 0,
    validPaymentCount: doc.validPaymentCount || 0,
    validBankTransactionCount: doc.validBankTransactionCount || 0,
    validInvoiceCount: doc.validInvoiceCount || 0,
    matchedCount: doc.matchedCount || 0,
    exceptionCount: doc.exceptionCount || 0,
    processingTimeMs: doc.processingTimeMs || null,
    errorMessage: doc.errorMessage || null,
    hasAnalytics: Boolean(doc.analytics),
    isArchived: Boolean(doc.isArchived),
    archivedAt: doc.archivedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt || null,
  };
}

function serializeResult(r) {
  return {
    id: r._id,
    paymentId: r.paymentId,
    bankTransactionId: r.bankTransactionId,
    invoiceId: r.invoiceId,
    status: r.status,
    exceptionType: r.exceptionType,
    matchMethod: r.matchMethod,
    confidence: r.confidence,
    paymentAmount: r.paymentAmount,
    bankAmount: r.bankAmount,
    invoiceAmount: r.invoiceAmount,
    amountDifference: r.amountDifference,
    invoiceAmountDifference: r.invoiceAmountDifference,
    dateDifferenceDays: r.dateDifferenceDays,
    paymentDate: r.paymentDate,
    bankDate: r.bankDate,
    invoiceDate: r.invoiceDate,
  };
}

module.exports = {
  createRun,
  listRuns,
  getRun,
  archiveRun,
  previewFile,
  uploadFile,
  executeRun,
  getResults,
  getExceptions,
  getAnalytics,
  analyzeExceptionAction,
  findOwnedRun,
  serializeRun,
  serializeResult,
  mapProcessingError,
};

