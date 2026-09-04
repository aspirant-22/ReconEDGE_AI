const express = require('express');
const mongoose = require('mongoose');
const geminiClient = require('../services/ai/geminiClient');

const router = express.Router();

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  res.json({
    success: true,
    status: dbState === 1 ? 'ok' : 'degraded',
    message: 'ReconEDGE AI API is running',
    checks: {
      application: { status: 'ok' },
      database: {
        status: dbState === 1 ? 'ok' : 'degraded',
        state: dbStatus,
      },
      ai: {
        status: geminiClient.isAvailable() ? 'configured' : 'unavailable',
        available: geminiClient.isAvailable(),
        model: geminiClient.isAvailable() ? geminiClient.getModelName() : null,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
