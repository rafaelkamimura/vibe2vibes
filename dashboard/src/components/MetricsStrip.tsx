interface MetricCardProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'steady';
  helper?: string;
}

function MetricCard({ label, value, trend = 'steady', helper }: MetricCardProps) {
  const trendColor =
    trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400';
  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-xl font-semibold text-slate-100">{value}</p>
        <span className={`text-[11px] font-semibold ${trendColor}`}>{trendSymbol}</span>
      </div>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

interface MetricsStripProps {
  totalMessages: number;
  activeSessions: number;
  errorRate: number;
  throughput: number;
}

export function MetricsStrip({ totalMessages, activeSessions, errorRate, throughput }: MetricsStripProps) {
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Total Messages"
        value={totalMessages.toLocaleString()}
        trend={totalMessages > 1000 ? 'up' : 'steady'}
        helper="Since last restart"
      />
      <MetricCard
        label="Active Sessions"
        value={String(activeSessions)}
        trend={activeSessions > 5 ? 'up' : 'steady'}
        helper="Concurrent workflows"
      />
      <MetricCard
        label="Error Rate"
        value={`${errorRate.toFixed(2)}%`}
        trend={errorRate > 1 ? 'down' : 'steady'}
        helper="5 min rolling window"
      />
      <MetricCard
        label="Throughput"
        value={`${throughput.toFixed(1)} msg/s`}
        trend={throughput > 5 ? 'up' : 'steady'}
        helper="Average over 1 min"
      />
    </section>
  );
}
