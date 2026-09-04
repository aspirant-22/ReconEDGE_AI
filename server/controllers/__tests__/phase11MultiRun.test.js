const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ReconciliationRun = require('../../models/ReconciliationRun');
const ReconciliationResult = require('../../models/ReconciliationResult');
const AuditLog = require('../../models/AuditLog');
const { askFinanceQuestion, getDeterministicKeyMetrics, clearCache } = require('../../services/ai/financeQA');
const { buildContext } = require('../../services/ai/financeContext');
const geminiClient = require('../../services/ai/geminiClient');

let runController;
let dashboardController;
let auditController;
let financeQAController;

const RUN_A = new mongoose.Types.ObjectId().toString();
const RUN_B = new mongoose.Types.ObjectId().toString();
const RUN_FOREIGN = new mongoose.Types.ObjectId().toString();

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function makeReq(params, query, user, body) {
  return {
    params: params || {},
    query: query || {},
    user: user || { _id: 'OWNER', name: 'Owner' },
    body: body || {},
  };
}

function makeRun(doc) {
  return {
    _id: doc._id || RUN_A,
    userId: 'OWNER',
    name: doc.name || 'Run A',
    status: doc.status || 'COMPLETED',
    periodStart: null,
    periodEnd: null,
    paymentFile: { fileName: 'payments.csv' },
    bankFile: null,
    invoiceFile: null,
    paymentCount: 5,
    bankTransactionCount: 5,
    invoiceCount: 5,
    validPaymentCount: 5,
    validBankTransactionCount: 5,
    validInvoiceCount: 5,
    matchedCount: doc.matchedCount != null ? doc.matchedCount : 3,
    exceptionCount: doc.exceptionCount != null ? doc.exceptionCount : 2,
    processingTimeMs: 10,
    errorMessage: null,
    isArchived: !!doc.isArchived,
    archivedAt: doc.isArchived ? new Date() : null,
    archivedBy: doc.isArchived ? 'OWNER' : null,
    hasAnalytics: true,
    analytics: doc.analytics,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject() { return this; },
  };
}

const ANALYTICS = {
  generatedAt: '2026-09-04T00:00:00.000Z',
  overview: {
    totalPayments: 5, totalBankTransactions: 5, totalInvoices: 5,
    totalReconciliationRecords: 5, matchedRecords: 3, paymentMatchRate: 60,
    bankMatchRate: 60, invoiceMatchRate: 60, bankAssignmentAccuracy: 0,
    totalExceptions: 2, exceptionRate: 40, resolvedExceptions: null, unresolvedExceptions: null,
  },
  matching: { matchedRecords: 3, paymentMatchRate: 60, bankMatchRate: 60, invoiceMatchRate: 60, bankAssignmentAccuracy: 0 },
  exceptions: { totalExceptions: 2, exceptionRate: 40, breakdown: { AMOUNT_MISMATCH: { count: 1, percentageOfExceptions: 50, percentageOfTotalPayments: 20 }, MISSING_BANK_TRANSACTION: { count: 1, percentageOfExceptions: 50, percentageOfTotalPayments: 20 } } },
  severity: { highSeverityCount: 1, mediumSeverityCount: 1, lowSeverityCount: 0, highSeverityPercentage: 50, mediumSeverityPercentage: 50, lowSeverityPercentage: 0 },
  financialImpact: { totalPaymentAmount: 15000, matchedPaymentAmount: 6000, exceptionPaymentAmount: 9000, amountMismatchImpact: 500, matchedAmountRate: 40, exceptionAmountRate: 60 },
  controlEffectiveness: { reconciliationRate: 60, exceptionRate: 40, cleanMatchRate: 60, exceptionDetectionPrecision: 0, exceptionDetectionRecall: 0, exceptionDetectionF1: 0 },
  health: { healthStatus: 'CRITICAL', healthReason: 'Exception rate is 40%, exceeding the critical threshold of 25%.' },
  topExceptions: [{ type: 'AMOUNT_MISMATCH', count: 1, percentage: 50 }, { type: 'MISSING_BANK_TRANSACTION', count: 1, percentage: 50 }],
};

