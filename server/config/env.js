const REQUIRED_VARS = ['PORT', 'MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];
const OPTIONAL_VARS = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'MAX_UPLOAD_SIZE_MB', 'DATE_FORMAT'];

const DEFAULT_VALUES = {
  PORT: '5000',
  MONGODB_URI: 'mongodb://localhost:27017/recon-edge-ai',
  JWT_SECRET: '',
  CLIENT_URL: 'http://localhost:5173',
  GEMINI_MODEL: 'gemini-3.6-flash',
  MAX_UPLOAD_SIZE_MB: '10',
  DATE_FORMAT: 'DMY',
};

function applyDefaults() {
  for (const [name, value] of Object.entries(DEFAULT_VALUES)) {
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

function validateRequired() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    const message = `Missing required environment configuration: ${missing.join(', ')}. Set these in server/.env (see server/.env.example).`;
    // eslint-disable-next-line no-console
    console.error(`[ENV] ${message}`);
    return { ok: false, missing };
  }

  return { ok: true, missing: [] };
}

function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const placeholders = ['', 'your_jwt_secret_here', 'change_me', 'changeme', 'secret'];
  if (!secret || placeholders.includes(secret) || secret.length < 16) {
    return {
      ok: false,
      message: 'JWT_SECRET must be set to a strong, non-default value of at least 16 characters. Using a default/weak JWT_SECRET in production is a security risk.',
    };
  }
  return { ok: true };
}

function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Validates application configuration at startup.
 *
 * Required config (PORT, MONGODB_URI, JWT_SECRET, CLIENT_URL) defaults where safe,
 * but fails loudly (exit) when a genuinely required value is absent or insecure.
 * Gemini config is OPTIONAL: its absence must not prevent the core app from starting.
 *
 * Prints variable NAMES only, never values.
 */
function validateEnvironment() {
  applyDefaults();

  const required = validateRequired();
  const jwt = validateJwtSecret();

  const issues = [];
  if (!required.ok) issues.push(required.missing.join(', '));
  if (!jwt.ok) issues.push(jwt.message);

  const gemini = geminiConfigured();

  if (issues.length > 0) {
    return { valid: false, issues, gemini };
  }

  return { valid: true, issues: [], gemini };
}

module.exports = {
  validateEnvironment,
  geminiConfigured,
  REQUIRED_VARS,
  OPTIONAL_VARS,
};
