import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { useReconciliation } from '../contexts/ReconciliationContext';
import RunSelector from '../components/run/RunSelector';
import { SkeletonTable } from '../components/dashboard/Skeletons';

const ACTION_LABELS = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  RECONCILIATION_RUN: 'Reconciliation',
  EXCEPTION_ANALYSIS: 'Exception Analysis',
  FINANCE_QA_QUERY: 'Finance Q&A',
  DASHBOARD_VIEW: 'Dashboard View',
};

const ACTION_COLORS = {
  LOGIN: 'bg-green-50 text-green-700 ring-green-200',
  LOGOUT: 'bg-gray-50 text-gray-600 ring-gray-200',
  RECONCILIATION_RUN: 'bg-blue-50 text-blue-700 ring-blue-200',
  EXCEPTION_ANALYSIS: 'bg-amber-50 text-amber-700 ring-amber-200',
  FINANCE_QA_QUERY: 'bg-purple-50 text-purple-700 ring-purple-200',
  DASHBOARD_VIEW: 'bg-sky-50 text-sky-700 ring-sky-200',
};

const ACTION_FILTERS = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'RECONCILIATION_RUN', label: 'Reconciliation' },
  { value: 'EXCEPTION_ANALYSIS', label: 'Exception Analysis' },
  { value: 'FINANCE_QA_QUERY', label: 'Finance Q&A' },
];

function formatTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function ActionBadge({ action }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${ACTION_COLORS[action] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
      {ACTION_LABELS[action] || action?.replace(/_/g, ' ')}
    </span>
  );
}

function StatusPill({ status }) {
  if (status === 'SUCCESS') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
        SUCCESS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
      FAILED
    </span>
  );
}

const AuditLogs = () => {
  const { selectedRunId, selectedRun } = useReconciliation();
  const [state, setState] = useState({
    loading: true,
    error: null,
    logs: [],
    total: 0,
    pages: 1,
  });
  const [action, setAction] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [appliedFilter, setAppliedFilter] = useState({ action: 'ALL', status: 'ALL', search: '' });

  const fetchLogs = useCallback(async (query) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await api.get('/audit-logs', { params: query });
      if (response.data.success) {
        setState({
          loading: false,
          error: null,
          logs: response.data.logs || [],
          total: response.data.pagination.total,
          pages: response.data.pagination.pages,
        });
      }
    } catch (err) {
      if (err.response?.status === 401) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: err.response?.data?.error?.message || 'Unable to load audit logs. Please try again.',
      }));
    }
  }, []);

  const buildQuery = () => {
    const q = { page, limit };
    if (appliedFilter.action !== 'ALL') q.action = appliedFilter.action;
    if (appliedFilter.status !== 'ALL') q.status = appliedFilter.status;
    if (appliedFilter.search.trim()) q.search = appliedFilter.search.trim();
    if (selectedRunId) q.runId = selectedRunId;
    return q;
  };

  useEffect(() => {
    fetchLogs(buildQuery());
  }, [page, limit, appliedFilter]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilter({ action, status, search });
  };

  useEffect(() => {
    if (page > state.pages) setPage(Math.max(state.pages, 1));
  }, [state.pages, page]);

  const changePage = (dir) => {
    setPage((p) => Math.min(Math.max(p + dir, 1), state.pages));
  };

  if (state.loading && state.logs.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-7 bg-gray-200 rounded w-44 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-64 mt-2 animate-pulse" />
        </div>
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Structured financial-control audit trail</p>
        </div>
        <div className="flex items-center gap-2">
          <RunSelector label="Run" />
          <button
            onClick={() => fetchLogs(buildQuery())}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} className={state.loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {selectedRunId && (
        <div className="mb-6 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Showing audit events for reconciliation run: {selectedRun?.name || 'selected run'}. No run selected shows the full audit trail.
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Shield size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Financial-control audit trail</p>
          <p className="mt-1">
            User and reconciliation activity is recorded without sensitive data — never secrets,
            passwords, or full AI requests.
          </p>
        </div>
      </div>

      {state.error && (
        <div className="bg-white rounded-xl border border-red-200 p-8 mb-6">
          <div className="text-center py-6">
            <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
            <h2 className="text-base font-semibold text-gray-900 mb-1">Unable to load audit logs</h2>
            <p className="text-sm text-gray-500 mb-5">{state.error}</p>
            <button
              onClick={() => fetchLogs(buildQuery())}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {!state.error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Audit Activity</h3>
              <span className="text-xs text-gray-400">{state.total} events</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                aria-label="action filter"
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-full bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {ACTION_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="status filter"
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-full bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                  placeholder="Search action, resource, user, or ID..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply Filters
              </button>

              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          {state.logs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={40} className="mx-auto mb-4 text-gray-300" />
              <h2 className="text-lg font-medium text-gray-900 mb-2">No audit activity yet</h2>
              <p className="text-sm text-gray-500">
                User and reconciliation activity will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Time</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Action</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">User</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Resource</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {state.logs.map((log) => (
                    <tr key={log.id || log.timestamp} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-xs text-gray-600 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                      <td className="px-6 py-3"><ActionBadge action={log.action} /></td>
                      <td className="px-6 py-3 text-sm text-gray-800 font-medium">{log.userName || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {log.resource}
                        {log.resourceId ? <span className="text-gray-400 font-mono text-xs ml-1">({log.resourceId})</span> : null}
                      </td>
                      <td className="px-6 py-3"><StatusPill status={log.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-gray-500">
              Showing {state.total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, state.total)} of {state.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changePage(-1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {state.pages}</span>
              <button
                onClick={() => changePage(1)}
                disabled={page >= state.pages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
