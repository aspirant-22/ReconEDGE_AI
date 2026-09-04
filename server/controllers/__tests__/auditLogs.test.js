const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { protect } = require('../../middleware/auth');
const AuditLog = require('../../models/AuditLog');

let controller;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe('Audit Logs Controller', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_secret_for_audit_logs_route_ok';
    delete require.cache[require.resolve('../../controllers/auditLogController')];
    controller = require('../../controllers/auditLogController');
  });
  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
    delete require.cache[require.resolve('../../controllers/auditLogController')];
  });

  it('Test 1 — protected audit-logs endpoint rejects missing JWT', async () => {
    const req = { headers: {} };
    const res = mockRes();
    await protect(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  it('Test 2 — protected audit-logs endpoint rejects invalid JWT', async () => {
    const req = { headers: { authorization: 'Bearer invalid.token.here' } };
    const res = mockRes();
    await protect(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  it('Test 3 — valid JWT passes protect for audit logs', async () => {
    mock.method(User, 'findById', async () => ({ _id: 'user-aud', name: 'Auditor' }));
    const token = jwt.sign({ id: 'user-aud' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('Test 4 — authenticated user can retrieve audit logs with pagination/filtering', async () => {
    mock.method(AuditLog, 'countDocuments', () => Promise.resolve(3));
    mock.method(AuditLog, 'find', () => ({
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean() {
        return Promise.resolve([
          { _id: 'a1', timestamp: new Date(), userId: 'u1', userName: 'Alice', action: 'LOGIN', resource: 'AUTH', resourceId: null, status: 'SUCCESS', metadata: {} },
          { _id: 'a2', timestamp: new Date(), userId: 'u1', userName: 'Alice', action: 'RECONCILIATION_RUN', resource: 'RECONCILIATION', resourceId: null, status: 'SUCCESS', metadata: {} },
          { _id: 'a3', timestamp: new Date(), userId: 'u1', userName: 'Alice', action: 'FINANCE_QA_QUERY', resource: 'FINANCE_QA', resourceId: null, status: 'SUCCESS', metadata: { intent: 'RECONCILIATION' } },
        ]);
      },
    }));

    const req = { user: { _id: 'u1', name: 'Alice' }, query: { page: '1', limit: '25', status: 'SUCCESS' } };
    const res = mockRes();
    await controller.getLogs(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.logs.length, 3);
    assert.equal(res.body.pagination.total, 3);
    assert.equal(res.body.logs[0].action, 'LOGIN');
  });

  it('Test 5 — audit event creation stores only safe fields', async () => {
    const created = [];
    mock.method(AuditLog, 'create', (doc) => { created.push(doc); return Promise.resolve({ _id: 'new1', ...doc }); });

    await controller.createAuditEvent({
      userId: 'u2',
      userName: 'Bob',
      action: 'FINANCE_QA_QUERY',
      resource: 'FINANCE_QA',
      status: 'SUCCESS',
      metadata: { intent: 'FINANCIAL_IMPACT' },
    });

    assert.equal(created.length, 1);
    const doc = created[0];
    assert.equal(doc.action, 'FINANCE_QA_QUERY');
    assert.equal(doc.status, 'SUCCESS');
    const raw = JSON.stringify(doc);
    assert.equal(raw.includes('password'), false);
    assert.equal(raw.includes('Authorization'), false);
    assert.equal(raw.includes('Bearer'), false);
    assert.equal(raw.includes('GEMINI_API_KEY'), false);
    assert.equal(raw.includes('question'), false);
  });

  it('Test 6 — invalid/rejected actions are not persisted', async () => {
    const created = [];
    mock.method(AuditLog, 'create', (doc) => { created.push(doc); return Promise.resolve({ _id: 'x', ...doc }); });

    await controller.createAuditEvent({ action: 'BOGUS_ACTION', status: 'SUCCESS' });
    assert.equal(created.length, 0);
  });

  it('Test 7 — audit event creation failure does not throw (tolerated)', async () => {
    mock.method(AuditLog, 'create', () => Promise.reject(new Error('db down')));
    const result = await controller.createAuditEvent({ action: 'LOGIN', status: 'SUCCESS' });
    assert.equal(result, null);
  });

  it('Test 8 — getLogs handles empty result gracefully', async () => {
    mock.method(AuditLog, 'countDocuments', () => Promise.resolve(0));
    mock.method(AuditLog, 'find', () => ({
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean() { return Promise.resolve([]); },
    }));

    const req = { user: { _id: 'u1', name: 'Alice' }, query: {} };
    const res = mockRes();
    await controller.getLogs(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.logs.length, 0);
    assert.equal(res.body.pagination.total, 0);
    assert.equal(res.body.pagination.pages, 1);
  });

  it('Test 9 — getLogs supports action and search filtering', async () => {
    mock.method(AuditLog, 'countDocuments', () => Promise.resolve(1));
    const capturedQuery = {};
    mock.method(AuditLog, 'find', (q) => {
      capturedQuery.query = q;
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean() { return Promise.resolve([{ _id: 'a1', timestamp: new Date(), userName: 'Alice', action: 'LOGIN', resource: 'AUTH', status: 'SUCCESS', metadata: {} }]); },
      };
    });

    const req = { user: { _id: 'u1', name: 'Alice' }, query: { action: 'LOGIN', search: 'alice' } };
    const res = mockRes();
    await controller.getLogs(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(capturedQuery.query.action, 'LOGIN');
    assert.ok(capturedQuery.query.$or, 'search builds $or clause');
  });
});
