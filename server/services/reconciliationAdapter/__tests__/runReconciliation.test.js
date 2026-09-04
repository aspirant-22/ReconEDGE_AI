const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const adapterModule = require('../mongoDataAdapter');

// runReconciliation destructures loadRunData at require time, so we must stub
// the adapter BEFORE requiring the orchestrator.
let runReconciliationStub;
adapterModule.loadRunData = async () => FIXTURE;
runReconciliationStub = require('../runReconciliation').runReconciliation;

const runReconciliation = (...args) => runReconciliationStub(...args);

// Engine-shaped fixture: 5 payments -> 3 exact matches, 1 amount mismatch,
// 1 missing bank transaction.
const FIXTURE = {
  payments: [
    { paymentId: 'PAY-001', orderId: '', customerId: 'C-1', amount: 1000, currency: 'INR', paymentDate: new Date('2026-07-15'), description: '' },
    { paymentId: 'PAY-002', orderId: '', customerId: 'C-2', amount: 2000, currency: 'INR', paymentDate: new Date('2026-07-16'), description: '' },
    { paymentId: 'PAY-003', orderId: '', customerId: 'C-3', amount: 3000, currency: 'INR', paymentDate: new Date('2026-07-17'), description: '' },
    { paymentId: 'PAY-004', orderId: '', customerId: 'C-4', amount: 4000, currency: 'INR', paymentDate: new Date('2026-07-18'), description: '' },
    { paymentId: 'PAY-005', orderId: '', customerId: 'C-5', amount: 5000, currency: 'INR', paymentDate: new Date('2026-07-19'), description: '' },
  ],
  bankTransactions: [
    { bankTransactionId: 'BANK-001', referenceId: 'PAY-001', amount: 1000, currency: 'INR', transactionDate: new Date('2026-07-15'), description: '' },
    { bankTransactionId: 'BANK-002', referenceId: 'PAY-002', amount: 2000, currency: 'INR', transactionDate: new Date('2026-07-16'), description: '' },
    { bankTransactionId: 'BANK-003', referenceId: 'PAY-003', amount: 3000, currency: 'INR', transactionDate: new Date('2026-07-17'), description: '' },
    { bankTransactionId: 'BANK-004', referenceId: 'PAY-004', amount: 4500, currency: 'INR', transactionDate: new Date('2026-07-18'), description: '' },
  ],
  invoices: [
    { invoiceId: 'INV-001', orderId: '', customerId: 'C-1', invoiceAmount: 1000, currency: 'INR', invoiceDate: new Date('2026-07-10'), description: '' },
    { invoiceId: 'INV-002', orderId: '', customerId: 'C-2', invoiceAmount: 2000, currency: 'INR', invoiceDate: new Date('2026-07-11'), description: '' },
    { invoiceId: 'INV-003', orderId: '', customerId: 'C-3', invoiceAmount: 3000, currency: 'INR', invoiceDate: new Date('2026-07-12'), description: '' },
    { invoiceId: 'INV-004', orderId: '', customerId: 'C-4', invoiceAmount: 4000, currency: 'INR', invoiceDate: new Date('2026-07-13'), description: '' },
    { invoiceId: 'INV-005', orderId: '', customerId: 'C-5', invoiceAmount: 5000, currency: 'INR', invoiceDate: new Date('2026-07-14'), description: '' },
  ],
};

describe('Reconciliation Adapter — runReconciliation', () => {
  before(() => {
    adapterModule.loadRunData = async () => FIXTURE;
  });

  it('runs the deterministic engine and returns expected match/exception counts', async () => {
    const outcome = await runReconciliation('run-123', {
      payments: 5,
      bankTransactions: 4,
      invoices: 5,
      total: 14,
    });

    assert.equal(outcome.results.length, 5);
    assert.equal(outcome.matchedCount, 3);
    assert.equal(outcome.exceptionCount, 2);
    assert.equal(outcome.metrics.inputRecords.payments, 5);
    assert.equal(outcome.metrics.matchedRecords, 3);
    assert.equal(outcome.metrics.exceptionRecords, 2);
  });

  it('classifies amount mismatch and missing bank correctly', async () => {
    const outcome = await runReconciliation('run-123', {
      payments: 5, bankTransactions: 4, invoices: 5, total: 14,
    });
    const pay001 = outcome.results.find((r) => r.paymentId === 'PAY-001');
    const pay004 = outcome.results.find((r) => r.paymentId === 'PAY-004');
    const pay005 = outcome.results.find((r) => r.paymentId === 'PAY-005');

    assert.equal(pay001.status, 'MATCHED');
    assert.equal(pay001.bankTransactionId, 'BANK-001');
    assert.equal(pay004.status, 'EXCEPTION');
    assert.equal(pay004.exceptionType, 'AMOUNT_MISMATCH');
    assert.equal(pay005.status, 'EXCEPTION');
    assert.equal(pay005.exceptionType, 'MISSING_BANK_TRANSACTION');
    assert.equal(pay005.bankTransactionId, null);
  });

  it('maps dates and amounts onto result docs', async () => {
    const outcome = await runReconciliation('run-123', {
      payments: 5, bankTransactions: 4, invoices: 5, total: 14,
    });
    const pay001 = outcome.results.find((r) => r.paymentId === 'PAY-001');
    assert.equal(pay001.paymentAmount, 1000);
    assert.equal(pay001.bankAmount, 1000);
    assert.ok(pay001.paymentDate instanceof Date || pay001.paymentDate instanceof Date);
    assert.equal(pay001.paymentDate.getTime(), new Date('2026-07-15').getTime());
  });

  it('produces analytics and metrics', async () => {
    const outcome = await runReconciliation('run-123', {
      payments: 5, bankTransactions: 4, invoices: 5, total: 14,
    });
    assert.ok(outcome.analytics.overview);
    assert.ok(outcome.analytics.matching);
    assert.ok(outcome.analytics.financialImpact);
    assert.equal(typeof outcome.metrics.matchRates.payment, 'number');
    assert.equal(outcome.metrics.matchRates.payment, 60.0);
  });
});
