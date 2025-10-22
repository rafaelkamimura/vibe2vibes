interface HeaderProps {
  connectionLabel: { label: string; color: string };
  onRefresh: () => void;
  onToggleTheme: () => void;
  theme: 'dark' | 'light';
}

export function Header({ connectionLabel, onRefresh, onToggleTheme, theme }: HeaderProps) {
  const themeClasses =
    theme === 'dark'
      ? 'border-slate-800 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-900';
  return (
    <header className={`flex items-center justify-between border-b px-6 py-4 ${themeClasses}`}>
      <div>
        <h1 className="text-xl font-semibold">Agent Communication Bus</h1>
        <p className={`text-sm ${connectionLabel.color}`}>{connectionLabel.label}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="rounded-md border px-3 py-1 text-sm hover:bg-slate-800/50"
        >
          Refresh
        </button>
        <button
          onClick={onToggleTheme}
          className="rounded-md border px-3 py-1 text-sm hover:bg-slate-800/50"
        >
          Theme: {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
      </div>
    </header>
  );
}
