// Human workflow status + resolution code presentation helpers (Phase 12).

export const WORKFLOW_STATUS_LABELS = {
  OPEN: 'Open',
  IN_REVIEW: 'In Review',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  ESCALATED: 'Escalated',
};

export const WORKFLOW_BADGE_STYLES = {
  OPEN: 'bg-gray-100 text-gray-700 ring-gray-300',
  IN_REVIEW: 'bg-blue-100 text-blue-800 ring-blue-300',
  RESOLVED: 'bg-green-100 text-green-800 ring-green-300',
  REJECTED: 'bg-red-100 text-red-800 ring-red-300',
  ESCALATED: 'bg-amber-100 text-amber-800 ring-amber-300',
};

// Controlled human resolution categories. The human selects these explicitly.
export const RESOLUTION_CODES = [
  { value: 'BANK_FEE', label: 'Bank Fee' },
  { value: 'TIMING_DIFFERENCE', label: 'Timing Difference' },
  { value: 'DUPLICATE_CONFIRMED', label: 'Duplicate Confirmed' },
  { value: 'FALSE_POSITIVE', label: 'False Positive' },
  { value: 'DATA_ENTRY_ERROR', label: 'Data Entry Error' },
  { value: 'MISSING_DOCUMENT', label: 'Missing Document' },
  { value: 'CUSTOMER_DISPUTE', label: 'Customer Dispute' },
  { value: 'SYSTEM_ERROR', label: 'System Error' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
  { value: 'OTHER', label: 'Other' },
];

export function resolutionCodeLabel(code) {
  const found = RESOLUTION_CODES.find((c) => c.value === code);
  return found ? found.label : code || '—';
}

export function formatWorkflowDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}