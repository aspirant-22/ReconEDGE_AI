import { useNavigate } from 'react-router-dom';
import { Clock, ExternalLink } from 'lucide-react';

const LABEL_MAP = {
  MISSING_BANK_TRANSACTION: 'Missing Bank Txn',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  DUPLICATE_BANK_TRANSACTION: 'Duplicate Bank Txn',
  DATE_MISMATCH: 'Date Mismatch',
  UNMATCHED_BANK_TRANSACTION: 'Unmatched Bank Txn',
};

const TYPE_COLORS = {
  MISSING_BANK_TRANSACTION: 'bg-red-50 text-red-700',
  AMOUNT_MISMATCH: 'bg-amber-50 text-amber-700',
  DUPLICATE_BANK_TRANSACTION: 'bg-blue-50 text-blue-700',
  DATE_MISMATCH: 'bg-purple-50 text-purple-700',
  UNMATCHED_BANK_TRANSACTION: 'bg-cyan-50 text-cyan-700',
};

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '—';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RecentExceptions({ recentExceptions }) {
  const navigate = useNavigate();

  if (!recentExceptions || recentExceptions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recent Exceptions</h3>
        </div>
        <div className="text-center py-8 text-sm text-gray-400">
          No recent exceptions.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recent Exceptions</h3>
        </div>
        <button
          onClick={() => navigate('/exceptions')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View All
          <ExternalLink size={12} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs font-medium text-gray-500">Reference</th>
              <th className="text-left py-2 text-xs font-medium text-gray-500">Type</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Amount</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentExceptions.map((exc, idx) => {
              const id = exc.paymentId || exc.bankTransactionId;
              const typeColor = TYPE_COLORS[exc.exceptionType] || 'bg-gray-50 text-gray-600';
              return (
                <tr key={id || idx} className="hover:bg-gray-50">
                  <td className="py-2.5 text-gray-700 font-mono text-xs">
                    {id || '—'}
                  </td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor}`}>
                      {LABEL_MAP[exc.exceptionType] || exc.exceptionType?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-gray-700 font-mono text-xs">
                    {formatCurrency(exc.paymentAmount || exc.bankAmount)}
                  </td>
                  <td className="py-2.5 text-right text-xs font-mono">
                    {exc.amountDifference > 0 ? (
                      <span className="text-red-600">{formatCurrency(exc.amountDifference)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
