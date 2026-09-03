const VALID_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const MAX_RECOMMENDATIONS = 5;

function validateAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid response format' };
  }

  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length === 0) {
    return { valid: false, error: 'Missing or empty summary' };
  }

  if (typeof parsed.likelyCause !== 'string' || parsed.likelyCause.trim().length === 0) {
    return { valid: false, error: 'Missing or empty likelyCause' };
  }

  if (!VALID_RISK_LEVELS.includes(parsed.riskLevel)) {
    return { valid: false, error: `Invalid riskLevel: ${parsed.riskLevel}. Must be one of: ${VALID_RISK_LEVELS.join(', ')}` };
  }

  if (!Array.isArray(parsed.recommendedActions)) {
    return { valid: false, error: 'recommendedActions must be an array' };
  }

  if (parsed.recommendedActions.length === 0) {
    return { valid: false, error: 'recommendedActions must not be empty' };
  }

  if (parsed.recommendedActions.length > MAX_RECOMMENDATIONS) {
    parsed.recommendedActions = parsed.recommendedActions.slice(0, MAX_RECOMMENDATIONS);
  }

  for (const action of parsed.recommendedActions) {
    if (typeof action !== 'string' || action.trim().length === 0) {
      return { valid: false, error: 'Each recommended action must be a non-empty string' };
    }
  }

  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
    return { valid: false, error: `Invalid confidence: ${parsed.confidence}. Must be between 0 and 1` };
  }

  if (typeof parsed.requiresHumanReview !== 'boolean') {
    return { valid: false, error: 'requiresHumanReview must be a boolean' };
  }

  return {
    valid: true,
    data: {
      summary: parsed.summary.trim(),
      likelyCause: parsed.likelyCause.trim(),
      riskLevel: parsed.riskLevel,
      recommendedActions: parsed.recommendedActions.map((a) => a.trim()),
      confidence: parsed.confidence,
      requiresHumanReview: parsed.requiresHumanReview,
    },
  };
}

module.exports = { validateAnalysis, VALID_RISK_LEVELS, MAX_RECOMMENDATIONS };
