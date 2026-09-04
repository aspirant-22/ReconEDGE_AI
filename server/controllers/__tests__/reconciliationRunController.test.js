const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const ReconciliationRun = require('../../models/ReconciliationRun');
const PaymentRecord = require('../../models/PaymentRecord');
const BankTransaction = require('../../models/BankTransaction');
const Invoice = require('../../models/Invoice');
const ReconciliationResult = require('../../models/ReconciliationResult');
const AuditLog = require('../../models/AuditLog');

let controller;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const RUN_ID = '507f1f77bcf86cd799439033';
const OTHER_RUN_ID = '507f1f77bcf86cd799439044';

before(() => {
  mock.method(AuditLog, 'create', () => Promise.resolve({ _id: 'a1' }));
  delete require.cache[require.resolve('../../controllers/reconciliationRunController')];
  controller = require('../../controllers/reconciliationRunController');
});

after(() => {
  mock.restoreAll();
  delete require.cache[require.resolve('../../controllers/reconciliationRunController')];
});

describe('Reconciliation Run Controller — createRun (validation)', () => {
  it('rejects a run with no name', async () => {
    const req = { user: { _id: OWNER_ID }, body: {} };
    const res = mockRes();
    await controller.createRun(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
  });

  it('creates a run with valid input', async () => {
    const created = [];
    mock.method(ReconciliationRun, 'create', (doc) => {
      created.push(doc);
      return Promise.resolve({ _id: RUN_ID, ...doc, createdAt: new Date(), updatedAt: new Date() });
    });
    const req = { user: { _id: OWNER_ID }, body: { name: 'June Recon', periodStart: '2026-06-01', periodEnd: '2026-06-30' } };
    const res = mockRes();
    await controller.createRun(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(created[0].userId, OWNER_ID);
    assert.equal(created[0].status, 'CREATED');
  });
});

describe('Reconciliation Run Controller — ownership enforcement', () => {
  it('getRun returns 404 for a run owned by another user', async () => {
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
    const req = { user: { _id: OTHER_ID }, params: { runId: RUN_ID } };
    const res = mockRes();
    await controller.getRun(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
  });

  it('getRun returns the run data for an owned run', async () => {
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve({
      _id: RUN_ID, name: 'June', status: 'COMPLETED', userId: OWNER_ID,
      createdAt: new Date(), updatedAt: new Date(), toObject: null,
    }));
    const req = { user: { _id: OWNER_ID }, params: { runId: RUN_ID } };
    const res = mockRes();
    await controller.getRun(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.name, 'June');
  });

  it('executeRun rejects when run is not owned (404, no leak)', async () => {
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
    const req = { user: { _id: OTHER_ID }, params: { runId: RUN_ID } };
    const res = mockRes();
    await controller.executeRun(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
  });

  it('getResults rejects when run is not owned', async () => {
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
    const req = { user: { _id: OTHER_ID }, params: { runId: RUN_ID }, query: {} };
    const res = mockRes();
    await controller.getResults(req, res);
    assert.equal(res.statusCode, 404);
  });

  it('executeRun requires all three datasets before running', async () => {
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve({ _id: RUN_ID, userId: OWNER_ID }));
    mock.method(PaymentRecord, 'countDocuments', () => Promise.resolve(5));
    mock.method(BankTransaction, 'countDocuments', () => Promise.resolve(0));
    mock.method(Invoice, 'countDocuments', () => Promise.resolve(0));
    const req = { user: { _id: OWNER_ID }, params: { runId: RUN_ID } };
    const res = mockRes();
    await controller.executeRun(req, res);
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
  });
});

describe('Reconciliation Run Controller — uploadFile (real data)', () => {
  function paymentsCsv() {
    return Buffer.from('paymentId,amount,paymentDate\nPAY-001,1000,2026-07-15\n', 'utf8');
  }

  it('stores a valid payments upload and marks run not READY until all datasets present', async () => {
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve({ _id: RUN_ID, userId: OWNER_ID }));
    mock.method(PaymentRecord, 'deleteMany', () => Promise.resolve({ deletedCount: 0 }));
    const inserted = [];
    mock.method(PaymentRecord, 'insertMany', (docs) => { inserted.push(...docs); return Promise.resolve(docs); });
    mock.method(PaymentRecord, 'countDocuments', () => Promise.resolve(1));
    mock.method(BankTransaction, 'countDocuments', () => Promise.resolve(0));
    mock.method(Invoice, 'countDocuments', () => Promise.resolve(0));
    mock.method(ReconciliationRun, 'findOneAndUpdate', () => Promise.resolve({ _id: RUN_ID, userId: OWNER_ID, status: 'VALIDATING', createdAt: new Date(), updatedAt: new Date() }));

    const req = {
      user: { _id: OWNER_ID },
      params: { runId: RUN_ID },
      body: { fileType: 'PAYMENTS' },
      query: {},
      file: { originalname: 'payments.csv', size: paymentsCsv().length, buffer: paymentsCsv() },
    };
    const res = mockRes();
    await controller.uploadFile(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.fileMeta.validRows, 1);
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].paymentId, 'PAY-001');
    assert.equal(inserted[0].amount, 1000);
  });

  it('returns 422 when rows fail validation (invalid amount)', async () => {
    const buf = Buffer.from('paymentId,amount,paymentDate\nPAY-001,abc,2026-07-15\n', 'utf8');
    mock.method(ReconciliationRun, 'findOne', () => Promise.resolve({ _id: RUN_ID, userId: OWNER_ID }));
    mock.method(PaymentRecord, 'deleteMany', () => Promise.resolve({}));
    mock.method(ReconciliationRun, 'updateOne', () => Promise.resolve({}));
    const req = {
      user: { _id: OWNER_ID },
      params: { runId: RUN_ID },
      body: { fileType: 'PAYMENTS' },
      query: {},
      file: { originalname: 'payments.csv', size: buf.length, buffer: buf },
    };
    const res = mockRes();
    await controller.uploadFile(req, res);
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
  });
});

