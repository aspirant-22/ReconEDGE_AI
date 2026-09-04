// File-level validation: extension, size limits, empty/corrupt detection,
// and filename sanitization.
//
// The parsing layer is responsible for malformed-content detection
// (see csvParser / xlsxParser); this module guards the file boundary.

const path = require('path');

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const ALLOWED_FILE_TYPES = ['PAYMENTS', 'BANK_TRANSACTIONS', 'INVOICES'];

function getMaxBytes() {
  const mb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 10;
  return safeMb * 1024 * 1024;
}

function getMaxSizeMb() {
  const mb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
  return Number.isFinite(mb) && mb > 0 ? mb : 10;
}

function sanitizeFileName(name) {
  if (typeof name !== 'string') return 'upload';
  const base = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
  return base || 'upload';
}

function getExtension(name) {
  const clean = sanitizeFileName(name);
  return path.extname(clean).toLowerCase();
}

function isValidFileType(fileType) {
  return ALLOWED_FILE_TYPES.includes(fileType);
}

/**
 * Returns { ok, error? } for a single uploaded file.
 * Does not read file contents — for content-level checks see malformed detection
 * performed during parsing.
 */
function validateFile({ originalname, size, fileType }) {
  if (!originalname) {
    return { ok: false, error: { code: 'INVALID_FILENAME', message: 'Invalid file name.' } };
  }

  if (!isValidFileType(fileType)) {
    return { ok: false, error: { code: 'INVALID_FILE_TYPE', message: `Invalid file type: ${fileType}. Must be one of PAYMENTS, BANK_TRANSACTIONS, INVOICES.` } };
  }

  const ext = getExtension(originalname);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: { code: 'UNSUPPORTED_EXTENSION', message: `Unsupported file format "${ext}". Supported: CSV, XLSX.` } };
  }

  const maxSize = getMaxBytes();
  if (size > maxSize) {
    return { ok: false, error: { code: 'FILE_TOO_LARGE', message: `File exceeds the maximum allowed size of ${getMaxSizeMb()} MB.` } };
  }

  if (size <= 0) {
    return { ok: false, error: { code: 'EMPTY_FILE', message: 'File is empty.' } };
  }

  return { ok: true, extension: ext };
}

// Multer fileFilter: reject by extension/size/type before any content is read.
function fileFilter(req, file, cb) {
  const fileType = (req.body && req.body.fileType) || req.query.fileType;
  const result = validateFile({ originalname: file.originalname, size: file.size, fileType });

  if (!result.ok) {
    const err = new Error(result.error.message);
    err.code = result.error.code;
    return cb(err, false);
  }

  return cb(null, true);
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_FILE_TYPES,
  getMaxBytes,
  getMaxSizeMb,
  getExtension,
  sanitizeFileName,
  isValidFileType,
  validateFile,
  fileFilter,
};
