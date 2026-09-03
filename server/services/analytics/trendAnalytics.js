const HEALTH_THRESHOLDS = {
  WARNING_EXCEPTION_RATE: 10,
  CRITICAL_EXCEPTION_RATE: 25,
};

function calculateControlEffectiveness(results, metrics) {
  const totalPayments = metrics.inputRecords.payments;
  const matchedRecords = metrics.matchedRecords;
  const totalExceptions = metrics.exceptionRecords;

  const reconciliationRate = totalPayments > 0 ? Number(((matchedRecords / totalPayments) * 100).toFixed(2)) : 0;
  const exceptionRate = totalPayments > 0 ? Number(((totalExceptions / totalPayments) * 100).toFixed(2)) : 0;
  const cleanMatchRate = metrics.matchRates.payment;

  const exceptionDetection = metrics.evaluation.exceptionDetection;
  const exceptionDetectionPrecision = exceptionDetection.precision;
  const exceptionDetectionRecall = exceptionDetection.recall;
  const exceptionDetectionF1 = exceptionDetection.f1;

  const controlEffectivenessScore = Number(((reconciliationRate * 0.4 + cleanMatchRate * 0.3 + exceptionDetectionF1 * 100 * 0.3)).toFixed(2));

  return {
    reconciliationRate,
    exceptionRate,
    cleanMatchRate,
    exceptionDetectionPrecision: Number((exceptionDetectionPrecision * 100).toFixed(2)),
    exceptionDetectionRecall: Number((exceptionDetectionRecall * 100).toFixed(2)),
    exceptionDetectionF1: Number((exceptionDetectionF1 * 100).toFixed(2)),
    controlEffectivenessScore,
  };
}

function calculateHealthStatus(controlMetrics) {
  const { exceptionRate } = controlMetrics;

  if (exceptionRate < HEALTH_THRESHOLDS.WARNING_EXCEPTION_RATE) {
    return {
      healthStatus: 'HEALTHY',
      healthReason: `Exception rate is ${exceptionRate}%, below the warning threshold of ${HEALTH_THRESHOLDS.WARNING_EXCEPTION_RATE}%.`,
    };
  }

  if (exceptionRate < HEALTH_THRESHOLDS.CRITICAL_EXCEPTION_RATE) {
    return {
      healthStatus: 'WARNING',
      healthReason: `Exception rate is ${exceptionRate}%, between the warning threshold of ${HEALTH_THRESHOLDS.WARNING_EXCEPTION_RATE}% and critical threshold of ${HEALTH_THRESHOLDS.CRITICAL_EXCEPTION_RATE}%.`,
    };
  }

  return {
    healthStatus: 'CRITICAL',
    healthReason: `Exception rate is ${exceptionRate}%, exceeding the critical threshold of ${HEALTH_THRESHOLDS.CRITICAL_EXCEPTION_RATE}%.`,
  };
}

module.exports = {
  calculateControlEffectiveness,
  calculateHealthStatus,
  HEALTH_THRESHOLDS,
};
