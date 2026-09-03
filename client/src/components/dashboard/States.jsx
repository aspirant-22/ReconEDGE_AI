import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 p-5">
      <div className="text-center py-8">
        <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
        <p className="text-sm font-medium text-gray-900 mb-1">Unable to load dashboard data</p>
        <p className="text-xs text-gray-500 mb-4">{message || 'Please try again.'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-gray-300" />
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">No reconciliation data available yet</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Run a reconciliation to populate the dashboard with financial control metrics, exception analysis, and AI insights.
        </p>
      </div>
    </div>
  );
}
