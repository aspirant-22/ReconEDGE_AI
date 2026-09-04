// Column mapping: auto-detect a safe mapping from uploaded headers to canonical
// fields, and apply explicit user overrides.
//
// Rule: never silently guess an ambiguous financial field. Auto-detection only
// commits when a header matches a canonical field's synonym table *uniquely and
// with confidence*. Ambiguous or unmatched cases are surfaced for manual mapping.

const { CANONICAL_SCHEMAS, HEADER_SYNONYMS } = require('./constants');

function normalizeHeader(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * For one canonical field, find matching uploaded columns.
 * Returns an array of { column, headerNorm } that match a synonym.
 */
function candidatesForField(field, headerIndex) {
  const synonyms = HEADER_SYNONYMS[field] || [];
  const candidates = [];
  const seenColumns = new Set();
  for (const syn of synonyms) {
    const synNorm = normalizeHeader(syn);
    if (headerIndex.has(synNorm)) {
      const column = headerIndex.get(synNorm);
      if (!seenColumns.has(column)) {
        seenColumns.add(column);
        candidates.push({ column, headerNorm: synNorm });
      }
    }
  }
  return candidates;
}

/**
 * Auto-detect a mapping for the given uploaded columns and file type.
 * Returns { mapping, confidence, candidates } where:
 *  - mapping: { canonicalField: uploadedColumn|null }
 *  - confidence: { canonicalField: 'high' | 'needsManual' | null }
 *  - candidates: { canonicalField: [column...] } (all plausible columns for manual UI)
 */
function detectMapping(columns, fileType) {
  const schema = CANONICAL_SCHEMAS[fileType];
  if (!schema) {
    throw new Error(`Unknown file type: ${fileType}`);
  }

  const headerIndex = new Map();
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (!headerIndex.has(norm)) {
      headerIndex.set(norm, col);
    }
  }

  const mapping = {};
  const confidence = {};
  const candidates = {};

  for (const field of schema.fields) {
    const matches = candidatesForField(field, headerIndex);
    candidates[field] = matches.map((m) => m.column);

    if (matches.length === 0) {
      mapping[field] = null;
      confidence[field] = null;
      continue;
    }

    // Multiple alias headers mapping to the same canonical field is ambiguous.
    if (matches.length > 1) {
      mapping[field] = null;
      confidence[field] = 'needsManual';
      continue;
    }

    mapping[field] = matches[0].column;
    confidence[field] = 'high';
  }

  const unmappedRequired = schema.required.filter((f) => !mapping[f]);

  return { mapping, confidence, candidates, unmappedRequired };
}

/**
 * Apply a user-provided manual mapping on top of an auto-detected one.
 * override: { canonicalField: uploadedColumn|null }
 * Validates canonical keys and that column values exist in `columns`.
 */
function applyManualMapping(columns, autoMapping, override, fileType) {
  const schema = CANONICAL_SCHEMAS[fileType];
  if (!schema) {
    throw new Error(`Unknown file type: ${fileType}`);
  }

  const columnSet = new Set(columns.map((c) => String(c).trim()));
  const mapping = { ...(autoMapping.mapping || {}) };

  if (override && typeof override === 'object') {
    for (const key of Object.keys(override)) {
      if (!schema.fields.includes(key)) {
        throw new Error(`Unknown canonical field in mapping: ${key}`);
      }
      const col = override[key];
      if (col === null || col === undefined || col === '') {
        mapping[key] = null;
        continue;
      }
      if (!columnSet.has(String(col).trim())) {
        throw new Error(`Mapping references a column that does not exist in the file: ${col}`);
      }
      mapping[key] = String(col).trim();
    }
  }

  const unmappedRequired = schema.required.filter((f) => !mapping[f]);
  return { mapping, unmappedRequired };
}

module.exports = {
  normalizeHeader,
  detectMapping,
  applyManualMapping,
};
