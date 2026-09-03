function calculateConfusionMatrix(evaluation, targetScenario) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const e of evaluation) {
    const predictedPositive = e.predictedScenario === targetScenario;
    const actualPositive = e.expectedScenario === targetScenario;

    if (predictedPositive && actualPositive) tp++;
    else if (predictedPositive && !actualPositive) fp++;
    else if (!predictedPositive && actualPositive) fn++;
    else tn++;
  }

  return { tp, fp, fn, tn };
}

function precision(tp, fp) {
  if (tp + fp === 0) return 0;
  return tp / (tp + fp);
}

function recall(tp, fn) {
  if (tp + fn === 0) return 0;
  return tp / (tp + fn);
}

function f1Score(p, r) {
  if (p + r === 0) return 0;
  return (2 * p * r) / (p + r);
}

function calculatePerScenarioMetrics(evaluation, scenarios) {
  const metrics = {};

  for (const scenario of scenarios) {
    const cm = calculateConfusionMatrix(evaluation, scenario);
    const p = precision(cm.tp, cm.fp);
    const r = recall(cm.tp, cm.fn);
    const f1 = f1Score(p, r);

    metrics[scenario] = {
      precision: Number(p.toFixed(4)),
      recall: Number(r.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      truePositives: cm.tp,
      falsePositives: cm.fp,
      falseNegatives: cm.fn,
      trueNegatives: cm.tn,
    };
  }

  return metrics;
}

function calculateOverallMetrics(evaluation) {
  const total = evaluation.length;
  if (total === 0) return { precision: 0, recall: 0, f1: 0, accuracy: 0 };

  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;
  let totalCorrect = 0;

  const allScenarios = new Set();
  for (const e of evaluation) {
    if (e.expectedScenario) allScenarios.add(e.expectedScenario);
    if (e.predictedScenario) allScenarios.add(e.predictedScenario);
  }

  for (const scenario of allScenarios) {
    if (scenario === 'EXACT_MATCH') continue;
    const cm = calculateConfusionMatrix(evaluation, scenario);
    totalTp += cm.tp;
    totalFp += cm.fp;
    totalFn += cm.fn;
  }

  totalCorrect = evaluation.filter((e) => e.scenarioCorrect).length;

  const p = precision(totalTp, totalFp);
  const r = recall(totalTp, totalFn);
  const f1 = f1Score(p, r);
  const accuracy = totalCorrect / total;

  return {
    precision: Number(p.toFixed(4)),
    recall: Number(r.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    accuracy: Number(accuracy.toFixed(4)),
  };
}

function calculatePaymentMatchRate(results) {
  const paymentResults = results.filter((r) => r.paymentId);
  if (paymentResults.length === 0) return 0;
  const matched = paymentResults.filter((r) => r.status === 'MATCHED').length;
  return Number(((matched / paymentResults.length) * 100).toFixed(2));
}

function calculateBankMatchRate(results) {
  const bankResults = results.filter((r) => r.bankTransactionId);
  if (bankResults.length === 0) return 0;
  const matched = bankResults.filter((r) => r.status === 'MATCHED').length;
  return Number(((matched / bankResults.length) * 100).toFixed(2));
}

function calculateInvoiceMatchRate(results) {
  const invoiceResults = results.filter((r) => r.invoiceId);
  if (invoiceResults.length === 0) return 0;
  const matched = invoiceResults.filter((r) => r.status === 'MATCHED').length;
  return Number(((matched / invoiceResults.length) * 100).toFixed(2));
}

function calculateThroughput(totalRecords, processingTimeMs) {
  if (processingTimeMs === 0) return 0;
  const seconds = processingTimeMs / 1000;
  return Number((totalRecords / seconds).toFixed(2));
}

module.exports = {
  calculateConfusionMatrix,
  precision,
  recall,
  f1Score,
  calculatePerScenarioMetrics,
  calculateOverallMetrics,
  calculatePaymentMatchRate,
  calculateBankMatchRate,
  calculateInvoiceMatchRate,
  calculateThroughput,
};
