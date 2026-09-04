const express = require('express');
const { getStatus, analyzeException } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { createAILimiter } = require('../middleware/rateLimit');

const router = express.Router();

const aiLimiter = createAILimiter();

router.get('/ai/status', getStatus);
router.post('/ai/analyze-exception', protect, aiLimiter, analyzeException);

module.exports = router;
