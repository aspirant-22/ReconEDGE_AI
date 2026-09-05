// Human exception resolution workflow — state machine and validation.
//
// Deliberately independent from the deterministic reconciliation engine
// (server/services/reconciliation/**) and analytics (server/services/analytics/**):
// this layer only manages the HUMAN workflow state on top of immutable results.

const ReconciliationResult = require('../../models/ReconciliationResult');

const WORKFLOW_STATUSES = ReconciliationResult.WORKFLOW_STATUSES;
const WORKFLOW_ACTIONS = ReconciliationResult.WORKFLOW_ACTIONS;
const RESOLUTION_CODES = ReconciliationResult.RESOLUTION_CODES;

// Valid outbound transitions. Any action not listed for the current status is
// an INVALID_STATE_TRANSITION. Terminal states can only be reopened.
const VALID_TRANSITIONS = {
  OPEN: ['START_REVIEW', 'RESOLVE', 'REJECT', 'ESCALATE'],
  IN_REVIEW: ['RESOLVE', 'REJECT', 'ESCALATE'],
  RESOLVED: ['REOPEN'],
  REJECTED: ['REOPEN'],
  ESCALATED: ['REOPEN'],
};

const SUCCESSOR_STATUS = {
  START_REVIEW: 'IN_REVIEW',
  RESOLVE: 'RESOLVED',
  REJECT: 'REJECTED',
  ESCALATE: 'ESCALATED',
  REOPEN: 'IN_REVIEW',
};

// Every action always logs the acting user. Verified twice: (a) run ownership
// via findOwnedRun, (b) the CAS guard on workflowStatus at write time.
function isAllowedTransition(currentStatus, action) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return Array.isArray(allowed) && allowed.includes(action);
}

function getSuccessorStatus(action) {
  return SUCCESSOR_STATUS[action];
}

// Structured validation of the human-supplied resolution payload.
// Returns { ok: true } or { ok: false, code, message }.
function validateActionInput(action, body) {
  if (!WORKFLOW_ACTIONS.includes(action)) {
    return { ok: false, code: 'INVALID_ACTION', message: `Unsupported action: ${action}` };
  }

  if (action === 'RESOLVE') {
    const code = body && body.resolutionCode;
    if (!code) {
      return { ok: false, code: 'RESOLUTION_CODE_REQUIRED', message: 'Resolution code is required for RESOLVE.' };
    }
    if (!RESOLUTION_CODES.includes(code)) {
      return { ok: false, code: 'INVALID_RESOLUTION_CODE', message: `Invalid resolution code: ${code}` };
    }
  }

  if (action === 'REJECT' || action === 'ESCALATE') {
    const reason = (body && body.reason ? String(body.reason).trim() : '');
    if (!reason) {
      return { ok: false, code: 'RESOLUTION_REASON_REQUIRED', message: `A reason is required for ${action}.` };
    }
  }

  return { ok: true };
}

function sanitizeText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/[<>]/g, (ch) => (ch === '<' ? '\u2039' : '\u203A')).trim();
  if (!str) return null;
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

module.exports = {
  WORKFLOW_STATUSES,
  WORKFLOW_ACTIONS,
  RESOLUTION_CODES,
  VALID_TRANSITIONS,
  SUCCESSOR_STATUS,
  isAllowedTransition,
  getSuccessorStatus,
  validateActionInput,
  sanitizeText,
};