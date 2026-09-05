// Dashboard controller.
//
// Supports two modes:
//  - Run-aware:   GET /api/dashboard?runId=<id> loads the authenticated user's
//                 run-specific analytics + recent exceptions (real data flow).
//  - Demo mode:   GET /api/dashboard (no runId) shows the generated sample
//                 dataset. This is clearly demo data and never mixed with real runs.
//
// A foreign/missing runId returns 404 — the demo dataset is NEVER used as a
// silent fallback for an invalid run selection.

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ReconciliationRun = require('../models/ReconciliationRun');
const ReconciliationResult = require('../models/ReconciliationResult');
const { findOwnedRun } = require('./reconciliationRunController');

const ANALYTICS_PATH = path.join(__dirname, '..', '..', 'data', 'generated', 'reconciliation-analytics.json');
const RESULTS_PATH = path.join(__dirname, '..', '..', 'data', 'generated', 'reconciliation-results.json');

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const NOT_FOUND = {
  success: false,
  error: { code: 'RUN_NOT_FOUND', message: 'Reconciliation run not found.' },
};

function buildDashboard(analytics, recentExceptionResults) {
  const exceptions = Array.isArray(recentExceptionResults) ? recentExceptionResults : [];

  const recentExceptions = exceptions.slice(0, 10).map((exc) => ({
    paymentId: exc.paymentId,
    bankTransactionId: exc.bankTransactionId,
    invoiceId: exc.invoiceId,
    exceptionType: exc.exceptionType,
    paymentAmount: exc.paymentAmount,
    bankAmount: exc.bankAmount,
    amountDifference: exc.amountDifference,
    dateDifferenceDays: exc.dateDifferenceDays,
    status: exc.status,
  }));

  return {
    overview: {
      paymentsProcessed: analytics.overview.totalPayments,
      matchedPayments: analytics.overview.matchedRecords,
      exceptions: analytics.overview.totalExceptions,
      exceptionRate: analytics.overview.exceptionRate,
    },
    reconciliation: {
      paymentMatchRate: analytics.matching.paymentMatchRate,
      bankMatchRate: analytics.matching.bankMatchRate,
      invoiceMatchRate: analytics.matching.invoiceMatchRate,
      bankAssignmentAccuracy: analytics.matching.bankAssignmentAccuracy,
      reconciliationRate: analytics.controlEffectiveness.reconciliationRate,
    },
    control: {
      health: analytics.health.healthStatus,
      healthReason: analytics.health.healthReason,
      reconciliationRate: analytics.controlEffectiveness.reconciliationRate,
      exceptionRate: analytics.controlEffectiveness.exceptionRate,
      cleanMatchRate: analytics.controlEffectiveness.cleanMatchRate,
      exceptionDetection: {
        precision: analytics.controlEffectiveness.exceptionDetectionPrecision,
        recall: analytics.controlEffectiveness.exceptionDetectionRecall,
        f1: analytics.controlEffectiveness.exceptionDetectionF1,
      },
    },
    exceptions: {
      total: analytics.exceptions.totalExceptions,
      breakdown: analytics.exceptions.breakdown,
      severity: {
        high: analytics.severity.highSeverityCount,
        medium: analytics.severity.mediumSeverityCount,
        low: analytics.severity.lowSeverityCount,
        highPercentage: analytics.severity.highSeverityPercentage,
        mediumPercentage: analytics.severity.mediumSeverityPercentage,
        lowPercentage: analytics.severity.lowSeverityPercentage,
      },
    },
    financial: {
      totalPaymentAmount: analytics.financialImpact.totalPaymentAmount,
      matchedPaymentAmount: analytics.financialImpact.matchedPaymentAmount,
      exceptionPaymentAmount: analytics.financialImpact.exceptionPaymentAmount,
      amountMismatchImpact: analytics.financialImpact.amountMismatchImpact,
    },
    topExceptions: analytics.topExceptions,
    recentExceptions,
    generatedAt: analytics.generatedAt,
    mode: 'run',
  };
}

function buildDemoDashboard() {
  const analytics = loadJson(ANALYTICS_PATH);
  const results = loadJson(RESULTS_PATH);

  if (!analytics || !results) {
    return null;
  }

  const exceptions = Array.isArray(results) ? results.filter((r) => r.status === 'EXCEPTION') : [];
  return { ...buildDashboard(analytics, exceptions), mode: 'demo' };
}

exports.getDashboard = async (req, res) => {
  try {
    const runId = req.query && req.query.runId;

    // No runId -> Demo mode (clearly labelled, never mixed with real runs).
    if (!runId) {
      const demo = buildDemoDashboard();
      if (!demo) {
        return res.json({ success: true, hasData: false, dashboard: null });
      }
      return res.json({ success: true, hasData: true, dashboard: demo });
    }

    // Run-aware mode: enforce ownership. Invalid/foreign runs -> 404, never demo fallback.
    const run = await findOwnedRun(req, String(runId));
    if (!run) {
      return res.status(404).json(NOT_FOUND);
    }

    if (!run.analytics) {
      return res.json({ success: true, hasData: false, runId: String(run._id), dashboard: null });
    }

    const exceptionRecords = await ReconciliationResult.find({ runId: run._id, status: 'EXCEPTION' })
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();

    // Lightweight derived human-workflow metrics — never modifies the locked
    // deterministic analytics document.
    const workflowRows = await ReconciliationResult.aggregate([
      { $match: { runId: run._id, status: 'EXCEPTION' } },
      { $group: { _id: '$workflowStatus', count: { $sum: 1 } } },
    ]);
    const wf = { open: 0, inReview: 0, resolved: 0, rejected: 0, escalated: 0 };
    workflowRows.forEach((row) => {
      const key = row._id || 'OPEN';
      if (key === 'OPEN') wf.open += row.count;
      else if (key === 'IN_REVIEW') wf.inReview += row.count;
      else if (key === 'RESOLVED') wf.resolved += row.count;
      else if (key === 'REJECTED') wf.rejected += row.count;
      else if (key === 'ESCALATED') wf.escalated += row.count;
    });
    const wfTotal = wf.open + wf.inReview + wf.resolved + wf.rejected + wf.escalated;
    const workflow = {
      total: wfTotal,
      open: wf.open,
      inReview: wf.inReview,
      resolved: wf.resolved,
      rejected: wf.rejected,
      escalated: wf.escalated,
      resolutionRate: wfTotal > 0 ? Math.round((wf.resolved / wfTotal) * 10000) / 100 : 0,
    };

    const dashboard = {
      ...buildDashboard(run.analytics.toObject ? run.analytics.toObject() : run.analytics, exceptionRecords),
      runId: String(run._id),
      runName: run.name,
      runStatus: run.status,
      periodStart: run.periodStart || null,
      periodEnd: run.periodEnd || null,
      workflow,
    };

    res.json({ success: true, hasData: true, dashboard });
  } catch (error) {
    logger.error(`Dashboard controller error: ${logger.sanitize(error.message)}`);
    res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: 'Unable to load dashboard data.' },
    });
  }
};
