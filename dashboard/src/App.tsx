import { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MessageStream, MessageEntry, MessageType } from './components/MessageStream';
import { SessionMonitor, SessionSummary } from './components/SessionMonitor';
import { AgentStatus } from './components/AgentStatus';
import { useWebSocket } from './hooks/useWebSocket';
import { MetricsStrip } from './components/MetricsStrip';
import { MessageInspector } from './components/MessageInspector';

// helper types and mock data remain the same as before...

type AgentHealth = 'healthy' | 'degraded' | 'unhealthy';

interface AgentDetail {
  agentId: string;
  framework: string;
  status: AgentHealth;
  capabilities: string[];
  tags: string[];
}

const initialAgents: AgentDetail[] = [
  {
    agentId: 'opencode://code-reviewer',
    framework: 'opencode',
    status: 'healthy',
    capabilities: ['code_review', 'security_audit', 'performance_check'],
    tags: ['code', 'analysis']
  },
  {
    agentId: 'codex://frontend-developer',
    framework: 'codex',
    status: 'healthy',
    capabilities: ['ui_component', 'documentation', 'tests'],
    tags: ['frontend', 'react']
  },
  {
    agentId: 'claude-code://orchestrator',
    framework: 'claude-code',
    status: 'degraded',
    capabilities: ['task_planning', 'coordination', 'aggregation'],
    tags: ['orchestration', 'nlp']
  }
];

const baseMessages: MessageEntry[] = [
  {
    id: 'msg_bootstrap_001',
    timestamp: new Date().toISOString(),
    sender: 'claude-code://orchestrator',
    recipient: 'opencode://code-reviewer',
    type: 'task_request',
    summary: 'Review sample.ts for security vulnerabilities.'
  },
  {
    id: 'msg_bootstrap_002',
    timestamp: new Date(Date.now() + 1_000).toISOString(),
    sender: 'opencode://code-reviewer',
    recipient: 'claude-code://orchestrator',
    type: 'task_response',
    summary: 'No critical issues found. Added suggestions for improved validation.'
  }
];

const baseSessions: SessionSummary[] = [
  {
    id: 'sess_feature_profile',
    orchestrator: 'claude-code://orchestrator',
    step: 'implementation',
    progress: 45,
    participants: ['opencode://code-reviewer', 'codex://frontend-developer']
  }
];

