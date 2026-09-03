import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#ec4899'];

const LABEL_MAP = {
  MISSING_BANK_TRANSACTION: 'Missing Bank Txn',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  DUPLICATE_BANK_TRANSACTION: 'Duplicate Bank Txn',
  DATE_MISMATCH: 'Date Mismatch',
  UNMATCHED_BANK_TRANSACTION: 'Unmatched Bank Txn',
  MISSING_INVOICE: 'Missing Invoice',
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: data } = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-gray-900">{name}</p>
      <p className="text-gray-600 mt-1">Count: <span className="font-medium text-gray-900">{value}</span></p>
      {data.percentageOfExceptions != null && (
        <p className="text-gray-600">{data.percentageOfExceptions}% of exceptions</p>
      )}
    </div>
  );
}

export default function ExceptionDistribution({ exceptions }) {
  if (!exceptions || !exceptions.breakdown) return null;

  const chartData = Object.entries(exceptions.breakdown).map(([type, data]) => ({
    name: LABEL_MAP[type] || type.replace(/_/g, ' '),
    value: data.count,
    percentageOfExceptions: data.percentageOfExceptions,
  }));

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Exception Distribution</h3>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
