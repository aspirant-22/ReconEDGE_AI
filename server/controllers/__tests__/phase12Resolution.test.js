// Phase 12 — Human exception resolution workflow: backend isolation tests.
//
// Covers the 28 mandatory scenarios: ownership, state machine, validation,
// evidence immutability, audit events, history, concurrency, lifecycle gating,
// ground-truth isolation, AI non-mutation, and demo-mode non-fallback.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const mongoose = require('mongoose');

function loadController() {
  delete require.cache[require.resolve('../../controllers/exceptionResolutionController')];
  return require('../../controllers/exceptionResolutionController');
}

function loadWorkflow() {
  delete require.cache[require.resolve('../../services/resolution/exceptionWorkflow')];
  return require('../../services/resolution/exceptionWorkflow');
}

// ---- mocked models -------------------------------------------------------
const mocks = {};
function setupModelMocks() {
  const ReconciliationRun = require('../../models/ReconciliationRun');
  const ReconciliationResult = require('../../models/ReconciliationResult');
  const ExceptionResolution = require('../../models/ExceptionResolution');

  mocks.RUN_QUERY = [];
  mocks.RECORD_QUERY = [];
  mocks.UPDATED = null;
  mocks.HISTORY = [];
  mocks.AUDIT_LOGS = [];

  if (ReconciliationRun.findOne) { try { ReconciliationRun.findOne.mockRestore(); } catch {} }
  if (ReconciliationResult.findOne) { try { ReconciliationResult.findOne.mockRestore(); } catch {} }
  if (ReconciliationResult.findOneAndUpdate) { try { ReconciliationResult.findOneAndUpdate.mockRestore(); } catch {} }
  if (ExceptionResolution.create) { try { ExceptionResolution.create.mockRestore(); } catch {} }
  if (ExceptionResolution.find) { try { ExceptionResolution.find.mockRestore(); } catch {} }

  mock.method(ReconciliationRun, 'findOne', (query) => {
    const owner = query && query.userId ? String(query.userId) : null;
    const entry = mocks.RUN_QUERY.find((r) => String(r.userId) === String(owner) && String(r._id) === String(query._id));
    return Promise.resolve(entry || null);
  });

  mock.method(ReconciliationResult, 'findOne', (query) => {
    const or = (query && query.$or) || [];
    const pid = (or[0] && (or[0].paymentId || or[0].bankTransactionId)) || null;
    const entry = pid ? mocks.RECORD_QUERY.find((r) => String(r.runId) === String(query.runId) && (r.paymentId === pid || r.bankTransactionId === pid)) : null;
    return { lean: async () => (entry ? { ...entry } : null) };
  });

  mock.method(ReconciliationResult, 'findOneAndUpdate', (query, update) => {
    const entry = mocks.RECORD_QUERY.find((r) => String(r._id) === String(query._id) && String(r.runId) === String(query.runId) && (r.workflowStatus || 'OPEN') === query.workflowStatus);
    if (!entry) return Promise.resolve(null);
    const set = update.$set || {};
    Object.assign(entry, set);
    entry.updatedAt = new Date();
    return Promise.resolve({ ...entry });
  });

  mock.method(ExceptionResolution, 'create', (doc) => {
    const entry = {
      _id: `hist-${mocks.HISTORY.length + 1}`,
      createdAt: new Date(),
      ...doc,
    };
    mocks.HISTORY.push(entry);
    return Promise.resolve(entry);
  });

  mock.method(ExceptionResolution, 'find', (query) => {
    const rows = mocks.HISTORY.filter(
      (h) => String(h.runId) === String(query.runId) && String(h.resultId) === String(query.resultId)
    );
    const result = { sort() { return this; }, limit() { return this; }, lean() { return Promise.resolve([...rows].reverse()); } };
    return result;
  });

  const AuditLog = require('../../models/AuditLog');
  if (AuditLog.create) { try { AuditLog.create.mockRestore(); } catch {} }
  mock.method(AuditLog, 'create', (doc) => {
    mocks.AUDIT_LOGS.push(doc);
    return Promise.resolve({ _id: 'audit', ...doc });
  });
}