const randomSummaries = [
  'Running integration tests.',
  'Generating UI component scaffolding.',
  'Reviewing API design for scalability.',
  'Aggregating results from agents.',
  'Syncing session context across participants.'
];

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default function App() {
  const wsUrl = import.meta.env.VITE_AGENT_BUS_WS_URL as string | undefined;
  const httpUrl = import.meta.env.VITE_AGENT_BUS_HTTP_URL as string | undefined;
  const { status: socketStatus } = useWebSocket(wsUrl);

  const [agents, setAgents] = useState<AgentDetail[]>(initialAgents);
  const [messages, setMessages] = useState<MessageEntry[]>(baseMessages);
  const [sessions, setSessions] = useState<SessionSummary[]>(baseSessions);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const [selectedSession, setSelectedSession] = useState<string | undefined>();
  const [messageFilter, setMessageFilter] = useState<MessageType | 'all'>('all');
  const [inspectedMessage, setInspectedMessage] = useState<MessageEntry | undefined>();
  const [metrics, setMetrics] = useState({
    totalMessages: messages.length,
    activeSessions: sessions.filter(session => session.progress < 100).length,
    errorRate: 0.42,
    throughput: 4.8
  });

  // Simulate incoming messages
  useEffect(() => {
    const interval = setInterval(() => {
      const sender = randomChoice(agents);
      const recipient = randomChoice(agents.filter(agent => agent.agentId !== sender.agentId));
      const type = randomChoice<MessageType>([
        'task_request',
        'task_response',
        'status_update',
        'heartbeat'
      ]);

      const message: MessageEntry = {
        id: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        sender: sender.agentId,
        recipient: recipient.agentId,
        type,
        summary: randomChoice(randomSummaries)
      };

      setMessages(prev => [message, ...prev].slice(0, 100));
      setMetrics(prev => ({
        ...prev,
        totalMessages: prev.totalMessages + 1,
        throughput: Math.min(12, prev.throughput + Math.random() * 0.4 - 0.1),
        errorRate:
          type === 'error'
            ? Math.min(5, prev.errorRate + Math.random() * 0.3)
            : Math.max(0, prev.errorRate - Math.random() * 0.1)
      }));
    }, 5_000);

    return () => clearInterval(interval);
  }, [agents]);

  // Simulate agent health changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev =>
        prev.map(agent => {
          if (Math.random() > 0.8) {
            const nextStatus: AgentHealth =
              agent.status === 'healthy'
                ? randomChoice(['healthy', 'degraded'])
                : agent.status === 'degraded'
                ? randomChoice(['healthy', 'degraded', 'unhealthy'])
                : randomChoice(['degraded', 'unhealthy']);
            return { ...agent, status: nextStatus };
          }
          return agent;
        })
      );
    }, 12_000);

    return () => clearInterval(interval);
  }, []);

  // Simulate session progression
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prev =>
        prev.map(session => {
          const nextProgress = Math.min(100, session.progress + Math.random() * 10);
          return {
            ...session,
            progress: nextProgress,
            step:
              nextProgress >= 100
                ? 'completed'
                : nextProgress >= 70
                ? 'review'
                : session.step
          };
        })
      );
      setMetrics(prev => ({
        ...prev,
        activeSessions: sessions.filter(session => session.progress < 100).length
      }));
    }, 8_000);

    return () => clearInterval(interval);
  }, [sessions]);

  const connectionLabel = useMemo(() => {
    switch (socketStatus) {
      case 'connected':
        return { label: 'WebSocket Connected', color: 'text-emerald-400' };
      case 'connecting':
        return { label: 'Connecting…', color: 'text-amber-400' };
      default:
        return { label: 'Disconnected', color: 'text-rose-400' };
    }
  }, [socketStatus]);

  const sidebarAgents = useMemo(
    () =>
      agents.map(({ agentId, framework, status, tags }) => ({
        agentId,
        framework,
        status,
        tags
      })),
    [agents]
  );

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          agents={sidebarAgents}
          selectedAgent={selectedAgent}
          onSelectAgent={agentId => {
            setSelectedAgent(agentId);
            if (agentId) {
              const candidate = messages.find(
                message => message.sender === agentId || message.recipient === agentId
              );
              setInspectedMessage(candidate);
            }
          }}
        />
        <main className="flex flex-1 flex-col gap-6 overflow-y-auto bg-slate-950 p-6">
          <MetricsStrip
            totalMessages={metrics.totalMessages}
            activeSessions={metrics.activeSessions}
            errorRate={metrics.errorRate}
            throughput={metrics.throughput}
          />

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {agents.map(agent => (
              <AgentStatus key={agent.agentId} {...agent} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MessageStream
                messages={messages}
                filter={messageFilter}
                onFilterChange={setMessageFilter}
                onSelectMessage={message => setInspectedMessage(message)}
                selectedMessageId={inspectedMessage?.id}
                selectedAgent={selectedAgent}
              />
            </div>
            <div className="flex flex-col gap-6 lg:col-span-1">
              <MessageInspector message={inspectedMessage} onClose={() => setInspectedMessage(undefined)} />
              <SessionMonitor
                sessions={sessions}
                selectedSession={selectedSession}
                onSelectSession={sessionId => setSelectedSession(sessionId)}
              />
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                <p>
                  <strong>HTTP Endpoint:</strong> {httpUrl || 'Set VITE_AGENT_BUS_HTTP_URL'}
                </p>
                <p className={`mt-2 text-xs font-semibold ${connectionLabel.color}`}>
                  {connectionLabel.label}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Configure WebSocket URL via <code>VITE_AGENT_BUS_WS_URL</code>. Data currently uses mock streams.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
