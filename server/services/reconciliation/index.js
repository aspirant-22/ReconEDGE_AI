const fs = require('fs');
const path = require('path');
const { reconcile } = require('./reconciliationEngine');
const { loadGroundTruth, buildGroundTruthIndex, evaluatePredictions, calculateScenarioAccuracy, calculateBankMatchAccuracy, calculateExceptionDetection, calculateExceptionClassification } = require('./evaluator');
const { calculatePerScenarioMetrics, calculateOverallMetrics, calculatePaymentMatchRate, calculateBankMatchRate, calculateInvoiceMatchRate, calculateThroughput } = require('./metrics');

function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function main() {
  const dataDir = path.join(__dirname, '..', '..', '..', 'data', 'generated');
  const startTime = Date.now();

  console.log('');
  console.log('\u2501'.repeat(50));
  console.log('ReconEDGE AI \u2014 Reconciliation Engine');
  console.log('\u2501'.repeat(50));
  console.log('');

  console.log('Loading datasets...');
  const payments = loadJsonFile(path.join(dataDir, 'payments.json'));
  const bankTransactions = loadJsonFile(path.join(dataDir, 'bank-transactions.json'));
  const invoices = loadJsonFile(path.join(dataDir, 'invoices.json'));

  console.log('');
  console.log('Input:');
  console.log(`Payments:           ${payments.length}`);
  console.log(`Bank Transactions:  ${bankTransactions.length}`);
  console.log(`Invoices:           ${invoices.length}`);

  console.log('');
  console.log('Running reconciliation engine...');
  const results = reconcile(payments, bankTransactions, invoices);
  const processingTimeMs = Date.now() - startTime;

  const matched = results.filter((r) => r.status === 'MATCHED');
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');
  const paymentMatchRate = calculatePaymentMatchRate(results);
  const bankMatchRate = calculateBankMatchRate(results);
  const invoiceMatchRate = calculateInvoiceMatchRate(results);

  const exceptionCounts = {};
  for (const exc of exceptions) {
    const type = exc.exceptionType || 'UNKNOWN';
    exceptionCounts[type] = (exceptionCounts[type] || 0) + 1;
  }

  console.log('');
  console.log('Reconciliation:');
  console.log(`Matched:            ${matched.length}`);
  console.log(`Exceptions:         ${exceptions.length}`);
  console.log('');
  console.log('Match Rates:');
  console.log(`  Payment Match Rate:   ${paymentMatchRate.toFixed(2)}%`);
  console.log(`  Bank Match Rate:      ${bankMatchRate.toFixed(2)}%`);
  console.log(`  Invoice Match Rate:   ${invoiceMatchRate.toFixed(2)}%`);

  console.log('');
  console.log('Exceptions:');
  for (const [type, count] of Object.entries(exceptionCounts).sort((a, b) => b[1] - a[1])) {
    const label = type.padEnd(30);
    console.log(`${label} ${count}`);
  }

  const totalRecords = payments.length + bankTransactions.length + invoices.length;
  const throughput = calculateThroughput(totalRecords, processingTimeMs);

  console.log('');
  console.log('Performance:');
  console.log(`Processing Time:     ${processingTimeMs} ms`);
  console.log(`Throughput:          ${throughput} records/sec`);

  let evaluation = null;
  let overallMetrics = null;
  let perScenarioMetrics = null;
  let exceptionDetection = null;
  let exceptionClassification = null;

  try {
    const groundTruthPath = path.join(dataDir, 'ground-truth.json');
    const groundTruth = loadGroundTruth(groundTruthPath);
    const groundTruthIndex = buildGroundTruthIndex(groundTruth);

    evaluation = evaluatePredictions(results, groundTruthIndex);
    overallMetrics = calculateOverallMetrics(evaluation);
    perScenarioMetrics = calculatePerScenarioMetrics(evaluation, [
      'AMOUNT_MISMATCH',
      'MISSING_BANK_TRANSACTION',
      'DUPLICATE_BANK_TRANSACTION',
      'DATE_MISMATCH',
      'UNMATCHED',
    ]);

    exceptionDetection = calculateExceptionDetection(evaluation);
    exceptionClassification = calculateExceptionClassification(evaluation);
    const scenarioAccuracy = calculateScenarioAccuracy(evaluation);
    const bankMatchAccuracy = calculateBankMatchAccuracy(evaluation);

    console.log('');
    console.log('Evaluation:');
    console.log(`Overall Accuracy:    ${(scenarioAccuracy * 100).toFixed(2)}%`);
    console.log(`Bank Match Accuracy: ${(bankMatchAccuracy * 100).toFixed(2)}%`);

    console.log('');
    console.log('Exception Detection (Binary):');
    console.log(`  Precision: ${(exceptionDetection.precision * 100).toFixed(2)}%`);
    console.log(`  Recall:    ${(exceptionDetection.recall * 100).toFixed(2)}%`);
    console.log(`  F1 Score:  ${(exceptionDetection.f1 * 100).toFixed(2)}%`);
    console.log(`  Accuracy:  ${(exceptionDetection.accuracy * 100).toFixed(2)}%`);
    console.log(`  TP: ${exceptionDetection.truePositives}  FP: ${exceptionDetection.falsePositives}  FN: ${exceptionDetection.falseNegatives}  TN: ${exceptionDetection.trueNegatives}`);

    console.log('');
    console.log('Exception Classification (Per-Category):');
    for (const [category, metrics] of Object.entries(exceptionClassification)) {
      console.log(`  ${category}:`);
      console.log(`    Precision: ${metrics.precision.toFixed(4)}  Recall: ${metrics.recall.toFixed(4)}  F1: ${metrics.f1.toFixed(4)}`);
      console.log(`    TP: ${metrics.truePositives}  FP: ${metrics.falsePositives}  FN: ${metrics.falseNegatives}`);
    }

    console.log('');
    console.log('Per-Scenario Metrics:');
    for (const [scenario, metrics] of Object.entries(perScenarioMetrics)) {
      console.log(`  ${scenario}:`);
      console.log(`    Precision: ${metrics.precision.toFixed(4)}  Recall: ${metrics.recall.toFixed(4)}  F1: ${metrics.f1.toFixed(4)}`);
    }

    console.log('');
    console.log('Ground Truth:');
    console.log('\u2713 Evaluation completed');
  } catch (error) {
    console.log('');
    console.log('Ground Truth:');
    console.log(`\u2717 Evaluation skipped: ${error.message}`);
  }

  const outputResults = results.map((r) => ({
    paymentId: r.paymentId,
    bankTransactionId: r.bankTransactionId,
    invoiceId: r.invoiceId,
    status: r.status,
    exceptionType: r.exceptionType || null,
    matchMethod: r.matchMethod,
    confidence: r.confidence,
    paymentAmount: r.paymentAmount,
    bankAmount: r.bankAmount,
    invoiceAmount: r.invoiceAmount,
    amountDifference: r.amountDifference,
    dateDifferenceDays: r.dateDifferenceDays,
  }));

  const outputMetrics = {
    inputRecords: {
      payments: payments.length,
      bankTransactions: bankTransactions.length,
      invoices: invoices.length,
    },
    matchedRecords: matched.length,
    exceptionRecords: exceptions.length,
    matchRates: {
      payment: paymentMatchRate,
      bank: bankMatchRate,
      invoice: invoiceMatchRate,
    },
    processingTimeMs,
    recordsPerSecond: throughput,
    exceptionDistribution: exceptionCounts,
    evaluation: {
      overallAccuracy: exceptionDetection ? exceptionDetection.accuracy : null,
      exceptionDetection: exceptionDetection || null,
      exceptionClassification: exceptionClassification || null,
      perScenarioMetrics: perScenarioMetrics || null,
    },
  };

  const resultsPath = path.join(dataDir, 'reconciliation-results.json');
  const metricsPath = path.join(dataDir, 'reconciliation-metrics.json');

  fs.writeFileSync(resultsPath, JSON.stringify(outputResults, null, 2));
  fs.writeFileSync(metricsPath, JSON.stringify(outputMetrics, null, 2));

  console.log('');
  console.log('Output:');
  console.log('\u2713 reconciliation-results.json');
  console.log('\u2713 reconciliation-metrics.json');
  console.log('');
  console.log('\u2501'.repeat(50));
}

main();
