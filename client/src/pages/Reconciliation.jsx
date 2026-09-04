import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Play,
  CheckCircle2,
  Shield,
  Search,
  Loader2,
  Download,
  AlertCircle,
  CreditCard,
  Landmark,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../services/api';
import { SkeletonCard, SkeletonTable } from '../components/dashboard/Skeletons';

const STATUS_LABELS = {
  MATCHED: 'Matched',
  EXCEPTION: 'Exception',
};

const TYPE_LABELS = {
  MISSING_BANK_TRANSACTION: 'Missing Bank Txn',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  DUPLICATE_BANK_TRANSACTION: 'Duplicate Bank Txn',
  DATE_MISMATCH: 'Date Mismatch',
  UNMATCHED_BANK_TRANSACTION: 'Unmatched Bank Txn',
};

const TYPE_COLORS = {
  MISSING_BANK_TRANSACTION: 'bg-red-50 text-red-700 ring-red-200',
  AMOUNT_MISMATCH: 'bg-amber-50 text-amber-700 ring-amber-200',
  DUPLICATE_BANK_TRANSACTION: 'bg-blue-50 text-blue-700 ring-blue-200',
  DATE_MISMATCH: 'bg-purple-50 text-purple-700 ring-purple-200',
  UNMATCHED_BANK_TRANSACTION: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
};

const TYPE_BAR_COLORS = {
  MISSING_BANK_TRANSACTION: 'bg-red-500',
  AMOUNT_MISMATCH: 'bg-amber-500',
  DUPLICATE_BANK_TRANSACTION: 'bg-blue-500',
  DATE_MISMATCH: 'bg-purple-500',
  UNMATCHED_BANK_TRANSACTION: 'bg-cyan-500',
};

function formatCurrency(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2) + '%';
}

function StatusBadge({ status }) {
  if (status === 'MATCHED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
        <CheckCircle2 size={12} />
        MATCHED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
      <AlertCircle size={12} />
      EXCEPTION
    </span>
  );
}

function TypeBadge({ type }) {
  if (!type) return <span className="text-gray-300">—</span>;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${TYPE_COLORS[type] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
      {TYPE_LABELS[type] || type.replace(/_/g, ' ')}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sublabel, color, bg }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  );
}

