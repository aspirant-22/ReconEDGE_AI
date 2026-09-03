const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { protect } = require('../../../middleware/auth');
const financeQAService = require('../../../services/ai/financeQA');

let controller;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function reqWithBody(body, authValue) {
  return {
    body,
    headers: authValue ? { authorization: authValue } : {},
  };
}

describe('Finance Q&A Controller', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_secret_for_finance_qa_route';

    mock.method(financeQAService, 'askFinanceQuestion', async (question) => ({
      success: true,
      data: {
        question,
        intent: 'SUMMARY',
        answer: 'The system has 350 matched payments and 175 exceptions.',
        keyMetrics: [{ label: 'Matched', value: '350' }],
        insights: ['Exceptions are elevated.'],
        dataSources: ['reconciliation-analytics'],
        confidence: 0.9,
        requiresHumanReview: true,
      },
    }));

    // Re-require the controller so it picks up the mocked service function.
    delete require.cache[require.resolve('../../../controllers/financeQAController')];
    controller = require('../../../controllers/financeQAController');
  });

  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
    delete require.cache[require.resolve('../../../controllers/financeQAController')];
  });

  it('Test 1 — POST /api/ai/finance-qa without JWT returns 401', async () => {
    const req = reqWithBody({ question: 'What is the match rate?' }, null);
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  it('Test 2 — POST /api/ai/finance-qa with invalid JWT returns 401', async () => {
    const req = reqWithBody({ question: 'What is the match rate?' }, 'Bearer invalid.token.here');
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  it('Test 3 — valid JWT passes the protect middleware', async () => {
    mock.method(User, 'findById', async () => ({ _id: 'user-abc', name: 'QA User' }));
    const token = jwt.sign({ id: 'user-abc' }, process.env.JWT_SECRET);
    const req = reqWithBody({ question: 'What is the match rate?' }, `Bearer ${token}`);
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert.equal(nextCalled, true);
    assert.equal(req.user._id, 'user-abc');
  });

  it('Test 4 — missing question returns 400', async () => {
    const req = reqWithBody({}, 'Bearer valid.token');
    const res = mockRes();
    await controller.askFinanceQuestion(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'QA_INVALID_INPUT');
  });

  it('Test 5 — empty question returns 400', async () => {
    const req = reqWithBody({ question: '   ' }, 'Bearer valid.token');
    const res = mockRes();
    await controller.askFinanceQuestion(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'QA_INVALID_INPUT');
  });

  it('Test 6 — non-string question returns 400', async () => {
    const req = reqWithBody({ question: 42 }, 'Bearer valid.token');
    const res = mockRes();
    await controller.askFinanceQuestion(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'QA_INVALID_INPUT');
  });

  it('Test 7 — over-length question returns 400', async () => {
    const req = reqWithBody({ question: 'x'.repeat(1001) }, 'Bearer valid.token');
    const res = mockRes();
    await controller.askFinanceQuestion(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'QA_INVALID_INPUT');
  });

  it('Test 8 — valid question returns structured success', async () => {
    const req = reqWithBody({ question: 'What is the match rate?' }, 'Bearer valid.token');
    const res = mockRes();
    await controller.askFinanceQuestion(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.intent, 'SUMMARY');
    assert.ok(Array.isArray(res.body.data.keyMetrics));
    assert.ok(Array.isArray(res.body.data.insights));
    assert.ok(Array.isArray(res.body.data.dataSources));
    assert.equal(typeof res.body.data.confidence, 'number');
    assert.equal(typeof res.body.data.requiresHumanReview, 'boolean');
  });
});
