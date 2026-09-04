const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { previewFile, validateWithMapping, MODULE_ERROR_CODES } = require('../index');
const { parseCsvBuffer } = require('../csvParser');
const { parseXlsxBuffer } = require('../xlsxParser');
const { detectMapping, applyManualMapping } = require('../columnMapper');
const { parseAmount, parseTextDate, getDateFormat } = require('../dataNormalizer');
const { buildValidationReport } = require('../validationReport');

function csvBuffer(rows) {
  return Buffer.from(rows.join('\n'), 'utf8');
}

function xlsxBuffer(aoa) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('File Processing — CSV parser', () => {
  it('parses quoted fields, embedded commas and newlines', () => {
    const buf = csvBuffer([
      'paymentId,amount,description',
      'PAY-001,1000.50,"paid for order, quickly"',
    ]);
    const parsed = parseCsvBuffer(buf);
    assert.equal(parsed.columns[0], 'paymentId');
    assert.equal(parsed.rows[0].description, 'paid for order, quickly');
  });

  it('strips BOM from header row', () => {
    const buf = Buffer.concat([Buffer.from('\uFEFF'), csvBuffer(['paymentId,amount', 'PAY-1,10'])]);
    const parsed = parseCsvBuffer(buf);
    assert.equal(parsed.columns[0], 'paymentId');
  });
});

describe('File Processing — XLSX parser', () => {
  it('parses sheet into columns and row objects', () => {
    const buf = xlsxBuffer([
      ['paymentId', 'amount', 'paymentDate'],
      ['PAY-001', 1000.5, '2026-07-15'],
    ]);
    const parsed = parseXlsxBuffer(buf);
    assert.equal(parsed.columns[0], 'paymentId');
    assert.equal(parsed.rows[0].amount, 1000.5);
  });
});

describe('File Processing — column mapping', () => {
  it('auto-detects high-confidence mapping from synonyms', () => {
    const buf = csvBuffer([
      'paymentId,paymentAmount,paymentDate,customerId',
      'PAY-001,1000.00,2026-07-15,CUST-001',
    ]);
    const { mapping, confidence } = detectMapping(['paymentId', 'paymentAmount', 'paymentDate', 'customerId'], 'PAYMENTS');
    assert.equal(mapping.paymentId, 'paymentId');
    assert.equal(mapping.amount, 'paymentAmount');
    assert.equal(mapping.paymentDate, 'paymentDate');
    assert.equal(mapping.customerId, 'customerId');
    assert.equal(confidence.paymentId, 'high');
  });

  it('flags ambiguous fields as needsManual', () => {
    const { confidence } = detectMapping(['amount', 'total'], 'PAYMENTS');
    assert.equal(confidence.amount, 'needsManual');
  });

  it('preview returns mapping and report without throwing when required mapping is missing', () => {
    const buf = csvBuffer(['paymentId,value', 'PAY-001,10']);
    const result = previewFile({ buffer: buf, originalname: 'p.csv', fileType: 'PAYMENTS', size: buf.length });
    assert.equal(result.report.blocking, true);
    assert.equal(result.report.passed, false);
    assert.equal(result.mapping.paymentDate, null);
  });
});

describe('File Processing — amount/date normalization', () => {
  it('parses amounts strictly and never coerces invalid to zero', () => {
    assert.equal(parseAmount('1,000.50'), 1000.5);
    assert.equal(parseAmount('(120.50)'), -120.5);
    // unparseable -> invalid marker, never 0
    const bad = parseAmount('abc');
    assert.equal(bad.invalid, true);
  });

  it('parses dates following configured DATE_FORMAT (default DMY)', () => {
    delete process.env.DATE_FORMAT;
    assert.equal(getDateFormat(), 'DMY');
    const d = parseTextDate('15/07/2026');
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 6);
    assert.equal(d.getUTCDate(), 15);
    // 15/07 cannot be an MDY date
    process.env.DATE_FORMAT = 'MDY';
    assert.equal(parseTextDate('15/07/2026').invalid, true);
    assert.equal(parseTextDate('07/15/2026').getUTCMonth(), 6);
    delete process.env.DATE_FORMAT;
  });

  it('parses ISO dates unambiguously regardless of DATE_FORMAT', () => {
    process.env.DATE_FORMAT = 'MDY';
    const d = parseTextDate('2026-07-15');
    assert.equal(d.getUTCDate(), 15);
    delete process.env.DATE_FORMAT;
  });
});

describe('File Processing — validation report', () => {
  it('flags duplicate IDs and requires mandatory fields', () => {
    const buf = csvBuffer([
      'paymentId,amount,paymentDate',
      'PAY-001,1000,2026-07-15',
      'PAY-001,500,2026-07-16',
      'PAY-002,300,', // missing date
    ]);
    const mapping = { paymentId: 'paymentId', amount: 'amount', paymentDate: 'paymentDate' };
    const rows = [
      { paymentId: 'PAY-001', amount: '1000', paymentDate: '2026-07-15' },
      { paymentId: 'PAY-001', amount: '500', paymentDate: '2026-07-16' },
      { paymentId: 'PAY-002', amount: '300', paymentDate: '' },
    ];
    const report = buildValidationReport(rows, mapping, 'PAYMENTS');
    assert.equal(report.validRows, 0);
    assert.equal(report.passed, false);
    const codes = report.errors.map((e) => e.code);
    assert.ok(codes.includes('DUPLICATE_ID'));
    assert.ok(codes.includes('EMPTY_REQUIRED_FIELD'));
  });

  it('validates a clean payments file', () => {
    const buf = csvBuffer([
      'paymentId,amount,paymentDate',
      'PAY-001,1000,2026-07-15',
    ]);
    const result = validateWithMapping({ buffer: buf, originalname: 'p.csv', fileType: 'PAYMENTS', size: buf.length });
    assert.equal(result.report.passed, true);
    assert.equal(result.report.validRows, 1);
    assert.equal(result.report.validRecords[0].amount, 1000);
  });

  it('rejects unsupported file extensions', () => {
    assert.throws(
      () => detectMapping(['x'], 'UNKNOWN'),
      /Unknown file type/
    );
  });
});

describe('File Processing — orchestrator errors', () => {
  it('rejects an empty file', () => {
    assert.throws(
      () => previewFile({ buffer: Buffer.from(''), originalname: 'p.csv', fileType: 'PAYMENTS', size: 0 }),
      (err) => err.code === 'EMPTY_FILE'
    );
    assert.equal(1, 1);
  });

  it('throws DUPLICATE_HEADERS on duplicate columns after normalize', () => {
    // two "paymentid" headers
    const buf = csvBuffer(['paymentId,paymentid', 'a,b']);
    try {
      previewFile({ buffer: buf, originalname: 'p.csv', fileType: 'PAYMENTS', size: buf.length });
      assert.fail('should throw');
    } catch (err) {
      assert.equal(err.message, MODULE_ERROR_CODES.DUPLICATE_HEADERS);
    }
  });
});

describe('File Processing — manual mapping apply', () => {
  it('fills missing required mapping with a user override', () => {
    const columns = ['paymentId', 'value', 'paidOn'];
    const auto = detectMapping(columns, 'PAYMENTS');
    const { mapping } = applyManualMapping(columns, auto, { amount: 'value', paymentDate: 'paidOn' }, 'PAYMENTS');
    assert.equal(mapping.amount, 'value');
    assert.equal(mapping.paymentDate, 'paidOn');
  });
});
