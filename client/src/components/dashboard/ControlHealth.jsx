import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

const HEALTH_CONFIG = {
  HEALTHY: {
    icon: ShieldCheck,
    label: 'HEALTHY',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    ring: 'bg-green-100',
  },
  WARNING: {
    icon: AlertTriangle,
    label: 'WARNING',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'bg-amber-100',
  },
  CRITICAL: {
    icon: ShieldAlert,
    label: 'CRITICAL',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    ring: 'bg-red-100',
  },
};

export default function ControlHealth({ control }) {
  if (!control) return null;

  const config = HEALTH_CONFIG[control.health] || HEALTH_CONFIG.CRITICAL;
  const Icon = config.icon;

  return (
    <div className={`bg-white rounded-xl border ${config.border} p-5`}>
      <div className="flex items-center gap-2 mb-5">
        <ShieldAlert size={18} className="text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-900">Control Health</h3>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-xl ${config.ring} flex items-center justify-center`}>
          <Icon size={28} className={config.color} />
        </div>
        <div>
          <p className={`text-xl font-bold ${config.color}`}>{config.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {control.health === 'CRITICAL' && 'Exception volume exceeds the configured control threshold. Human review is required.'}
            {control.health === 'WARNING' && 'Exception rate is elevated. Monitoring required.'}
            {control.health === 'HEALTHY' && 'Control metrics are within acceptable thresholds.'}
          </p>
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        {control.healthReason}
      </div>

      <div className="mt-4 space-y-2">
        <MiniMetric label="Reconciliation Rate" value={control.reconciliationRate} suffix="%" />
        <MiniMetric label="Exception Rate" value={control.exceptionRate} suffix="%" />
        <MiniMetric label="Clean Match Rate" value={control.cleanMatchRate} suffix="%" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, suffix = '' }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-700">
        {value !== null && value !== undefined ? value + suffix : '—'}
      </span>
    </div>
  );
}
