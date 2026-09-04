// Row-level validation and structured report generation.
//
// Produces { totalRows, validRows, invalidRows, passed, errors, validRecords }
// where errors is an array of row-level { row, field, code, message } entries.
// Duplicate IDs within a file are detected and ALL affected rows are flagged.

const { normalizeRecord } = require('./dataNormalizer');

const ROW_BASE = 2; // header is row 1; first data row is 2 (1-based, human-friendly)

function idOf(rec) {
  if (rec.paymentId != null && rec.paymentId !== '') return rec.paymentId;
  if (rec.transactionId != null && rec.transactionId !== '') return rec.transactionId;
  if (rec.invoiceId != null && rec.invoiceId !== '') return rec.invoiceId;
  return null;
}

/**
 * Validate all parsed rows against the resolved mapping.
 * @param rows raw row objects
 * @param mapping resolved { canonical: uploadedColumn }
 * @param fileType PAYMENTS | BANK_TRANSACTIONS | INVOICES
 */
function buildValidationReport(rows, mapping, fileType) {
  const errors = [];
  const normalized = [];

  rows.forEach((rawRow, i) => {
    const { record, errors: recErrors } = normalizeRecord(rawRow, mapping, fileType, i);
    if (recErrors.length > 0) {
      for (const e of recErrors) {
        errors.push({ row: i + ROW_BASE, field: e.field, code: e.code, message: e.message });
      }
      return;
    }
    normalized.push({ ...record, rowNumber: i + ROW_BASE });
  });

  // Duplicate ID detection across all records that passed field-level validation.
  const duplicateRows = new Set();
  const seen = new Map(); // id -> first rowNumber
  for (const rec of normalized) {
    const id = idOf(rec);
    if (id === null) continue;
    if (seen.has(id)) {
      duplicateRows.add(rec.rowNumber);
      duplicateRows.add(seen.get(id));
    } else {
      seen.set(id, rec.rowNumber);
    }
  }

  for (const rowNumber of duplicateRows) {
    errors.push({
      row: rowNumber,
      field: 'id',
      code: 'DUPLICATE_ID',
      message: 'Duplicate ID detected in file.',
    });
  }

  const validRecords = normalized.filter((rec) => !duplicateRows.has(rec.rowNumber));

  const blocking = errors.some((e) => e.code === 'MISSING_MAPPING');
  const passed = !blocking && errors.length === 0;

  return {
    totalRows: rows.length,
    validRows: validRecords.length,
    invalidRows: rows.length - validRecords.length,
    passed,
    blocking,
    errors,
    validRecords,
  };
}

module.exports = { buildValidationReport, detectDuplicateIds: idOf };
