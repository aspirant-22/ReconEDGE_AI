const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { protect } = require('../../middleware/auth');

const SAMPLE_RESULTS = [
  { paymentId: 'PAY-1', bankTransactionId: 'BANK-1', invoiceId: 'INV-1', status: 'MATCHED', exceptionType: null, matchMethod: 'EXACT_REFERENCE', confidence: 0.95, paymentAmount: 100, bankAmount: 100, invoiceAmount: 100, amountDifference: 0, dateDifferenceDays: 0 },
  { paymentId: 'PAY-2', bankTransactionId: null, invoiceId: 'INV-2', status: 'EXCEPTION', exceptionType: 'MISSING_BANK_TRANSACTION', matchMethod: null, confidence: 0, paymentAmount: 200, bankAmount: null, invoiceAmount: 200, amountDifference: 0, dateDifferenceDays: 0 },
  { paymentId: null, bankTransactionId: 'BANK-3', invoiceId: null, status: 'EXCEPTION', exceptionType: 'UNMATCHED_BANK_TRANSACTION', matchMethod: null, confidence: 0, paymentAmount: null, bankAmount: 50, invoiceAmount: null, amountDifference: 0, dateDifferenceDays: 0 },
];

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function reqWithBody(body, authValue) {
  return { body, headers: authValue ? { authorization: authValue } : {} };
}

function mockEngine(engineResults) {
  const reconEngine = require('../../services/reconciliation/reconciliationEngine');
  mock.method(reconEngine, 'reconcile', () => engineResults);
}

describe('Reconciliation Controller', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_secret_for_reconciliation_route_ok';
    mock.method(fs, 'writeFileSync', () => {});
  });
  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
    delete require.cache[require.resolve('../../controllers/reconciliationController')];
    delete require.cache[require.resolve('../../services/reconciliation/reconciliationEngine')];
  });

  it('Test 1 — protected reconciliation endpoint rejects missing JWT', async () => {
    const req = reqWithBody({}, null);
    const res = mockRes();
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(nextCalled, false);
  });

  it('Test 2 — protected reconciliation endpoint rejects invalid JWT', async () => {
    const req = reqWithBody({}, 'Bearer invalid.token.here');
    const res = mockRes();
    await protect(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  it('Test 3 — valid JWT passes protect and accesses reconciliation results', async () => {
    mock.method(User, 'findById', async () => ({ _id: 'user-rec', name: 'Rec User' }));
    const token = jwt.sign({ id: 'user-rec' }, process.env.JWT_SECRET);

    mockEngine(SAMPLE_RESULTS);
    mock.method(require('../../services/reconciliation/metrics'), 'calculatePaymentMatchRate', () => 50);

    delete require.cache[require.resolve('../../controllers/reconciliationController')];
    const controller = require('../../controllers/reconciliationController');

    const req = { headers: { authorization: `Bearer ${token}` }, user: { _id: 'user-rec', name: 'Rec User' } };
    let passed = false;
    await protect(req, mockRes(), () => { passed = true; });
    assert.equal(passed, true);

    const res = mockRes();
    controller.runReconciliation(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  });

  it('Test 4 — run reconciliation invokes the existing deterministic engine', async () => {
    mockEngine(SAMPLE_RESULTS);
    delete require.cache[require.resolve('../../controllers/reconciliationController')];
    const controller = require('../../controllers/reconciliationController');

    const req = { user: { _id: 'user-rec', name: 'Rec User' } };
    const res = mockRes();
    controller.runReconciliation(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.results));
  });

  it('Test 5 — run reconciliation returns the expected structure without ground truth', async () => {
    mockEngine(SAMPLE_RESULTS);
    delete require.cache[require.resolve('../../controllers/reconciliationController')];
    const controller = require('../../controllers/reconciliationController');

    const req = { user: { _id: 'user-rec', name: 'Rec User' } };
    const res = mockRes();
    controller.runReconciliation(req, res);
    assert.equal(res.body.success, true);

    const data = res.body.data;
    assert.ok(data.dataset, 'dataset present');
    assert.ok(data.summary, 'summary present');
    assert.ok(typeof data.summary.matched === 'number');
    assert.ok(typeof data.summary.exceptions === 'number');
    assert.ok(Array.isArray(data.results));
    assert.ok('exceptionDistribution' in data);

    const raw = JSON.stringify(data);
    assert.equal(raw.includes('groundTruth'), false);
    assert.equal(raw.includes('expectedScenario'), false);
    assert.equal(raw.includes('expectedBankTransactionId'), false);
    assert.equal(raw.includes('expectedInvoiceId'), false);
  });

  it('Test 6 — run reconciliation returns derived summary consistent with the engine output', async () => {
    mockEngine(SAMPLE_RESULTS);
    delete require.cache[require.resolve('../../controllers/reconciliationController')];
    const controller = require('../../controllers/reconciliationController');

    const req = { user: { _id: 'user-rec', name: 'Rec User' } };
    const res = mockRes();
    controller.runReconciliation(req, res);
    const data = res.body.data;

    assert.equal(data.summary.exceptions, 2);
    assert.equal(data.summary.matched, 1);
    assert.ok(data.summary.exceptionRate >= 0);
    assert.deepEqual(data.exceptionDistribution.MISSING_BANK_TRANSACTION, 1);
    assert.deepEqual(data.exceptionDistribution.UNMATCHED_BANK_TRANSACTION, 1);
  });
});
