const fs = require('fs');
const path = require('path');

function loadGroundTruth(groundTruthPath) {
  if (!fs.existsSync(groundTruthPath)) {
    throw new Error(`Ground truth file not found: ${groundTruthPath}`);
  }

  const content = fs.readFileSync(groundTruthPath, 'utf-8');
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error('Ground truth must be an array');
  }

  return data;
}

function buildGroundTruthIndex(groundTruth) {
  const index = new Map();
  for (const gt of groundTruth) {
    index.set(gt.paymentId, gt);
  }
  return index;
}

function evaluatePredictions(predictions, groundTruthIndex) {
  const evaluation = [];

  for (const pred of predictions) {
    if (!pred.paymentId) continue;

    const gt = groundTruthIndex.get(pred.paymentId);

    if (!gt) {
      evaluation.push({
        paymentId: pred.paymentId,
        predictedScenario: pred.exceptionType || 'MATCHED',
        expectedScenario: null,
        scenarioCorrect: false,
        bankMatchCorrect: false,
        invoiceMatchCorrect: false,
        isFalsePositive: false,
        isFalseNegative: false,
      });
      continue;
    }

    const predictedScenario = pred.exceptionType || 'MATCHED';
    const expectedScenario = gt.scenario;

    const scenarioCorrect = predictedScenario === expectedScenario ||
      (predictedScenario === 'MATCHED' && expectedScenario === 'EXACT_MATCH');

    const predictedBankId = pred.bankTransactionId;
    const expectedBankId = gt.expectedBankTransactionId;
    const bankMatchCorrect = predictedBankId === expectedBankId;

    const predictedInvoiceId = pred.invoiceId;
    const expectedInvoiceId = gt.expectedInvoiceId;
    const invoiceMatchCorrect = predictedInvoiceId === expectedInvoiceId;

    const isFalsePositive = !scenarioCorrect && predictedScenario !== 'MATCHED' && expectedScenario === 'EXACT_MATCH';
    const isFalseNegative = !scenarioCorrect && predictedScenario === 'MATCHED' && expectedScenario !== 'EXACT_MATCH';

    evaluation.push({
      paymentId: pred.paymentId,
      predictedScenario,
      expectedScenario,
      scenarioCorrect,
      bankMatchCorrect,
      invoiceMatchCorrect,
      isFalsePositive,
      isFalseNegative,
    });
  }

  return evaluation;
}

function calculateScenarioAccuracy(evaluation) {
  const total = evaluation.length;
  if (total === 0) return 0;

  const correct = evaluation.filter((e) => e.scenarioCorrect).length;
  return correct / total;
}

function calculateBankMatchAccuracy(evaluation) {
  const withExpectedBank = evaluation.filter((e) => e.expectedScenario !== 'MISSING_BANK_TRANSACTION');
  if (withExpectedBank.length === 0) return 0;

  const correct = withExpectedBank.filter((e) => e.bankMatchCorrect).length;
  return correct / withExpectedBank.length;
}

function calculateExceptionDetection(evaluation) {
  const tp = evaluation.filter((e) => e.predictedScenario !== 'MATCHED' && e.expectedScenario !== 'EXACT_MATCH').length;
  const fp = evaluation.filter((e) => e.predictedScenario !== 'MATCHED' && e.expectedScenario === 'EXACT_MATCH').length;
  const fn = evaluation.filter((e) => e.predictedScenario === 'MATCHED' && e.expectedScenario !== 'EXACT_MATCH').length;
  const tn = evaluation.filter((e) => e.predictedScenario === 'MATCHED' && e.expectedScenario === 'EXACT_MATCH').length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / (tp + fp + fn + tn);

  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    trueNegatives: tn,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    accuracy: Number(accuracy.toFixed(4)),
  };
}

function calculateExceptionClassification(evaluation) {
  const categories = new Set();
  for (const e of evaluation) {
    if (e.expectedScenario && e.expectedScenario !== 'EXACT_MATCH') {
      categories.add(e.expectedScenario);
    }
  }

  const metrics = {};
  for (const category of categories) {
    const tp = evaluation.filter((e) => e.predictedScenario === category && e.expectedScenario === category).length;
    const fp = evaluation.filter((e) => e.predictedScenario === category && e.expectedScenario !== category).length;
    const fn = evaluation.filter((e) => e.predictedScenario !== category && e.expectedScenario === category).length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    metrics[category] = {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
    };
  }

  return metrics;
}

module.exports = {
  loadGroundTruth,
  buildGroundTruthIndex,
  evaluatePredictions,
  calculateScenarioAccuracy,
  calculateBankMatchAccuracy,
  calculateExceptionDetection,
  calculateExceptionClassification,
};
