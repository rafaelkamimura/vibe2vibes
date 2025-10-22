interface HeaderProps {
  connectionLabel: { label: string; color: string };
  onRefresh: () => void;
  onToggleTheme: () => void;
  theme: 'dark' | 'light';
}

export function Header({ connectionLabel, onRefresh, onToggleTheme, theme }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Agent Communication Bus</h1>
        <p className={`text-sm ${connectionLabel.color}`}>{connectionLabel.label}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
        >
          Refresh
        </button>
        <button
          onClick={onToggleTheme}
          className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
        >
          Theme: {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
      </div>
    </header>
  );
}
