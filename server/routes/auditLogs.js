const express = require('express');
const { getLogs } = require('../controllers/auditLogController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/audit-logs', protect, getLogs);

module.exports = router;
