const express = require('express');
const { askFinanceQuestion } = require('../controllers/financeQAController');
const { protect } = require('../middleware/auth');
const { createAILimiter } = require('../middleware/rateLimit');

const router = express.Router();

const aiLimiter = createAILimiter();

router.post('/ai/finance-qa', protect, aiLimiter, askFinanceQuestion);

module.exports = router;
