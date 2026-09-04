const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ReconciliationRun = require('../../models/ReconciliationRun');
const ReconciliationResult = require('../../models/ReconciliationResult');
const AuditLog = require('../../models/AuditLog');
const aiIndex = require('../../services/ai');
const geminiClient = require('../../services/ai/geminiClient');
const { buildPrompt, buildAnalysisPayload } = require('../../services/ai/prompts');
const { GROUND_TRUTH_FIELDS } = require('../../services/ai/exceptionAnalyzer');

let runController;
let aiController;

const USER_A = 'USER_A';
const USER_B = 'USER_B';
const RUN_A1 = new mongoose.Types.ObjectId().toString();
const RUN_A2 = new mongoose.Types.ObjectId().toString();
const RUN_B1 = new mongoose.Types.ObjectId().toString();

const EXC_A1 = {
  paymentId: 'PAY-A1-001',
  bankTransactionId: 'BANK-A1-001',
  invoiceId: 'INV-A1-001',
  status: 'EXCEPTION',
  exceptionType: 'AMOUNT_MISMATCH',
  paymentAmount: 2663.82,
  bankAmount: 2519.24,
  invoiceAmount: 2663.82,
  amountDifference: 144.58,
  dateDifferenceDays: 1,
};

const EXC_A2 = {
  paymentId: 'PAY-A2-001',
  bankTransactionId: null,
  invoiceId: 'INV-A2-001',
  status: 'EXCEPTION',
  exceptionType: 'MISSING_BANK_TRANSACTION',
  paymentAmount: 5000,
  bankAmount: null,
  invoiceAmount: 5000,
  amountDifference: 0,
  dateDifferenceDays: 0,
};

const EXC_B1 = {
  paymentId: 'PAY-B1-001',
  bankTransactionId: 'BANK-B1-001',
  invoiceId: 'INV-B1-001',
  status: 'EXCEPTION',
  exceptionType: 'DATE_MISMATCH',
  paymentAmount: 1200,
  bankAmount: 1200,
  invoiceAmount: 1200,
  amountDifference: 0,
  dateDifferenceDays: 3,
};

const EXPERTS = {
  'PAY-A1-001': { runId: RUN_A1, record: EXC_A1 },
  'PAY-A2-001': { runId: RUN_A2, record: EXC_A2 },
  'PAY-B1-001': { runId: RUN_B1, record: EXC_B1 },
};

function makeRun({ _id, userId, name }) {
  return {
    _id,
    userId,
    name,
    status: 'COMPLETED',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    paymentCount: 5,
    bankTransactionCount: 5,
    invoiceCount: 5,
    validPaymentCount: 5,
    validBankTransactionCount: 5,
    validInvoiceCount: 5,
    matchedCount: 3,
    exceptionCount: 2,
    processingTimeMs: 10,
    errorMessage: null,
  };
}

const RUN_DOCS = [
  makeRun({ _id: RUN_A1, userId: USER_A, name: 'Run A1' }),
  makeRun({ _id: RUN_A2, userId: USER_A, name: 'Run A2' }),
  makeRun({ _id: RUN_B1, userId: USER_B, name: 'Run B1' }),
];

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function makeReq(params, user) {
  return {
    params: params || {},
    query: {},
    user: user || { _id: USER_A, name: 'User A' },
    body: {},
  };
}

let analyzeCalls = [];

function validAnalysis() {
  return {
    summary: 'Amount differs between payment and bank transaction.',
    likelyCause: 'Possible fee or adjustment.',
    riskLevel: 'MEDIUM',
    recommendedActions: ['Review settlement details.'],
    confidence: 0.8,
    requiresHumanReview: true,
  };
}

