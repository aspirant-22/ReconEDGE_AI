const geminiClient = require('./geminiClient');
const { buildFinanceQAPrompt } = require('./prompts');
const { parseResponse } = require('./responseParser');
const { buildContext } = require('./financeContext');

const INTENTS = [
  'RECONCILIATION',
  'EXCEPTIONS',
  'FINANCIAL_IMPACT',
  'CONTROL_HEALTH',
  'SUMMARY',
  'TRANSACTION_DETAILS',
  'GENERAL_FINANCE',
  'UNKNOWN',
];

const GROUND_TRUTH_FIELDS = [
  'expectedScenario',
  'expectedBankTransactionId',
  'expectedInvoiceId',
  'ground-truth',
  'groundTruth',
];

const QA_CACHE = new Map();

const RECONCILIATION_KEYWORDS = [
  'reconcil', 'match rate', 'successfully reconciled', 'percentage', 'payment match',
  'bank match', 'invoice match', 'reconciled', 'matched payments', 'how many are matched',
  'clean match', 'reconciliation rate',
];

const EXCEPTIONS_KEYWORDS = [
  'exception', 'unmatched', 'duplicate', 'amount mismatch', 'date mismatch',
  'missing bank', 'most common exception', 'exception category', 'exception type',
  'how many exception', 'highest-risk', 'highest risk', 'priority exception',
];

const FINANCIAL_KEYWORDS = [
  'amount', 'money', 'financial impact', 'total payment amount', 'total amount',
  'impact', 'affected', 'sum', 'value of', 'how much money', 'currency',
  'difference between matched and exception',
];

const CONTROL_KEYWORDS = [
  'control health', 'critical', 'warning', 'healthy', 'health', 'why is',
  'threshold', 'control', 'dashboard critical',
];

const SUMMARY_KEYWORDS = [
  'summary', 'summarize', 'overview', 'situation', 'give me a', 'complete picture',
  'general status', 'wrap up',
];

const TRANSACTION_KEYWORDS = [
  'transaction', 'list', 'details', 'reference', 'record', 'show me',
  'which exception is', 'look up', 'find transaction',
];

function normalizeQuestion(question) {
  return question.toLowerCase().trim();
}

function detectIntent(question) {
  const q = normalizeQuestion(question);

  const hasReconciliation = RECONCILIATION_KEYWORDS.some((kw) => q.includes(kw));
  const hasExceptions = EXCEPTIONS_KEYWORDS.some((kw) => q.includes(kw));
  const hasFinancial = FINANCIAL_KEYWORDS.some((kw) => q.includes(kw));
  const hasControl = CONTROL_KEYWORDS.some((kw) => q.includes(kw));
  const hasSummary = SUMMARY_KEYWORDS.some((kw) => q.includes(kw));
  const hasTransaction = TRANSACTION_KEYWORDS.some((kw) => q.includes(kw));

  if (hasSummary) return 'SUMMARY';
  if (hasControl) return 'CONTROL_HEALTH';
  if (hasFinancial) return 'FINANCIAL_IMPACT';
  if (hasReconciliation) return 'RECONCILIATION';
  if (hasExceptions) return 'EXCEPTIONS';
  if (hasTransaction) return 'TRANSACTION_DETAILS';
  return 'UNKNOWN';
}

function hasGroundTruthFields(obj, path = '') {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    const combined = path ? `${path}.${key}` : key;
    if (GROUND_TRUTH_FIELDS.some((f) => key === f || key.includes('expected'))) {
      return true;
    }
    if (typeof obj[key] === 'object' && hasGroundTruthFields(obj[key], combined)) {
      return true;
    }
  }
  return false;
}

