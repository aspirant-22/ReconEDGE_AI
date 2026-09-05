import { WORKFLOW_STATUS_LABELS, WORKFLOW_BADGE_STYLES } from './workflowConstants';

// Status is always communicated with a text label, never color alone.
function WorkflowBadge({ status }) {
  const label = WORKFLOW_STATUS_LABELS[status] || status || 'Unknown';
  const style = WORKFLOW_BADGE_STYLES[status] || 'bg-gray-100 text-gray-700 ring-gray-300';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${style}`}>
      {label}
    </span>
  );
}

export default WorkflowBadge;