const ANALYTICS_B = {
  generatedAt: '2026-09-04T00:00:00.000Z',
  overview: {
    totalPayments: 10, totalBankTransactions: 10, totalInvoices: 10,
    totalReconciliationRecords: 10, matchedRecords: 9, paymentMatchRate: 90,
    bankMatchRate: 90, invoiceMatchRate: 90, bankAssignmentAccuracy: 0,
    totalExceptions: 1, exceptionRate: 10, resolvedExceptions: null, unresolvedExceptions: null,
  },
  matching: { matchedRecords: 9, paymentMatchRate: 90, bankMatchRate: 90, invoiceMatchRate: 90, bankAssignmentAccuracy: 0 },
  exceptions: { totalExceptions: 1, exceptionRate: 10, breakdown: { DATE_MISMATCH: { count: 1, percentageOfExceptions: 100, percentageOfTotalPayments: 10 } } },
  severity: { highSeverityCount: 0, mediumSeverityCount: 1, lowSeverityCount: 0, highSeverityPercentage: 0, mediumSeverityPercentage: 100, lowSeverityPercentage: 0 },
  financialImpact: { totalPaymentAmount: 30000, matchedPaymentAmount: 27000, exceptionPaymentAmount: 3000, amountMismatchImpact: 0, matchedAmountRate: 90, exceptionAmountRate: 10 },
  controlEffectiveness: { reconciliationRate: 90, exceptionRate: 10, cleanMatchRate: 90, exceptionDetectionPrecision: 0, exceptionDetectionRecall: 0, exceptionDetectionF1: 0 },
  health: { healthStatus: 'WARNING', healthReason: 'Exception rate is 10%.' },
  topExceptions: [{ type: 'DATE_MISMATCH', count: 1, percentage: 100 }],
};

