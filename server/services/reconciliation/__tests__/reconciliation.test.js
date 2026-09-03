const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { reconcile } = require('../reconciliationEngine');
const { classifyException, classifyAllResults } = require('../exceptionClassifier');
const { evaluatePredictions, calculateExceptionDetection, calculateExceptionClassification } = require('../evaluator');
const { calculatePaymentMatchRate, calculateBankMatchRate, calculateInvoiceMatchRate } = require('../metrics');

describe('Reconciliation Engine', () => {
  it('should detect unmatched bank transactions from residual scan', () => {
    const payments = [
      { paymentId: 'PAY-001', orderId: 'ORD-001', customerId: 'CUST-001', amount: 1000, currency: 'INR', paymentDate: '2026-07-15', description: 'Order 001' },
    ];
    const bankTransactions = [
      { bankTransactionId: 'BANK-001', referenceId: 'UNKNOWN-REF', amount: 500, transactionDate: '2026-07-16', currency: 'INR', type: 'CREDIT', status: 'SETTLED', description: 'Unknown' },
    ];
    const invoices = [
      { invoiceId: 'INV-001', orderId: 'ORD-001', customerId: 'CUST-001', invoiceAmount: 1000, currency: 'INR', invoiceDate: '2026-07-10', description: 'Invoice 001' },
    ];

    const results = reconcile(payments, bankTransactions, invoices);
    const unmatchedBank = results.filter(r => r.exceptionType === 'UNMATCHED_BANK_TRANSACTION');
    assert.equal(unmatchedBank.length, 1);
    assert.equal(unmatchedBank[0].bankTransactionId, 'BANK-001');
    assert.equal(unmatchedBank[0].paymentId, null);
  });

  it('should not overwrite residual scan entries in classifier', () => {
    const residualEntry = {
      paymentId: null,
      bankTransactionId: 'BANK-999',
      status: 'EXCEPTION',
      exceptionType: 'UNMATCHED_BANK_TRANSACTION',
    };
    const classified = classifyException(residualEntry);
    assert.equal(classified.status, 'EXCEPTION');
    assert.equal(classified.exceptionType, 'UNMATCHED_BANK_TRANSACTION');
  });

  it('should classify payment exceptions correctly', () => {
    const results = [
      { paymentId: 'PAY-001', bankTransactionId: null, invoiceId: 'INV-001', isDuplicate: false, hasAmountMismatch: false, hasDateMismatch: false, paymentAmount: 1000 },
      { paymentId: 'PAY-002', bankTransactionId: 'BANK-002', invoiceId: 'INV-002', isDuplicate: false, hasAmountMismatch: true, hasDateMismatch: false, paymentAmount: 1000, bankAmount: 1100, amountDifference: 100 },
      { paymentId: 'PAY-003', bankTransactionId: 'BANK-003', invoiceId: 'INV-003', isDuplicate: true, hasAmountMismatch: false, hasDateMismatch: false, paymentAmount: 1000 },
      { paymentId: 'PAY-004', bankTransactionId: 'BANK-004', invoiceId: 'INV-004', isDuplicate: false, hasAmountMismatch: false, hasDateMismatch: true, paymentAmount: 1000, dateDifferenceDays: 10 },
    ];
    const classified = classifyAllResults(results);
    assert.equal(classified[0].exceptionType, 'MISSING_BANK_TRANSACTION');
    assert.equal(classified[1].exceptionType, 'AMOUNT_MISMATCH');
    assert.equal(classified[2].exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(classified[3].exceptionType, 'DATE_MISMATCH');
  });

  it('should calculate separate match rates', () => {
    const results = [
      { paymentId: 'PAY-001', bankTransactionId: 'BANK-001', invoiceId: 'INV-001', status: 'MATCHED' },
      { paymentId: 'PAY-002', bankTransactionId: null, invoiceId: 'INV-002', status: 'EXCEPTION' },
      { paymentId: 'PAY-003', bankTransactionId: 'BANK-003', invoiceId: 'INV-003', status: 'MATCHED' },
      { paymentId: null, bankTransactionId: 'BANK-004', invoiceId: null, status: 'EXCEPTION' },
    ];
    assert.equal(calculatePaymentMatchRate(results), 66.67);
    assert.equal(calculateBankMatchRate(results), 66.67);
    assert.equal(calculateInvoiceMatchRate(results), 66.67);
  });
});

describe('Evaluator', () => {
  it('should detect exceptions correctly', () => {
    const evaluation = [
      { paymentId: 'PAY-001', predictedScenario: 'MATCHED', expectedScenario: 'EXACT_MATCH' },
      { paymentId: 'PAY-002', predictedScenario: 'AMOUNT_MISMATCH', expectedScenario: 'AMOUNT_MISMATCH' },
      { paymentId: 'PAY-003', predictedScenario: 'MATCHED', expectedScenario: 'MISSING_BANK_TRANSACTION' },
      { paymentId: 'PAY-004', predictedScenario: 'DUPLICATE_BANK_TRANSACTION', expectedScenario: 'EXACT_MATCH' },
    ];
    const detection = calculateExceptionDetection(evaluation);
    assert.equal(detection.truePositives, 1);
    assert.equal(detection.falsePositives, 1);
    assert.equal(detection.falseNegatives, 1);
    assert.equal(detection.trueNegatives, 1);
  });

  it('should classify exceptions per category', () => {
    const evaluation = [
      { paymentId: 'PAY-001', predictedScenario: 'AMOUNT_MISMATCH', expectedScenario: 'AMOUNT_MISMATCH' },
      { paymentId: 'PAY-002', predictedScenario: 'AMOUNT_MISMATCH', expectedScenario: 'EXACT_MATCH' },
      { paymentId: 'PAY-003', predictedScenario: 'MATCHED', expectedScenario: 'MISSING_BANK_TRANSACTION' },
      { paymentId: 'PAY-004', predictedScenario: 'MISSING_BANK_TRANSACTION', expectedScenario: 'MISSING_BANK_TRANSACTION' },
    ];
    const classification = calculateExceptionClassification(evaluation);
    assert.equal(classification['AMOUNT_MISMATCH'].truePositives, 1);
    assert.equal(classification['AMOUNT_MISMATCH'].falsePositives, 1);
    assert.equal(classification['MISSING_BANK_TRANSACTION'].truePositives, 1);
    assert.equal(classification['MISSING_BANK_TRANSACTION'].falseNegatives, 1);
  });
});
