interface AgentStatusProps {
  agentId: string;
  framework: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  capabilities?: string[];
}

export function AgentStatus({
  agentId,
  framework,
  status,
  capabilities = []
}: AgentStatusProps) {
  const color =
    status === 'healthy' ? 'text-emerald-400' : status === 'degraded' ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-100">{agentId}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">{framework}</p>
        </div>
        <span className={`text-xs font-semibold ${color}`}>{status}</span>
      </div>
      {capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {capabilities.map(cap => (
            <span
              key={cap}
              className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
            >
              {cap}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
