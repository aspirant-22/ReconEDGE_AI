const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createRandom } = require('../random');
const { generatePayments } = require('../generators/paymentGenerator');
const { generateBankTransactions } = require('../generators/bankGenerator');
const { generateInvoices } = require('../generators/invoiceGenerator');
const { assignScenarios, applyAnomalies, SCENARIO_DISTRIBUTION } = require('../anomalies');
const { validateDataset } = require('../validate');

function generateTestDataset(seed, count = 100) {
  const rng = createRandom(seed);
  const startDate = new Date('2026-07-01');
  const endDate = new Date('2026-08-31');

  const payments = generatePayments(rng, count, startDate, endDate);
  const bankTransactions = generateBankTransactions(rng, payments, startDate, endDate);
  const invoices = generateInvoices(rng, payments, startDate, endDate);
  const { scenarios, counts: scenarioCounts } = assignScenarios(rng, count);

  const result = applyAnomalies(rng, payments, bankTransactions, invoices, scenarios);

  return result;
}

describe('Synthetic Data Generator', () => {
  it('Test 1 — Unmatched bank exists', () => {
    const result = generateTestDataset(42, 100);
    const unmatchedBankTxs = result.groundTruth.filter(gt => gt.scenario === 'UNMATCHED');
    assert.ok(unmatchedBankTxs.length > 0, 'Should have unmatched scenarios');

    const strayBankTxs = result.bankTransactions.filter(b => {
      return !result.payments.some(p => p.paymentId === b.referenceId);
    });
    assert.ok(strayBankTxs.length > 0, 'Should have stray bank transactions');
  });

  it('Test 2 — Payment-side absence', () => {
    const result = generateTestDataset(42, 100);
    const unmatchedPayments = result.groundTruth.filter(gt => gt.scenario === 'UNMATCHED');

    for (const gt of unmatchedPayments) {
      const matchingBankTx = result.bankTransactions.find(b => b.referenceId === gt.paymentId);
      assert.equal(matchingBankTx, undefined, `Payment ${gt.paymentId} should not have matching bank tx`);
    }
  });

  it('Test 3 — No reference collision', () => {
    const result = generateTestDataset(42, 100);
    const unmatchedPayments = result.groundTruth.filter(gt => gt.scenario === 'UNMATCHED');
    const paymentIds = new Set(result.payments.map(p => p.paymentId));

    const strayBankTxs = result.bankTransactions.filter(b => {
      return !result.payments.some(p => p.paymentId === b.referenceId);
    });

    for (const bankTx of strayBankTxs) {
      assert.ok(!paymentIds.has(bankTx.referenceId), `Stray bank tx ${bankTx.bankTransactionId} should not reference a payment`);
    }
  });

  it('Test 4 — No duplicate collision', () => {
    const result = generateTestDataset(42, 100);
    const bankIds = result.bankTransactions.map(b => b.bankTransactionId);
    const uniqueBankIds = new Set(bankIds);
    assert.equal(bankIds.length, uniqueBankIds.size, 'Should have unique bank transaction IDs');
  });

  it('Test 5 — Ground truth consistency', () => {
    const result = generateTestDataset(42, 100);
    const validation = validateDataset(
      result.payments,
      result.bankTransactions,
      result.invoices,
      result.groundTruth,
      result.scenarioCounts
    );
    assert.ok(validation.valid, `Validation failed: ${validation.errors.join(', ')}`);
  });

  it('Test 6 — Deterministic generation', () => {
    const result1 = generateTestDataset(42, 100);
    const result2 = generateTestDataset(42, 100);

    assert.deepEqual(result1.payments, result2.payments, 'Same seed should produce same payments');
    assert.deepEqual(result1.bankTransactions, result2.bankTransactions, 'Same seed should produce same bank transactions');
    assert.deepEqual(result1.invoices, result2.invoices, 'Same seed should produce same invoices');
    assert.deepEqual(result1.groundTruth, result2.groundTruth, 'Same seed should produce same ground truth');
  });

  it('Test 7 — Different seed', () => {
    const result1 = generateTestDataset(42, 100);
    const result2 = generateTestDataset(99, 100);

    assert.notDeepEqual(result1.payments, result2.payments, 'Different seed should produce different payments');
  });

  it('Test 8 — Custom count', () => {
    const result = generateTestDataset(42, 50);
    assert.equal(result.payments.length, 50, 'Should generate 50 payments');
    assert.equal(result.invoices.length, 50, 'Should generate 50 invoices');
    assert.ok(result.bankTransactions.length >= 50, 'Should have at least 50 bank transactions');
  });
});