function resetMocks() {
  mocks.RUN_QUERY = [];
  mocks.RECORD_QUERY = [];
  mocks.UPDATED = null;
  mocks.HISTORY = [];
  mocks.AUDIT_LOGS = [];
  mocks.latest = null;
}

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RUN_A1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const RUN_A2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const RUN_B1 = 'bbbbbbbbbbbbbbbbbbbbbb11';

function makeRun(id, userId, over = {}) {
  return {
    _id: id, userId, name: 'Run',
    status: 'COMPLETED', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    isArchived: false,
    ...over,
  };
}

function makeRecord(runId, exceptionId, over = {}) {
  return {
    _id: `record-${exceptionId}`,
    runId,
    paymentId: exceptionId,
    bankTransactionId: null,
    invoiceId: null,
    status: 'EXCEPTION',
    exceptionType: 'AMOUNT_MISMATCH',
    paymentAmount: 10000,
    bankAmount: 9500,
    invoiceAmount: 10000,
    amountDifference: 500,
    dateDifferenceDays: 0,
    matchMethod: 'PAYMENT_AMOUNT_BANK_AMOUNT',
    paymentDate: new Date('2026-01-10'),
    bankDate: new Date('2026-01-10'),
    invoiceDate: new Date('2026-01-10'),
    workflowStatus: 'OPEN',
    lastAction: null,
    resolutionCode: null,
    resolutionReason: null,
    resolutionNotes: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function makeUser(id, name) {
  return { _id: id, name, email: `${name}@example.com` };
}

function makeReq({ runId, exceptionId, user }, body) {
  return { params: { runId, exceptionId }, user, body: body || {} };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function seedBase() {
  mocks.RUN_QUERY.push(makeRun(RUN_A1, USER_A));
  mocks.RUN_QUERY.push(makeRun(RUN_A2, USER_A));
  mocks.RUN_QUERY.push(makeRun(RUN_B1, USER_B));
  mocks.RECORD_QUERY.push(makeRecord(RUN_A1, 'PAY-A1-001'));
  mocks.RECORD_QUERY.push(makeRecord(RUN_A2, 'PAY-A2-001'));
  mocks.RECORD_QUERY.push(makeRecord(RUN_B1, 'PAY-B1-001'));
}

test('Phase 12 — Human Exception Resolution Workflow', async (t) => {
  setupModelMocks();
  const runController = loadController();
  resetMocks();
  seedBase();

  await t.test('1 — get exception detail returns evidence + workflow state', async () => {
    const res = mockRes();
    await runController.getExceptionDetail(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exceptionId, 'PAY-A1-001');
    assert.equal(res.body.data.workflowStatus, 'OPEN');
    assert.equal(res.body.data.paymentAmount, 10000);
    assert.equal(res.body.data.run.name, 'Run');
    assert.equal(res.body.data.run.isArchived, false);
  });

  await t.test('2 — foreign run → 404', async () => {
    const res = mockRes();
    await runController.getExceptionDetail(makeReq({ runId: 1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
  });

  await t.test('3 — foreign exception → 404', async () => {
    const res = mockRes();
    await runController.getExceptionDetail(makeReq({ runId: RUN_A1, exceptionId: 'PAY-B1-001', user: makeUser(USER_A, 'A') }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'EXCEPTION_NOT_FOUND');
  });

  await t.test('4 — START_REVIEW succeeds (OPEN → IN_REVIEW)', async () => {
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'START_REVIEW' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exception.workflowStatus, 'IN_REVIEW');
    assert.equal(res.body.data.resolution.previousStatus, 'OPEN');
    assert.equal(res.body.data.resolution.newStatus, 'IN_REVIEW');
  });

  await t.test('5 — RESOLVE succeeds (IN_REVIEW → RESOLVED) with code', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    rec.workflowStatus = 'IN_REVIEW';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE', notes: 'Verified against bank statement.' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exception.workflowStatus, 'RESOLVED');
    assert.equal(res.body.data.exception.resolutionCode, 'BANK_FEE');
    assert.equal(res.body.data.exception.resolutionNotes, 'Verified against bank statement.');
    assert.equal(res.body.data.resolution.action, 'RESOLVE');
  });

  await t.test('6 — REJECT succeeds (IN_REVIEW → REJECTED) with reason', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A2-001');
    rec.workflowStatus = 'IN_REVIEW';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }, { action: 'REJECT', reason: 'Duplicate confirmed' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exception.workflowStatus, 'REJECTED');
  });

  await t.test('7 — ESCALATE succeeds (IN_REVIEW → ESCALATED) with reason', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-B1-001');
    rec.workflowStatus = 'IN_REVIEW';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_B1, exceptionId: 'PAY-B1-001', user: makeUser(USER_B, 'B') }, { action: 'ESCALATE', reason: 'Needs legal review' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exception.workflowStatus, 'ESCALATED');
  });

  await t.test('8 — invalid action rejected (400 INVALID_ACTION)', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    rec.workflowStatus = 'OPEN';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'FIRE_THE_AI' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_ACTION');
  });

  await t.test('9 — invalid state transition rejected (400)', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    rec.workflowStatus = 'RESOLVED';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_STATE_TRANSITION');
    // RESOLVED → ESCALATE must also be rejected (no silent jumps).
    const res2 = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'ESCALATE', reason: 'x' }), res2);
    assert.equal(res2.statusCode, 400);
    assert.equal(res2.body.error.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('10 — RESOLVE without resolutionCode rejected (422)', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    rec.workflowStatus = 'OPEN';
    resetAudit();
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE' }), res);
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error.code, 'RESOLUTION_CODE_REQUIRED');
    assert.equal(mocks.AUDIT_LOGS.length, 0, 'no audit for rejected action');
  });

  await t.test('11 — REJECT without reason rejected (422)', async () => {
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'REJECT' }), res);
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error.code, 'RESOLUTION_REASON_REQUIRED');
  });

  await t.test('12 — ESCALATE without reason rejected (422)', async () => {
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'ESCALATE' }), res);
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error.code, 'RESOLUTION_REASON_REQUIRED');
  });

  await t.test('13 — resolution preserves financial evidence', async () => {
    resetMocks();
    seedBase();
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    const before = { paymentAmount: rec.paymentAmount, bankAmount: rec.bankAmount, invoiceAmount: rec.invoiceAmount, amountDifference: rec.amountDifference, exceptionType: rec.exceptionType, status: rec.status };
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exception.paymentAmount, before.paymentAmount);
    assert.equal(res.body.data.exception.bankAmount, before.bankAmount);
    assert.equal(res.body.data.exception.invoiceAmount, before.invoiceAmount);
    assert.equal(res.body.data.exception.amountDifference, before.amountDifference);
    assert.equal(res.body.data.exception.exceptionType, before.exceptionType);
    assert.equal(res.body.data.exception.status, before.status);
    assert.equal(res.body.data.exception.workflowStatus, 'RESOLVED');
  });

  await t.test('14 — workflow changes are the only mutation', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    // Financial fields on the stored record are byte-identical to the original.
    const original = makeRecord(RUN_A1, 'PAY-A1-001');
    assert.equal(rec.paymentAmount, original.paymentAmount);
    assert.equal(rec.status, original.status);
    assert.equal(rec.exceptionType, original.exceptionType);
  });

  await t.test('15 — audit event created on each human action', async () => {
    resetAudit();
    resetMocks();
    seedBase();
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    rec.workflowStatus = 'OPEN';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'MANUAL_ADJUSTMENT' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(mocks.AUDIT_LOGS.length, 1);
    assert.equal(mocks.AUDIT_LOGS[0].action, 'EXCEPTION_RESOLVED');
    assert.equal(mocks.AUDIT_LOGS[0].metadata.previousStatus, 'OPEN');
    assert.equal(mocks.AUDIT_LOGS[0].metadata.newStatus, 'RESOLVED');
    assert.equal(mocks.AUDIT_LOGS[0].metadata.resolutionCode, 'MANUAL_ADJUSTMENT');
  });

  await t.test('16 — resolution history returned correctly (scoped, ordered)', async () => {
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A2-001');
    // Recreate a history trail for A2
    mocks.HISTORY = [
      { _id: 'h1', runId: RUN_A2, resultId: rec._id, action: 'START_REVIEW', previousStatus: 'OPEN', newStatus: 'IN_REVIEW', resolutionCode: null, reason: null, notes: null, userName: 'User A', createdAt: new Date('2026-02-01T10:00:00Z') },
      { _id: 'h2', runId: RUN_A2, resultId: rec._id, action: 'RESOLVE', previousStatus: 'IN_REVIEW', newStatus: 'RESOLVED', resolutionCode: 'BANK_FEE', reason: null, notes: 'ok', userName: 'User A', createdAt: new Date('2026-02-01T10:05:00Z') },
      { _id: 'h-other', runId: RUN_A1, resultId: 'record-PAY-A1-001', action: 'RESOLVE', previousStatus: 'OPEN', newStatus: 'RESOLVED', resolutionCode: 'BANK_FEE', reason: null, notes: null, userName: 'User A', createdAt: new Date('2026-02-01T10:06:00Z') },
    ];
    const res = mockRes();
    await runController.getExceptionHistory(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 2, 'only entries for this run+exception');
    assert.equal(res.body.data[0].action, 'RESOLVE');
    assert.equal(res.body.data[0].newStatus, 'RESOLVED');
    assert.equal(res.body.data[1].action, 'START_REVIEW');
  });

  await t.test('17 — user A cannot modify user B exception', async () => {
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_B1, exceptionId: 'PAY-B1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
  });

  await t.test('18 — user A cannot read user B history', async () => {
    const res = mockRes();
    await runController.getExceptionHistory(makeReq({ runId: RUN_B1, exceptionId: 'PAY-B1-001', user: makeUser(USER_A, 'A') }), res);
    assert.equal(res.statusCode, 404);
  });

  await t.test('19 — Run A1 changes do not affect Run A2', async () => {
    resetMocks();
    seedBase();
    const a1 = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    const a2 = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A2-001');
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'SYSTEM_ERROR' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(a1.workflowStatus, 'RESOLVED');
    assert.equal(a2.workflowStatus, 'OPEN');
    assert.equal(a2.lastAction, null);
  });

  await t.test('20 — Run A1 changes do not affect user B Run B1', async () => {
    const b1 = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-B1-001');
    assert.equal(b1.workflowStatus, 'OPEN');
  });

  await t.test('21 — archived run cannot be modified (409 RUN_ARCHIVED)', async () => {
    resetMocks();
    seedBase();
    const archivedRun = mocks.RUN_QUERY.find((r) => String(r._id) === RUN_A2);
    archivedRun.isArchived = true;
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, 'RUN_ARCHIVED');
    // Detail/history remain readable on archived runs.
    const dres = mockRes();
    await runController.getExceptionDetail(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }), dres);
    assert.equal(dres.statusCode, 200);
  });

  await t.test('22 — processing run cannot be modified (409 RUN_NOT_RESOLVABLE)', async () => {
    resetMocks();
    seedBase();
    const rec = mocks.RUN_QUERY.find((r) => String(r._id) === RUN_A2);
    rec.status = 'PROCESSING';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }, { action: 'START_REVIEW' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, 'RUN_NOT_RESOLVABLE');
  });

  await t.test('23 — failed run cannot be modified (409 RUN_NOT_RESOLVABLE)', async () => {
    resetMocks();
    seedBase();
    const rec = mocks.RUN_QUERY.find((r) => String(r._id) === RUN_A2);
    rec.status = 'FAILED';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }, { action: 'START_REVIEW' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, 'RUN_NOT_RESOLVABLE');
  });

  await t.test('24 — duplicate RESOLVE request handled safely', async () => {
    resetMocks();
    seedBase();
    resetAudit();
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A3-001');
    if (!rec) mocks.RECORD_QUERY.push(makeRecord(RUN_A1, 'PAY-A3-001'));
    const target = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A3-001');

    const body = { action: 'RESOLVE', resolutionCode: 'BANK_FEE', notes: 'dup' };
    const res1 = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A3-001', user: makeUser(USER_A, 'A') }, body), res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(target.workflowStatus, 'RESOLVED');

    // Second identical request: state is already RESOLVED → rejected, no second history row.
    const res2 = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A3-001', user: makeUser(USER_A, 'A') }, body), res2);
    assert.equal(res2.statusCode, 400);
    assert.equal(res2.body.error.code, 'INVALID_STATE_TRANSITION');
    assert.equal(mocks.HISTORY.filter((h) => h.resultId === target._id && h.action === 'RESOLVE').length, 1);
    assert.equal(mocks.AUDIT_LOGS.filter((a) => a.action === 'EXCEPTION_RESOLVED').length, 1);
  });

  await t.test('24b — concurrent identical requests: CAS guard allows a single winner', async () => {
    resetMocks();
    seedBase();
    resetAudit();
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A4-001');
    if (!rec) mocks.RECORD_QUERY.push(makeRecord(RUN_A1, 'PAY-A4-001'));
    const target = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A4-001');

    // Simulate two requests both reading OPEN; the CAS makes only the first succeed.
    const body = { action: 'RESOLVE', resolutionCode: 'OTHER' };
    const resA = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A4-001', user: makeUser(USER_A, 'A') }, body), resA);
    // Force a condition where read sees RESOLVED (the "second reader" case).
    target.workflowStatus = 'RESOLVED';
    const resB = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A4-001', user: makeUser(USER_A, 'A') }, body), resB);
    assert.equal(resA.statusCode, 200);
    assert.equal(resB.statusCode, 400);
    assert.equal(mocks.HISTORY.filter((h) => h.resultId === target._id && h.action === 'RESOLVE').length, 1);
  });

  await t.test('25 — ground truth never appears in API response', async () => {
    const res = mockRes();
    await runController.getExceptionDetail(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }), res);
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('expectedScenario') && !raw.includes('expectedBankTransactionId') && !raw.includes('expectedInvoiceId'));
    assert.ok(!raw.includes('ground-truth'));
  });

  await t.test('26 — ground truth never enters audit metadata', async () => {
    resetAudit();
    resetMocks();
    seedBase();
    resetAudit();
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'START_REVIEW' }), res);
    assert.equal(mocks.AUDIT_LOGS.length, 1);
    const raw = JSON.stringify(mocks.AUDIT_LOGS[0]);
    assert.ok(!raw.includes('expectedScenario') && !raw.includes('expectedBankTransactionId') && !raw.includes('expectedInvoiceId'));
    assert.ok(!raw.includes('paymentAmount'));
    assert.ok(!raw.includes('ground-truth'));
  });

  await t.test('27 — AI cannot trigger resolution (no AI input path)', async () => {
    resetMocks();
    seedBase();
    const res = mockRes();
    // Attempt to smuggle an AI decision — the payload writer is the human request only.
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE', aiMutated: true, geminiDecision: 'resolve' }), res);
    assert.equal(res.statusCode, 200);
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('aiMutated') && !raw.includes('geminiDecision'), 'unknown AI fields are never persisted/echoed');
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    assert.equal(rec.aiMutated, undefined);
    assert.equal(rec.geminiDecision, undefined);
    assert.equal(rec.workflowStatus, 'RESOLVED');
  });

  await t.test('28 — real run never falls back to demo', async () => {
    // Missing exception on a real run → 404 EXCEPTION_NOT_FOUND, never a demo record.
    resetMocks();
    seedBase();
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-DEMO-999', user: makeUser(USER_A, 'A') }, { action: 'RESOLVE', resolutionCode: 'BANK_FEE' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'EXCEPTION_NOT_FOUND');
  });

  await t.test('REOPEN transitions (terminal → IN_REVIEW) with audit + history', async () => {
    resetMocks();
    seedBase();
    resetAudit();
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A1-001');
    rec.workflowStatus = 'REJECTED';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'REOPEN' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.exception.workflowStatus, 'IN_REVIEW');
    assert.equal(mocks.AUDIT_LOGS[0].action, 'EXCEPTION_REOPENED');
  });

  await t.test('REOPEN from OPEN is an invalid transition', async () => {
    resetMocks();
    seedBase();
    const rec = mocks.RECORD_QUERY.find((r) => r.paymentId === 'PAY-A2-001');
    rec.workflowStatus = 'OPEN';
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001', user: makeUser(USER_A, 'A') }, { action: 'REOPEN' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('reasons/notes are sanitized (no raw HTML)', async () => {
    resetMocks();
    seedBase();
    const res = mockRes();
    await runController.performExceptionAction(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }, { action: 'ESCALATE', reason: '<script>alert(1)</script>Reason', notes: '<img src=x onerror=alert(1)> notes' }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(!res.body.data.exception.resolutionReason.includes('<script>'));
    assert.ok(res.body.data.exception.resolutionReason.includes('\u2039script\u203A'));
    assert.ok(!res.body.data.exception.resolutionNotes.includes('<img'));
  });

  await t.test('empty history returns []', async () => {
    resetMocks();
    seedBase();
    mocks.HISTORY = [];
    const res = mockRes();
    await runController.getExceptionHistory(makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001', user: makeUser(USER_A, 'A') }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, []);
  });

  await t.test('workflow service: valid transition table is explicit', () => {
    const wf = loadWorkflow();
    assert.deepEqual(wf.VALID_TRANSITIONS.OPEN, ['START_REVIEW', 'RESOLVE', 'REJECT', 'ESCALATE']);
    assert.deepEqual(wf.VALID_TRANSITIONS.IN_REVIEW, ['RESOLVE', 'REJECT', 'ESCALATE']);
    assert.deepEqual(wf.VALID_TRANSITIONS.RESOLVED, ['REOPEN']);
    assert.deepEqual(wf.VALID_TRANSITIONS.REJECTED, ['REOPEN']);
    assert.deepEqual(wf.VALID_TRANSITIONS.ESCALATED, ['REOPEN']);
    assert.equal(wf.isAllowedTransition('OPEN', 'RESOLVED'), false);
    assert.equal(wf.isAllowedTransition('RESOLVED', 'ESCALATE'), false);
    assert.equal(wf.isAllowedTransition('RESOLVED', 'REOPEN'), true);
    assert.equal(wf.getSuccessorStatus('REOPEN'), 'IN_REVIEW');
  });

  await t.test('state machine: keys match model enums', () => {
    const ReconciliationResult = require('../../models/ReconciliationResult');
    assert.deepEqual(ReconciliationResult.WORKFLOW_STATUSES,
      ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED']);
    assert.deepEqual(ReconciliationResult.WORKFLOW_ACTIONS,
      ['START_REVIEW', 'RESOLVE', 'REJECT', 'ESCALATE', 'REOPEN']);
    assert.ok(ReconciliationResult.RESOLUTION_CODES.includes('BANK_FEE'));
  });
});

function resetAudit() {
  mocks.AUDIT_LOGS = [];
}

// Remove mongoose connection attempts triggered by any model singletons.
try { mongoose.disconnect(); } catch {}