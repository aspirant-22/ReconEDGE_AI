import { Activity } from 'lucide-react';

export default function ReconciliationHealth({ reconciliation }) {
  if (!reconciliation) return null;

  const rate = reconciliation.reconciliationRate;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Activity size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Reconciliation Health</h3>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="relative w-36 h-36">
          <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r="50"
              fill="none" stroke="#e5e7eb" strokeWidth="10"
            />
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke={rate >= 90 ? '#22c55e' : rate >= 70 ? '#3b82f6' : '#ef4444'}
              strokeWidth="10"
              strokeDasharray={`${(rate / 100) * 314.16} 314.16`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{rate}%</span>
            <span className="text-xs text-gray-400">Reconciliation Rate</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <MetricRow label="Payment Match Rate" value={reconciliation.paymentMatchRate} />
        <MetricRow label="Bank Match Rate" value={reconciliation.bankMatchRate} />
        <MetricRow label="Invoice Match Rate" value={reconciliation.invoiceMatchRate} />
        <MetricRow label="Bank Assignment Accuracy" value={reconciliation.bankAssignmentAccuracy} />
      </div>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">
        {value !== null && value !== undefined ? value + '%' : '—'}
      </span>
    </div>
  );
}
