import { useNavigate } from 'react-router-dom';
import { ListOrdered, ExternalLink } from 'lucide-react';

const SEVERITY_MAP = {
  MISSING_BANK_TRANSACTION: 'HIGH',
  UNMATCHED_BANK_TRANSACTION: 'HIGH',
  DUPLICATE_BANK_TRANSACTION: 'HIGH',
  AMOUNT_MISMATCH: 'MEDIUM',
  DATE_MISMATCH: 'MEDIUM',
};

const SEVERITY_COLORS = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-green-100 text-green-700',
};

const LABEL_MAP = {
  MISSING_BANK_TRANSACTION: 'Missing Bank Transaction',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  DUPLICATE_BANK_TRANSACTION: 'Duplicate Bank Transaction',
  DATE_MISMATCH: 'Date Mismatch',
  UNMATCHED_BANK_TRANSACTION: 'Unmatched Bank Transaction',
};

export default function TopExceptions({ topExceptions, financialBreakdown }) {
  const navigate = useNavigate();

  if (!topExceptions || topExceptions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <ListOrdered size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Top Exceptions</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2.5 text-xs font-medium text-gray-500">Exception Type</th>
              <th className="text-right py-2.5 text-xs font-medium text-gray-500">Count</th>
              <th className="text-right py-2.5 text-xs font-medium text-gray-500">% of Total</th>
              <th className="text-center py-2.5 text-xs font-medium text-gray-500">Severity</th>
              <th className="text-right py-2.5 text-xs font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {topExceptions.map((exc) => {
              const severity = SEVERITY_MAP[exc.type] || 'LOW';
              return (
                <tr key={exc.type} className="hover:bg-gray-50">
                  <td className="py-3 text-gray-900 font-medium">
                    {LABEL_MAP[exc.type] || exc.type.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 text-right text-gray-700">{exc.count}</td>
                  <td className="py-3 text-right text-gray-500">{exc.percentage}%</td>
                  <td className="py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[severity] || 'bg-gray-100 text-gray-600'}`}>
                      {severity}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => navigate('/exceptions')}
                      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View
                      <ExternalLink size={12} />
                    </button>
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
