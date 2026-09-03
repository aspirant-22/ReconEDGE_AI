import { DollarSign, CheckCircle, AlertTriangle, Percent } from 'lucide-react';

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '—';
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const cards = [
  {
    key: 'paymentsProcessed',
    label: 'Payments Processed',
    icon: DollarSign,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    format: (v) => v.toLocaleString('en-IN'),
    sublabel: 'Total payment records',
  },
  {
    key: 'matchedPayments',
    label: 'Matched',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    format: (v) => v.toLocaleString('en-IN'),
    sublabel: 'Successfully reconciled',
  },
  {
    key: 'exceptions',
    label: 'Exceptions',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    format: (v) => v.toLocaleString('en-IN'),
    sublabel: 'Require investigation',
  },
  {
    key: 'exceptionRate',
    label: 'Exception Rate',
    icon: Percent,
    color: 'text-red-600',
    bg: 'bg-red-50',
    format: (v) => v.toFixed(2) + '%',
    sublabel: 'Of total payments',
  },
];

export default function KPICards({ overview }) {
  if (!overview) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const value = overview[card.key];
        const displayValue = value !== null && value !== undefined ? card.format(value) : '—';

        return (
          <div key={card.key} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon size={18} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sublabel}</p>
          </div>
        );
      })}
    </div>
  );
}

export { formatCurrency };
