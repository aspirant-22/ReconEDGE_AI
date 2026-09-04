// Run-specific reconciliation orchestration.
//
// Loads a run's canonical data from MongoDB via the Mongo data adapter, runs the
// EXISTING Phase 3 deterministic engine, computes metrics and analytics using the
// EXISTING Phase 3/4 services, and returns everything needed to persist results.
//
// No ground truth is used anywhere in this flow.

const { reconcile } = require('../reconciliation/reconciliationEngine');
const {
  calculatePaymentMatchRate,
  calculateBankMatchRate,
  calculateInvoiceMatchRate,
} = require('../reconciliation/metrics');
const { generateAnalytics } = require('../analytics/analyticsEngine');
const { loadRunData } = require('./mongoDataAdapter');

function buildIdMap(payments, bankTransactions, invoices) {
  const paymentById = new Map(payments.map((p) => [p.paymentId, p]));
  const bankById = new Map(bankTransactions.map((b) => [b.bankTransactionId, b]));
  const invoiceById = new Map(invoices.map((i) => [i.invoiceId, i]));
  return { paymentById, bankById, invoiceById };
}

function resultToDoc(result, maps) {
  const payment = maps.paymentById.get(result.paymentId);
  const bank = result.bankTransactionId ? maps.bankById.get(result.bankTransactionId) : null;
  const invoice = result.invoiceId ? maps.invoiceById.get(result.invoiceId) : null;

  return {
    paymentId: result.paymentId || null,
    bankTransactionId: result.bankTransactionId || null,
    invoiceId: result.invoiceId || null,
    status: result.status,
    exceptionType: result.exceptionType || null,
    matchMethod: result.matchMethod || null,
    confidence: result.confidence || 0,
    paymentAmount: result.paymentAmount != null ? Number(result.paymentAmount) : null,
    bankAmount: result.bankAmount != null ? Number(result.bankAmount) : null,
    invoiceAmount: result.invoiceAmount != null ? Number(result.invoiceAmount) : null,
    amountDifference: result.amountDifference != null ? Number(result.amountDifference) : null,
    invoiceAmountDifference: result.invoiceAmountDifference != null ? Number(result.invoiceAmountDifference) : null,
    dateDifferenceDays: result.dateDifferenceDays != null ? Number(result.dateDifferenceDays) : null,
    paymentDate: payment ? payment.paymentDate : null,
    bankDate: bank ? bank.transactionDate : null,
    invoiceDate: invoice ? invoice.invoiceDate : null,
  };
}

async function runReconciliation(runId, inputCounts) {
  const startTime = Date.now();

  const data = await loadRunData(runId);
  const maps = buildIdMap(data.payments, data.bankTransactions, data.invoices);

  const results = reconcile(data.payments, data.bankTransactions, data.invoices);

  const matched = results.filter((r) => r.status === 'MATCHED');
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');

  const paymentMatchRate = calculatePaymentMatchRate(results);
  const bankMatchRate = calculateBankMatchRate(results);
  const invoiceMatchRate = calculateInvoiceMatchRate(results);

  const exceptionDistribution = {};
  for (const exc of exceptions) {
    const type = exc.exceptionType || 'UNKNOWN';
    exceptionDistribution[type] = (exceptionDistribution[type] || 0) + 1;
  }

  const processingTimeMs = Date.now() - startTime;

  const metrics = {
    inputRecords: {
      payments: inputCounts.payments,
      bankTransactions: inputCounts.bankTransactions,
      invoices: inputCounts.invoices,
    },
    matchedRecords: matched.length,
    exceptionRecords: exceptions.length,
    matchRates: {
      payment: paymentMatchRate,
      bank: bankMatchRate,
      invoice: invoiceMatchRate,
    },
    processingTimeMs,
    recordsPerSecond: inputCounts.total > 0 ? Number((inputCounts.total / (processingTimeMs / 1000)).toFixed(2)) : 0,
    exceptionDistribution,
    // No ground truth is available for real uploaded data, so ground-truth
    // evaluation metrics are not computable here. They are set to zero to keep
    // the locked analytics pipeline intact; they are never displayed for real runs.
    evaluation: {
      exceptionDetection: { accuracy: 0, precision: 0, recall: 0, f1: 0 },
      exceptionClassification: {},
      perScenario: {},
      overall: {},
    },
  };

  const analytics = generateAnalytics(results, metrics);

  const resultDocs = results.map((r) => resultToDoc(r, maps));

  return {
    results: resultDocs,
    matchedCount: matched.length,
    exceptionCount: exceptions.length,
    processingTimeMs,
    metrics,
    analytics,
  };
}

module.exports = { runReconciliation, resultToDoc };
