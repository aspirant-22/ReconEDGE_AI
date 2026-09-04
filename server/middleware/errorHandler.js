const logger = require('../utils/logger');

/**
 * Global error handler.
 *
 * Converts unexpected errors into safe HTTP responses. Never exposes stack
 * traces, filesystem paths, API keys, connection strings, or internal prompts.
 *
 * For KNOWN error types we return a controlled, safe message. For any
 * UNEXPECTED error we return a generic message and log the real detail
 * server-side.
 *
 * Response shape is a strict superset of the existing contract so existing
 * clients that read either `message` or `error.message` keep working:
 *   { success: false, message, error: { code, message } }
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let code = 'INTERNAL_ERROR';
  let message;

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON.';
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  }

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
  }

  if (err.code === 11000) {
    statusCode = 400;
    code = 'DUPLICATE_FIELD';
    message = 'Duplicate field value entered';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors || {}).map((val) => val.message).join(', ');
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  }

  // Legacy controllers may rely on res.status being set and a pre-mapped error.
  // Only for known/mapped cases do we surface a controlled detail message.
  const safeMessage = message || 'Something went wrong. Please try again later.';

  // Log a safe summary server-side (sanitized); never leak internals to the client.
  logger.error(`[ERROR] ${statusCode} ${code}: ${logger.sanitize(err.message || safeMessage)}`);

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    error: {
      code,
      message: safeMessage,
    },
  });
};

module.exports = errorHandler;
