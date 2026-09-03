import { IndianRupee } from 'lucide-react';
import { formatCurrency } from './KPICards';

export default function FinancialImpact({ financial }) {
  if (!financial) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <IndianRupee size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Financial Impact</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard
          label="Total Payment Amount"
          value={formatCurrency(financial.totalPaymentAmount)}
          color="text-gray-900"
        />
        <MetricCard
          label="Matched Payment Amount"
          value={formatCurrency(financial.matchedPaymentAmount)}
          color="text-green-700"
        />
        <MetricCard
          label="Exception Payment Amount"
          value={formatCurrency(financial.exceptionPaymentAmount)}
          color="text-red-700"
        />
        <MetricCard
          label="Amount Mismatch Impact"
          value={formatCurrency(financial.amountMismatchImpact)}
          color="text-amber-700"
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
