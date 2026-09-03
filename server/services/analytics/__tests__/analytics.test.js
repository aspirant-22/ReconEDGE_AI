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

  it('Test 15 — Exception rate consistency', () => {
    const exceptionAnalytics = calculateExceptionAnalytics(MOCK_RESULTS, MOCK_METRICS);
    const overview = calculateReconciliationOverview(MOCK_RESULTS, MOCK_METRICS);
    assert.equal(exceptionAnalytics.exceptionRate, overview.exceptionRate);
    const expectedRate = Number(((MOCK_METRICS.exceptionRecords / MOCK_METRICS.inputRecords.payments) * 100).toFixed(2));
    assert.equal(exceptionAnalytics.exceptionRate, expectedRate);
    assert.notEqual(exceptionAnalytics.exceptionRate, Number(((MOCK_METRICS.exceptionRecords / MOCK_RESULTS.length) * 100).toFixed(2)));
  });

  it('Test 16 — Control score removed', () => {
    const analytics = generateAnalytics(MOCK_RESULTS, MOCK_METRICS);
    assert.ok(!('controlEffectivenessScore' in analytics.controlEffectiveness));
    assert.ok('reconciliationRate' in analytics.controlEffectiveness);
    assert.ok('exceptionRate' in analytics.controlEffectiveness);
    assert.ok('cleanMatchRate' in analytics.controlEffectiveness);
    assert.ok('exceptionDetectionPrecision' in analytics.controlEffectiveness);
    assert.ok('exceptionDetectionRecall' in analytics.controlEffectiveness);
    assert.ok('exceptionDetectionF1' in analytics.controlEffectiveness);
  });

  it('Test 17 — Zero amounts included', () => {
    const zeroResults = [
      { paymentId: 'PAY-Z1', bankTransactionId: 'BANK-Z1', invoiceId: 'INV-Z1', status: 'MATCHED', exceptionType: null, paymentAmount: 0, bankAmount: 0, invoiceAmount: 0, amountDifference: 0 },
      { paymentId: 'PAY-Z2', bankTransactionId: 'BANK-Z2', invoiceId: 'INV-Z2', status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH', paymentAmount: 0, bankAmount: 100, invoiceAmount: 0, amountDifference: 100 },
    ];
    const zeroMetrics = {
      inputRecords: { payments: 2, bankTransactions: 2, invoices: 2 },
      matchedRecords: 1,
      exceptionRecords: 1,
      matchRates: { payment: 50, bank: 50, invoice: 50 },
      evaluation: {
        exceptionDetection: { truePositives: 1, falsePositives: 0, falseNegatives: 0, trueNegatives: 1, precision: 1, recall: 1, f1: 1, accuracy: 1 },
        exceptionClassification: { AMOUNT_MISMATCH: { precision: 1, recall: 1, f1: 1, truePositives: 1, falsePositives: 0, falseNegatives: 0 } },
      },
    };
    const financial = calculateFinancialAnalytics(zeroResults);
    assert.equal(financial.totalPaymentAmount, 0);
    assert.equal(financial.totalBankAmount, 100);
    assert.equal(financial.totalInvoiceAmount, 0);
    assert.equal(financial.amountMismatchImpact, 100);
  });

  it('Test 18 — Financial precision (0.1 + 0.2 + 0.3)', () => {
    const precisionResults = [
      { paymentId: 'PAY-P1', bankTransactionId: 'BANK-P1', invoiceId: 'INV-P1', status: 'MATCHED', exceptionType: null, paymentAmount: 0.1, bankAmount: 0.1, invoiceAmount: 0.1, amountDifference: 0 },
      { paymentId: 'PAY-P2', bankTransactionId: 'BANK-P2', invoiceId: 'INV-P2', status: 'MATCHED', exceptionType: null, paymentAmount: 0.2, bankAmount: 0.2, invoiceAmount: 0.2, amountDifference: 0 },
      { paymentId: 'PAY-P3', bankTransactionId: 'BANK-P3', invoiceId: 'INV-P3', status: 'MATCHED', exceptionType: null, paymentAmount: 0.3, bankAmount: 0.3, invoiceAmount: 0.3, amountDifference: 0 },
    ];
    const financial = calculateFinancialAnalytics(precisionResults);
    assert.equal(financial.totalPaymentAmount, 0.6);
    assert.equal(financial.totalBankAmount, 0.6);
    assert.equal(financial.totalInvoiceAmount, 0.6);
    assert.equal(financial.matchedPaymentAmount, 0.6);
  });

  it('Test 19 — Amount mismatch precise', () => {
    const mismatchResults = [
      { paymentId: 'PAY-M1', bankTransactionId: 'BANK-M1', invoiceId: 'INV-M1', status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH', paymentAmount: 1000.25, bankAmount: 1100.50, invoiceAmount: 1000.25, amountDifference: 100.25 },
    ];
    const financial = calculateFinancialAnalytics(mismatchResults);
    assert.equal(financial.amountMismatchImpact, 100.25);
  });

  it('Test 20 — Duplicate bank does not double-count', () => {
    const duplicateResults = [
      { paymentId: 'PAY-D1', bankTransactionId: 'BANK-D1', invoiceId: 'INV-D1', status: 'MATCHED', exceptionType: null, paymentAmount: 500, bankAmount: 500, invoiceAmount: 500, amountDifference: 0 },
      { paymentId: 'PAY-D2', bankTransactionId: 'BANK-D1', invoiceId: 'INV-D2', status: 'EXCEPTION', exceptionType: 'DUPLICATE_BANK_TRANSACTION', paymentAmount: 300, bankAmount: 500, invoiceAmount: 300, amountDifference: 200 },
    ];
    const financial = calculateFinancialAnalytics(duplicateResults);
    assert.equal(financial.totalPaymentAmount, 800);
    assert.equal(financial.totalBankAmount, 500);
    assert.equal(financial.totalInvoiceAmount, 800);
  });

  it('Test 21 — Missing bank does not contribute to amount mismatch', () => {
    const missingResults = [
      { paymentId: 'PAY-X1', bankTransactionId: null, invoiceId: 'INV-X1', status: 'EXCEPTION', exceptionType: 'MISSING_BANK_TRANSACTION', paymentAmount: 5000, bankAmount: null, invoiceAmount: 5000, amountDifference: 0 },
    ];
    const financial = calculateFinancialAnalytics(missingResults);
    assert.equal(financial.amountMismatchImpact, 0);
    assert.equal(financial.totalPaymentAmount, 5000);
    assert.equal(financial.totalBankAmount, 0);
  });

  it('Test 22 — Unmatched bank does not contribute to payment-side amount mismatch', () => {
    const unmatchedResults = [
      { paymentId: null, bankTransactionId: 'BANK-U1', invoiceId: null, status: 'EXCEPTION', exceptionType: 'UNMATCHED_BANK_TRANSACTION', paymentAmount: null, bankAmount: 7000, invoiceAmount: null, amountDifference: 0 },
    ];
    const financial = calculateFinancialAnalytics(unmatchedResults);
    assert.equal(financial.amountMismatchImpact, 0);
    assert.equal(financial.totalPaymentAmount, 0);
    assert.equal(financial.totalBankAmount, 7000);
  });
});
