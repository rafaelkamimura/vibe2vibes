interface SessionStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  participants?: string[];
}

interface SessionTimelineProps {
  sessionId: string;
  steps: SessionStep[];
}

const statusStyles: Record<SessionStep['status'], string> = {
  pending: 'bg-slate-700 border-slate-700 text-slate-400',
  in_progress: 'bg-amber-500/20 border-amber-400 text-amber-300',
  completed: 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
};

export function SessionTimeline({ sessionId, steps }: SessionTimelineProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="border-b border-slate-800 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Session Timeline
        </h2>
        <p className="text-xs text-slate-500">{sessionId}</p>
      </header>
      <div className="px-5 py-4">
        <ul className="space-y-4">
          {steps.map(step => (
            <li
              key={step.name}
              className={`rounded-lg border px-4 py-3 transition-colors ${statusStyles[step.status]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">{step.name}</span>
                <span className="text-xs uppercase tracking-wide text-slate-300">{step.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-300">
                {step.startedAt && <span>Start: {step.startedAt}</span>}
                {step.completedAt && <span>End: {step.completedAt}</span>}
              </div>
              {step.participants && step.participants.length > 0 && (
                <div className="mt-2 text-xs text-slate-300">
                  Participants: {step.participants.join(', ')}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
