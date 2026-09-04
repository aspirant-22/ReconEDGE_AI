// Value normalization for uploaded datasets.
//
// Key rules:
//  - Amounts are parsed strictly. An unparseable amount (e.g. "abc") is
//    reported as invalid and is NEVER coerced to zero.
//  - Dates are parsed with an explicit, configurable preference (DATE_FORMAT:
//    DMY default or MDY). Ambiguous dates that do not match the configured
//    format are reported as invalid rather than guessed.
//  - Currency is uppercased/trimmed; invalid currency values are surfaced.

const { DATE_FIELDS, AMOUNT_FIELDS } = require('./constants');

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function getDateFormat() {
  const fmt = String(process.env.DATE_FORMAT || 'DMY').toUpperCase();
  return fmt === 'MDY' ? 'MDY' : 'DMY';
}

function isValidDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const ISO_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const DMY_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/;
const MONTH_NAME_RE = /^(\d{1,2})[-\s/]+([a-zA-Z]{3,})[-\s/]+(\d{2,4})$/;

function parseTextDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel-style serial date (days since 1899-12-30)
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + Math.round(value) * 86400000);
  }

  const s = String(value).trim();
  if (!s) return null;

  // ISO
  let m = s.match(ISO_RE);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isValidDate(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
    return { invalid: true };
  }

  const dateFormat = getDateFormat();

  // Name-based month e.g. "04-Sep-2026"
  m = s.match(MONTH_NAME_RE);
  if (m) {
    const monthKey = m[2].toLowerCase().slice(0, 3);
    const month = MONTHS[monthKey];
    if (!month) return { invalid: true };
    const day = Number(m[1]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (isValidDate(year, month, day)) return new Date(Date.UTC(year, month - 1, day));
    return { invalid: true };
  }

  // Numeric d/m/y or m/d/y
  m = s.match(DMY_RE);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;

    if (dateFormat === 'MDY') {
      if (isValidDate(year, a, b)) return new Date(Date.UTC(year, a - 1, b));
      return { invalid: true };
    }
    // DMY
    if (isValidDate(year, b, a)) return new Date(Date.UTC(year, b - 1, a));
    return { invalid: true };
  }

  // Ambiguous or unparseable
  return { invalid: true };
}

function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[,\s]/g, '')
      .replace(/[₹$€£]/g, '');
    // remove parentheses representing negatives e.g. (120.50)
    let sign = 1;
    let body = cleaned;
    if (body.startsWith('(') && body.endsWith(')')) {
      sign = -1;
      body = body.slice(1, -1);
    }
    const num = Number(body);
    if (Number.isFinite(num)) {
      return Number((sign * num).toFixed(2));
    }
    return { invalid: true };
  }
  return { invalid: true };
}

function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return { value: 'INR' };
  const s = String(value).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s)) return { value: s };
  return { invalid: true };
}

function parseId(value) {
  if (value === null || value === undefined) return { value: '' };
  return { value: String(value).trim() };
}

/**
 * Build a canonical record from a raw row using the resolved mapping.
 * Returns { record, errors } where errors is an array of { field, code, message, row }.
 * A returned record is only usable when errors is empty.
 */
function normalizeRecord(rawRow, mapping, fileType, rowIndex) {
  const errors = [];
  const record = {};

  const requiredFields = {
    PAYMENTS: ['paymentId', 'amount', 'paymentDate'],
    BANK_TRANSACTIONS: ['transactionId', 'amount', 'transactionDate'],
    INVOICES: ['invoiceId', 'amount', 'invoiceDate'],
  }[fileType];

  for (const canonical of Object.keys(mapping)) {
    const column = mapping[canonical];
    if (!column) continue;

    const rawValue = rawRow[column];

    if (canonical === 'amount' || AMOUNT_FIELDS.includes(canonical)) {
      const parsed = parseAmount(rawValue);
      if (parsed.invalid) {
        errors.push({
          field: canonical,
          code: 'INVALID_AMOUNT',
          message: `Amount is not a valid number.`,
        });
      } else if (parsed <= 0) {
        errors.push({
          field: canonical,
          code: 'INVALID_AMOUNT',
          message: 'Amount must be greater than zero.',
        });
      } else {
        record.amount = parsed;
        record.amountPaise = Math.round(parsed * 100);
      }
    } else if (DATE_FIELDS.includes(canonical)) {
      const parsed = parseTextDate(rawValue);
      if (!parsed) {
        errors.push({
          field: canonical,
          code: 'EMPTY_REQUIRED_FIELD',
          message: `${canonicalLabel(canonical)} is required.`,
        });
      } else if (parsed.invalid) {
        errors.push({
          field: canonical,
          code: 'INVALID_DATE',
          message: `${canonicalLabel(canonical)} is invalid or ambiguous (expected ${getDateFormat()} format).`,
        });
      } else {
        record[canonical] = parsed;
      }
    } else if (canonical === 'currency') {
      const parsed = parseCurrency(rawValue);
      if (parsed.invalid) {
        errors.push({
          field: canonical,
          code: 'INVALID_CURRENCY',
          message: 'Currency is invalid (expected a 3-letter code such as INR).',
        });
      } else {
        record.currency = parsed.value;
      }
    } else if (canonical === 'description') {
      record.description = String(rawValue === null || rawValue === undefined ? '' : rawValue).trim();
    } else {
      // identifier / reference fields
      const { value } = parseId(rawValue);
      record[canonical] = value;
    }
  }

  // Required-field checks (must be present and non-empty)
  for (const rf of requiredFields) {
    if (mapping[rf] == null) {
      errors.push({
        field: rf,
        code: 'MISSING_MAPPING',
        message: `Column for ${canonicalLabel(rf)} is not mapped.`,
      });
      continue;
    }
    const v = record[rf];
    if (v === undefined || v === null || v === '' || Number.isNaN(v)) {
      errors.push({
        field: rf,
        code: 'EMPTY_REQUIRED_FIELD',
        message: `${canonicalLabel(rf)} is required.`,
      });
    }
  }

  return { record, errors };
}

function canonicalLabel(canonical) {
  return {
    paymentId: 'Payment ID',
    transactionId: 'Transaction ID',
    invoiceId: 'Invoice ID',
    amount: 'Amount',
    paymentDate: 'Payment date',
    transactionDate: 'Transaction date',
    invoiceDate: 'Invoice date',
    currency: 'Currency',
    customerId: 'Customer ID',
    reference: 'Reference',
    description: 'Description',
  }[canonical] || canonical;
}

module.exports = {
  getDateFormat,
  parseTextDate,
  parseAmount,
  parseCurrency,
  parseId,
  normalizeRecord,
  canonicalLabel,
  isValidDate,
};
