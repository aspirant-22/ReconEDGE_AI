const { calculateReconciliationOverview } = require('./reconciliationAnalytics');
const { calculateExceptionAnalytics, calculateSeverityAnalytics, calculateTopExceptions } = require('./exceptionAnalytics');
const { calculateFinancialAnalytics } = require('./financialAnalytics');
const { calculateControlEffectiveness, calculateHealthStatus } = require('./trendAnalytics');

function generateAnalytics(results, metrics) {
  const overview = calculateReconciliationOverview(results, metrics);
  const exceptionAnalytics = calculateExceptionAnalytics(results, metrics);
  const severityAnalytics = calculateSeverityAnalytics(results);
  const financialAnalytics = calculateFinancialAnalytics(results);
  const controlEffectiveness = calculateControlEffectiveness(results, metrics);
  const healthStatus = calculateHealthStatus(controlEffectiveness);
  const topExceptions = calculateTopExceptions(results);

  return {
    generatedAt: new Date().toISOString(),
    overview,
    matching: {
      matchedRecords: overview.matchedRecords,
      paymentMatchRate: overview.paymentMatchRate,
      bankMatchRate: overview.bankMatchRate,
      invoiceMatchRate: overview.invoiceMatchRate,
      bankAssignmentAccuracy: overview.bankAssignmentAccuracy,
    },
    exceptions: exceptionAnalytics,
    severity: severityAnalytics,
    financialImpact: financialAnalytics,
    controlEffectiveness,
    health: healthStatus,
    topExceptions,
  };
}

module.exports = { generateAnalytics };
