const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /(["']?Authorization["']?\s*[:=]\s*)["']?Bearer\s+[A-Za-z0-9._\-]+/gi,
  /JWT_SECRET["']?\s*[:=]\s*["']?[^"'\s,;]+/gi,
  /MONGODB_URI["']?\s*[:=]\s*["']?[^"'\s,;]+/gi,
  /GEMINI_API_KEY["']?\s*[:=]\s*["']?[^"'\s,;]+/gi,
];

function sanitize(message) {
  let str = String(message);
  for (const pattern of SENSITIVE_PATTERNS) {
    str = str.replace(pattern, '[REDACTED]');
  }
  return str;
}

function log(level, message, ...args) {
  const cleaned = sanitize(message);
  const cleanedArgs = args.map((a) => {
    if (typeof a === 'string') return sanitize(a);
    if (a instanceof Error) return new Error(sanitize(a.message));
    return a;
  });
  // eslint-disable-next-line no-console
  console[level]?.(cleaned, ...cleanedArgs);
}

module.exports = {
  info: (message, ...args) => log('log', message, ...args),
  warn: (message, ...args) => log('warn', message, ...args),
  error: (message, ...args) => log('error', message, ...args),
  sanitize,
};
