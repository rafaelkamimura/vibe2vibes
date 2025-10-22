interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
}

interface NotificationsProps {
  items: NotificationItem[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<NotificationItem['type'], string> = {
  info: 'border-sky-500/60 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-500/60 bg-amber-500/10 text-amber-100',
  error: 'border-rose-500/60 bg-rose-500/10 text-rose-100'
};

export function Notifications({ items, onDismiss }: NotificationsProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-3">
      {items.map(item => (
        <div
          key={item.id}
          className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${typeStyles[item.type]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-slate-200/80">{item.message}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-200/60">
                {new Date(item.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              onClick={() => onDismiss(item.id)}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
