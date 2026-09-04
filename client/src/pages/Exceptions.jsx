import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Brain, Loader2, ChevronDown, ChevronUp, Shield, Search } from 'lucide-react';
import { recApi } from '../services/recApi';
import { useReconciliation } from '../contexts/ReconciliationContext';
import RunSelector from '../components/run/RunSelector';

const EXCEPTION_ICONS = {
  MISSING_BANK_TRANSACTION: '🏦',
  AMOUNT_MISMATCH: '💰',
  DUPLICATE_BANK_TRANSACTION: '📋',
  DATE_MISMATCH: '📅',
  UNMATCHED_BANK_TRANSACTION: '🔍',
};

const RISK_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
};

const EXCEPTION_TYPES = [
  { value: '', label: 'All Exception Types' },
  { value: 'MISSING_BANK_TRANSACTION', label: 'Missing Bank Transaction' },
  { value: 'AMOUNT_MISMATCH', label: 'Amount Mismatch' },
  { value: 'DUPLICATE_BANK_TRANSACTION', label: 'Duplicate Bank Transaction' },
  { value: 'DATE_MISMATCH', label: 'Date Mismatch' },
  { value: 'UNMATCHED_BANK_TRANSACTION', label: 'Unmatched Bank Transaction' },
];

function loadDemoExceptions() {
  return fetch('/data/generated/reconciliation-results.json')
    .then((r) => r.json())
    .then((all) => all.filter((x) => x.status === 'EXCEPTION'))
    .catch(() => []);
}

