import { useState } from 'react';
import { Loader2, ClipboardCheck, CheckCircle2, XCircle, ArrowUpCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import WorkflowBadge from './WorkflowBadge';
import { RESOLUTION_CODES } from './workflowConstants';

const ACTION_LABELS = {
  START_REVIEW: 'Start Review',
  RESOLVE: 'Resolve',
  REJECT: 'Reject',
  ESCALATE: 'Escalate',
  REOPEN: 'Reopen',
};

function WorkflowPanel({ exception, disabled, isArchived, runStatus, error, onAction }) {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const status = exception?.workflowStatus || 'OPEN';
  const terminal = ['RESOLVED', 'REJECTED', 'ESCALATED'].includes(status);
  const inReviewOrOpen = ['OPEN', 'IN_REVIEW'].includes(status);

  if (!exception) return null;

  const startAction = (action) => {
    setFormError(null);
    setSelected(selected === action ? null : action);
  };

  const canSubmit = () => {
    if (selected === 'RESOLVE') return !!formValues.resolutionCode;
    if (selected === 'REJECT' || selected === 'ESCALATE') return formValues.reason.trim().length > 0;
    return true;
  };

  // Per-action draft, reset whenever the selected action changes.
  const [formValues, setFormValues] = useState({ resolutionCode: '', reason: '', notes: '' });
  const updateForm = (patch) => setFormValues((prev) => ({ ...prev, ...patch }));

  const closeForm = () => { setSelected(null); setFormValues({ resolutionCode: '', reason: '', notes: '' }); setFormError(null); };

  const handleSubmit = async () => {
    if (submitting) return;
    setFormError(null);
    if (selected === 'RESOLVE' && !formValues.resolutionCode) { setFormError('Please select a resolution code.'); return; }
    if ((selected === 'REJECT' || selected === 'ESCALATE') && !formValues.reason.trim()) { setFormError('Please provide a reason.'); return; }
    setSubmitting(true);
    try {
      const payload = selected === 'START_REVIEW' || selected === 'REOPEN'
        ? { action: selected }
        : { action: selected, resolutionCode: selected === 'RESOLVE' ? formValues.resolutionCode : undefined, reason: (selected === 'REJECT' || selected === 'ESCALATE') && formValues.reason.trim() ? formValues.reason.trim() : undefined, notes: formValues.notes.trim() || undefined };
      await onAction(selected, payload);
      closeForm();
    } catch (err) {
      setFormError(err.message || 'Unable to apply the action. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showReopen = terminal;
  const showDecision = inReviewOrOpen;

  const ActionButton = ({ action, className, testId }) => (
    <button
      type="button"
      onClick={() => startAction(action)}
      disabled={disabled || submitting}
      data-testid={testId}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {action === 'START_REVIEW' && <ClipboardCheck size={16} />}
      {action === 'RESOLVE' && <CheckCircle2 size={16} />}
      {action === 'REJECT' && <XCircle size={16} />}
      {action === 'ESCALATE' && <ArrowUpCircle size={16} />}
      {action === 'REOPEN' && <RotateCcw size={16} />}
      {ACTION_LABELS[action]}
    </button>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Human Resolution</h3>
          <p className="text-xs text-gray-500 mt-0.5">Only a human reviewer can change workflow state.</p>
        </div>
        <WorkflowBadge status={status} />
      </div>

      <div className="px-6 py-5">
        {isArchived && (
          <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4">
            <AlertTriangle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <span>This run is <strong>archived</strong> and read-only. Restore it before changing exception workflow state.</span>
          </div>
        )}

        {!isArchived && runStatus !== 'COMPLETED' && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>Resolution is only available on <strong>completed</strong> runs (current run status: {runStatus || '—'}). You can still inspect the evidence and history.</span>
          </div>
        )}

        {(error || formError) && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4" data-testid="workflow-error">
            {formError || error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!disabled && showDecision && (
            <>
              <ActionButton action="START_REVIEW" className="bg-blue-600 text-white hover:bg-blue-700" testId="action-start-review" />
              <ActionButton action="RESOLVE" className="bg-green-600 text-white hover:bg-green-700" testId="action-resolve" />
              <ActionButton action="REJECT" className="bg-red-600 text-white hover:bg-red-700" testId="action-reject" />
              <ActionButton action="ESCALATE" className="bg-amber-600 text-white hover:bg-amber-700" testId="action-escalate" />
            </>
          )}
          {!disabled && showReopen && (
            <ActionButton action="REOPEN" className="bg-gray-700 text-white hover:bg-gray-800" testId="action-reopen" />
          )}
          {disabled && !isArchived && runStatus === 'COMPLETED' && (
            <p className="text-sm text-gray-400">Action buttons are unavailable.</p>
          )}
        </div>

        {selected && !disabled && (
          <div className="mt-5 border-t border-gray-100 pt-5 space-y-4" data-testid={`action-form-${selected}`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
                {selected === 'START_REVIEW' && <ClipboardCheck size={16} className="text-blue-600" />}
                {selected === 'RESOLVE' && <CheckCircle2 size={16} className="text-green-600" />}
                {selected === 'REJECT' && <XCircle size={16} className="text-red-600" />}
                {selected === 'ESCALATE' && <ArrowUpCircle size={16} className="text-amber-600" />}
                {selected === 'REOPEN' && <RotateCcw size={16} className="text-gray-600" />}
                {ACTION_LABELS[selected]}
              </span>
              <span className="text-xs text-gray-400">
                {status} → {selected === 'START_REVIEW' || selected === 'REOPEN' ? 'IN_REVIEW' : selected === 'RESOLVE' ? 'RESOLVED' : selected === 'REJECT' ? 'REJECTED' : 'ESCALATED'}
              </span>
            </div>

            {selected === 'RESOLVE' && (
              <div>
                <label htmlFor="resolution-code" className="block text-xs font-medium text-gray-600 mb-1">Resolution Code *</label>
                <select
                  id="resolution-code"
                  value={formValues.resolutionCode}
                  onChange={(e) => updateForm({ resolutionCode: e.target.value })}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  data-testid="resolution-code-select"
                >
                  <option value="">Select a code…</option>
                  {RESOLUTION_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}

            {(selected === 'REJECT' || selected === 'ESCALATE') && (
              <div>
                <label htmlFor="resolution-reason" className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
                <textarea
                  id="resolution-reason"
                  rows={2}
                  value={formValues.reason}
                  onChange={(e) => updateForm({ reason: e.target.value })}
                  placeholder={selected === 'REJECT' ? 'Why is this exception being rejected?' : 'Why is this being escalated?'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  data-testid="resolution-reason"
                />
              </div>
            )}

            <div>
              <label htmlFor="resolution-notes" className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <textarea
                id="resolution-notes"
                rows={2}
                value={formValues.notes}
                onChange={(e) => updateForm({ notes: e.target.value })}
                placeholder="Optional additional context for the audit trail…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                data-testid="resolution-notes"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit() || submitting}
                data-testid={`confirm-${selected}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!disabled && showDecision && selected === null && (
          <p className="text-xs text-gray-400 mt-4">
            Resolving requires a resolution code. Rejecting and escalating require a reason.
          </p>
        )}
      </div>
    </div>
  );
}

export default WorkflowPanel;