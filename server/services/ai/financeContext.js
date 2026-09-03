const fs = require('fs');
const path = require('path');

const ANALYTICS_PATH = path.join(__dirname, '..', '..', '..', 'data', 'generated', 'reconciliation-analytics.json');
const RESULTS_PATH = path.join(__dirname, '..', '..', '..', 'data', 'generated', 'reconciliation-results.json');

const HEALTH_THRESHOLDS = {
  WARNING_EXCEPTION_RATE: 10,
  CRITICAL_EXCEPTION_RATE: 25,
};

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadAnalytics() {
  return loadJson(ANALYTICS_PATH);
}

function loadResults() {
  const data = loadJson(RESULTS_PATH);
  return Array.isArray(data) ? data : [];
}

function buildOverviewContext(analytics) {
  const overview = analytics.overview;
  return {
    dataset: {
      payments: overview.totalPayments,
      bankTransactions: overview.totalBankTransactions,
      invoices: overview.totalInvoices,
    },
    reconciliation: {
      matched: overview.matchedRecords,
      exceptions: overview.totalExceptions,
      paymentMatchRate: overview.paymentMatchRate,
      bankMatchRate: overview.bankMatchRate,
      invoiceMatchRate: overview.invoiceMatchRate,
      bankAssignmentAccuracy: overview.bankAssignmentAccuracy,
      exceptionRate: overview.exceptionRate,
    },
  };
}

function buildExceptionContext(analytics) {
  const exceptions = analytics.exceptions;
  const categories = {};
  for (const [type, data] of Object.entries(exceptions.breakdown || {})) {
    categories[type] = data.count;
  }
  return {
    exceptions: {
      total: exceptions.totalExceptions,
      rate: exceptions.exceptionRate,
      categories,
    },
  };
}

function buildFinancialContext(analytics) {
  const fin = analytics.financialImpact;
  return {
    financialImpact: {
      totalPaymentAmount: fin.totalPaymentAmount,
      matchedPaymentAmount: fin.matchedPaymentAmount,
      exceptionPaymentAmount: fin.exceptionPaymentAmount,
      amountMismatchImpact: fin.amountMismatchImpact,
      matchedAmountRate: fin.matchedAmountRate,
      exceptionAmountRate: fin.exceptionAmountRate,
    },
  };
}

function buildControlHealthContext(analytics) {
  const control = analytics.controlEffectiveness;
  return {
    controlHealth: {
      status: analytics.health.healthStatus,
      reason: analytics.health.healthReason,
      reconciliationRate: control.reconciliationRate,
      exceptionRate: control.exceptionRate,
      cleanMatchRate: control.cleanMatchRate,
      exceptionDetection: {
        precision: control.exceptionDetectionPrecision,
        recall: control.exceptionDetectionRecall,
        f1: control.exceptionDetectionF1,
      },
      thresholds: {
        warningExceptionRate: HEALTH_THRESHOLDS.WARNING_EXCEPTION_RATE,
        criticalExceptionRate: HEALTH_THRESHOLDS.CRITICAL_EXCEPTION_RATE,
      },
    },
  };
}

function buildTransactionDetailsContext(analytics, results) {
  const summary = {};
  for (const type of Object.keys(analytics.exceptions.breakdown || {})) {
    summary[type] = 0;
  }
  for (const r of results) {
    if (r.status === 'EXCEPTION' && r.exceptionType && summary[r.exceptionType] !== undefined) {
      summary[r.exceptionType]++;
    }
  }
  const recent = results
    .filter((r) => r.status === 'EXCEPTION')
    .slice(0, 5)
    .map((exc) => ({
      reference: exc.paymentId || exc.bankTransactionId,
      type: exc.exceptionType,
      paymentAmount: exc.paymentAmount,
      bankAmount: exc.bankAmount,
      amountDifference: exc.amountDifference,
    }));
  return {
    transactionDetails: {
      exceptionCountByType: summary,
      recentExceptions: recent,
    },
  };
}

/**
 * Build the fiscal context for a given intent.
 * Only returns the fields relevant to the question, minimizing tokens.
 */
function buildContextForIntent(analytics, results, intent) {
  switch (intent) {
    case 'RECONCILIATION':
      return {
        ...buildOverviewContext(analytics),
        ...buildExceptionContext(analytics),
        ...buildControlHealthContext(analytics),
      };
    case 'EXCEPTIONS':
      return {
        ...buildOverviewContext(analytics),
        ...buildExceptionContext(analytics),
        ...buildControlHealthContext(analytics),
      };
    case 'FINANCIAL_IMPACT':
      return {
        ...buildOverviewContext(analytics),
        ...buildFinancialContext(analytics),
      };
    case 'CONTROL_HEALTH':
      return {
        ...buildOverviewContext(analytics),
        ...buildControlHealthContext(analytics),
      };
    case 'TRANSACTION_DETAILS':
      return {
        ...buildOverviewContext(analytics),
        ...buildExceptionContext(analytics),
        ...buildTransactionDetailsContext(analytics, results),
      };
    case 'GENERAL_FINANCE':
      return {
        ...buildOverviewContext(analytics),
        ...buildExceptionContext(analytics),
        ...buildFinancialContext(analytics),
        ...buildControlHealthContext(analytics),
      };
    case 'SUMMARY':
    default:
      return {
        ...buildOverviewContext(analytics),
        ...buildExceptionContext(analytics),
        ...buildFinancialContext(analytics),
        ...buildControlHealthContext(analytics),
      };
  }
}

function buildContext(question, intent) {
  const analytics = loadAnalytics();
  if (!analytics) {
    return { success: false, error: { code: 'DATA_NOT_FOUND', message: 'Analytics data not available.' } };
  }

  const results = loadResults();
  const context = buildContextForIntent(analytics, results, intent);

  return {
    success: true,
    context,
    analytics,
    results,
  };
}

module.exports = {
  buildContext,
  buildContextForIntent,
  loadAnalytics,
  loadResults,
  HEALTH_THRESHOLDS,
  ANALYTICS_PATH,
  RESULTS_PATH,
};
