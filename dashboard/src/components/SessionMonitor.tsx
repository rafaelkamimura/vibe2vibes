export interface SessionSummary {
  id: string;
  orchestrator: string;
  step: string;
  progress: number;
  participants: string[];
}

interface SessionMonitorProps {
  sessions: SessionSummary[];
  onSelectSession?: (sessionId: string) => void;
  selectedSession?: string;
}

export function SessionMonitor({
  sessions,
  onSelectSession,
  selectedSession
}: SessionMonitorProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="border-b border-slate-800 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Sessions
        </h2>
      </header>
      <div className="px-5 py-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No active sessions.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map(session => {
              const active = session.id === selectedSession;
              return (
                <li
                  key={session.id}
                  className={`rounded-lg border bg-slate-900/70 p-4 transition-colors ${
                    active
                      ? 'border-emerald-500/60 ring-2 ring-emerald-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => onSelectSession?.(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{session.id}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {session.orchestrator}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{session.step}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Participants: {session.participants.join(', ')}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
