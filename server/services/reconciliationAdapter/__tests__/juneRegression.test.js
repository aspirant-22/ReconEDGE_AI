// Phase 12.1 — REAL-DATA regression tests (June reconciliation run).
//
// These tests run the ACTUAL production path against the REAL June CSV files
// (read-only fixtures copied from the run that exposed the regressions):
//
//   CSV -> csvParser -> column mapping -> dataNormalizer (canonical docs)
//        -> mongoDataAdapter (paymentToEngine/bankToEngine/invoiceToEngine)
//        -> deterministic reconciliation engine (normalizer/matcher/
//           duplicateDetector/exceptionClassifier)
//
// Contract:
//   - no bank transaction silently disappears (matched or UNMATCHED, exactly once)
//   - no payment silently disappears (exactly once)
//   - one bank per payment; a bank is never shared between payments
//   - duplicate-reference couples resolve deterministically: primary payment ->
//     DUPLICATE_BANK_TRANSACTION, redundant payment -> DUPLICATE_PAYMENT, each
//     keeping its own bank and the shared declared invoice (no cross-wiring)
//   - the four known-good AMOUNT_MISMATCH cases stay correct

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { parseCsvBuffer } = require('../../fileProcessing/csvParser');
const { detectMapping, applyManualMapping } = require('../../fileProcessing/columnMapper');
const { normalizeRecord } = require('../../fileProcessing/dataNormalizer');
const { paymentToEngine, bankToEngine, invoiceToEngine } = require('../mongoDataAdapter');
const { reconcile } = require('../../reconciliation/reconciliationEngine');

const FIXTURES = path.join(__dirname, 'fixtures', 'june');

function loadCanonical(fileName, fileType, manualOverride) {
  const buffer = fs.readFileSync(path.join(FIXTURES, fileName));
  const parsed = parseCsvBuffer(buffer);
  const auto = detectMapping(parsed.columns, fileType);
  const effective = manualOverride
    ? applyManualMapping(parsed.columns, auto, manualOverride, fileType)
    : { mapping: auto.mapping };
  const records = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const { record, errors } = normalizeRecord(parsed.rows[i], effective.mapping, fileType, i);
    if (!errors.length) records.push(record);
  }
  return { mapping: effective.mapping, records };
}

function runJuneReconciliation() {
  const payments = loadCanonical('payments.csv', 'PAYMENTS');
  const bankTransactions = loadCanonical('bank-transactions.csv', 'BANK_TRANSACTIONS');
  const invoices = loadCanonical('invoices.csv', 'INVOICES', { invoiceDate: 'invoice_date' });

  assert.equal(payments.records.length, 51, 'payments row count');
  assert.equal(bankTransactions.records.length, 53, 'bank rows count');
  assert.equal(invoices.records.length, 50, 'invoice rows count');

  return {
    results: reconcile(
      payments.records.map(paymentToEngine),
      bankTransactions.records.map(bankToEngine),
      invoices.records.map(invoiceToEngine)
    ),
  };
}

function buildMaps(results) {
  const byPayment = new Map();
  const bankOwners = new Map();
  const invoiceOwners = new Map();
  const allBankRows = new Map(); // bankTransactionId -> count of result rows mentioning it

  for (const r of results) {
    if (r.paymentId) byPayment.set(r.paymentId, r);
    if (r.bankTransactionId) {
      allBankRows.set(r.bankTransactionId, (allBankRows.get(r.bankTransactionId) || 0) + 1);
      if (r.paymentId) bankOwners.set(r.bankTransactionId, r.paymentId);
    }
    if (r.invoiceId && r.paymentId) invoiceOwners.set(r.invoiceId, r.paymentId);
  }
  return { byPayment, bankOwners, invoiceOwners, allBankRows };
}

