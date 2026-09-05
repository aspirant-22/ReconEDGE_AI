// Run-wide human workflow summary cards (Open / In Review / Resolved / Rejected /
// Escalated / Resolution Rate). Only rendered for real runs, never demo mode.

function WorkflowSummaryCards({ workflow }) {
  if (!workflow) return null;
  const items = [
    { label: 'Open', value: workflow.open ?? 0, cls: 'text-gray-700' },
    { label: 'In Review', value: workflow.inReview ?? 0, cls: 'text-blue-700' },
    { label: 'Resolved', value: workflow.resolved ?? 0, cls: 'text-green-700' },
    { label: 'Rejected', value: workflow.rejected ?? 0, cls: 'text-red-700' },
    { label: 'Escalated', value: workflow.escalated ?? 0, cls: 'text-amber-700' },
    { label: 'Resolution Rate', value: `${workflow.resolutionRate ?? 0}%`, cls: 'text-primary-700' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="workflow-summary">
      {items.map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">{s.label}</p>
          <p className={`text-xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

export default WorkflowSummaryCards;