describe('Phase 11 — Run-Scoped AI Exception Analysis Isolation', () => {
  before(() => {
    process.env.JWT_SECRET = 'phase11_isolation_secret';
    mock.method(AuditLog, 'create', () => Promise.resolve({ _id: 'audit-log' }));

    mock.method(ReconciliationRun, 'findOne', (query) => {
      const run = RUN_DOCS.find((r) => String(r._id) === String(query && query._id));
      if (!run) return Promise.resolve(null);
      if (String(run.userId) !== String(query && query.userId)) return Promise.resolve(null);
      return Promise.resolve(run);
    });

    mock.method(ReconciliationResult, 'findOne', (query) => ({
      lean: async () => {
        const q = query || {};
        const or = q.$or || [];
        const pid = (or[0] && (or[0].paymentId || or[0].bankTransactionId)) || null;
        const entry = pid ? EXPERTS[pid] : null;
        if (!entry) return null;
        if (String(entry.runId) !== String(q.runId)) return null;
        return { ...entry.record };
      },
    }));

    analyzeCalls = [];
    mock.method(aiIndex, 'analyzeException', async (exceptionId, record, scope) => {
      analyzeCalls.push({ exceptionId, record, scope });
      return { success: true, analysis: validAnalysis(), cached: false };
    });

    delete require.cache[require.resolve('../../controllers/reconciliationRunController')];
    delete require.cache[require.resolve('../../controllers/aiController')];
    delete require.cache[require.resolve('../../controllers/auditLogController')];
    runController = require('../../controllers/reconciliationRunController');
    aiController = require('../../controllers/aiController');
  });

  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
  });

  it('1 — User A analyzing exception in Run A1 succeeds with A1-scoped context', async () => {
    analyzeCalls = [];
    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001' }, { _id: USER_A, name: 'User A' }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(String(res.body.runId), RUN_A1);
    assert.equal(res.body.exceptionType, 'AMOUNT_MISMATCH');
    assert.equal(analyzeCalls.length, 1);
    assert.equal(analyzeCalls[0].scope, `${USER_A}:${RUN_A1}`);
    assert.equal(analyzeCalls[0].record.paymentId, 'PAY-A1-001');
    assert.equal(analyzeCalls[0].record.runName, 'Run A1');
    assert.equal(analyzeCalls[0].record.exceptionType, 'AMOUNT_MISMATCH');
  });

  it('2 — User A analyzing exception in Run A2 succeeds with A2-scoped context', async () => {
    analyzeCalls = [];
    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_A2, exceptionId: 'PAY-A2-001' }, { _id: USER_A, name: 'User A' }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(analyzeCalls.length, 1);
    assert.equal(analyzeCalls[0].scope, `${USER_A}:${RUN_A2}`);
    assert.equal(analyzeCalls[0].record.paymentId, 'PAY-A2-001');
    assert.equal(analyzeCalls[0].record.runName, 'Run A2');
    assert.equal(analyzeCalls[0].record.exceptionType, 'MISSING_BANK_TRANSACTION');
  });

  it('3 — User B analyzing exception in Run B1 succeeds with B1-scoped context', async () => {
    analyzeCalls = [];
    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_B1, exceptionId: 'PAY-B1-001' }, { _id: USER_B, name: 'User B' }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(analyzeCalls.length, 1);
    assert.equal(analyzeCalls[0].scope, `${USER_B}:${RUN_B1}`);
    assert.equal(analyzeCalls[0].record.paymentId, 'PAY-B1-001');
  });

  it('4 — User A attempting to analyze Run B1 exception returns 404 (owned-run boundary)', async () => {
    analyzeCalls = [];
    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_B1, exceptionId: 'PAY-B1-001' }, { _id: USER_A, name: 'User A' }),
      res
    );
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
    assert.equal(analyzeCalls.length, 0, 'analyzer must never be invoked for a foreign run');
  });

  it('5 — User B attempting to analyze Run A1 exception returns 404 (owned-run boundary)', async () => {
    analyzeCalls = [];
    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001' }, { _id: USER_B, name: 'User B' }),
      res
    );
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'RUN_NOT_FOUND');
    assert.equal(analyzeCalls.length, 0);
  });

  it('4b — exception that belongs to another run within the same user cannot be analyzed', async () => {
    // A owns RUN_A1 % RUN_A2. An A1 exception id requested against RUN_A2 must 404.
    analyzeCalls = [];
    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_A2, exceptionId: 'PAY-A1-001' }, { _id: USER_A, name: 'User A' }),
      res
    );
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'EXCEPTION_NOT_FOUND');
    assert.equal(analyzeCalls.length, 0);
  });

  it('6 — A1 cache scope differs from A2: cached A1 response is not returned for A2', async () => {
    // Use the real analyzer + gemini mock to prove cache isolation across runs for the same user.
    mock.restoreAll(); // remove controller mocks; we test the analyzer directly now
    let geminiCalls = 0;
    mock.method(geminiClient, 'isAvailable', () => true);
    mock.method(geminiClient, 'generateContent', () => {
      geminiCalls += 1;
      return Promise.resolve(JSON.stringify({
        summary: `Analysis for scope invoked ${geminiCalls}`,
        likelyCause: 'Deterministic cause.',
        riskLevel: 'LOW',
        recommendedActions: ['Verify with source system.'],
        confidence: 0.9,
        requiresHumanReview: false,
      }));
    });
    const { analyzeException, clearCache } = require('../../services/ai/exceptionAnalyzer');
    clearCache();

    const recordA1 = { ...EXC_A1, runName: 'Run A1' };
    const recordA2 = { ...EXC_A2, runName: 'Run A2' };

    const first = await analyzeException('PAY-A1-001', recordA1, `${USER_A}:${RUN_A1}`);
    assert.equal(first.success, true, 'first A1 analysis succeeds');
    assert.ok(!first.cached);
    const geminiAfterFirst = geminiCalls;

    // Analyzing A1 again (same scope + record) must hit cache, not Gemini.
    const sameScopeAgain = await analyzeException('PAY-A1-001', recordA1, `${USER_A}:${RUN_A1}`);
    assert.equal(sameScopeAgain.cached, true, 'same run+exception+record uses cache');
    assert.equal(geminiCalls, geminiAfterFirst, 'Gemini not called again for same scope cache hit');

    // Analyzing A1's id under A2 scope must NOT reuse the A1 cache entry.
    const a2Scoped = await analyzeException('PAY-A1-001', recordA2, `${USER_A}:${RUN_A2}`);
    assert.ok(!a2Scoped.cached, 'A2 scope must not get cached A1 response');
    assert.equal(geminiCalls, geminiAfterFirst + 1, 'Gemini called again for different run scope');
  });

  it('7 — B1 cache scope differs from A1: cached A1 response is not returned for B1 (cross-user)', async () => {
    // Continue in the same sandbox: gemini mock already installed by test 6 ordering.
    const { analyzeException, clearCache } = require('../../services/ai/exceptionAnalyzer');
    clearCache();
    let geminiCalls = 0;
    mock.method(geminiClient, 'isAvailable', () => true);
    mock.method(geminiClient, 'generateContent', () => {
      geminiCalls += 1;
      return Promise.resolve(JSON.stringify({
        summary: 'Isolated analysis.',
        likelyCause: 'Deterministic.',
        riskLevel: 'LOW',
        recommendedActions: ['Review.'],
        confidence: 0.8,
        requiresHumanReview: true,
      }));
    });

    const recordA1 = { ...EXC_A1, runName: 'Run A1' };
    const recordB1 = { ...EXC_B1, runName: 'Run B1' };

    const a1 = await analyzeException('PAY-A1-001', recordA1, `${USER_A}:${RUN_A1}`);
    assert.equal(a1.success, true);
    const callsAfterA1 = geminiCalls;

    // Same exception id presented under User B's run scope must NOT reuse A1 cache.
    const b1 = await analyzeException('PAY-A1-001', recordB1, `${USER_B}:${RUN_B1}`);
    assert.ok(!b1.cached, 'B1 scope must not get cached A1 response (cross-user)');
    assert.equal(geminiCalls, callsAfterA1 + 1, 'Gemini invoked again for a different user scope');
  });

  it('8 — Real run with unavailable run data returns AI_CONTEXT_UNAVAILABLE, never demo fallback', async () => {
    mock.restoreAll();
    mock.method(AuditLog, 'create', () => Promise.resolve({ _id: 'audit-log' }));
    mock.method(ReconciliationRun, 'findOne', (query) => {
      const run = RUN_DOCS.find((r) => String(r._id) === String(query && query._id));
      if (!run) return Promise.resolve(null);
      if (String(run.userId) !== String(query && query.userId)) return Promise.resolve(null);
      return Promise.resolve(run);
    });
    mock.method(ReconciliationResult, 'findOne', () => ({
      lean: async () => ({
        ...EXC_A1,
        exceptionType: null,
        status: 'EXCEPTION',
      }),
    }));
    analyzeCalls = [];
    mock.method(aiIndex, 'analyzeException', async (exceptionId, record, scope) => {
      analyzeCalls.push({ exceptionId, record, scope });
      return { success: true, analysis: validAnalysis(), cached: false };
    });
    delete require.cache[require.resolve('../../controllers/reconciliationRunController')];
    runController = require('../../controllers/reconciliationRunController');

    const res = mockRes();
    await runController.analyzeExceptionAction(
      makeReq({ runId: RUN_A1, exceptionId: 'PAY-A1-001' }, { _id: USER_A, name: 'User A' }),
      res
    );
    assert.equal(res.statusCode, 422);
    assert.equal(res.body.error.code, 'AI_CONTEXT_UNAVAILABLE');
    assert.equal(analyzeCalls.length, 0, 'analyzer must not be called (no demo/global fallback)');
  });

  it('9 — Ground-truth fields never reach the AI context', () => {
    const contaminated = {
      ...EXC_A1,
      runName: 'Run A1',
      runStatus: 'COMPLETED',
      expectedScenario: 'EXACT_MATCH',
      expectedBankTransactionId: 'BANK-SECRET',
      expectedInvoiceId: 'INV-SECRET',
      'ground-truth': { should: 'never', reach: 'gemini' },
      groundTruth: { also: 'blocked' },
    };

    // The payload (what is embedded into the prompt sent to Gemini) is a
    // whitelist built by buildAnalysisPayload — it cannot contain ground truth.
    const payload = buildAnalysisPayload(contaminated);
    const allKeys = collectKeys(payload);
    for (const field of GROUND_TRUTH_FIELDS) {
      assert.ok(!allKeys.has(field), `payload must not contain ${field}`);
    }
    assert.ok(!JSON.stringify(payload).includes('expectedScenario'));
    assert.ok(!JSON.stringify(payload).includes('expectedBankTransactionId'));
    assert.ok(!JSON.stringify(payload).includes('expectedInvoiceId'));

    // The full prompt sent to Gemini is ground-truth free too.
    const prompt = buildPrompt(contaminated);
    assert.ok(!prompt.includes('expectedScenario'));
    assert.ok(!prompt.includes('expectedBankTransactionId'));
    assert.ok(!prompt.includes('expectedInvoiceId'));
    assert.ok(!prompt.includes('ground-truth'));
    assert.ok(!prompt.includes('groundTruth'));

    // The ReconciliationResult model physically cannot store ground-truth fields.
    const schemaPaths = Object.keys(ReconciliationResult.schema.paths);
    for (const field of GROUND_TRUTH_FIELDS) {
      assert.ok(!schemaPaths.includes(field), `ReconciliationResult schema must not define ${field}`);
    }
  });

  it('10 — Demo mode AI exception analysis continues to work independently', async () => {
    mock.restoreAll();
    mock.method(AuditLog, 'create', () => Promise.resolve({ _id: 'audit-log' }));
    let demoAnalyzeCalls = 0;
    mock.method(aiIndex, 'analyzeException', async () => {
      demoAnalyzeCalls += 1;
      return { success: true, analysis: validAnalysis(), cached: false };
    });
    delete require.cache[require.resolve('../../controllers/aiController')];
    aiController = require('../../controllers/aiController');

    // Pull a real demo exception id out of the generated demo results file.
    const resultsPath = path.join(__dirname, '..', '..', '..', 'data', 'generated', 'reconciliation-results.json');
    const raw = fs.readFileSync(resultsPath, 'utf8');
    const demoResults = JSON.parse(raw);
    const demoExc = demoResults.find((r) => r.status === 'EXCEPTION');
    assert.ok(demoExc, 'demo results contain at least one exception');

    const res = mockRes();
    await aiController.analyzeException(
      { body: { exceptionId: demoExc.paymentId || demoExc.bankTransactionId }, user: { _id: USER_A, name: 'User A' } },
      res
    );

    assert.equal(res.statusCode, 200, 'demo exception analysis still works');
    assert.equal(res.body.success, true);
    assert.equal(demoAnalyzeCalls, 1, 'demo path calls the shared analyzer');
    assert.equal(res.body.runId, undefined, 'demo analysis is not run-scoped');

    // Demo records may contain ground-truth fields in the file; the prompt is still clean.
    const prompt = buildPrompt(demoExc);
    assert.ok(!prompt.includes('expectedScenario'));
    assert.ok(!prompt.includes('expectedBankTransactionId'));
    assert.ok(!prompt.includes('expectedInvoiceId'));
  });
});

function collectKeys(obj) {
  const all = new Set();
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      all.add(key);
      walk(value[key]);
    }
  };
  walk(obj);
  return all;
}