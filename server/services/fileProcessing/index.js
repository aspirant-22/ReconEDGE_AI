// Orchestrator for the file-processing pipeline:
//   parse -> validate file boundary -> detect duplicate headers
//   -> column detect/map -> row-level validation -> structured report.
//
// Parsers throw with a small set of sentinel codes that the controller maps to
// user-facing errors (see MODULE_ERROR_CODES below).

const { parseCsvBuffer } = require('./csvParser');
const { parseXlsxBuffer } = require('./xlsxParser');
const { validateFile, getExtension } = require('./fileValidator');
const { detectMapping, applyManualMapping, normalizeHeader } = require('./columnMapper');
const { buildValidationReport } = require('./validationReport');

const MODULE_ERROR_CODES = {
  XLSX_CORRUPTED: 'XLSX_CORRUPTED',
  MALFORMED_CSV: 'MALFORMED_CSV',
  DUPLICATE_HEADERS: 'DUPLICATE_HEADERS',
  NO_DATA: 'NO_DATA',
};

function parseFile(buffer, extension) {
  if (extension === '.csv') {
    try {
      return parseCsvBuffer(buffer);
    } catch (error) {
      throw new Error(MODULE_ERROR_CODES.MALFORMED_CSV);
    }
  }
  if (extension === '.xlsx' || extension === '.xls') {
    try {
      return parseXlsxBuffer(buffer);
    } catch (error) {
      if (error.message === MODULE_ERROR_CODES.XLSX_CORRUPTED) {
        throw new Error(MODULE_ERROR_CODES.XLSX_CORRUPTED);
      }
      throw new Error(MODULE_ERROR_CODES.MALFORMED_CSV);
    }
  }
  throw new Error(MODULE_ERROR_CODES.MALFORMED_CSV);
}

function assertUniqueHeaders(columns) {
  const seen = new Map();
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (!norm) continue;
    if (seen.has(norm)) {
      throw new Error(MODULE_ERROR_CODES.DUPLICATE_HEADERS);
    }
    seen.set(norm, col);
  }
}

function assertNonEmpty(rows) {
  if (!rows || rows.length === 0) {
    throw new Error(MODULE_ERROR_CODES.NO_DATA);
  }
}

function sampleRows(rows, limit = 5) {
  return rows.slice(0, limit);
}

/**
 * Preview a single uploaded file without persisting anything.
 * Returns detected columns, auto-detected mapping, candidates, sample rows and
 * a validation report computed with the auto-detected mapping.
 */
function previewFile({ buffer, originalname, fileType, size }) {
  const fileCheck = validateFile({ originalname, size, fileType });
  if (!fileCheck.ok) throw toModuleError(fileCheck.error);

  const extension = fileCheck.extension;
  const parsed = parseFile(buffer, extension);
  assertUniqueHeaders(parsed.columns);
  assertNonEmpty(parsed.rows);

  const auto = detectMapping(parsed.columns, fileType);

  const report = buildValidationReport(parsed.rows, auto.mapping, fileType);

  return {
    columns: parsed.columns,
    fileType,
    mapping: auto.mapping,
    confidence: auto.confidence,
    candidates: auto.candidates,
    sampleRows: sampleRows(parsed.rows),
    report,
  };
}

/**
 * Re-run validation applying a user-confirmed manual mapping on top of the
 * auto-detected one.
 */
function validateWithMapping({ buffer, originalname, fileType, size, mapping }) {
  const fileCheck = validateFile({ originalname, size, fileType });
  if (!fileCheck.ok) throw toModuleError(fileCheck.error);

  const extension = fileCheck.extension;
  const parsed = parseFile(buffer, extension);
  assertUniqueHeaders(parsed.columns);
  assertNonEmpty(parsed.rows);

  const auto = detectMapping(parsed.columns, fileType);
  const { mapping: effectiveMapping } = applyManualMapping(
    parsed.columns,
    auto,
    mapping || {},
    fileType
  );

  const report = buildValidationReport(parsed.rows, effectiveMapping, fileType);
  if (report.blocking) {
    const err = new Error('Mapping is incomplete. Required columns must be mapped.');
    err.code = MODULE_ERROR_CODES.MISSING_MAPPING;
    throw err;
  }

  return {
    columns: parsed.columns,
    fileType,
    mapping: effectiveMapping,
    confidence: auto.confidence,
    candidates: auto.candidates,
    sampleRows: sampleRows(parsed.rows),
    report,
  };
}

function toModuleError(err) {
  const wrapped = new Error(err.code || 'UPLOAD_FAILED');
  wrapped.code = err.code || 'UPLOAD_FAILED';
  wrapped.userMessage = err.message || 'Upload failed.';
  return wrapped;
}

module.exports = {
  previewFile,
  validateWithMapping,
  MODULE_ERROR_CODES,
};
