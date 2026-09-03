const geminiClient = require('./geminiClient');
const { buildPrompt, buildAnalysisPayload } = require('./prompts');
const { parseResponse } = require('./responseParser');
const { validateAnalysis } = require('./aiGuardrails');

const GROUND_TRUTH_FIELDS = [
  'expectedScenario',
  'expectedBankTransactionId',
  'expectedInvoiceId',
  'ground-truth',
  'groundTruth',
];

const VALID_EXCEPTION_TYPES = [
  'MISSING_BANK_TRANSACTION',
  'AMOUNT_MISMATCH',
  'DUPLICATE_BANK_TRANSACTION',
  'DATE_MISMATCH',
  'UNMATCHED_BANK_TRANSACTION',
];

const analysisCache = new Map();

function getCacheKey(exceptionId, exceptionRecord) {
  return `${exceptionId}:${JSON.stringify(exceptionRecord)}`;
}

function validateExceptionRecord(record) {
  if (!record || typeof record !== 'object') {
    return { valid: false, error: 'Invalid exception record' };
  }

  if (record.status !== 'EXCEPTION') {
    return { valid: false, error: 'Record is not an exception' };
  }

  if (!VALID_EXCEPTION_TYPES.includes(record.exceptionType)) {
    return { valid: false, error: `Unknown exception type: ${record.exceptionType}` };
  }

  return { valid: true };
}

function hasGroundTruthFields(record) {
  const keys = Object.keys(record);
  return GROUND_TRUTH_FIELDS.some((field) => keys.includes(field));
}

function buildPayload(exceptionRecord) {
  const payload = buildAnalysisPayload(exceptionRecord);
  if (hasGroundTruthFields(payload)) {
    throw new Error('Payload contains ground-truth fields');
  }
  return payload;
}

async function analyzeException(exceptionId, exceptionRecord) {
  const validation = validateExceptionRecord(exceptionRecord);
  if (!validation.valid) {
    return { success: false, error: { code: 'AI_REQUEST_INVALID', message: validation.error } };
  }

  const cacheKey = getCacheKey(exceptionId, exceptionRecord);
  if (analysisCache.has(cacheKey)) {
    return { success: true, analysis: analysisCache.get(cacheKey), cached: true };
  }

  if (!geminiClient.isAvailable()) {
    return { success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' } };
  }

  try {
    const prompt = buildPrompt(exceptionRecord);
    const rawText = await geminiClient.generateContent(prompt);
    const parsed = parseResponse(rawText);

    if (!parsed) {
      console.log('AI analysis validation failed: Could not parse response');
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: 'AI returned an unparseable response.' } };
    }

    const guardrailResult = validateAnalysis(parsed);
    if (!guardrailResult.valid) {
      console.log('AI analysis validation failed:', guardrailResult.error);
      return { success: false, error: { code: 'AI_INVALID_RESPONSE', message: guardrailResult.error } };
    }

    analysisCache.set(cacheKey, guardrailResult.data);

    return { success: true, analysis: guardrailResult.data };
  } catch (error) {
    if (error.message === 'AI_NOT_CONFIGURED') {
      return { success: false, error: { code: 'AI_CONFIG_ERROR', message: 'AI is not configured.' } };
    }
    if (error.message === 'AI_TIMEOUT') {
      return { success: false, error: { code: 'AI_TIMEOUT', message: 'AI request timed out.' } };
    }
    console.log('AI analysis unavailable:', error.message);
    return { success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' } };
  }
}

function clearCache() {
  analysisCache.clear();
}

module.exports = {
  analyzeException,
  validateExceptionRecord,
  buildPayload,
  hasGroundTruthFields,
  clearCache,
  VALID_EXCEPTION_TYPES,
  GROUND_TRUTH_FIELDS,
};