describe('Phase 12.1 — real June data regression', () => {
  it('maps the real CSV columns the way the production upload would', () => {
    const payments = loadCanonical('payments.csv', 'PAYMENTS');
    const bankTransactions = loadCanonical('bank-transactions.csv', 'BANK_TRANSACTIONS');
    const invoices = loadCanonical('invoices.csv', 'INVOICES', { invoiceDate: 'invoice_date' });

    assert.equal(payments.mapping.paymentId, 'payment_id');
    assert.equal(payments.mapping.reference, 'reference_number');
    assert.equal(bankTransactions.mapping.transactionId, 'transaction_id');
    assert.equal(bankTransactions.mapping.reference, 'reference_number');
    assert.equal(invoices.mapping.invoiceId, 'invoice_id');
    assert.equal(invoices.mapping.invoiceDate, 'invoice_date');
    assert.equal(invoices.mapping.reference, 'reference_number');
  });

  it('never lets a bank transaction silently disappear (51 payments / 53 banks / 50 invoices)', () => {
    const { results } = runJuneReconciliation();
    const { allBankRows } = buildMaps(results);

    for (const bankId of ['TXN-900016', 'TXN-900047', 'TXN-900015', 'TXN-900046']) {
      assert.ok(allBankRows.has(bankId), `${bankId} must appear in the reconciliation output`);
    }

    assert.equal(allBankRows.size, 53, 'every one of the 53 bank transactions must appear exactly once');
    for (const [bankId, count] of allBankRows) {
      assert.equal(count, 1, `${bankId} must appear in exactly one result row`);
    }
  });

  it('keeps every payment exactly once and links the duplicate-reference couples one-to-one', () => {
    const { results } = runJuneReconciliation();
    const { byPayment, bankOwners } = buildMaps(results);

    assert.equal(byPayment.size, 51, 'every payment must appear exactly once');

    for (const p of ['PMT-50015', 'PMT-50016', 'PMT-50047', 'PMT-50048']) {
      assert.ok(byPayment.get(p).bankTransactionId, `${p} must not lose its bank`);
    }

    const couple1 = [byPayment.get('PMT-50015').bankTransactionId, byPayment.get('PMT-50016').bankTransactionId].sort();
    assert.deepEqual(couple1, ['TXN-900015', 'TXN-900016'], 'REF10014 bank couple mapped one-to-one');

    const couple2 = [byPayment.get('PMT-50047').bankTransactionId, byPayment.get('PMT-50048').bankTransactionId].sort();
    assert.deepEqual(couple2, ['TXN-900046', 'TXN-900047'], 'REF10046 bank couple mapped one-to-one');

    assert.equal(bankOwners.size, 49, 'every payment-linked bank is distinct (no one-to-many)');
    const attachedBankRows = results.filter((r) => r.paymentId && r.bankTransactionId).length;
    assert.equal(bankOwners.size, attachedBankRows, 'no bank may be owned by more than one payment');
    const bankless = results.filter((r) => r.paymentId && !r.bankTransactionId);
    assert.deepEqual(
      [...bankless.map((r) => r.paymentId)].sort(),
      ['PMT-50003', 'PMT-50036'],
      'any payment without a bank is a genuine missing-bank case, never a lost relationship'
    );
    for (const r of bankless) assert.equal(r.exceptionType, 'MISSING_BANK_TRANSACTION');
  });

  it('never cross-wires invoices', () => {
    const { results } = runJuneReconciliation();
    const { byPayment } = buildMaps(results);

    assert.equal(byPayment.get('PMT-50045').invoiceId, 'INV-10045', 'PMT-50045 keeps its own invoice');

    // The shared-invoice couples legitimately point at their declared invoice.
    assert.equal(byPayment.get('PMT-50015').invoiceId, 'INV-10015');
    assert.equal(byPayment.get('PMT-50016').invoiceId, 'INV-10015');
    assert.equal(byPayment.get('PMT-50047').invoiceId, 'INV-10047');
    assert.equal(byPayment.get('PMT-50048').invoiceId, 'INV-10047');

    // Payments must never be linked to an invoice they do not declare (no
    // cross-wiring to a neighbouring order, and no cascade into the next
    // invoice id).
    assert.notEqual(byPayment.get('PMT-50016').invoiceId, 'INV-10045', 'PMT-50016 must not steal INV-10045');
    assert.notEqual(byPayment.get('PMT-50016').invoiceId, 'INV-10016', 'PMT-50016 must not cascade into INV-10016');

    // Group invoice ownership from the source files: an invoice may be owned by
    // exactly the payments whose reference matches, never by an unrelated one.
    const sourcePayments = loadCanonical('payments.csv', 'PAYMENTS').records;
    const sourceOwners = sourcePayments.reduce(
      (acc, p) => {
        if (!p.paymentId || !p.reference) return acc;
        if (!acc[p.reference]) acc[p.reference] = [];
        acc[p.reference].push(p.paymentId);
        return acc;
      },
      {}
    );
    const owners = new Map();
    for (const r of results) {
      if (!r.invoiceId || !r.paymentId) continue;
      if (!owners.has(r.invoiceId)) owners.set(r.invoiceId, []);
      owners.get(r.invoiceId).push(r.paymentId);
    }
    for (const [invId, paymentIds] of owners) {
      const shared = ['INV-10015', 'INV-10047'].includes(invId);
      if (shared) {
        assert.equal(paymentIds.length, 2, `${invId} shared only by its own couple`);
        for (const p of paymentIds) {
          const sourceRef = sourcePayments.find((r) => r.paymentId === p)?.reference;
          assert.ok(sourceRef, `${p} must have a source reference`);
          assert.ok(
            sourceOwners[sourceRef] && sourceOwners[sourceRef].length > 1,
            `${p} must share its reference with its couple partner`
          );
        }
      } else {
        assert.equal(paymentIds.length, 1, `invoice ${invId} must not be cross-wired`);
      }
    }
  });

  it('keeps the four known-good AMOUNT_MISMATCH cases intact', () => {
    const { results } = runJuneReconciliation();
    const { byPayment } = buildMaps(results);

    const cases = [
      ['PMT-50009', 'TXN-900009', 'INV-10009'],
      ['PMT-50012', 'TXN-900012', 'INV-10012'],
      ['PMT-50042', 'TXN-900041', 'INV-10042'],
      ['PMT-50030', 'TXN-900030', 'INV-10030'],
    ];

    for (const [paymentId, bankId, invoiceId] of cases) {
      const row = byPayment.get(paymentId);
      assert.ok(row, `missing result row for ${paymentId}`);
      assert.equal(row.status, 'EXCEPTION', `${paymentId} status`);
      assert.equal(row.exceptionType, 'AMOUNT_MISMATCH', `${paymentId} exceptionType`);
      assert.equal(row.bankTransactionId, bankId, `${paymentId} bank`);
      assert.equal(row.invoiceId, invoiceId, `${paymentId} invoice`);
    }

    const pmt30 = byPayment.get('PMT-50030');
    assert.equal(pmt30.paymentAmount, 29229.29);
    assert.equal(pmt30.bankAmount, 29329.29);
    assert.equal(pmt30.invoiceAmount, 29229.29);
  });

  it('emits every unconsumed bank as UNMATCHED_BANK_TRANSACTION (matched or explicitly unmatched)', () => {
    const { results } = runJuneReconciliation();
    const unmatched = results
      .filter((r) => r.paymentId === null && r.exceptionType === 'UNMATCHED_BANK_TRANSACTION')
      .map((r) => r.bankTransactionId);

    const expectedUnmatched = ['TXN-900005', 'TXN-900051', 'TXN-900052', 'TXN-900053']; // no dup-pair members
    assert.deepEqual([...unmatched].sort(), [...expectedUnmatched].sort());
  });

  it('keeps matching deterministic regardless of empty customer/order identity', () => {
    const { results } = runJuneReconciliation();
    const { byPayment } = buildMaps(results);

    // With no customer column in the real files, the ORDER_CUSTOMER fallback
    // must not fabricate matches on empty strings.
    assert.equal(byPayment.get('PMT-50003').invoiceId, 'INV-10003');
    assert.equal(byPayment.get('PMT-50022').invoiceId, 'INV-10021');
    assert.equal(byPayment.get('PMT-50046').invoiceId, 'INV-10046');
  });
});