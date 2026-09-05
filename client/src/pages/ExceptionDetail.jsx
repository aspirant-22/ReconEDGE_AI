import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Brain, Loader2, Shield, FileText, Landmark, Building2, CalendarDays } from 'lucide-react';
import { recApi } from '../services/recApi';
import WorkflowBadge from '../components/exceptions/WorkflowBadge';
import WorkflowPanel from '../components/exceptions/WorkflowPanel';
import HistoryTimeline from '../components/exceptions/HistoryTimeline';
import { resolutionCodeLabel, formatWorkflowDate } from '../components/exceptions/workflowConstants';

const RISK_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
};

function DetailCard({ children }) {
  return <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{children}</div>;
}

function AmountPill({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value != null ? `₹${Number(value).toLocaleString('en-IN')}` : '—'}</span>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-sm text-gray-700 font-mono mt-0.5 break-all">{value || '—'}</p>
    </div>
  );
}

const ExceptionDetail = () => {
  const { runId, exceptionId } = useParams();
  const [exception, setException] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [detailRes, historyRes] = await Promise.all([
        recApi.getException(runId, exceptionId),
        recApi.getExceptionHistory(runId, exceptionId),
      ]);
      setException(detailRes.data?.data || null);
      setHistory(historyRes.data?.data || []);
    } catch (err) {
      if (err.response?.status === 401) return;
      setLoadError(err.response?.data?.error?.message || 'Unable to load this exception.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, exceptionId]);

  const handleWorkflowAction = async (action, payload) => {
    setActionError(null);
    try {
      await recApi.resolutionAction(runId, exceptionId, payload);
      ackDone();
      await loadAll();
      setAnalysis(null);
    } catch (err) {
      const message = err.response?.data?.error?.message;
      if (err.response?.status === 409) {
        await loadAll();
        throw new Error(message || 'This exception was updated by another request. Refresh and try again.');
      }
      throw new Error(message || 'Unable to apply the action.');
    }
  };

  const [ack, setAck] = useState(null);
  function ackDone() { setAck(true); setTimeout(() => setAck(null), 4000); }

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const response = await recApi.analyzeException(runId, exceptionId);
      if (response.data?.success) setAnalysis(response.data.analysis);
    } catch (err) {
      setAnalysis({
        summary: err.response?.data?.error?.message || 'AI analysis unavailable.',
        likelyCause: 'Could not determine cause.',
        riskLevel: 'MEDIUM',
        recommendedActions: ['Manual review required.'],
        confidence: 0,
        requiresHumanReview: true,
        error: true,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (loadError || !exception) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-10 text-center">
        <Shield size={40} className="mx-auto text-gray-300 mb-3" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Exception not found</h2>
        <p className="text-sm text-gray-500 mb-6">{loadError || 'The exception could not be located.'}</p>
        <Link to="/exceptions" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          <ArrowLeft size={16} /> Back to Exceptions
        </Link>
      </div>
    );
  }

  const isArchived = !!exception.run?.isArchived;
  const runStatus = exception.run?.status;
  const isResolved = exception.workflowStatus === 'RESOLVED';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link to="/exceptions" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft size={16} /> Back to Exceptions
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Exception Detail</h1>
              <WorkflowBadge status={exception.workflowStatus} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {exception.run?.name || 'Reconciliation run'} · {exception.exceptionType?.replace(/_/g, ' ')}
            </p>
          </div>
          {exception.resolvedAt && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Last updated</p>
              <p className="text-sm text-gray-700">{formatWorkflowDate(exception.resolvedAt)}</p>
            </div>
          )}
        </div>
      </div>

      {ack && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3" data-testid="ack-banner">
          Workflow state updated. The change has been recorded in the audit trail.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DetailCard>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Financial Evidence</h3>
              {exception.severity && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[exception.severity] || 'bg-gray-100 text-gray-600'}`}>
                  {exception.severity} severity
                </span>
              )}
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                <FileText size={16} className="text-gray-400" />
                <span className="font-mono text-xs">{exception.exceptionId}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Landmark size={14} /> Payment
                  </div>
                  <AmountPill label="Amount" value={exception.paymentAmount} />
                </div>
                <div className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Building2 size={14} /> Bank
                  </div>
                  <AmountPill label="Amount" value={exception.bankAmount} />
                </div>
                <div className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <FileText size={14} /> Invoice
                  </div>
                  <AmountPill label="Amount" value={exception.invoiceAmount} />
                </div>
              </div>

              {exception.amountDifference != null && exception.amountDifference > 0 && (
                <p className="text-sm text-orange-600 mt-3">
                  Amount difference: ₹{Number(exception.amountDifference).toLocaleString('en-IN')}
                </p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-4">
                <Field label="Payment ID" value={exception.paymentId} />
                <Field label="Bank Transaction ID" value={exception.bankTransactionId} />
                <Field label="Invoice ID" value={exception.invoiceId} />
                <Field label="Match Method" value={exception.matchMethod} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
                {exception.paymentDate && (
                  <div>
                    <span className="text-xs text-gray-400">Payment Date</span>
                    <p className="text-gray-700 mt-0.5">{(exception.paymentDate || '').toString().slice(0, 10)}</p>
                  </div>
                )}
                {exception.bankDate && (
                  <div>
                    <span className="text-xs text-gray-400">Bank Date</span>
                    <p className="text-gray-700 mt-0.5">{(exception.bankDate || '').toString().slice(0, 10)}</p>
                  </div>
                )}
                {exception.dateDifferenceDays != null && (
                  <div>
                    <span className="text-xs text-gray-400">Date Difference</span>
                    <p className="text-gray-700 mt-0.5">{exception.dateDifferenceDays} days</p>
                  </div>
                )}
              </div>
            </div>
          </DetailCard>

          <DetailCard>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">AI Analysis</h3>
            </div>
            <div className="px-6 py-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 mb-4">
                <Shield size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  AI-generated analysis is <strong>advisory only</strong> and never changes workflow state.
                  The deterministic reconciliation result is the source of truth, and human review is required
                  before resolving, rejecting or escalating.
                </p>
              </div>

              {analysis ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={16} className="text-primary-600" />
                    <span className="text-sm font-medium text-gray-900">AI Analysis</span>
                    <span className="text-xs text-gray-400">(Confidence: {Math.round((analysis.confidence || 0) * 100)}%)</span>
                    {analysis.requiresHumanReview && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Human Review Required</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700"><span className="text-gray-500 font-medium">Summary:</span> {analysis.summary}</p>
                    <p className="text-gray-700"><span className="text-gray-500 font-medium">Likely Cause:</span> {analysis.likelyCause}</p>
                    <div>
                      <span className="text-gray-500 font-medium">Recommended Actions:</span>
                      <ul className="mt-1 space-y-1">
                        {(analysis.recommendedActions || []).map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-700">
                            <span className="text-primary-500 mt-0.5">•</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="analyze-exception"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                  {analyzing ? 'Analyzing…' : 'Analyze with AI'}
                </button>
              )}
            </div>
          </DetailCard>
        </div>

        <div className="space-y-6">
          <WorkflowPanel
            exception={exception}
            disabled={isArchived || runStatus !== 'COMPLETED'}
            isArchived={isArchived}
            runStatus={runStatus}
            error={actionError}
            onAction={handleWorkflowAction}
          />

          {isResolved && (
            <DetailCard>
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Resolution Summary</h3>
              </div>
              <div className="px-6 py-5 space-y-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400">Resolution Code</span>
                  <p className="text-gray-700 font-medium mt-0.5">{resolutionCodeLabel(exception.resolutionCode)} ({exception.resolutionCode || '—'})</p>
                </div>
                {exception.resolutionReason && (
                  <div>
                    <span className="text-xs text-gray-400">Reason</span>
                    <p className="text-gray-700 mt-0.5">{exception.resolutionReason}</p>
                  </div>
                )}
                {exception.resolutionNotes && (
                  <div>
                    <span className="text-xs text-gray-400">Notes</span>
                    <p className="text-gray-700 mt-0.5">{exception.resolutionNotes}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                  <CalendarDays size={14} />
                  {formatWorkflowDate(exception.resolvedAt)}
                </div>
              </div>
            </DetailCard>
          )}

          <DetailCard>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Resolution History</h3>
            </div>
            <div className="px-6 py-5">
              <HistoryTimeline history={history} loading={false} />
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
};

export default ExceptionDetail;