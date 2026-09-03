import { useState, useEffect } from 'react';
import { Brain, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function AIInsights({ control }) {
  const [aiStatus, setAiStatus] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/ai/status')
      .then((res) => setAiStatus(res.data))
      .catch(() => setAiStatus({ available: false }));
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    setInsight(null);
    try {
      const response = await api.get('/dashboard');
      if (response.data.success && response.data.dashboard?.recentExceptions?.length > 0) {
        const firstException = response.data.dashboard.recentExceptions[0];
        const excId = firstException.paymentId || firstException.bankTransactionId;
        if (excId) {
          const aiRes = await api.post('/ai/analyze-exception', { exceptionId: excId });
          if (aiRes.data.success) {
            setInsight({
              summary: aiRes.data.analysis.summary,
              riskLevel: aiRes.data.analysis.riskLevel,
              actions: aiRes.data.analysis.recommendedActions,
              type: aiRes.data.exceptionType,
            });
          }
        }
      }
    } catch {
      setInsight({
        summary: 'AI analysis is currently unavailable. Please try again later.',
        riskLevel: null,
        actions: [],
        error: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Brain size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">AI Control Insights</h3>
        {aiStatus && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${aiStatus.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {aiStatus.available ? 'AI Available' : 'AI Not Configured'}
          </span>
        )}
      </div>

      {control?.health === 'CRITICAL' && !insight && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-sm text-red-800">
          High-priority exceptions require human review.
        </div>
      )}

      {insight ? (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-700">{insight.summary}</p>
          </div>
          {insight.riskLevel && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Risk Level:</span>
              <span className={`px-2 py-0.5 rounded-full ${
                insight.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                insight.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {insight.riskLevel}
              </span>
            </div>
          )}
          {insight.actions && insight.actions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Recommended Actions:</p>
              <ul className="space-y-1">
                {insight.actions.map((action, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-primary-400 mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">
            No AI insights generated yet. Analyze an exception to receive an explanation and recommended actions.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={loading || !aiStatus?.available}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain size={14} />
                Analyze Priority Exceptions
              </>
            )}
          </button>
          {!aiStatus?.available && (
            <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
              <AlertCircle size={12} />
              Configure GEMINI_API_KEY to enable AI analysis.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
