import { TrendingUp } from 'lucide-react';

export default function ExceptionSeverity({ severity }) {
  if (!severity) return null;

  const hasData = severity.high + severity.medium + severity.low > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={18} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Exception Severity</h3>
        </div>
        <div className="text-center py-8 text-gray-400 text-sm">—</div>
      </div>
    );
  }

  const maxCount = Math.max(severity.high, severity.medium, severity.low, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900">Exception Severity</h3>
      </div>

      <div className="space-y-4">
        <SeverityBar
          label="HIGH"
          count={severity.high}
          percentage={severity.highPercentage}
          maxCount={maxCount}
          color="bg-red-500"
          bgColor="bg-red-50"
          textColor="text-red-700"
        />
        <SeverityBar
          label="MEDIUM"
          count={severity.medium}
          percentage={severity.mediumPercentage}
          maxCount={maxCount}
          color="bg-amber-500"
          bgColor="bg-amber-50"
          textColor="text-amber-700"
        />
        <SeverityBar
          label="LOW"
          count={severity.low}
          percentage={severity.lowPercentage}
          maxCount={maxCount}
          color="bg-green-500"
          bgColor="bg-green-50"
          textColor="text-green-700"
        />
      </div>
    </div>
  );
}

function SeverityBar({ label, count, percentage, maxCount, color, bgColor, textColor }) {
  const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${textColor} ${bgColor} px-2 py-0.5 rounded`}>
            {label}
          </span>
          <span className="text-sm font-medium text-gray-900">{count}</span>
        </div>
        <span className="text-xs text-gray-400">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  );
}
