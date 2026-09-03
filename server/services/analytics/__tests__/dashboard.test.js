const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getDashboard } = require('../../../controllers/dashboardController');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function mockReq() {
  return {};
}

describe('Dashboard Controller', () => {
  it('Test 1 — Returns dashboard data when files exist', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.hasData, true);
    assert.ok(res.body.dashboard);
  });

  it('Test 2 — Dashboard has overview section', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    assert.equal(res.body.dashboard.overview.paymentsProcessed, 500);
    assert.equal(res.body.dashboard.overview.matchedPayments, 350);
    assert.equal(res.body.dashboard.overview.exceptions, 175);
    assert.equal(res.body.dashboard.overview.exceptionRate, 35);
  });

  it('Test 3 — Dashboard has reconciliation section', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    const recon = res.body.dashboard.reconciliation;
    assert.equal(recon.paymentMatchRate, 70);
    assert.equal(recon.bankMatchRate, 73.68);
    assert.equal(recon.invoiceMatchRate, 70);
    assert.equal(recon.bankAssignmentAccuracy, 100);
    assert.equal(recon.reconciliationRate, 70);
  });

  it('Test 4 — Dashboard has control health', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    const control = res.body.dashboard.control;
    assert.equal(control.health, 'CRITICAL');
    assert.ok(control.healthReason);
    assert.equal(control.reconciliationRate, 70);
    assert.equal(control.exceptionRate, 35);
  });

  it('Test 5 — Dashboard has exception breakdown', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    const exc = res.body.dashboard.exceptions;
    assert.equal(exc.total, 175);
    assert.equal(exc.breakdown.MISSING_BANK_TRANSACTION.count, 50);
    assert.equal(exc.breakdown.AMOUNT_MISMATCH.count, 50);
    assert.equal(exc.breakdown.DUPLICATE_BANK_TRANSACTION.count, 25);
    assert.equal(exc.breakdown.DATE_MISMATCH.count, 25);
    assert.equal(exc.breakdown.UNMATCHED_BANK_TRANSACTION.count, 25);
  });

  it('Test 6 — Dashboard has severity breakdown', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    const sev = res.body.dashboard.exceptions.severity;
    assert.equal(sev.high, 100);
    assert.equal(sev.medium, 75);
    assert.equal(sev.low, 0);
  });

  it('Test 7 — Dashboard has financial impact', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    const fin = res.body.dashboard.financial;
    assert.equal(fin.totalPaymentAmount, 25079405.23);
    assert.equal(fin.matchedPaymentAmount, 17486654.13);
    assert.equal(fin.exceptionPaymentAmount, 7592751.1);
    assert.equal(fin.amountMismatchImpact, 12012.7);
  });

  it('Test 8 — Dashboard has top exceptions', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    assert.ok(Array.isArray(res.body.dashboard.topExceptions));
    assert.equal(res.body.dashboard.topExceptions.length, 5);
  });

  it('Test 9 — Dashboard has recent exceptions', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    assert.ok(Array.isArray(res.body.dashboard.recentExceptions));
    assert.ok(res.body.dashboard.recentExceptions.length <= 10);
  });

  it('Test 10 — Dashboard control exception detection', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    const detection = res.body.dashboard.control.exceptionDetection;
    assert.equal(detection.precision, 100);
    assert.equal(detection.recall, 100);
    assert.equal(detection.f1, 100);
  });

  it('Test 11 — Dashboard has generatedAt timestamp', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    assert.ok(res.body.dashboard.generatedAt);
  });

  it('Test 12 — Dashboard API returns valid JSON structure', async () => {
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req, res);
    assert.equal(typeof res.body, 'object');
    assert.equal(res.body.success, true);
    assert.ok(res.body.dashboard);
    assert.ok(res.body.dashboard.overview);
    assert.ok(res.body.dashboard.reconciliation);
    assert.ok(res.body.dashboard.control);
    assert.ok(res.body.dashboard.exceptions);
    assert.ok(res.body.dashboard.financial);
  });
});
