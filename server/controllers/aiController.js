const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { geminiClient, analyzeException, VALID_EXCEPTION_TYPES } = require('../services/ai');
const { createAuditEvent } = require('./auditLogController');

const RESULTS_PATH = path.join(__dirname, '..', '..', 'data', 'generated', 'reconciliation-results.json');

function loadResults() {
  try {
    const raw = fs.readFileSync(RESULTS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

exports.getStatus = async (req, res) => {
  const available = geminiClient.isAvailable();
  res.json({
    success: true,
    available,
    provider: 'gemini',
    model: available ? geminiClient.getModelName() : null,
  });
};

exports.analyzeException = async (req, res) => {
  try {
    const { exceptionId } = req.body;

    if (!exceptionId || typeof exceptionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'AI_REQUEST_INVALID', message: 'exceptionId is required and must be a string.' },
      });
    }

    const results = loadResults();
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'DATA_NOT_FOUND', message: 'Reconciliation results not found.' },
      });
    }

    const record = results.find((r) => r.paymentId === exceptionId || r.bankTransactionId === exceptionId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: { code: 'EXCEPTION_NOT_FOUND', message: `No record found for ID: ${exceptionId}` },
      });
    }

    if (record.status !== 'EXCEPTION') {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_AN_EXCEPTION', message: 'The specified record is not an exception.' },
      });
    }

    const result = await analyzeException(exceptionId, record);

    if (!result.success) {
      createAuditEvent({
        userId: req.user ? String(req.user._id) : null,
        userName: req.user ? req.user.name : null,
        action: 'EXCEPTION_ANALYSIS',
        resource: 'EXCEPTION',
        resourceId: exceptionId,
        status: 'FAILED',
      });

      const statusCode = result.error.code === 'AI_REQUEST_INVALID' ? 400
        : result.error.code === 'AI_CONFIG_ERROR' ? 503
        : result.error.code === 'AI_TIMEOUT' ? 504
        : result.error.code === 'AI_UNAVAILABLE' ? 503
        : 500;

      return res.status(statusCode).json({
        success: false,
        error: result.error,
      });
    }

    createAuditEvent({
      userId: req.user ? String(req.user._id) : null,
      userName: req.user ? req.user.name : null,
      action: 'EXCEPTION_ANALYSIS',
      resource: 'EXCEPTION',
      resourceId: exceptionId,
      status: 'SUCCESS',
      metadata: { exceptionType: record.exceptionType },
    });

    res.json({
      success: true,
      exceptionId,
      exceptionType: record.exceptionType,
      analysis: result.analysis,
      cached: result.cached || false,
    });
  } catch (error) {
    logger.error(`AI controller error: ${logger.sanitize(error.message)}`);
    res.status(500).json({
      success: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' },
    });
  }
};
