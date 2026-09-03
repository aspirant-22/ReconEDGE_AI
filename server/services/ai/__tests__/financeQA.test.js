const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { protect } = require('../../../middleware/auth');
const { askFinanceQuestion, validateFinanceAnswer, hasGroundTruthFields, hasActionVerbs, detectIntent } = require('../financeQA');
const { buildFinanceQAPrompt, FINANCE_QA_SYSTEM_PROMPT } = require('../prompts');
const geminiClient = require('../geminiClient');

describe('Finance Q&A Service', () => {
  before(() => {
    process.env.JWT_SECRET = 'test_secret_for_finance_qa';
  });

  after(() => {
    delete process.env.JWT_SECRET;
    mock.restoreAll();
  });

  describe('System prompt guardrails', () => {
    it('includes grounding and advisory rules', () => {
      const lower = FINANCE_QA_SYSTEM_PROMPT.toLowerCase();
      assert.ok(lower.includes('never invent'));
      assert.ok(lower.includes('ground-truth'));
      assert.ok(lower.includes('do not modify'));
      assert.ok(lower.includes('advisory'));
      assert.ok(lower.includes('json only'));
    });

    it('prompt embeds only the provided context, not ground truth', () => {
      const context = { reconciliation: { matched: 350, exceptions: 175 } };
      const prompt = buildFinanceQAPrompt('What is the match rate?', context);
      assert.ok(prompt.includes('What is the match rate?'));
      assert.ok(prompt.includes('350'));
      assert.ok(!prompt.includes('expectedScenario'));
      assert.ok(!prompt.includes('expectedBankTransactionId'));
    });
  });

  describe('Intent detection', () => {
    it('detects reconciliation intent', () => {
      assert.equal(detectIntent('What is the payment match rate?'), 'RECONCILIATION');
    });

    it('detects exceptions intent', () => {
      assert.equal(detectIntent('How many exceptions are there?'), 'EXCEPTIONS');
    });

    it('detects financial impact intent', () => {
      assert.equal(detectIntent('What is the total payment amount?'), 'FINANCIAL_IMPACT');
    });

    it('detects control health intent', () => {
      assert.equal(detectIntent('Is the control health critical?'), 'CONTROL_HEALTH');
    });

    it('detects summary intent', () => {
      assert.equal(detectIntent('Give me a summary of the situation'), 'SUMMARY');
    });

    it('returns UNKNOWN for unrelated questions', () => {
      assert.equal(detectIntent('What is the weather today?'), 'UNKNOWN');
    });
  });

  describe('Response validation', () => {
    it('accepts a valid finance answer', () => {
      const valid = {
        answer: 'The exception rate is 35.00%.',
        keyMetrics: [{ label: 'Exception Rate', value: '35.00%' }],
        insights: ['Exceptions are elevated.'],
        dataSources: ['reconciliation-analytics'],
        confidence: 0.9,
        requiresHumanReview: true,
      };
      const result = validateFinanceAnswer(valid);
      assert.equal(result.valid, true);
      assert.equal(result.data.answer, valid.answer);
      assert.equal(result.data.keyMetrics.length, 1);
    });

    it('rejects missing answer', () => {
      const invalid = {
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 0.5,
        requiresHumanReview: false,
      };
      assert.equal(validateFinanceAnswer(invalid).valid, false);
    });

    it('rejects invalid confidence', () => {
      const invalid = {
        answer: 'Test',
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 2,
        requiresHumanReview: false,
      };
      assert.equal(validateFinanceAnswer(invalid).valid, false);
    });

    it('rejects non-boolean requiresHumanReview', () => {
      const invalid = {
        answer: 'Test',
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 0.5,
        requiresHumanReview: 'yes',
      };
      assert.equal(validateFinanceAnswer(invalid).valid, false);
    });

    it('rejects unsupported schema fields', () => {
      const invalid = {
        answer: 'Test',
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 0.5,
        requiresHumanReview: false,
        inventedField: 'should be rejected',
      };
      assert.equal(validateFinanceAnswer(invalid).valid, false);
    });

    it('rejects empty answer', () => {
      const invalid = {
        answer: '',
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 0.5,
        requiresHumanReview: false,
      };
      assert.equal(validateFinanceAnswer(invalid).valid, false);
    });
  });

  describe('Action verb guardrail', () => {
    it('detects financial mutation verbs', () => {
      assert.equal(hasActionVerbs('I will delete the transaction'), true);
      assert.equal(hasActionVerbs('You should approve this payment'), true);
    });

    it('allows normal advisory language', () => {
      assert.equal(hasActionVerbs('The exception rate is high.'), false);
    });
  });

  describe('Ground truth isolation', () => {
    it('detects ground-truth-like fields in responses', () => {
      assert.equal(hasGroundTruthFields({ answer: 'ok', expectedScenario: 'X' }), true);
    });

    it('passes clean responses', () => {
      assert.equal(hasGroundTruthFields({ answer: 'ok', keyMetrics: [] }), false);
    });
  });

  describe('Unknown-intent short-circuit', () => {
    it('does not call Gemini for unrelated questions', async () => {
      geminiClient.configure({ apiKey: undefined });
      const result = await askFinanceQuestion('What color is the sky?');
      assert.equal(result.success, true);
      assert.equal(result.data.intent, 'UNKNOWN');
    });
  });

  describe('Empty and invalid input', () => {
    it('rejects empty question', async () => {
      const result = await askFinanceQuestion('');
      assert.equal(result.success, false);
      assert.equal(result.error.code, 'QA_INVALID_INPUT');
    });

    it('rejects non-string question', async () => {
      const result = await askFinanceQuestion(42);
      assert.equal(result.success, false);
      assert.equal(result.error.code, 'QA_INVALID_INPUT');
    });
  });
});
