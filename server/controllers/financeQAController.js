const { askFinanceQuestion } = require('../services/ai/financeQA');
const logger = require('../utils/logger');
const { createAuditEvent } = require('./auditLogController');
const ReconciliationResult = require('../models/ReconciliationResult');
const { findOwnedRun } = require('./reconciliationRunController');

const MAX_QUESTION_LENGTH = 1000;

function validateQuestion(question) {
  if (question == null || typeof question !== 'string') {
    return { valid: false, error: { code: 'QA_INVALID_INPUT', message: 'question is required and must be a string.' } };
  }
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: { code: 'QA_INVALID_INPUT', message: 'question must not be empty.' } };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: { code: 'QA_INVALID_INPUT', message: `question must not exceed ${MAX_QUESTION_LENGTH} characters.` },
    };
  }
  return { valid: true, question: trimmed };
}

exports.askFinanceQuestion = async (req, res) => {
  try {
    const validation = validateQuestion(req.body && req.body.question);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { runId } = req.body || {};

    let options;
    let resource = 'FINANCE_QA';
    let resourceId = null;

    // Run-aware grounding: when a run is selected, this user's Q&A is answered
    // exclusively from that run's data. Ownership is enforced on the backend.
    if (runId) {
      const run = await findOwnedRun(req, String(runId));
      if (!run) {
        return res.status(404).json({ success: false, error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' } });
      }
      if (!run.analytics) {
        return res.status(422).json({ success: false, error: { code: 'NOT_COMPLETED', message: 'This run has not been reconciled yet.' } });
      }

      const results = await ReconciliationResult.find({ runId: run._id })
        .sort({ createdAt: 1 })
        .lean();

      options = {
        analytics: run.analytics && run.analytics.toObject ? run.analytics.toObject() : run.analytics,
        results,
        scope: String(run._id),
      };
      resource = 'ReconciliationRun';
      resourceId = String(run._id);
    }

    const result = await askFinanceQuestion(validation.question, options);

    if (!result.success) {
      createAuditEvent({
        userId: req.user ? String(req.user._id) : null,
        userName: req.user ? req.user.name : null,
        action: 'FINANCE_QA_QUERY',
        resource,
        resourceId,
        status: 'FAILED',
      });

      const statusCode = result.error.code === 'AI_REQUEST_INVALID' ? 400
        : result.error.code === 'AI_CONFIG_ERROR' ? 503
        : result.error.code === 'AI_TIMEOUT' ? 504
        : result.error.code === 'DATA_NOT_FOUND' ? 503
        : result.error.code === 'AI_UNAVAILABLE' ? 503
        : 500;

      return res.status(statusCode).json({ success: false, error: result.error });
    }

    createAuditEvent({
      userId: req.user ? String(req.user._id) : null,
      userName: req.user ? req.user.name : null,
      action: 'FINANCE_QA_QUERY',
      resource,
      resourceId,
      status: 'SUCCESS',
      metadata: result.data && result.data.intent ? { intent: result.data.intent } : {},
    });

    res.json({ success: true, data: result.data, cached: result.cached || false });
  } catch (error) {
    logger.error(`Finance QA controller error: ${logger.sanitize(error.message)}`);
    res.status(500).json({
      success: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' },
    });
  }
};
