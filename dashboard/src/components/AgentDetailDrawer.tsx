import { AgentStatus } from './AgentStatus';

export interface AgentDetail {
  agentId: string;
  framework: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  capabilities: string[];
  tags: string[];
  lastHeartbeat: string;
  currentTask?: string;
}

interface AgentDetailDrawerProps {
  agent?: AgentDetail;
  onClose: () => void;
}

export function AgentDetailDrawer({ agent, onClose }: AgentDetailDrawerProps) {
  if (!agent) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        Select an agent to view details.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Agent Details
          </h2>
          <p className="text-xs text-slate-500">{agent.agentId}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </header>
      <div className="space-y-4 px-5 py-4 text-sm text-slate-200">
        <AgentStatus
          agentId={agent.agentId}
          framework={agent.framework}
          status={agent.status}
          capabilities={agent.capabilities}
        />
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Last heartbeat</p>
          <p>{agent.lastHeartbeat}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Current task</p>
          <p>{agent.currentTask || 'Idle'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Controls</p>
          <div className="mt-2 flex gap-2">
            <button className="rounded-md border border-emerald-500/50 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">
              Simulate Recovery
            </button>
            <button className="rounded-md border border-rose-500/50 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10">
              Simulate Failure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
