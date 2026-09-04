import { useState, useRef, useEffect } from 'react';
import { Send, Shield, Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useReconciliation } from '../contexts/ReconciliationContext';
import RunSelector from '../components/run/RunSelector';

const SUGGESTED_QUESTIONS = [
  'What is the overall reconciliation status?',
  'How many exceptions are there and why?',
  'What is the financial impact of the exceptions?',
  'Is the control health critical?',
];

const FinanceQA = () => {
  const { selectedRunId, selectedRun } = useReconciliation();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get('/ai/status').then((res) => setAiStatus(res.data)).catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const submitQuestion = async (text) => {
    const trimmed = (text || question).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    try {
      const response = await api.post('/ai/finance-qa', { question: trimmed, runId: selectedRunId || undefined });
      if (response.data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', ...response.data.data }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', error: true, answer: response.data?.error?.message || 'Unable to answer the question.' },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', error: true, answer: err.response?.data?.error?.message || 'AI analysis is temporarily unavailable.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitQuestion();
  };

  const formatAnswerParagraphs = (answer) =>
    (answer || '').split(/\n+/).filter((p) => p.trim().length > 0);

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Q&A</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ask natural-language questions about your reconciliation and analytics data
          </p>
        </div>
        <RunSelector />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Shield size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">AI Finance Copilot — Grounded & Advisory</p>
          <p className="mt-1">
            {selectedRunId
              ? `Answers are grounded only in "${selectedRun?.name || 'the selected run'}" reconciliation analytics.`
              : 'Answers use the demo sample dataset. Select a reconciliation run to scope Q&A to its real analytics.'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary-600" />
            <h2 className="font-semibold text-gray-900">Ask your finance controller</h2>
          </div>
          {aiStatus && (
            <div className={`text-xs px-3 py-1 rounded-full ${aiStatus.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              AI: {aiStatus.available ? 'Available' : 'Not Configured'}
            </div>
          )}
        </div>

        <div className="flex-1 p-6 space-y-4 min-h-[320px] max-h-[480px] overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles size={40} className="mx-auto mb-4 text-primary-200" />
              <p className="text-gray-500 text-sm">Ask about reconciliation, exceptions, financial impact, or control health.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {SUGGESTED_QUESTIONS.map((sq) => (
                  <button
                    key={sq}
                    onClick={() => submitQuestion(sq)}
                    disabled={loading}
                    className="px-3 py-2 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-full hover:bg-primary-100 disabled:opacity-50 transition-colors"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : msg.error
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="space-y-3">
                    {msg.error && (
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle size={16} />
                        {msg.answer}
                      </div>
                    )}

                    {!msg.error && (
                      <>
                        <div className="space-y-1">
                          {formatAnswerParagraphs(msg.answer).map((p, idx) => (
                            <p key={idx}>{p}</p>
                          ))}
                        </div>

                        {Array.isArray(msg.keyMetrics) && msg.keyMetrics.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {msg.keyMetrics.map((m, idx) => (
                              <div key={idx} className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                                <p className="text-xs text-gray-500">{m.label}</p>
                                <p className="text-sm font-semibold text-gray-900">{m.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {Array.isArray(msg.insights) && msg.insights.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-500 mb-1">Insights</p>
                            <ul className="space-y-1">
                              {msg.insights.map((ins, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-gray-700">
                                  <span className="text-primary-500 mt-0.5">•</span>
                                  {ins}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {typeof msg.confidence === 'number' && msg.confidence > 0 && (
                            <span className="text-xs text-gray-500">
                              Confidence: {Math.round(msg.confidence * 100)}%
                            </span>
                          )}
                          {msg.requiresHumanReview && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                              Human Review Recommended
                            </span>
                          )}
                          {Array.isArray(msg.dataSources) && msg.dataSources.length > 0 && (
                            <span className="text-xs text-gray-400">
                              Sources: {msg.dataSources.join(', ')}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Analyzing...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your reconciliation data..."
            maxLength={1000}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Ask
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              title="Clear conversation"
              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default FinanceQA;