const Reconciliation = () => {
  const [state, setState] = useState({
    loading: true,
    error: null,
    hasData: false,
    dataset: null,
    summary: null,
    exceptionDistribution: null,
    financial: null,
    results: [],
    generatedAt: null,
    processingTimeMs: null,
  });

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await api.get('/reconciliation');
      if (response.data.success && response.data.hasData) {
        setState({
          loading: false,
          error: null,
          hasData: true,
          dataset: response.data.data.dataset,
          summary: response.data.data.summary,
          exceptionDistribution: response.data.data.exceptionDistribution || {},
          financial: response.data.data.financial,
          results: response.data.data.results || [],
          generatedAt: response.data.data.generatedAt,
          processingTimeMs: response.data.data.processingTimeMs,
        });
      } else {
        setState({
          loading: false,
          error: null,
          hasData: false,
          dataset: null,
          summary: null,
          exceptionDistribution: null,
          financial: null,
          results: [],
          generatedAt: null,
          processingTimeMs: null,
        });
      }
    } catch (err) {
      if (err.response?.status === 401) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: err.response?.data?.error?.message || 'Unable to load reconciliation data. Please try again.',
      }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setRunMessage(null);
    setState((s) => ({ ...s, error: null }));
    try {
      const response = await api.post('/reconciliation/run');
      if (response.data.success) {
        setState({
          loading: false,
          error: null,
          hasData: true,
          dataset: response.data.data.dataset,
          summary: response.data.data.summary,
          exceptionDistribution: response.data.data.exceptionDistribution || {},
          financial: response.data.data.financial,
          results: response.data.data.results || [],
          generatedAt: response.data.data.generatedAt,
          processingTimeMs: response.data.data.processingTimeMs,
        });
        setRunMessage('Reconciliation completed');
        setPage(1);
      } else {
        setState((s) => ({ ...s, error: 'Reconciliation failed. We couldn\u2019t complete the reconciliation run.' }));
      }
    } catch (err) {
      if (err.response?.status === 401) return;
      setState((s) => ({ ...s, error: 'Reconciliation failed. We couldn\u2019t complete the reconciliation run.' }));
    } finally {
      setRunning(false);
    }
  };

  const filtered = useMemo(() => {
    let list = Array.isArray(state.results) ? state.results : [];
    if (statusFilter !== 'ALL') {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (typeFilter !== 'ALL') {
      list = list.filter((r) => r.exceptionType === typeFilter);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((r) =>
        [r.paymentId, r.bankTransactionId, r.invoiceId]
          .filter(Boolean)
          .some((id) => id.toLowerCase().includes(term))
      );
    }
    return list;
  }, [state.results, statusFilter, typeFilter, search]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageResults = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const changePage = (dir) => {
    setPage((p) => Math.min(Math.max(p + dir, 1), totalPages));
  };

  const typeOptions = Object.keys(state.exceptionDistribution || {});
  const maxTypeCount = Math.max(1, ...Object.values(state.exceptionDistribution || {}).map(Number));

  if (state.loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-7 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-72 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Run and review deterministic financial reconciliation</p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Running reconciliation...
            </>
          ) : (
            <>
              <Play size={16} />
              Run Reconciliation
            </>
          )}
        </button>
      </div>

      {runMessage && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
          <CheckCircle2 size={16} />
          {runMessage}
          {state.processingTimeMs != null && (
            <span className="text-green-600 ml-1">
              (Processing time: {state.processingTimeMs} ms)
            </span>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Shield size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Deterministic reconciliation</p>
          <p className="mt-1">
            Matching and financial calculations are performed by the reconciliation engine.
            AI is used only for explanation and decision support.
          </p>
        </div>
      </div>

      {state.error && (
        <div className="bg-white rounded-xl border border-red-200 p-8 mb-6">
          <div className="text-center py-6">
            <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
            <h2 className="text-base font-semibold text-gray-900 mb-1">Reconciliation failed</h2>
            <p className="text-sm text-gray-500 mb-5">We couldn&apos;t complete the reconciliation run.</p>
            <button
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              <Play size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {!state.hasData && !state.error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ArrowLeftRight size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">No reconciliation results yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Run reconciliation to generate matching results.
          </p>
          <button
            onClick={handleRun}
            disabled={running}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Run Reconciliation
          </button>
        </div>
      )}

      {state.hasData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricCard
              icon={CreditCard}
              label="Payments"
              value={state.dataset?.payments?.toLocaleString('en-IN') || '—'}
              sublabel="Payment records"
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <MetricCard
              icon={Landmark}
              label="Bank Transactions"
              value={state.dataset?.bankTransactions?.toLocaleString('en-IN') || '—'}
              sublabel="Bank settlement records"
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
            <MetricCard
              icon={FileText}
              label="Invoices"
              value={state.dataset?.invoices?.toLocaleString('en-IN') || '—'}
              sublabel="Invoice records"
              color="text-sky-600"
              bg="bg-sky-50"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <MetricCard
              icon={CheckCircle2}
              label="Matched"
              value={state.summary?.matched?.toLocaleString('en-IN') || '—'}
              sublabel="Successfully reconciled"
              color="text-green-600"
              bg="bg-green-50"
            />
            <MetricCard
              icon={AlertCircle}
              label="Exceptions"
              value={state.summary?.exceptions?.toLocaleString('en-IN') || '—'}
              sublabel="Require investigation"
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <MetricCard
              icon={ArrowLeftRight}
              label="Payment Match Rate"
              value={formatPercent(state.summary?.paymentMatchRate)}
              sublabel="Matched / payments"
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <MetricCard
              icon={ArrowLeftRight}
              label="Bank Match Rate"
              value={formatPercent(state.summary?.bankMatchRate)}
              sublabel="Matched / bank records"
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
            <MetricCard
              icon={ArrowLeftRight}
              label="Invoice Match Rate"
              value={formatPercent(state.summary?.invoiceMatchRate)}
              sublabel="Matched / invoices"
              color="text-sky-600"
              bg="bg-sky-50"
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Download size={18} className="text-primary-600" />
                <h3 className="text-sm font-semibold text-gray-900">Exception Breakdown</h3>
              </div>
              <span className="text-xs text-gray-400">{Object.keys(state.exceptionDistribution || {}).length} types</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Exception Type</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Count</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 w-1/2">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {typeOptions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                        No exceptions detected.
                      </td>
                    </tr>
                  ) : (
                    typeOptions.map((type) => (
                      <tr key={type} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <TypeBadge type={type} />
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-semibold text-gray-900">
                          {state.exceptionDistribution[type]}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${TYPE_BAR_COLORS[type] || 'bg-gray-400'} rounded-full`}
                                style={{ width: `${(state.exceptionDistribution[type] / maxTypeCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Reconciliation Results</h3>
                <span className="text-xs text-gray-400">{filtered.length} records</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => { setStatusFilter('ALL'); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'ALL' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => { setStatusFilter('MATCHED'); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'MATCHED' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Matched
                </button>
                <button
                  onClick={() => { setStatusFilter('EXCEPTION'); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'EXCEPTION' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Exceptions
                </button>

                <div className="w-px h-6 bg-gray-200 mx-1" />

                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-full bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ALL">All Exceptions</option>
                  <option value="MISSING_BANK_TRANSACTION">Missing Bank</option>
                  <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
                  <option value="DUPLICATE_BANK_TRANSACTION">Duplicate</option>
                  <option value="DATE_MISMATCH">Date Mismatch</option>
                  <option value="UNMATCHED_BANK_TRANSACTION">Unmatched Bank</option>
                </select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search payment, bank or invoice ID..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="px-2 py-1 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>per page</span>
                </div>
              </div>
            </div>

            {pageResults.length === 0 ? (
              <div className="p-12 text-center">
                <Search size={40} className="mx-auto mb-4 text-gray-300" />
                <h2 className="text-base font-medium text-gray-900 mb-1">No matching results</h2>
                <p className="text-sm text-gray-500">Adjust your filters or search to find reconciliation records.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Payment ID</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Bank Txn ID</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Invoice ID</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Payment Amt</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Bank Amt</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Exception Type</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Confidence</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Date Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageResults.map((r, i) => (
                      <tr key={r.paymentId || r.bankTransactionId || i} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.paymentId || '—'}</td>
                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.bankTransactionId || '—'}</td>
                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.invoiceId || '—'}</td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-gray-700">{formatCurrency(r.paymentAmount)}</td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-gray-700">{formatCurrency(r.bankAmount)}</td>
                        <td className="px-6 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-6 py-3"><TypeBadge type={r.exceptionType} /></td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-gray-600">
                          {r.confidence != null ? (r.confidence * 100).toFixed(0) + '%' : '—'}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-gray-600">
                          {r.dateDifferenceDays != null ? r.dateDifferenceDays + 'd' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-gray-500">
                Showing {filtered.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePage(-1)}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => changePage(1)}
                  disabled={currentPage >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reconciliation;
