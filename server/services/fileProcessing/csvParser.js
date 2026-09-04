// Minimal, dependency-free CSV parser.
// Handles quoted fields, embedded commas/quotes/newlines, and BOM.

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '') || rows.length > 0) {
        rows.push(row);
      }
      row = [];
    } else if (ch === '\r') {
      // skip CR; handled at \n
    } else {
      field += ch;
    }
  }

  // flush last field/row
  row.push(field);
  if (row.some((c) => c.trim() !== '')) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return { columns: [], rows: [] };
  }

  const header = rows[0].map((c) => c.trim());
  const dataRows = rows.slice(1).map((r) => r.map((c) => c.trim()));

  const rowObjects = dataRows.map((r) => {
    const obj = {};
    for (let ci = 0; ci < header.length; ci++) {
      obj[header[ci]] = r[ci] !== undefined ? r[ci] : '';
    }
    return obj;
  });

  return { columns: header, rows: rowObjects };
}

module.exports = { parseCsvBuffer };
