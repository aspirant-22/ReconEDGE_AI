const express = require('express');
const { getStatus, analyzeException } = require('../controllers/aiController');

const router = express.Router();

router.get('/ai/status', getStatus);
router.post('/ai/analyze-exception', analyzeException);

module.exports = router;
