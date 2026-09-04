const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const { validateEnvironment } = require('./config/env');
const geminiClient = require('./services/ai/geminiClient');
const logger = require('./utils/logger');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

let server = null;

function shutdown(signal) {
  logger.info(`[SERVER] Received ${signal}. Shutting down gracefully...`);

  const closeTimer = setTimeout(() => {
    logger.error('[SERVER] Forcefully exiting after shutdown timeout.');
    process.exit(1);
  }, 10000);
  closeTimer.unref();

  if (server) {
    server.close(async () => {
      try {
        await mongoose.disconnect();
        logger.info('[SERVER] Database connection closed.');
      } catch (e) {
        logger.error(`[SERVER] Error closing database: ${logger.sanitize(e.message)}`);
      }
      logger.info('[SERVER] Shutdown complete.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const startServer = async () => {
  const env = validateEnvironment();

  if (!env.valid) {
    logger.error('Invalid environment configuration. Fix the following and restart:');
    env.issues.forEach((issue) => logger.error(`  - ${issue}`));
    process.exit(1);
  }

  geminiClient.initializeClient();
  logger.info(`[AI] Gemini provider: ${env.gemini ? 'configured' : 'NOT configured (AI features unavailable; core app unaffected)'}`);

  try {
    await connectDB();
    server = app.listen(PORT, () => {
      logger.info(`ReconEDGE AI API running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${logger.sanitize(error.message)}`);
    process.exit(1);
  }
};

startServer();