function validateFinanceAnswer(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid response format' };
  }

  if (typeof parsed.answer !== 'string' || parsed.answer.trim().length === 0) {
    return { valid: false, error: 'Missing or empty answer' };
  }

  if (!Array.isArray(parsed.keyMetrics)) {
    return { valid: false, error: 'keyMetrics must be an array' };
  }

  const MAX_METRICS = 10;
  if (parsed.keyMetrics.length > MAX_METRICS) {
    parsed.keyMetrics = parsed.keyMetrics.slice(0, MAX_METRICS);
  }

  for (const metric of parsed.keyMetrics) {
    if (!metric || typeof metric !== 'object') {
      return { valid: false, error: 'Each keyMetric must be an object' };
    }
    if (typeof metric.label !== 'string' || metric.label.trim().length === 0) {
      return { valid: false, error: 'keyMetric label must be a non-empty string' };
    }
    if (typeof metric.value !== 'string') {
      return { valid: false, error: 'keyMetric value must be a string' };
    }
  }

  if (!Array.isArray(parsed.insights)) {
    return { valid: false, error: 'insights must be an array' };
  }

  if (!Array.isArray(parsed.dataSources)) {
    return { valid: false, error: 'dataSources must be an array' };
  }

  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
    return { valid: false, error: `Invalid confidence: ${parsed.confidence}. Must be between 0 and 1` };
  }

  if (typeof parsed.requiresHumanReview !== 'boolean') {
    return { valid: false, error: 'requiresHumanReview must be a boolean' };
  }

  const ALLOWED_FIELDS = ['answer', 'keyMetrics', 'insights', 'dataSources', 'confidence', 'requiresHumanReview'];
  const receivedFields = Object.keys(parsed);
  const unknownFields = receivedFields.filter((f) => !ALLOWED_FIELDS.includes(f));
  if (unknownFields.length > 0) {
    return { valid: false, error: `Unsupported fields in response: ${unknownFields.join(', ')}` };
  }

  return {
    valid: true,
    data: {
      answer: parsed.answer.trim(),
      keyMetrics: parsed.keyMetrics.map((m) => ({
        label: m.label.trim(),
        value: m.value.trim(),
      })),
      insights: parsed.insights.map((i) => (typeof i === 'string' ? i.trim() : String(i).trim())),
      dataSources: parsed.dataSources.map((s) => (typeof s === 'string' ? s.trim() : String(s).trim())),
      confidence: parsed.confidence,
      requiresHumanReview: parsed.requiresHumanReview,
    },
  };
}

function hasActionVerbs(text) {
  const forbidden = /(modify|delete|approve|reject|update|create|override|correct|fix|change|mark\s+as\s+resolved|close\s+out|adjust).*(record|transaction|payment|exception|reconcil)/i;
  return forbidden.test(text);
}

function getDeterministicKeyMetrics(context) {
  const metrics = [];

  if (context.reconciliation) {
    metrics.push({
      label: 'Matched Payments',
      value: String(context.reconciliation.matched),
      source: 'reconciliation-analytics',
    });
    metrics.push({
      label: 'Exceptions',
      value: String(context.reconciliation.exceptions),
      source: 'reconciliation-analytics',
    });
    metrics.push({
      label: 'Payment Match Rate',
      value: `${context.reconciliation.paymentMatchRate}%`,
      source: 'reconciliation-analytics',
    });
    metrics.push({
      label: 'Bank Match Rate',
      value: `${context.reconciliation.bankMatchRate}%`,
      source: 'reconciliation-analytics',
    });
    metrics.push({
      label: 'Invoice Match Rate',
      value: `${context.reconciliation.invoiceMatchRate}%`,
      source: 'reconciliation-analytics',
    });
    metrics.push({
      label: 'Exception Rate',
      value: `${context.reconciliation.exceptionRate}%`,
      source: 'reconciliation-analytics',
    });
  }

  if (context.exceptions && context.exceptions.rate !== undefined) {
    metrics.push({
      label: 'Exception Rate',
      value: `${context.exceptions.rate}%`,
      source: 'reconciliation-analytics',
    });
  }

  if (context.financialImpact) {
    const fin = context.financialImpact;
    metrics.push({ label: 'Total Payment Amount', value: String(fin.totalPaymentAmount), source: 'reconciliation-analytics' });
    metrics.push({ label: 'Matched Payment Amount', value: String(fin.matchedPaymentAmount), source: 'reconciliation-analytics' });
    metrics.push({ label: 'Exception Payment Amount', value: String(fin.exceptionPaymentAmount), source: 'reconciliation-analytics' });
    metrics.push({ label: 'Amount Mismatch Impact', value: String(fin.amountMismatchImpact), source: 'reconciliation-analytics' });
  }

  if (context.controlHealth) {
    metrics.push({
      label: 'Control Health',
      value: context.controlHealth.status,
      source: 'reconciliation-analytics',
    });
  }

  return metrics;
}

