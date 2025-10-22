export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Agent Communication Bus</h1>
        <p className="text-sm text-slate-400">Real-time status dashboard</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          Online
        </span>
        <button className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800">
          Refresh
        </button>
      </div>
    </header>
  );
}
