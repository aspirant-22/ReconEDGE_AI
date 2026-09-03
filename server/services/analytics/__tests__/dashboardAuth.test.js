const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { protect } = require('../../../middleware/auth');
const { getDashboard } = require('../../../controllers/dashboardController');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function reqWithAuthorization(value) {
  return {
    headers: value ? { authorization: value } : {},
  };
}

describe('Dashboard Authentication', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_secret_for_audit';
  });

  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
  });

  it('Test 1 — GET /api/dashboard without JWT returns 401', async () => {
    const req = reqWithAuthorization(null);
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(nextCalled, false);
  });

  it('Test 2 — GET /api/dashboard with invalid JWT returns 401', async () => {
    const req = reqWithAuthorization('Bearer this.is.not.a.valid.token');
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(nextCalled, false);
  });

  it('Test 3 — GET /api/dashboard with valid JWT reaches the controller', async () => {
    mock.method(User, 'findById', async () => ({ _id: 'user-123', name: 'Test User' }));

    const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);
    const req = reqWithAuthorization(`Bearer ${token}`);
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert.equal(nextCalled, true);
    assert.equal(req.user._id, 'user-123');

    await getDashboard(req, res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.hasData, true);
    assert.ok(res.body.dashboard);
  });

  it('Test 4 — Protected dashboard response structure is unchanged', async () => {
    mock.method(User, 'findById', async () => ({ _id: 'user-123', name: 'Test User' }));

    const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);
    const req = reqWithAuthorization(`Bearer ${token}`);
    const res = mockRes();
    const next = () => {};

    await protect(req, res, next);
    await getDashboard(req, res);

    assert.ok(res.body.dashboard.overview);
    assert.ok(res.body.dashboard.reconciliation);
    assert.ok(res.body.dashboard.control);
    assert.ok(res.body.dashboard.exceptions);
    assert.ok(res.body.dashboard.financial);
    assert.equal(res.body.dashboard.overview.paymentsProcessed, 500);
    assert.equal(res.body.dashboard.overview.matchedPayments, 350);
    assert.equal(res.body.dashboard.overview.exceptions, 175);
    assert.equal(res.body.dashboard.control.health, 'CRITICAL');
  });
});
