const fs = require('fs');
const path = require('path');
const { createRandom } = require('./random');
const { generatePayments } = require('./generators/paymentGenerator');
const { generateBankTransactions } = require('./generators/bankGenerator');
const { generateInvoices } = require('./generators/invoiceGenerator');
const { assignScenarios, applyAnomalies, SCENARIO_DISTRIBUTION } = require('./anomalies');
const { validateDataset } = require('./validate');
const { jsonToCsv } = require('./csvWriter');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { count: 500, seed: 42 };

  for (const arg of args) {
    if (arg.startsWith('--count=')) {
      config.count = parseInt(arg.split('=')[1], 10);
    }
    if (arg.startsWith('--seed=')) {
      config.seed = parseInt(arg.split('=')[1], 10);
    }
  }

  return config;
}

function ensureOutputDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeCsv(filePath, data, headers) {
  const csv = jsonToCsv(data, headers);
  fs.writeFileSync(filePath, csv);
}

function main() {
  const config = parseArgs();
  const outputDir = path.join(__dirname, '..', '..', '..', 'data', 'generated');

  ensureOutputDir(outputDir);

  const rng = createRandom(config.seed);
  const startDate = new Date('2026-07-01');
  const endDate = new Date('2026-08-31');

  const payments = generatePayments(rng, config.count, startDate, endDate);
  const bankTransactions = generateBankTransactions(rng, payments, startDate, endDate);
  const invoices = generateInvoices(rng, payments, startDate, endDate);

  const { scenarios, counts: scenarioDistribution } = assignScenarios(rng, config.count);

  const result = applyAnomalies(rng, payments, bankTransactions, invoices, scenarios);

  const validation = validateDataset(
    result.payments,
    result.bankTransactions,
    result.invoices,
    result.groundTruth,
    result.scenarioCounts
  );

  if (!validation.valid) {
    console.error('Dataset validation FAILED:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  writeJson(path.join(outputDir, 'payments.json'), result.payments);
  writeJson(path.join(outputDir, 'bank-transactions.json'), result.bankTransactions);
  writeJson(path.join(outputDir, 'invoices.json'), result.invoices);
  writeJson(path.join(outputDir, 'ground-truth.json'), result.groundTruth);

  const paymentHeaders = [
    'paymentId', 'orderId', 'customerId', 'amount', 'currency',
    'paymentDate', 'paymentMethod', 'status', 'gateway', 'description',
  ];
  const bankHeaders = [
    'bankTransactionId', 'referenceId', 'amount', 'transactionDate',
    'currency', 'type', 'status', 'description',
  ];
  const invoiceHeaders = [
    'invoiceId', 'orderId', 'customerId', 'invoiceAmount', 'invoiceDate',
    'currency', 'status', 'description',
  ];

  writeCsv(path.join(outputDir, 'payments.csv'), result.payments, paymentHeaders);
  writeCsv(path.join(outputDir, 'bank-transactions.csv'), result.bankTransactions, bankHeaders);
  writeCsv(path.join(outputDir, 'invoices.csv'), result.invoices, invoiceHeaders);

  const summary = {
    seed: config.seed,
    generatedAt: new Date().toISOString(),
    paymentRecords: result.payments.length,
    bankRecords: result.bankTransactions.length,
    invoiceRecords: result.invoices.length,
    scenarios: result.scenarioCounts,
  };

  writeJson(path.join(outputDir, 'dataset-summary.json'), summary);

  console.log('');
  console.log('\u2501'.repeat(48));
  console.log('ReconEDGE AI \u2014 Synthetic Data Generator');
  console.log('\u2501'.repeat(48));
  console.log('');
  console.log(`Seed: ${config.seed}`);
  console.log('');
  console.log(`Payments:           ${result.payments.length}`);
  console.log(`Bank Transactions:  ${result.bankTransactions.length}`);
  console.log(`Invoices:           ${result.invoices.length}`);
  console.log('');
  console.log('Scenarios:');
  console.log(`\u2713 Exact Match:             ${result.scenarioCounts.EXACT_MATCH}`);
  console.log(`\u26A0 Amount Mismatch:          ${result.scenarioCounts.AMOUNT_MISMATCH}`);
  console.log(`\u26A0 Missing Bank:             ${result.scenarioCounts.MISSING_BANK_TRANSACTION}`);
  console.log(`\u26A0 Duplicate Bank:           ${result.scenarioCounts.DUPLICATE_BANK_TRANSACTION}`);
  console.log(`\u26A0 Date Mismatch:            ${result.scenarioCounts.DATE_MISMATCH}`);
  console.log(`\u26A0 Unmatched Bank:           ${result.scenarioCounts.UNMATCHED_BANK_TRANSACTION}`);
  console.log('');
  console.log('Ground Truth:        VALID');
  console.log('Dataset Validation:  PASSED');
  console.log('');
  console.log('Files generated:');
  console.log('\u2713 payments.json');
  console.log('\u2713 bank-transactions.json');
  console.log('\u2713 invoices.json');
  console.log('\u2713 ground-truth.json');
  console.log('\u2713 dataset-summary.json');
  console.log('\u2713 payments.csv');
  console.log('\u2713 bank-transactions.csv');
  console.log('\u2713 invoices.csv');
  console.log('');
  console.log('\u2501'.repeat(48));
}

main();
