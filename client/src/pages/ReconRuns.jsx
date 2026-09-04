import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  Search,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { recApi } from '../services/recApi';

const STATUS_LABELS = {
  CREATED: 'Created',
  UPLOADING: 'Uploading',
  VALIDATING: 'Validating',
  READY: 'Ready',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const STATUS_COLORS = {
  CREATED: 'bg-gray-100 text-gray-600 ring-gray-200',
  UPLOADING: 'bg-blue-50 text-blue-700 ring-blue-200',
  VALIDATING: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  READY: 'bg-amber-50 text-amber-700 ring-amber-200',
  PROCESSING: 'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED: 'bg-green-50 text-green-700 ring-green-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
};

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const ReconRuns = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, runs: [], total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState('active');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [appliedFilter, setAppliedFilter] = useState({ search: '', status: '', archived: 'active' });

  const loadRuns = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = {
        page,
        limit,
        sortBy,
        sortOrder,
      };
      if (appliedFilter.search.trim()) params.search = appliedFilter.search.trim();
      if (appliedFilter.status) params.status = appliedFilter.status;
      if (appliedFilter.archived && appliedFilter.archived !== 'active') {
        params.archived = appliedFilter.archived;
      }
      const response = await recApi.listRuns(params);
      const pagination = response.data?.pagination || {};
      setState({
        loading: false,
        error: null,
        runs: response.data?.data || [],
        total: pagination.total || 0,
        pages: pagination.totalPages || Math.max(Math.ceil((pagination.total || 0) / limit), 1),
      });
    } catch (err) {
      if (err.response?.status === 401) return;
      setState((s) => ({ ...s, loading: false, error: err.response?.data?.error?.message || 'Unable to load reconciliation runs.', runs: [] }));
    }
  }, [page, limit, sortBy, sortOrder, appliedFilter]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilter({ search, status, archived });
  };

  useEffect(() => {
    if (page > Math.max(state.pages, 1)) setPage(Math.max(state.pages, 1));
  }, [state.pages, page]);

  const handleArchive = async (e, run) => {
    e.stopPropagation();
    const action = run.isArchived ? false : true;
    try {
      await recApi.archiveRun(run.id, action);
      await loadRuns();
    } catch (err) {
      setState((s) => ({ ...s, error: err.response?.data?.error?.message || 'Unable to update run.' }));
    }
  };

  const columnSort = (key, label) => {
    const active = sortBy === key;
    const order = active && sortOrder === 'desc' ? 'asc' : 'desc';
    return (
      <button
        onClick={() => { setSortBy(key); setSortOrder(order); setPage(1); }}
        className="inline-flex items-center gap-1 hover:text-gray-900"
      >
        {label}
        {active && <span className="text-primary-600">{sortOrder === 'desc' ? '↓' : '↑'}</span>}
      </button>
    );
  };

  const changePage = (dir) => setPage((p) => Math.min(Math.max(p + dir, 1), Math.max(state.pages, 1)));

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Reconciliations</h1>
          <p className="text-sm text-gray-500 mt-1">Upload your own payment, bank and invoice files to reconcile real data.</p>
        </div>
        <button
          onClick={() => navigate('/reconciliation/runs/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          New Reconciliation
        </button>
      </div>

      {state.error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <AlertCircle size={16} />
          {state.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 mb-6 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            placeholder="Search by run name..."
            aria-label="search runs"
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="status filter"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          value={archived}
          onChange={(e) => setArchived(e.target.value)}
          aria-label="archived filter"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="active">Active</option>
          <option value="true">Archived</option>
          <option value="all">All</option>
        </select>
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          Apply Filters
        </button>
      </div>

      {state.loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white border border-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : state.runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Clock size={40} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-base font-medium text-gray-900 mb-1">No reconciliation runs yet</h2>
          <p className="text-sm text-gray-500 mb-5">Adjust your filters or upload your payment, bank and invoice files to run a real-data reconciliation.</p>
          <button
            onClick={() => navigate('/reconciliation/runs/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Start a Reconciliation
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">{columnSort('name', 'Name')}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Period</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">{columnSort('status', 'Status')}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Payments</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Bank Txns</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Invoices</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">{columnSort('createdAt', 'Created')}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Actions</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {state.runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => navigate(`/reconciliation/runs/${run.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {run.name}
                      {run.isArchived && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">archived</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">
                    {run.periodStart ? formatDate(run.periodStart).split(',')[0] : '—'}
                    {run.periodEnd ? ` → ${formatDate(run.periodEnd).split(',')[0]}` : ''}
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={run.status} /></td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-gray-700">{run.validPaymentCount}</td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-gray-700">{run.validBankTransactionCount}</td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-gray-700">{run.validInvoiceCount}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{formatDate(run.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => handleArchive(e, run)}
                      title={run.isArchived ? 'Restore run' : 'Archive run'}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {run.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ArrowRight size={16} className="text-gray-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {state.pages > 1 && (
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
          )}
        </div>
      )}
    </div>
  );
};

export default ReconRuns;