describe('Phase 11 — Multi-Run Management', () => {
  before(() => {
    process.env.JWT_SECRET = 'phase11_test_secret';
    mock.method(AuditLog, 'create', () => Promise.resolve({ _id: 'audit-log' }));
    delete require.cache[require.resolve('../../controllers/reconciliationRunController')];
    delete require.cache[require.resolve('../../controllers/auditLogController')];
    delete require.cache[require.resolve('../../controllers/dashboardController')];
    delete require.cache[require.resolve('../../controllers/financeQAController')];
    runController = require('../../controllers/reconciliationRunController');
    dashboardController = require('../../controllers/dashboardController');
    auditController = require('../../controllers/auditLogController');
    financeQAController = require('../../controllers/financeQAController');
  });

  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
  });

  describe('Run list — search/pagination/status/archive', () => {
    it('listRuns returns pagination metadata with totalPages', async () => {
      mock.method(ReconciliationRun, 'countDocuments', () => Promise.resolve(37));
      const runs = Array.from({ length: 20 }, (_, i) => makeRun({ name: `Run ${i}`, _id: `R${i}` }));
      mock.method(ReconciliationRun, 'find', () => ({
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean() { return Promise.resolve(runs); },
      }));

      const req = makeReq({}, { page: '1', limit: '20' });
      const res = mockRes();
      await runController.listRuns(req, res);

      assert.equal(res.body.pagination.total, 37);
      assert.equal(res.body.pagination.totalPages, 2);
      assert.equal(res.body.data.length, 20);
    });

    it('listRuns applies search, status filter and excludes archived by default', async () => {
      const captured = {};
      mock.method(ReconciliationRun, 'countDocuments', () => Promise.resolve(1));
      mock.method(ReconciliationRun, 'find', (q) => {
        captured.q = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve([makeRun({ name: 'September' })]); } };
      });

      const req = makeReq({}, { search: 'Sept', status: 'COMPLETED', page: '1', limit: '20' });
      const res = mockRes();
      await runController.listRuns(req, res);

      assert.equal(captured.q.userId, 'OWNER');
      assert.equal(captured.q.isArchived, false, 'default excludes archived runs');
      assert.equal(captured.q.status, 'COMPLETED');
      assert.ok(captured.q.name, 'search maps to name regex');
      assert.equal(captured.q.name instanceof RegExp, true);
    });

    it('listRuns includes archived runs when archived=all or true', async () => {
      const captured = {};
      mock.method(ReconciliationRun, 'countDocuments', () => Promise.resolve(2));
      mock.method(ReconciliationRun, 'find', (q) => {
        captured.q = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve([makeRun({ isArchived: true })]); } };
      });

      const req = makeReq({}, { archived: 'true' });
      const res = mockRes();
      await runController.listRuns(req, res);
      assert.equal(captured.q.isArchived, true);
    });

    it('listRuns never trusts a foreign userId from the frontend', async () => {
      const captured = {};
      mock.method(ReconciliationRun, 'countDocuments', () => Promise.resolve(0));
      mock.method(ReconciliationRun, 'find', (q) => {
        captured.q = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve([]); } };
      });

      const req = makeReq({}, { page: '1' }, { _id: 'ACTUAL_USER', name: 'U' });
      const res = mockRes();
      await runController.listRuns(req, res);
      assert.equal(captured.q.userId, 'ACTUAL_USER');
    });
  });

  describe('Archive', () => {
    it('archiveRun sets isArchived/archivedAt/archivedBy', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(makeRun({})));
      mock.method(ReconciliationRun, 'findOneAndUpdate', (_q, update) => Promise.resolve(makeRun({ isArchived: update.isArchived, archivedAt: update.archivedAt, archivedBy: update.archivedBy })));

      const req = makeReq({ runId: RUN_A }, {}, { _id: 'OWNER', name: 'Owner' }, { archive: true });
      const res = mockRes();
      await runController.archiveRun(req, res);

      assert.equal(res.body.success, true);
      assert.equal(res.body.data.isArchived, true);
    });

    it('archiveRun rejects foreign run with 404 (no leak)', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
      const req = makeReq({ runId: RUN_FOREIGN }, {}, { _id: 'OWNER', name: 'Owner' }, { archive: true });
      const res = mockRes();
      await runController.archiveRun(req, res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
    });
  });

  describe('getExceptions — run isolation + filters', () => {
    it('returns only exceptions for the owned run with severity', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(makeRun({})));

      const exceptionRows = [
        { _id: 'e1', status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH', paymentId: 'P1', paymentAmount: 100 },
      ];
      const captured = {};
      mock.method(ReconciliationResult, 'countDocuments', (q) => { captured.countQuery = q; return Promise.resolve(1); });
      mock.method(ReconciliationResult, 'find', (q) => {
        captured.findQuery = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve(exceptionRows); } };
      });

      const req = makeReq({ runId: RUN_A });
      const res = mockRes();
      await runController.getExceptions(req, res);

      assert.equal(captured.findQuery.runId, RUN_A);
      assert.equal(captured.findQuery.status, 'EXCEPTION');
      assert.equal(res.body.data[0].severity, 'MEDIUM');
      assert.equal(res.body.pagination.total, 1);
    });

    it('filters by exceptionType and enforces severity mapping', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(makeRun({})));
      const captured = {};
      mock.method(ReconciliationResult, 'countDocuments', () => Promise.resolve(1));
      mock.method(ReconciliationResult, 'find', (q) => {
        captured.findQuery = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve([{ _id: 'e1', status: 'EXCEPTION', exceptionType: 'MISSING_BANK_TRANSACTION', paymentId: 'P9' }]); } };
      });

      const req = makeReq({ runId: RUN_A }, { exceptionType: 'MISSING_BANK_TRANSACTION' });
      const res = mockRes();
      await runController.getExceptions(req, res);
      assert.equal(captured.findQuery.exceptionType, 'MISSING_BANK_TRANSACTION');
      assert.equal(res.body.data[0].severity, 'HIGH');
    });

    it('rejects foreign run', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
      const req = makeReq({ runId: RUN_FOREIGN });
      const res = mockRes();
      await runController.getExceptions(req, res);
      assert.equal(res.statusCode, 404);
    });
  });

  describe('Run-aware dashboard', () => {
    it('returns run-specific metrics for an owned run', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(makeRun({ analytics: ANALYTICS })));
      mock.method(ReconciliationResult, 'find', () => ({
        sort() { return this; }, limit() { return this; }, lean() { return Promise.resolve([]); },
      }));

      const req = makeReq({}, { runId: RUN_A });
      const res = mockRes();
      await dashboardController.getDashboard(req, res);

      assert.equal(res.body.hasData, true);
      assert.equal(res.body.dashboard.overview.paymentsProcessed, 5);
      assert.equal(res.body.dashboard.overview.matchedPayments, 3);
      assert.equal(res.body.dashboard.overview.exceptions, 2);
      assert.equal(res.body.dashboard.mode, 'run');
    });

    it('rejects foreign/missing run with 404 (no demo fallback)', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
      const req = makeReq({}, { runId: RUN_FOREIGN });
      const res = mockRes();
      await dashboardController.getDashboard(req, res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
    });

    it('returns hasData=false for a run with no analytics yet', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(makeRun({ status: 'READY', analytics: null })));
      const req = makeReq({}, { runId: RUN_A });
      const res = mockRes();
      await dashboardController.getDashboard(req, res);
      assert.equal(res.body.hasData, false);
      assert.equal(res.body.dashboard, null);
    });
  });

  describe('Run-aware Finance Q&A', () => {
    it('controller rejects foreign run with 404', async () => {
      mock.method(ReconciliationRun, 'findOne', () => Promise.resolve(null));
      const req = makeReq({}, {}, { _id: 'OWNER', name: 'Owner' }, { question: 'How many exceptions?', runId: RUN_FOREIGN });
      const res = mockRes();
      await financeQAController.askFinanceQuestion(req, res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
    });

    it('buildContext grounds metrics in the supplied run analytics (different runs -> different metrics)', () => {
      const ctxA = buildContext('How many exceptions do we have?', 'EXCEPTIONS', { analytics: ANALYTICS, results: [], scope: RUN_A });
      const ctxB = buildContext('How many exceptions do we have?', 'EXCEPTIONS', { analytics: ANALYTICS_B, results: [], scope: RUN_B });
      assert.equal(ctxA.success, true);
      assert.equal(ctxB.success, true);

      const mA = getDeterministicKeyMetrics(ctxA.context);
      const mB = getDeterministicKeyMetrics(ctxB.context);
      const excA = mA.find((m) => m.label === 'Exceptions');
      const excB = mB.find((m) => m.label === 'Exceptions');
      assert.equal(excA.value, '2');
      assert.equal(excB.value, '1');
      assert.notEqual(excA.value, excB.value);
    });

    it('cache is scoped per-run so a second run never reuses the first run answer', async () => {
      clearCache();
      const valueA = { answer: 'answer for RUN A', keyMetrics: [{ label: 'Exceptions', value: '2' }], insights: [], dataSources: ['run analytics'], confidence: 0.9, requiresHumanReview: false };
      const valueB = { answer: 'answer for RUN B', keyMetrics: [{ label: 'Exceptions', value: '1' }], insights: [], dataSources: ['run analytics'], confidence: 0.9, requiresHumanReview: false };
      let calls = 0;
      mock.method(geminiClient, 'isAvailable', () => true);
      mock.method(geminiClient, 'generateContent', () => {
        calls += 1;
        return Promise.resolve(JSON.stringify(calls === 1 ? valueA : valueB));
      });

      const q = 'What is the exception rate?';
      const a = await askFinanceQuestion(q, { analytics: ANALYTICS, results: [], scope: RUN_A });
      const b = await askFinanceQuestion(q, { analytics: ANALYTICS_B, results: [], scope: RUN_B });
      const a2 = await askFinanceQuestion(q, { analytics: ANALYTICS, results: [], scope: RUN_A });

      assert.equal(a.data.answer, 'answer for RUN A');
      assert.equal(b.data.answer, 'answer for RUN B');
      assert.equal(a2.data.answer, 'answer for RUN A');
      assert.equal(calls, 2, 'third call hits cache; only two LLM calls happened');
    });
  });

  describe('Run-aware audit logs', () => {
    it('scopes logs to the authenticated user only', async () => {
      const captured = {};
      mock.method(AuditLog, 'countDocuments', () => Promise.resolve(0));
      mock.method(AuditLog, 'find', (q) => {
        captured.q = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve([]); } };
      });

      const req = makeReq({}, { page: '1', limit: '25' }, { _id: 'user-x', name: 'X' });
      const res = mockRes();
      await auditController.getLogs(req, res);
      assert.equal(captured.q.userId, 'user-x');
    });

    it('filters by runId when provided', async () => {
      const captured = {};
      mock.method(AuditLog, 'countDocuments', () => Promise.resolve(0));
      mock.method(AuditLog, 'find', (q) => {
        captured.q = q;
        return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve([]); } };
      });

      const runId = new mongoose.Types.ObjectId().toString();
      const req = makeReq({}, { runId }, { _id: 'user-x', name: 'X' });
      const res = mockRes();
      await auditController.getLogs(req, res);
      assert.equal(captured.q.resourceId, runId);
      assert.equal(captured.q.userId, 'user-x');
    });
  });
});
