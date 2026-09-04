import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Landmark,
  FileText,
  Search,
  Loader2,
  Sparkles,
  Play,
  X,
} from 'lucide-react';
import { recApi } from '../services/recApi';

const STATUS_LABELS = {
  CREATED: 'Created', UPLOADING: 'Uploading', VALIDATING: 'Validating',
  READY: 'Ready', PROCESSING: 'Processing', COMPLETED: 'Completed', FAILED: 'Failed',
};

const TYPE_LABELS = {
  MISSING_BANK_TRANSACTION: 'Missing Bank Txn',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  DUPLICATE_BANK_TRANSACTION: 'Duplicate Bank Txn',
  DATE_MISMATCH: 'Date Mismatch',
  UNMATCHED_BANK_TRANSACTION: 'Unmatched Bank Txn',
};

function formatCurrency(a) {
  if (a === null || a === undefined || Number.isNaN(a)) return '—';
  return '₹' + Number(a).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const map = {
    MATCHED: 'bg-green-50 text-green-700 ring-green-200',
    EXCEPTION: 'bg-red-50 text-red-700 ring-red-200',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${map[status] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{status}</span>;
}

function TypeBadge({ type }) {
  if (!type) return <span className="text-gray-300">—</span>;
  return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 bg-amber-50 text-amber-700 ring-amber-200">{TYPE_LABELS[type] || type.replace(/_/g, ' ')}</span>;
}

const ReconRunDetail = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [analytics, setAnalytics] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const loadResults = useCallback(async (status, term, p) => {
    try {
      const res = await recApi.getResults(runId, {
        status: status === 'ALL' ? undefined : status,
        search: term || undefined,
        page: p,
        limit: pageSize,
      });
      setResults(res.data?.data || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (e) { /* ignore refresh errors */ }
  }, [runId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runRes, anRes] = await Promise.all([
        recApi.getRun(runId),
        recApi.getAnalytics(runId).catch(() => null),
      ]);
      setRun(runRes.data?.data);
      setAnalytics(anRes ? anRes.data?.data : null);
      if (runRes.data?.data?.status === 'COMPLETED') await loadResults('ALL', '', 1);
    } catch (err) {
      if (err.response?.status === 401) return;
      setError(err.response?.data?.error?.message || 'Unable to load this run.');
    } finally {
      setLoading(false);
    }
  }, [runId, loadResults]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (status, term, p) => {
    setStatusFilter(status);
    setSearch(term);
    setPage(p);
    loadResults(status, term, p);
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await recApi.executeRun(runId);
      setAnalytics(res.data?.data?.analytics);
      await load();
    } catch (err) {
      if (err.response?.status !== 401) setError(err.response?.data?.error?.message || 'Reconciliation failed.');
    } finally {
      setExecuting(false);
    }
  };

  const handleAnalyze = async (record) => {
    setAnalyzing(record.paymentId || record.bankTransactionId);
    setAnalysis(null);
    try {
      const res = await recApi.analyzeException(runId, record.paymentId || record.bankTransactionId);
      setAnalysis(res.data);
    } catch (err) {
      if (err.response?.status === 401) return;
      setAnalysis({ error: err.response?.data?.error?.message || 'AI analysis is temporarily unavailable.' });
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) {
    return <div className="h-40 bg-white border border-gray-200 rounded-xl animate-pulse" />;
  }

  if (!run) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <AlertCircle size={36} className="mx-auto mb-3 text-red-400" />
        <h2 className="text-base font-medium text-gray-900 mb-1">Run not found</h2>
        <p className="text-sm text-gray-500 mb-4">{error || 'This reconciliation could not be found.'}</p>
        <button onClick={() => navigate('/reconciliation/runs')} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          <ArrowLeft size={14} /> Back to runs
        </button>
      </div>
    );
  }

  const completed = run.status === 'COMPLETED';
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <button onClick={() => navigate('/reconciliation/runs')} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> My reconciliations
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{run.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Status: <span className="font-medium text-gray-700">{STATUS_LABELS[run.status] || run.status}</span></p>
        </div>
        {!completed && (
          <button
            onClick={handleExecute}
            disabled={executing || run.status !== 'READY'}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {executing ? 'Running...' : 'Run Reconciliation'}
          </button>
        )}
      </div>

      {run.errorMessage && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <AlertCircle size={16} /> {run.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <FileSummary icon={CreditCard} label="Payments" meta={run.paymentFile} color="text-blue-600" bg="bg-blue-50" />
        <FileSummary icon={Landmark} label="Bank Transactions" meta={run.bankFile} color="text-indigo-600" bg="bg-indigo-50" />
        <FileSummary icon={FileText} label="Invoices" meta={run.invoiceFile} color="text-sky-600" bg="bg-sky-50" />
      </div>

      {completed && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniMetric label="Matched" value={run.matchedCount} color="text-green-600" />
            <MiniMetric label="Exceptions" value={run.exceptionCount} color="text-amber-600" />
            <MiniMetric label="Payment match rate" value={(analytics?.matching?.paymentMatchRate ?? '—') + '%'} color="text-blue-600" />
            <MiniMetric label="Processing time" value={run.processingTimeMs != null ? `${run.processingTimeMs} ms` : '—'} color="text-gray-700" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Reconciliation Results</h3>
                <span className="text-xs text-gray-400">{total} records</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => handleFilter('ALL', search, 1)} className={`px-3 py-1.5 text-xs font-medium rounded-full ${statusFilter === 'ALL' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
                <button onClick={() => handleFilter('MATCHED', search, 1)} className={`px-3 py-1.5 text-xs font-medium rounded-full ${statusFilter === 'MATCHED' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Matched</button>
                <button onClick={() => handleFilter('EXCEPTION', search, 1)} className={`px-3 py-1.5 text-xs font-medium rounded-full ${statusFilter === 'EXCEPTION' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Exceptions</button>
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFilter(statusFilter, search, 1); }}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search ID and press Enter"
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Payment ID</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Bank Txn</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Invoice</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Payment</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Bank</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Exception</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Analyze</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((r, i) => (
                    <tr key={r.paymentId || r.bankTransactionId || i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.paymentId || '—'}</td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.bankTransactionId || '—'}</td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.invoiceId || '—'}</td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-gray-700">{formatCurrency(r.paymentAmount)}</td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-gray-700">{formatCurrency(r.bankAmount)}</td>
                      <td className="px-6 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-6 py-3">{r.status === 'EXCEPTION' ? <TypeBadge type={r.exceptionType} /> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-6 py-3 text-right">
                        {r.status === 'EXCEPTION' ? (
                          <button
                            onClick={() => handleAnalyze(r)}
                            disabled={analyzing === (r.paymentId || r.bankTransactionId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                            data-testid={`analyze-${r.paymentId || r.bankTransactionId}`}
                          >
                            {analyzing === (r.paymentId || r.bankTransactionId) ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            Explain
                          </button>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-gray-500">{total} result(s)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleFilter(statusFilter, search, page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Prev</button>
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => handleFilter(statusFilter, search, page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        </>
      )}

      {!completed && run.status === 'READY' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          All three datasets are uploaded and validated. Click <span className="font-medium">Run Reconciliation</span> to process them.
        </div>
      )}

      {analysis && (
        <AnalysisModal analysis={analysis} onClose={() => setAnalysis(null)} />
      )}
    </div>
  );
};

function FileSummary({ icon: Icon, label, meta, color, bg }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}><Icon size={16} className={color} /></div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      {meta ? (
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="truncate text-gray-700 font-medium">{meta.fileName}</p>
          <p>{meta.validRows} valid / {meta.totalRows} total rows</p>
          {meta.invalidRows > 0 && <p className="text-red-500">{meta.invalidRows} invalid row(s) skipped</p>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Not uploaded</p>
      )}
    </div>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function AnalysisModal({ analysis, onClose }) {
  const hasError = analysis.error;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="analysis-modal">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary-600" />
            <h3 className="text-base font-semibold text-gray-900">Exception Analysis</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {hasError ? (
          <p className="text-sm text-red-600">{analysis.error}</p>
        ) : (
          <div className="text-sm text-gray-700 space-y-3">
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">{analysis.exceptionType?.replace(/_/g, ' ')}</span>
              <p className="text-xs text-gray-400">{analysis.cached ? 'Cached result' : 'AI-generated'}</p>
            </div>
            {analysis.analysis?.summary && <p>{analysis.analysis.summary}</p>}
            {analysis.analysis?.likelyCause && (
              <div><span className="font-medium text-gray-800">Likely cause: </span>{analysis.analysis.likelyCause}</div>
            )}
            {analysis.analysis?.recommendedActions?.length > 0 && (
              <div>
                <span className="font-medium text-gray-800 block mb-1">Recommended actions</span>
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.analysis.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {analysis.analysis?.riskLevel && <div><span className="font-medium text-gray-800">Risk: </span>{analysis.analysis.riskLevel}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReconRunDetail;
