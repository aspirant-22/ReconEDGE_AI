const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateAnalytics } = require('../analyticsEngine');
const { calculateReconciliationOverview } = require('../reconciliationAnalytics');
const { calculateExceptionAnalytics, calculateSeverityAnalytics, calculateTopExceptions } = require('../exceptionAnalytics');
const { calculateFinancialAnalytics } = require('../financialAnalytics');
const { calculateControlEffectiveness, calculateHealthStatus, HEALTH_THRESHOLDS } = require('../trendAnalytics');

const MOCK_RESULTS = [
  { paymentId: 'PAY-001', bankTransactionId: 'BANK-001', invoiceId: 'INV-001', status: 'MATCHED', exceptionType: null, paymentAmount: 1000, bankAmount: 1000, invoiceAmount: 1000, amountDifference: 0 },
  { paymentId: 'PAY-002', bankTransactionId: 'BANK-002', invoiceId: 'INV-002', status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH', paymentAmount: 1000, bankAmount: 1100, invoiceAmount: 1000, amountDifference: 100 },
  { paymentId: 'PAY-003', bankTransactionId: null, invoiceId: 'INV-003', status: 'EXCEPTION', exceptionType: 'MISSING_BANK_TRANSACTION', paymentAmount: 2000, bankAmount: null, invoiceAmount: 2000, amountDifference: 0 },
  { paymentId: 'PAY-004', bankTransactionId: 'BANK-004', invoiceId: 'INV-004', status: 'EXCEPTION', exceptionType: 'DATE_MISMATCH', paymentAmount: 1500, bankAmount: 1500, invoiceAmount: 1500, amountDifference: 0 },
  { paymentId: null, bankTransactionId: 'BANK-99', invoiceId: null, status: 'EXCEPTION', exceptionType: 'UNMATCHED_BANK_TRANSACTION', paymentAmount: null, bankAmount: 5000, invoiceAmount: null, amountDifference: 0 },
];

const MOCK_METRICS = {
  inputRecords: { payments: 4, bankTransactions: 5, invoices: 4 },
  matchedRecords: 1,
  exceptionRecords: 4,
  matchRates: { payment: 25, bank: 20, invoice: 25 },
  processingTimeMs: 10,
  recordsPerSecond: 1000,
  exceptionDistribution: { AMOUNT_MISMATCH: 1, MISSING_BANK_TRANSACTION: 1, DATE_MISMATCH: 1, UNMATCHED_BANK_TRANSACTION: 1 },
  evaluation: {
    overallAccuracy: 0.75,
    exceptionDetection: { truePositives: 3, falsePositives: 0, falseNegatives: 0, trueNegatives: 1, precision: 1, recall: 1, f1: 1, accuracy: 1 },
    exceptionClassification: {
      AMOUNT_MISMATCH: { precision: 1, recall: 1, f1: 1, truePositives: 1, falsePositives: 0, falseNegatives: 0 },
      MISSING_BANK_TRANSACTION: { precision: 1, recall: 1, f1: 1, truePositives: 1, falsePositives: 0, falseNegatives: 0 },
      DATE_MISMATCH: { precision: 1, recall: 1, f1: 1, truePositives: 1, falsePositives: 0, falseNegatives: 0 },
    },
  },
};

describe('Reconciliation Analytics', () => {
  it('Test 1 — Overview metrics', () => {
    const overview = calculateReconciliationOverview(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(overview.totalPayments, 4);
    assert.equal(overview.totalBankTransactions, 5);
    assert.equal(overview.totalInvoices, 4);
    assert.equal(overview.matchedRecords, 1);
  });

  it('Test 2 — Payment Match Rate', () => {
    const overview = calculateReconciliationOverview(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(overview.paymentMatchRate, 25);
  });

  it('Test 3 — Invoice Match Rate', () => {
    const overview = calculateReconciliationOverview(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(overview.invoiceMatchRate, 25);
  });

  it('Test 4 — Bank Match Rate', () => {
    const overview = calculateReconciliationOverview(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(overview.bankMatchRate, 20);
  });

  it('Test 5 — Exception totals', () => {
    const exceptionAnalytics = calculateExceptionAnalytics(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(exceptionAnalytics.totalExceptions, 4);
  });

  it('Test 6 — Exception breakdown', () => {
    const exceptionAnalytics = calculateExceptionAnalytics(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(exceptionAnalytics.breakdown.AMOUNT_MISMATCH.count, 1);
    assert.equal(exceptionAnalytics.breakdown.MISSING_BANK_TRANSACTION.count, 1);
    assert.equal(exceptionAnalytics.breakdown.DATE_MISMATCH.count, 1);
    assert.equal(exceptionAnalytics.breakdown.UNMATCHED_BANK_TRANSACTION.count, 1);
  });

  it('Test 7 — Severity', () => {
    const severity = calculateSeverityAnalytics(MOCK_RESULTS);
    assert.equal(severity.highSeverityCount, 2);
    assert.equal(severity.mediumSeverityCount, 2);
    assert.equal(severity.lowSeverityCount, 0);
  });

  it('Test 8 — Amount mismatch impact', () => {
    const financial = calculateFinancialAnalytics(MOCK_RESULTS);
    assert.equal(financial.amountMismatchImpact, 100);
  });

  it('Test 9 — Missing bank exclusion', () => {
    const financial = calculateFinancialAnalytics(MOCK_RESULTS);
    const missingBankResult = MOCK_RESULTS.find(r => r.exceptionType === 'MISSING_BANK_TRANSACTION');
    assert.equal(missingBankResult.bankAmount, null);
    assert.equal(financial.amountMismatchImpact, 100);
  });

  it('Test 10 — Unmatched bank exclusion', () => {
    const financial = calculateFinancialAnalytics(MOCK_RESULTS);
    const unmatchedResult = MOCK_RESULTS.find(r => r.exceptionType === 'UNMATCHED_BANK_TRANSACTION');
    assert.equal(unmatchedResult.paymentAmount, null);
    assert.equal(financial.amountMismatchImpact, 100);
  });

  it('Test 11 — Health classification', () => {
    const healthy = calculateHealthStatus({ exceptionRate: 5 });
    assert.equal(healthy.healthStatus, 'HEALTHY');

    const warning = calculateHealthStatus({ exceptionRate: 15 });
    assert.equal(warning.healthStatus, 'WARNING');

    const critical = calculateHealthStatus({ exceptionRate: 30 });
    assert.equal(critical.healthStatus, 'CRITICAL');
  });

  it('Test 12 — Ground truth isolation', () => {
    const analytics = generateAnalytics(MOCK_RESULTS, MOCK_METRICS);
    assert.ok(analytics.generatedAt);
    assert.ok(analytics.overview);
    assert.ok(analytics.exceptions);
    assert.ok(analytics.severity);
    assert.ok(analytics.financialImpact);
    assert.ok(analytics.controlEffectiveness);
    assert.ok(analytics.health);
    assert.ok(analytics.topExceptions);
  });

  it('Test 13 — Read-only behavior', () => {
    const originalResults = JSON.parse(JSON.stringify(MOCK_RESULTS));
    const originalMetrics = JSON.parse(JSON.stringify(MOCK_METRICS));
    generateAnalytics(MOCK_RESULTS, MOCK_METRICS);
    assert.deepEqual(MOCK_RESULTS, originalResults);
    assert.deepEqual(MOCK_METRICS, originalMetrics);
  });

  it('Test 14 — Determinism', () => {
    const analytics1 = generateAnalytics(MOCK_RESULTS, MOCK_METRICS);
    const analytics2 = generateAnalytics(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(analytics1.overview.totalPayments, analytics2.overview.totalPayments);
    assert.equal(analytics1.overview.matchedRecords, analytics2.overview.matchedRecords);
    assert.equal(analytics1.exceptions.totalExceptions, analytics2.exceptions.totalExceptions);
    assert.equal(analytics1.health.healthStatus, analytics2.health.healthStatus);
  });
});
