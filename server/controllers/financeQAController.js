const { askFinanceQuestion } = require('../services/ai/financeQA');

const MAX_QUESTION_LENGTH = 1000;

function validateQuestion(question) {
  if (question == null || typeof question !== 'string') {
    return { valid: false, error: { code: 'QA_INVALID_INPUT', message: 'question is required and must be a string.' } };
  }
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: { code: 'QA_INVALID_INPUT', message: 'question must not be empty.' } };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      valid: false,
      error: { code: 'QA_INVALID_INPUT', message: `question must not exceed ${MAX_QUESTION_LENGTH} characters.` },
    };
  }
  return { valid: true, question: trimmed };
}

exports.askFinanceQuestion = async (req, res) => {
  try {
    const validation = validateQuestion(req.body && req.body.question);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await askFinanceQuestion(validation.question);

    if (!result.success) {
      const statusCode = result.error.code === 'AI_REQUEST_INVALID' ? 400
        : result.error.code === 'AI_CONFIG_ERROR' ? 503
        : result.error.code === 'AI_TIMEOUT' ? 504
        : result.error.code === 'DATA_NOT_FOUND' ? 503
        : result.error.code === 'AI_UNAVAILABLE' ? 503
        : 500;

      return res.status(statusCode).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data, cached: result.cached || false });
  } catch (error) {
    console.log('Finance QA controller error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'AI_UNAVAILABLE', message: 'AI analysis is temporarily unavailable.' },
    });
  }
};
