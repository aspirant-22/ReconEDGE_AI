import { History } from 'lucide-react';
import WorkflowBadge from './WorkflowBadge';
import { resolutionCodeLabel, formatWorkflowDate } from './workflowConstants';

const ACTION_LABELS = {
  START_REVIEW: 'Started Review',
  RESOLVE: 'Resolved',
  REJECT: 'Rejected',
  ESCALATE: 'Escalated',
  REOPEN: 'Reopened',
};

function HistoryTimeline({ history, loading }) {
  if (loading) {
    return <div className="animate-pulse space-y-3">{[0, 1].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}</div>;
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8">
        <History size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No resolution activity yet.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {history.map((h, i) => (
        <li key={h.id || i} className="relative pl-6 pb-5 last:pb-0">
          {i < history.length - 1 && <span className="absolute left-2 top-3 bottom-0 w-px bg-gray-200" />}
          <span className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white ring-2 ring-gray-200 bg-white" />
          <div className="text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-800">{h.userName || 'User'}</span>
              <span className="text-gray-500">{ACTION_LABELS[h.action] || h.action}</span>
              <WorkflowBadge status={h.previousStatus} />
              <span className="text-gray-400">→</span>
              <WorkflowBadge status={h.newStatus} />
            </div>
            <p className="text-gray-400 mt-1">{formatWorkflowDate(h.timestamp)}</p>
            {(h.resolutionCode || h.reason) && (
              <div className="mt-1.5 space-y-0.5">
                {h.resolutionCode && (
                  <p className="text-gray-600"><span className="font-medium text-gray-500">Code:</span> {resolutionCodeLabel(h.resolutionCode)}</p>
                )}
                {h.reason && <p className="text-gray-600"><span className="font-medium text-gray-500">Reason:</span> {h.reason}</p>}
                {h.notes && <p className="text-gray-600"><span className="font-medium text-gray-500">Notes:</span> {h.notes}</p>}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default HistoryTimeline;