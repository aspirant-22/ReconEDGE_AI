const SEVERITY_MAP = {
  MISSING_BANK_TRANSACTION: 'HIGH',
  UNMATCHED_BANK_TRANSACTION: 'HIGH',
  DUPLICATE_BANK_TRANSACTION: 'HIGH',
  AMOUNT_MISMATCH: 'MEDIUM',
  DATE_MISMATCH: 'MEDIUM',
};

function calculateExceptionAnalytics(results, metrics) {
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');
  const totalExceptions = exceptions.length;
  const totalPayments = metrics.inputRecords.payments;

  const exceptionCounts = {};
  for (const exc of exceptions) {
    const type = exc.exceptionType || 'UNKNOWN';
    exceptionCounts[type] = (exceptionCounts[type] || 0) + 1;
  }

  const breakdown = {};
  for (const [type, count] of Object.entries(exceptionCounts)) {
    breakdown[type] = {
      count,
      percentageOfExceptions: totalExceptions > 0 ? Number(((count / totalExceptions) * 100).toFixed(2)) : 0,
      percentageOfTotalPayments: totalPayments > 0 ? Number(((count / totalPayments) * 100).toFixed(2)) : 0,
    };
  }

  const classificationMetrics = metrics.evaluation.exceptionClassification || {};
  for (const [type, data] of Object.entries(breakdown)) {
    if (classificationMetrics[type]) {
      data.precision = classificationMetrics[type].precision;
      data.recall = classificationMetrics[type].recall;
      data.f1 = classificationMetrics[type].f1;
      data.truePositives = classificationMetrics[type].truePositives;
      data.falsePositives = classificationMetrics[type].falsePositives;
      data.falseNegatives = classificationMetrics[type].falseNegatives;
    }
  }

  return {
    totalExceptions,
    exceptionRate: totalPayments > 0 ? Number(((totalExceptions / totalPayments) * 100).toFixed(2)) : 0,
    breakdown,
  };
}

function calculateSeverityAnalytics(results) {
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');

  let highSeverityCount = 0;
  let mediumSeverityCount = 0;
  let lowSeverityCount = 0;

  for (const exc of exceptions) {
    const severity = SEVERITY_MAP[exc.exceptionType] || 'LOW';
    if (severity === 'HIGH') highSeverityCount++;
    else if (severity === 'MEDIUM') mediumSeverityCount++;
    else lowSeverityCount++;
  }

  const total = exceptions.length;

  return {
    highSeverityCount,
    mediumSeverityCount,
    lowSeverityCount,
    highSeverityPercentage: total > 0 ? Number(((highSeverityCount / total) * 100).toFixed(2)) : 0,
    mediumSeverityPercentage: total > 0 ? Number(((mediumSeverityCount / total) * 100).toFixed(2)) : 0,
    lowSeverityPercentage: total > 0 ? Number(((lowSeverityCount / total) * 100).toFixed(2)) : 0,
    severityMap: SEVERITY_MAP,
  };
}

function calculateTopExceptions(results) {
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');
  const totalExceptions = exceptions.length;

  const counts = {};
  for (const exc of exceptions) {
    const type = exc.exceptionType || 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalExceptions > 0 ? Number(((count / totalExceptions) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  calculateExceptionAnalytics,
  calculateSeverityAnalytics,
  calculateTopExceptions,
  SEVERITY_MAP,
};
