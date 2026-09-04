import { FolderOpen, Loader2, Plus } from 'lucide-react';
import { useReconciliation } from '../../contexts/ReconciliationContext';
import { Link } from 'react-router-dom';

const RunSelector = ({ allowDemo = true, showManage = true, label = 'Scope' }) => {
  const { runs, runsLoading, selectedRunId, setSelectedRunId } = useReconciliation();

  const current = runs.find((r) => String(r.id || r._id) === String(selectedRunId)) || null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-xs font-medium text-gray-500">{label}</span>}
      <select
        value={selectedRunId || ''}
        onChange={(e) => setSelectedRunId(e.target.value || null)}
        aria-label={label}
        disabled={runsLoading}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-60"
      >
        {allowDemo ? (
          <option value="">Demo dataset</option>
        ) : (
          <option value="">Select a reconciliation run</option>
        )}
        {runs.length === 0 && !runsLoading && (
          <option value="" disabled>
            No reconciliation runs yet
          </option>
        )}
        {runs.map((run) => (
          <option key={run.id || run._id} value={run.id || run._id}>
            {run.name} ({run.status?.toLowerCase()})
          </option>
        ))}
      </select>
      {runsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      {showManage && current && (
        <span className="text-xs text-gray-400 truncate max-w-[200px]" title={current.name}>
          Currently viewing {current.name}
        </span>
      )}
      {showManage && (
        <Link
          to="/reconciliation/runs"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          <FolderOpen size={14} />
          Manage runs
        </Link>
      )}
    </div>
  );
};

export default RunSelector;