const Exceptions = () => {
  const { selectedRunId, selectedRun } = useReconciliation();
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [exceptionType, setExceptionType] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [appliedFilter, setAppliedFilter] = useState({ exceptionType: '', severity: '', search: '' });
  const promoRef = useRef(false);

  useEffect(() => {
    if (promoRef.current) return;
    promoRef.current = true;
    apiStatusFetch();
  }, []);

  const apiStatusFetch = async () => {
    const statusRes = await fetch('/api/ai/status', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).catch(() => ({ available: false }));
    setAiStatus(statusRes);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!selectedRunId) {
        const demo = await loadDemoExceptions();
        setExceptions(demo);
      } else {
        const params = {};
        if (appliedFilter.exceptionType) params.exceptionType = appliedFilter.exceptionType;
        if (appliedFilter.severity) params.severity = appliedFilter.severity;
        if (appliedFilter.search.trim()) params.search = appliedFilter.search.trim();
        params.limit = 100;
        const response = await recApi.getExceptions(selectedRunId, params);
        setExceptions(response.data?.data || []);
      }
    } catch (err) {
      if (err.response?.status === 401) return;
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRunId, appliedFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Switching runs (or entering demo mode) must never display the previous
  // run's AI analysis responses. Reset all run-local UI state on run change.
  useEffect(() => {
    setAnalyses({});
    setExpandedRow(null);
    setAnalyzing(null);
  }, [selectedRunId]);

  const applyFilters = () => {
    setAppliedFilter({ exceptionType, severity, search });
  };

  const handleAnalyze = async (exception) => {
    const id = exception.paymentId || exception.bankTransactionId || exception.invoiceId;
    setAnalyzing(id);

    try {
      let response;
      if (selectedRunId) {
        response = await recApi.analyzeException(selectedRunId, id);
      } else {
        response = await fetch('/api/ai/analyze-exception', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ exceptionId: id }),
        }).then((r) => r.json());
      }
      if (response.data?.success) {
        setAnalyses((prev) => ({ ...prev, [id]: response.data.analysis }));
      }
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [id]: {
          summary: err.response?.data?.error?.message || 'AI analysis unavailable.',
          likelyCause: 'Could not determine cause.',
          riskLevel: 'MEDIUM',
          recommendedActions: ['Manual review required.'],
          confidence: 0,
          requiresHumanReview: true,
          error: true,
        },
      }));
    } finally {
      setAnalyzing(null);
    }
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exceptions</h1>
          <p className="text-sm text-gray-500 mt-1">Review and resolve reconciliation discrepancies</p>
        </div>
        <RunSelector />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Shield size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">AI-Generated Analysis Advisory</p>
          <p className="mt-1">
            AI-generated analysis is advisory only. Deterministic reconciliation results remain the source of truth.
            Human review is required before any financial action.
          </p>
        </div>
      </div>

      {!selectedRunId && (
        <div className="mb-6 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Showing demo sample exceptions. Select a reconciliation run above to view your real run's exceptions.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                {selectedRunId ? `Exceptions — ${selectedRun?.name || 'Run'}` : 'Reconciliation Exceptions'}
              </h2>
              <p className="text-sm text-gray-500">{exceptions.length} exceptions detected</p>
            </div>
            {aiStatus && (
              <div className={`text-xs px-3 py-1 rounded-full ${aiStatus.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                AI: {aiStatus.available ? 'Available' : 'Not Configured'}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                placeholder="Search by payment/bank/invoice ID..."
                aria-label="search exceptions"
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <select
              value={exceptionType}
              onChange={(e) => setExceptionType(e.target.value)}
              aria-label="exception type filter"
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {EXCEPTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              aria-label="severity filter"
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Severities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {exceptions.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">No Exceptions</h2>
            <p className="text-sm text-gray-500">All reconciled records passed the configured matching checks.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {exceptions.map((exc) => {
              const id = exc.paymentId || exc.bankTransactionId || exc.invoiceId;
              const isExpanded = expandedRow === id;
              const analysis = analyses[id];
              const isAnalyzing = analyzing === id;

              return (
                <div key={`${selectedRunId || 'demo'}-${id}`} className="hover:bg-gray-50 transition-colors">
                  <div
                    className="px-6 py-4 cursor-pointer flex items-center gap-4"
                    onClick={() => toggleRow(id)}
                  >
                    <span className="text-xl">{EXCEPTION_ICONS[exc.exceptionType] || '⚠️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{exc.exceptionType?.replace(/_/g, ' ')}</span>
                        {exc.severity && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[exc.severity] || 'bg-gray-100 text-gray-600'}`}>
                            {exc.severity}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500">{id}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {exc.paymentAmount != null && <span>Payment: ₹{exc.paymentAmount.toLocaleString('en-IN')}</span>}
                        {exc.bankAmount != null && <span> | Bank: ₹{exc.bankAmount.toLocaleString('en-IN')}</span>}
                        {exc.amountDifference > 0 && <span className="text-orange-600"> | Diff: ₹{exc.amountDifference.toLocaleString('en-IN')}</span>}
                      </div>
                    </div>
                    {analysis && (
                      <span className={`text-xs px-2 py-1 rounded-full ${RISK_COLORS[analysis.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                        {analysis.riskLevel}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-4 border-t border-gray-50">
                      <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400">Payment ID</span>
                          <p className="text-gray-700 font-mono">{exc.paymentId || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Bank Transaction ID</span>
                          <p className="text-gray-700 font-mono">{exc.bankTransactionId || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Invoice ID</span>
                          <p className="text-gray-700 font-mono">{exc.invoiceId || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Match Method</span>
                          <p className="text-gray-700">{exc.matchMethod || '—'}</p>
                        </div>
                      </div>

                      {analysis ? (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Brain size={16} className="text-primary-600" />
                            <span className="text-sm font-medium text-gray-900">AI Analysis</span>
                            <span className="text-xs text-gray-400">
                              (Confidence: {Math.round((analysis.confidence || 0) * 100)}%)
                            </span>
                            {analysis.requiresHumanReview && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                Human Review Required
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-500 font-medium">Summary:</span>
                              <p className="text-gray-700 mt-0.5">{analysis.summary}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 font-medium">Likely Cause:</span>
                              <p className="text-gray-700 mt-0.5">{analysis.likelyCause}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 font-medium">Risk Level:</span>
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[analysis.riskLevel]}`}>
                                {analysis.riskLevel}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 font-medium">Recommended Actions:</span>
                              <ul className="mt-1 space-y-1">
                                {(analysis.recommendedActions || []).map((action, i) => (
                                  <li key={i} className="text-gray-700 flex items-start gap-2">
                                    <span className="text-primary-500 mt-0.5">•</span>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAnalyze(exc);
                            }}
                            disabled={isAnalyzing || !aiStatus?.available}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Brain size={14} />
                                Analyze with AI
                              </>
                            )}
                          </button>
                          {!aiStatus?.available && (
                            <p className="text-xs text-gray-400 mt-2">Configure GEMINI_API_KEY to enable AI analysis.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Exceptions;
