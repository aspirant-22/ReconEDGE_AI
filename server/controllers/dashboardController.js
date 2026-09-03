const fs = require('fs');
const path = require('path');

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

exports.getDashboard = async (req, res) => {
  try {
    const analytics = loadJson(ANALYTICS_PATH);
    const results = loadJson(RESULTS_PATH);

    if (!analytics || !results) {
      return res.json({
        success: true,
        hasData: false,
        dashboard: null,
      });
    }

    const exceptions = Array.isArray(results)
      ? results.filter((r) => r.status === 'EXCEPTION')
      : [];

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

    const dashboard = {
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
    };

    res.json({
      success: true,
      hasData: true,
      dashboard,
    });
  } catch (error) {
    console.log('Dashboard controller error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: 'Unable to load dashboard data.' },
    });
  }
};
