const express = require('express');
const { getReconciliation, runReconciliation } = require('../controllers/reconciliationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/reconciliation', protect, getReconciliation);
router.post('/reconciliation/run', protect, runReconciliation);

module.exports = router;
