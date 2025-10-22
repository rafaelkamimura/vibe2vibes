import { MessageEntry } from './MessageStream';

interface MessageInspectorProps {
  message?: MessageEntry;
  onClose: () => void;
}

export function MessageInspector({ message, onClose }: MessageInspectorProps) {
  return (
    <div className="h-full rounded-xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Message Inspector
        </h2>
        <button
          onClick={onClose}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </header>
      <div className="h-[24rem] overflow-y-auto px-5 py-4 text-sm text-slate-200">
        {message ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Message ID</p>
              <p className="font-mono text-slate-100">{message.id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Timestamp</p>
              <p>{new Date(message.timestamp).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sender</p>
                <p>{message.sender}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Recipient</p>
                <p>{message.recipient}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
              <p>{message.type}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Summary</p>
              <p>{message.summary}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Payload</p>
              <pre className="rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
{`{
  "details": "Mock payload data available when real integration happens"
}`}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select a message to inspect details.</p>
        )}
      </div>
    </div>
  );
}
