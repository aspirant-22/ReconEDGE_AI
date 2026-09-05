// Regression tests for the Phase 12.1 targeted classification fix.
//
// Contract: when a payment shares its business reference with a bank
// transaction and/or invoice, the engine must link them regardless of amount.
// Existing counterparts with a different amount => AMOUNT_MISMATCH; equal
// amounts => MATCHED; truly absent counterparts keep MISSING_*/UNMATCHED_*
// classifications; duplicate-reference couples stay one-to-one.
//
// These tests exercise the exact production path: canonical uploaded docs ->
// reconciliationAdapter (paymentToEngine/bankToEngine/invoiceToEngine) ->
// deterministic reconciliation engine.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { paymentToEngine, bankToEngine, invoiceToEngine } = require('../mongoDataAdapter');
const { reconcile } = require('../../reconciliation/reconciliationEngine');
const {
  buildIndexes,
  matchPaymentToBank,
  matchPaymentToInvoice,
} = require('../../reconciliation/matcher');
const {
  normalizePayment,
  normalizeBankTransaction,
  normalizeInvoice,
} = require('../../reconciliation/normalizer');
const {
  payments,
  bankTransactions,
  invoices,
  expected,
  expectedUnmatchedBanks,
} = require('./fixtures/phase121Fixture');

function run() {
  return reconcile(
    payments.map(paymentToEngine),
    bankTransactions.map(bankToEngine),
    invoices.map(invoiceToEngine)
  );
}

