interface AgentSummary {
  agentId: string;
  framework: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  tags: string[];
}

interface SidebarProps {
  agents: AgentSummary[];
  selectedAgent?: string;
  onSelectAgent: (agentId: string | undefined) => void;
}

export function Sidebar({ agents, selectedAgent, onSelectAgent }: SidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Agents
        </h2>
        <button
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={() => onSelectAgent(undefined)}
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="space-y-3">
          {agents.map(agent => {
            const active = agent.agentId === selectedAgent;
            return (
              <li
                key={agent.agentId}
                className={`cursor-pointer rounded-lg border bg-slate-900/70 px-4 py-3 transition-colors ${
                  active
                    ? 'border-emerald-500/60 ring-2 ring-emerald-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
                onClick={() =>
                  onSelectAgent(active ? undefined : agent.agentId)
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">
                    {agent.agentId}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      agent.status === 'healthy'
                        ? 'bg-emerald-400'
                        : agent.status === 'degraded'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  {agent.framework}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
