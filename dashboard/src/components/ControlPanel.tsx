interface ControlPanelProps {
  messageCadence: number;
  onChangeCadence: (value: number) => void;
  onSimulateAgentFailure: () => void;
  onSimulateAgentRecovery: () => void;
  onReset: () => void;
}

export function ControlPanel({
  messageCadence,
  onChangeCadence,
  onSimulateAgentFailure,
  onSimulateAgentRecovery,
  onReset
}: ControlPanelProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Control Panel
        </h2>
        <button
          onClick={onReset}
          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Reset Mock Data
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500">
            Message cadence (seconds)
          </label>
          <input
            type="range"
            min={2}
            max={12}
            value={messageCadence}
            onChange={event => onChangeCadence(Number(event.target.value))}
            className="mt-2 w-full"
          />
          <p className="text-xs text-slate-400">Current: {messageCadence}s</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSimulateAgentFailure}
            className="flex-1 rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
          >
            Simulate Agent Failure
          </button>
          <button
            onClick={onSimulateAgentRecovery}
            className="flex-1 rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            Simulate Agent Recovery
          </button>
        </div>
      </div>
    </section>
  );
}
