export type MessageType = 'task_request' | 'task_response' | 'status_update' | 'error' | 'heartbeat';

export interface MessageEntry {
  id: string;
  timestamp: string;
  sender: string;
  recipient: string;
  type: MessageType;
  summary: string;
}

interface MessageStreamProps {
  messages: MessageEntry[];
  filter: MessageType | 'all';
  onFilterChange: (filter: MessageType | 'all') => void;
  onSelectMessage: (message: MessageEntry) => void;
  selectedMessageId?: string;
  selectedAgent?: string;
}

const filterOptions: Array<{ value: MessageType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'task_request', label: 'Requests' },
  { value: 'task_response', label: 'Responses' },
  { value: 'status_update', label: 'Status Updates' },
  { value: 'error', label: 'Errors' },
  { value: 'heartbeat', label: 'Heartbeats' }
];

export function MessageStream({
  messages,
  filter,
  onFilterChange,
  onSelectMessage,
  selectedMessageId,
  selectedAgent
}: MessageStreamProps) {
  const filtered = messages.filter(message => {
    const matchesType = filter === 'all' || message.type === filter;
    const matchesAgent =
      !selectedAgent ||
      message.sender === selectedAgent ||
      message.recipient === selectedAgent;
    return matchesType && matchesAgent;
  });

  return (
    <section className="h-full rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Message Stream
          </h2>
          {selectedAgent && (
            <p className="text-xs text-slate-500">
              Showing messages related to <strong>{selectedAgent}</strong>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Filter:</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
            value={filter}
            onChange={event => onFilterChange(event.target.value as MessageType | 'all')}
          >
            {filterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="h-[24rem] overflow-y-auto px-5 py-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            No messages found for the current filters. Try selecting a different agent or type.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map(message => {
              const active = message.id === selectedMessageId;
              return (
                <li
                  key={message.id}
                  className={`cursor-pointer rounded-lg border px-4 py-3 text-sm text-slate-200 transition-colors ${
                    active
                      ? 'border-emerald-500/60 bg-slate-900 ring-2 ring-emerald-500/30'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                  }`}
                  onClick={() => onSelectMessage(message)}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{message.id}</span>
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 text-slate-300">
                    <strong>{message.sender}</strong> → <strong>{message.recipient}</strong>
                  </p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{message.type}</p>
                  <p className="mt-2 text-sm text-slate-200">{message.summary}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