async function askFinanceQuestion(question) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return { success: false, error: { code: 'QA_INVALID_INPUT', message: 'Question is required.' } };
  }

  const trimmedQuestion = question.trim();
  const intent = detectIntent(trimmedQuestion);

  if (intent === 'UNKNOWN') {
    return {
      success: true,
      data: {
        question: trimmedQuestion,
        intent,
        answer: 'I can only answer questions about the financial reconciliation and analytics data available in this system. Please ask about reconciliation status, exceptions, financial impact, control health, or request a summary.',
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 0,
        requiresHumanReview: false,
      },
    };
  }

  const contextResult = buildContext(trimmedQuestion, intent);
  if (!contextResult.success) {
    return { success: false, error: { code: 'DATA_NOT_FOUND', message: 'Financial data is not available.' } };
  }

  const { context } = contextResult;

  const deterministicMetrics = getDeterministicKeyMetrics(context);
  if (deterministicMetrics.length === 0) {
    return {
      success: true,
      data: {
        question: trimmedQuestion,
        intent,
        answer: 'The relevant financial data is not yet available. Run a reconciliation to populate analytics before asking about this.',
        keyMetrics: [],
        insights: [],
        dataSources: [],
        confidence: 0,
        requiresHumanReview: true,
      },
    };
  }

  const cacheKey = `${intent}:${trimmedQuestion.toLowerCase()}`;
  if (QA_CACHE.has(cacheKey)) {
    return { success: true, data: QA_CACHE.get(cacheKey), cached: true };
  }

  if (!geminiClient.isAvailable()) {
    return { success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' } };
  }

  try {
    const prompt = buildFinanceQAPrompt(trimmedQuestion, context);
    const rawText = await geminiClient.generateContent(prompt);
    const parsed = parseResponse(rawText);

    if (!parsed) {
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: 'Could not parse the AI response.' } };
    }

    if (hasGroundTruthFields(parsed)) {
      console.log('Finance QA guardrail: response contained ground-truth-like fields.');
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: 'Response validation failed.' } };
    }

    if (hasActionVerbs(parsed.answer)) {
      console.log('Finance QA guardrail: answer suggests financial record mutation.');
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: 'Response validation failed.' } };
    }

    if (parsed.keyMetrics && parsed.keyMetrics.some((m) => m && m.value && hasActionVerbs(m.value))) {
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: 'Response validation failed.' } };
    }

    const guardrailResult = validateFinanceAnswer(parsed);
    if (!guardrailResult.valid) {
      console.log('Finance QA validation failed:', guardrailResult.error);
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: guardrailResult.error } };
    }

    const result = {
      question: trimmedQuestion,
      intent,
      answer: guardrailResult.data.answer,
      keyMetrics: guardrailResult.data.keyMetrics,
      insights: guardrailResult.data.insights,
      dataSources: guardrailResult.data.dataSources,
      confidence: guardrailResult.data.confidence,
      requiresHumanReview: guardrailResult.data.requiresHumanReview,
    };

    QA_CACHE.set(cacheKey, result);

    return { success: true, data: result };
  } catch (error) {
    if (error.message === 'AI_NOT_CONFIGURED') {
      return { success: false, error: { code: 'AI_CONFIG_ERROR', message: 'AI is not configured.' } };
    }
    if (error.message === 'AI_TIMEOUT') {
      return { success: false, error: { code: 'AI_TIMEOUT', message: 'AI request timed out.' } };
    }
    console.log('Finance QA unavailable:', error.message);
    return { success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' } };
  }
}

function clearCache() {
  QA_CACHE.clear();
}

module.exports = {
  askFinanceQuestion,
  detectIntent,
  validateFinanceAnswer,
  hasGroundTruthFields,
  hasActionVerbs,
  getDeterministicKeyMetrics,
  clearCache,
  INTENTS,
  GROUND_TRUTH_FIELDS,
};