describe('Phase 12.1 — reference-based classification', () => {
  it('adapter forwards the payment and invoice references to the engine', () => {
    const enginePayment = paymentToEngine(payments[0]);
    const engineInvoice = invoiceToEngine(invoices[0]);
    assert.equal(enginePayment.referenceId, 'REF10008');
    assert.equal(engineInvoice.referenceId, 'REF10008');
    assert.equal(bankToEngine(bankTransactions[0]).referenceId, 'REF10008');
  });

  it('classifies the four targeted records as AMOUNT_MISMATCH with bank and invoice linked', () => {
    const results = run();
    const byPayment = new Map(results.map((r) => [r.paymentId, r]));

    for (const paymentId of ['PMT-50009', 'PMT-50012', 'PMT-50042', 'PMT-50030']) {
      const row = byPayment.get(paymentId);
      assert.ok(row, `missing result row for ${paymentId}`);
      assert.equal(row.status, 'EXCEPTION', `${paymentId} status`);
      assert.equal(row.exceptionType, 'AMOUNT_MISMATCH', `${paymentId} exceptionType`);
      assert.ok(row.bankTransactionId, `${paymentId} must link a bank transaction`);
      assert.ok(row.invoiceId, `${paymentId} must link an invoice`);
      assert.equal(row.hasAmountMismatch, true, `${paymentId} hasAmountMismatch`);
      assert.ok(row.hasAmountMismatch, `${paymentId} amount difference outstanding`);
    }

    assert.equal(byPayment.get('PMT-50030').bankTransactionId, 'TXN-900030');
    assert.equal(byPayment.get('PMT-50009').invoiceId, 'INV-10009');
    assert.equal(byPayment.get('PMT-50012').invoiceId, 'INV-10012');
    assert.equal(byPayment.get('PMT-50042').invoiceId, 'INV-10042');
  });

  it('keeps exact-reference equal-amount records MATCHED (CASE C)', () => {
    const results = run();
    const row = results.find((r) => r.paymentId === 'PMT-50100');
    assert.equal(row.status, 'MATCHED');
    assert.equal(row.exceptionType, null);
    assert.equal(row.bankTransactionId, 'TXN-90100');
    assert.equal(row.invoiceId, 'INV-100100');
  });

  it('keeps genuinely-missing bank records as MISSING_BANK_TRANSACTION (negative PMT-50003)', () => {
    const results = run();
    const row = results.find((r) => r.paymentId === 'PMT-50003');
    assert.equal(row.status, 'EXCEPTION');
    assert.equal(row.exceptionType, 'MISSING_BANK_TRANSACTION');
    assert.equal(row.bankTransactionId, null);
  });

  it('keeps banks with no matching payment as UNMATCHED_BANK_TRANSACTION', () => {
    const results = run();
    const unmatched = results.filter(
      (r) => r.paymentId === null && r.exceptionType === 'UNMATCHED_BANK_TRANSACTION'
    );
    const ids = unmatched.map((r) => r.bankTransactionId).sort();
    assert.deepEqual(ids, [...expectedUnmatchedBanks].sort());
  });

  it('resolves duplicate-reference couples deterministically to their own banks', () => {
    const results = run();
    const byPayment = new Map(results.map((r) => [r.paymentId, r]));

    assert.equal(byPayment.get('PMT-50015').exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(byPayment.get('PMT-50015').bankTransactionId, 'TXN-900015');
    assert.equal(byPayment.get('PMT-50016').exceptionType, 'DUPLICATE_PAYMENT');
    assert.equal(byPayment.get('PMT-50016').bankTransactionId, 'TXN-900016');

    assert.equal(byPayment.get('PMT-50047').exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(byPayment.get('PMT-50047').bankTransactionId, 'TXN-900046');
    assert.equal(byPayment.get('PMT-50048').exceptionType, 'DUPLICATE_PAYMENT');
    assert.equal(byPayment.get('PMT-50048').bankTransactionId, 'TXN-900047');

    const linkedBankIds = results
      .filter((r) => r.bankTransactionId)
      .map((r) => r.bankTransactionId);
    const counts = new Map();
    for (const id of linkedBankIds) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const [id, count] of counts) {
      assert.equal(count, 1, `bank ${id} must be linked to exactly one row`);
    }
  });

  it('matches the full post-fix expectation table', () => {
    const results = run();
    const byPayment = new Map(results.map((r) => [r.paymentId, r]));
    for (const [paymentId, expectation] of Object.entries(expected)) {
      const row = byPayment.get(paymentId);
      assert.ok(row, `missing result row for ${paymentId}`);
      assert.equal(row.status, expectation.status, `${paymentId} status`);
      assert.equal(row.exceptionType, expectation.exceptionType, `${paymentId} exceptionType`);
    }
  });

  it('consumes TXN-900030 for PMT-50030 and never emits it as UNMATCHED_BANK_TRANSACTION', () => {
    const results = run();
    const row = results.find((r) => r.paymentId === 'PMT-50030');
    assert.equal(row.bankTransactionId, 'TXN-900030');
    assert.equal(row.exceptionType, 'AMOUNT_MISMATCH');

    const unmatched = results.filter(
      (r) => r.exceptionType === 'UNMATCHED_BANK_TRANSACTION'
    );
    assert.ok(
      !unmatched.some((r) => r.bankTransactionId === 'TXN-900030'),
      'TXN-900030 must be consumed, not UNMATCHED_BANK_TRANSACTION'
    );
  });

  it('consumes matched bank candidates strictly one-to-one across the whole result set', () => {
    const results = run();
    const linked = results.filter((r) => r.bankTransactionId);
    const counts = new Map();
    for (const r of linked) {
      counts.set(r.bankTransactionId, (counts.get(r.bankTransactionId) || 0) + 1);
    }
    for (const [id, count] of counts) {
      assert.equal(count, 1, `bank ${id} must be linked to exactly one result row`);
    }
  });

  it('links invoices to their owning payments; only a shared payment/invoice couple re-uses an invoice', () => {
    const results = run();
    const byPayment = new Map(results.map((r) => [r.paymentId, r]));

    // Shared-invoice couple members legitimately point at the same invoice.
    assert.equal(byPayment.get('PMT-50015').invoiceId, 'INV-10015');
    assert.equal(byPayment.get('PMT-50016').invoiceId, 'INV-10015');
    assert.equal(byPayment.get('PMT-50047').invoiceId, 'INV-10047');
    assert.equal(byPayment.get('PMT-50048').invoiceId, 'INV-10047');

    const owners = new Map();
    for (const r of results) {
      if (!r.invoiceId || !r.paymentId) continue;
      if (!owners.has(r.invoiceId)) owners.set(r.invoiceId, []);
      owners.get(r.invoiceId).push(r.paymentId);
    }
    for (const [invId, paymentIds] of owners) {
      if (invId === 'INV-10015') {
        assert.deepEqual([...paymentIds].sort(), ['PMT-50015', 'PMT-50016']);
      } else if (invId === 'INV-10047') {
        assert.deepEqual([...paymentIds].sort(), ['PMT-50047', 'PMT-50048']);
      } else {
        assert.equal(paymentIds.length, 1, `invoice ${invId} must not be cross-wired`);
      }
    }
  });

  it('produces no duplicate MATCHED results and couples surface as DUPLICATE_*', () => {
    const results = run();
    const matched = results.filter((r) => r.status === 'MATCHED');
    const paymentIds = matched.map((r) => r.paymentId);
    assert.equal(new Set(paymentIds).size, matched.length, 'matched paymentIds must be unique');
    assert.ok(
      matched.every((r) => r.bankTransactionId && r.invoiceId),
      'no MATCHED row may be unmatched on bank or invoice'
    );
    const bankIds = matched.map((r) => r.bankTransactionId);
    const invoiceIds = matched.map((r) => r.invoiceId);
    assert.equal(new Set(bankIds).size, bankIds.length, 'no two MATCHED rows share a bank');
    assert.equal(new Set(invoiceIds).size, invoiceIds.length, 'no two MATCHED rows share an invoice');

    // Duplicate-reference couples: the shared reference must NOT yield two MATCHED rows.
    const byPayment = new Map(results.map((r) => [r.paymentId, r]));
    assert.equal(byPayment.get('PMT-50015').exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(byPayment.get('PMT-50016').exceptionType, 'DUPLICATE_PAYMENT');
    assert.equal(byPayment.get('PMT-50047').exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(byPayment.get('PMT-50048').exceptionType, 'DUPLICATE_PAYMENT');
  });

  it('applies deterministic reference precedence: equal->MATCHED, differs->AMOUNT_MISMATCH, absent->MISSING_*/UNMATCHED_*', () => {
    const results = run();
    const byPayment = new Map(results.map((r) => [r.paymentId, r]));

    // Case A - uniquely identifiable counterpart + same amount => MATCHED
    assert.equal(byPayment.get('PMT-50100').status, 'MATCHED');
    assert.equal(byPayment.get('PMT-50100').exceptionType, null);

    // Case D - shared reference with duplicate banks AND duplicate payments
    //          => DUPLICATE_BANK_TRANSACTION for the primary, DUPLICATE_PAYMENT
    //          for the redundant payment.
    assert.equal(byPayment.get('PMT-50015').exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(byPayment.get('PMT-50016').exceptionType, 'DUPLICATE_PAYMENT');
    assert.equal(byPayment.get('PMT-50047').exceptionType, 'DUPLICATE_BANK_TRANSACTION');
    assert.equal(byPayment.get('PMT-50048').exceptionType, 'DUPLICATE_PAYMENT');

    // Case B - uniquely identifiable counterpart + different amount => AMOUNT_MISMATCH
    for (const paymentId of ['PMT-50009', 'PMT-50012', 'PMT-50042', 'PMT-50030']) {
      const row = byPayment.get(paymentId);
      assert.equal(row.status, 'EXCEPTION', `${paymentId} status`);
      assert.equal(row.exceptionType, 'AMOUNT_MISMATCH', `${paymentId} exceptionType`);
    }

    // Case C - no legitimate counterpart => MISSING_* / UNMATCHED_*
    assert.equal(byPayment.get('PMT-50003').exceptionType, 'MISSING_BANK_TRANSACTION');
    const unmatched = results.filter(
      (r) => r.paymentId === null && r.exceptionType === 'UNMATCHED_BANK_TRANSACTION'
    );
    assert.deepEqual(
      unmatched.map((r) => r.bankTransactionId).sort(),
      ['TXN-900005', 'TXN-900051', 'TXN-900052', 'TXN-900053']
    );
  });

  it('does not weaken candidate uniqueness for ambiguous bank references', () => {
    const banks = [
      { bankTransactionId: 'B-A1', referenceId: 'REF-X', amount: 100, currency: 'INR', transactionDate: '2026-07-15', description: '' },
      { bankTransactionId: 'B-A2', referenceId: 'REF-X', amount: 101, currency: 'INR', transactionDate: '2026-07-15', description: '' },
    ].map(normalizeBankTransaction);
    const payment = normalizePayment({
      paymentId: 'P-X', orderId: 'O', customerId: 'C', referenceId: 'REF-X',
      amount: 100, currency: 'INR', paymentDate: '2026-07-15', description: '',
    });
    const indexes = buildIndexes(banks, []);
    const match = matchPaymentToBank(payment, indexes, new Set());
    assert.ok(match, 'ambiguous bank reference must surface a result');
    assert.equal(match.bankTransactionId, null, 'ambiguous bank reference must not assign a bank');
    assert.equal(match.isDuplicate, true, 'ambiguous bank reference must be flagged as duplicate');
  });

  it('does not weaken candidate uniqueness for ambiguous invoice references', () => {
    const invoiceDocs = [
      { invoiceId: 'INV-A1', orderId: 'O-Z', customerId: 'C-Z', invoiceAmount: 500, currency: 'INR', invoiceDate: '2026-07-10', referenceId: 'REF-Y', description: '' },
      { invoiceId: 'INV-A2', orderId: 'O-W', customerId: 'C-W', invoiceAmount: 500, currency: 'INR', invoiceDate: '2026-07-10', referenceId: 'REF-Y', description: '' },
    ].map(normalizeInvoice);
    const payment = normalizePayment({
      paymentId: 'P-Y', orderId: 'O', customerId: 'C', referenceId: 'REF-Y',
      amount: 500, currency: 'INR', paymentDate: '2026-07-15', description: '',
    });
    const indexes = buildIndexes([], invoiceDocs);
    const match = matchPaymentToInvoice(payment, indexes, new Set());
    assert.equal(match, null, 'ambiguous invoice reference must not blind-link');
  });
});