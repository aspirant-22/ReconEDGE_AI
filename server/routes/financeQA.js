const express = require('express');
const { askFinanceQuestion } = require('../controllers/financeQAController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/ai/finance-qa', protect, askFinanceQuestion);

module.exports = router;
