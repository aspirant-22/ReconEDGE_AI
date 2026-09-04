const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { getMaxBytes, fileFilter } = require('../services/fileProcessing/fileValidator');
const {
  createRun,
  listRuns,
  getRun,
  archiveRun,
  previewFile,
  uploadFile,
  executeRun,
  getResults,
  getExceptions,
  getAnalytics,
  analyzeExceptionAction,
} = require('../controllers/reconciliationRunController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getMaxBytes(), files: 1 },
  fileFilter,
});

router.post('/reconciliation/runs', protect, createRun);
router.get('/reconciliation/runs', protect, listRuns);
router.get('/reconciliation/runs/:runId', protect, getRun);
router.post('/reconciliation/runs/:runId/archive', protect, archiveRun);
router.post('/reconciliation/runs/:runId/preview', protect, upload.single('file'), previewFile);
router.post('/reconciliation/runs/:runId/upload', protect, upload.single('file'), uploadFile);
router.post('/reconciliation/runs/:runId/run', protect, executeRun);
router.get('/reconciliation/runs/:runId/results', protect, getResults);
router.get('/reconciliation/runs/:runId/exceptions', protect, getExceptions);
router.get('/reconciliation/runs/:runId/analytics', protect, getAnalytics);
router.post('/reconciliation/runs/:runId/exceptions/:exceptionId/analyze', protect, analyzeExceptionAction);

module.exports = router;
