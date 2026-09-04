const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const jwt = require('jsonwebtoken');

const { sanitize } = require('../../utils/logger');
const { createRateLimiter } = require('../rateLimit');
const { securityHeaders } = require('../securityHeaders');
const errorHandler = require('../errorHandler');
const { validateEnvironment } = require('../../config/env');
const { protect } = require('../auth');
const User = require('../../models/User');
const geminiClient = require('../../services/ai/geminiClient');
const healthRouter = require('../../routes/health');

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.setHeader = (name, value) => { res.headers[name] = value; return res; };
  return res;
}

function runLimiter(limiter, req) {
  const res = mockRes();
  let nextCalled = false;
  limiter(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

describe('Phase 8 — Production Hardening', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_secret_for_phase_8_validation_1234';
  });
  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
  });

  it('Test 1 — logger.sanitize redacts Gemini API keys', () => {
    const out = sanitize('key is AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx seen here');
    assert.equal(out.includes('AIzaSyB'), false);
    assert.ok(out.includes('[REDACTED]'));
  });

  it('Test 2 — logger.sanitize redacts bearer tokens in text', () => {
    const out = sanitize('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.some.thing was used');
    assert.equal(out.includes('eyJhbGciOiJIUzI1NiJ9'), false);
    assert.ok(out.includes('[REDACTED]'));
  });

  it('Test 3 — logger.sanitize redacts JWT_SECRET assignments', () => {
    const out = sanitize('JWT_SECRET=supersecretvalue');
    assert.equal(out.includes('supersecretvalue'), false);
    assert.ok(out.includes('[REDACTED]'));
  });

  it('Test 4 — reports missing required config by name only', () => {
    const originalUri = process.env.MONGODB_URI;
    const originalPort = process.env.PORT;
    delete process.env.MONGODB_URI;
    delete process.env.PORT;
    process.env.JWT_SECRET = 'this_is_a_strong_secret_123456';
    const result = validateEnvironment();
    assert.equal(result.valid, true);
    if (originalUri) process.env.MONGODB_URI = originalUri;
    if (originalPort) process.env.PORT = originalPort;
  });

  it('Test 5 — rejects a weak JWT_SECRET', () => {
    process.env.JWT_SECRET = 'short';
    const result = validateEnvironment();
    assert.equal(result.valid, false);
    process.env.JWT_SECRET = 'this_is_a_strong_secret_123456';
  });

  it('Test 6 — Gemini absence does not invalidate env (core app starts)', () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.JWT_SECRET = 'this_is_a_strong_secret_123456';
    const result = validateEnvironment();
    assert.equal(result.gemini, false);
    assert.equal(result.valid, true);
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  it('Test 7 — rate limiter returns 429 after exceeding the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2, keyPrefix: 't7' });
    const req = { ip: '1.2.3.4', user: { _id: 'user-t7' } };

    const first = runLimiter(limiter, req);
    assert.equal(first.nextCalled, true);
    assert.notEqual(first.res.statusCode, 429);

    const second = runLimiter(limiter, req);
    assert.equal(second.nextCalled, true);

    const third = runLimiter(limiter, req);
    assert.equal(third.nextCalled, false);
    assert.equal(third.res.statusCode, 429);
    assert.equal(third.res.body.success, false);
    assert.equal(third.res.body.error.code, 'RATE_LIMITED');
  });

  it('Test 8 — applies hardened security response headers', () => {
    const res = mockRes();
    let called = false;
    securityHeaders({}, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(res.headers['X-Frame-Options'], 'DENY');
    assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  });

  it('Test 9 — error handler does not leak internal stack/paths/secrets', () => {
    const req = {};
    const res = mockRes();
    res.statusCode = 500;
    const err = new Error('Unexpected failure at C:\\Users\\someone\\secret.js: process.env.GEMINI_API_KEY=AIzaSyBsecret');
    errorHandler(err, req, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INTERNAL_ERROR');
    assert.equal(res.body.message.includes('AIzaSyB'), false);
    assert.equal(res.body.message.includes('secret.js'), false);
  });

  it('Test 10 — invalid JSON body maps to 400 INVALID_JSON', () => {
    const res = mockRes();
    const err = Object.assign(new Error('Invalid JSON'), { type: 'entity.parse.failed' });
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  it('Test 11 — oversized body maps to 413 PAYLOAD_TOO_LARGE', () => {
    const res = mockRes();
    const err = Object.assign(new Error('too large'), { type: 'entity.too.large' });
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  it('Test 12 — error handler preserves `message` for legacy clients', () => {
    const res = mockRes();
    errorHandler(new Error('generic failure'), {}, res, () => {});
    assert.equal(typeof res.body.message, 'string');
    assert.equal(typeof res.body.error.message, 'string');
  });

  it('Test 13 — analyze-exception require a valid JWT via protect', async () => {
    const token = jwt.sign({ id: 'user-p8' }, process.env.JWT_SECRET);
    mock.method(User, 'findById', async () => ({ _id: 'user-p8', name: 'P8' }));
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user._id, 'user-p8');
  });

  it('Test 14 — analyze-exception without JWT returns 401 (protected route)', async () => {
    const req = { headers: {} };
    const res = mockRes();
    await protect(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  it('Test 15 — health endpoint reports AI availability accurately', () => {
    const handler = healthRouter.stack[0].route.stack[0].handle;

    mock.method(geminiClient, 'isAvailable', () => false);
    const resUnavailable = mockRes();
    handler({}, resUnavailable, () => {});
    assert.equal(resUnavailable.body.success, true);
    assert.equal(resUnavailable.body.checks.ai.available, false);
    assert.equal(resUnavailable.body.checks.ai.status, 'unavailable');
    assert.equal(resUnavailable.body.checks.ai.model, null);

    mock.method(geminiClient, 'isAvailable', () => true);
    const resAvailable = mockRes();
    handler({}, resAvailable, () => {});
    assert.equal(resAvailable.body.success, true);
    assert.equal(resAvailable.body.checks.ai.available, true);
    assert.equal(resAvailable.body.checks.ai.status, 'configured');
    assert.ok(typeof resAvailable.body.checks.ai.model === 'string');
    assert.ok('application' in resAvailable.body.checks);
    assert.ok('database' in resAvailable.body.checks);
  });
});
