// XLSX/XLS parsing using the `xlsx` (SheetJS) library.
// Dates are read as JS Date objects where the workbook declares date formatting,
// otherwise raw values are returned and normalized later by dataNormalizer.

const XLSX = require('xlsx');

function normalizeHeader(value) {
  return String(value).trim();
}

function parseXlsxBuffer(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (error) {
    throw new Error('XLSX_CORRUPTED');
  }

  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!sheetName) {
    return { columns: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  if (!matrix || matrix.length === 0) {
    return { columns: [], rows: [] };
  }

  const header = (matrix[0] || []).map(normalizeHeader);
  const dataRows = matrix.slice(1);

  const rowObjects = dataRows.map((r) => {
    const obj = {};
    for (let ci = 0; ci < header.length; ci++) {
      const val = r[ci];
      obj[header[ci]] = val !== undefined && val !== null ? val : '';
    }
    return obj;
  });

  return { columns: header, rows: rowObjects };
}

module.exports = { parseXlsxBuffer };
