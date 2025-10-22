import { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MessageStream, MessageEntry, MessageType } from './components/MessageStream';
import { SessionMonitor, SessionSummary } from './components/SessionMonitor';
import { AgentStatus } from './components/AgentStatus';
import { useWebSocket } from './hooks/useWebSocket';
import { MetricsStrip } from './components/MetricsStrip';
import { MessageInspector } from './components/MessageInspector';
import { AgentDetailDrawer, AgentDetail } from './components/AgentDetailDrawer';
import { SessionTimeline } from './components/SessionTimeline';
import { ControlPanel } from './components/ControlPanel';
import { Notifications } from './components/Notifications';

type AgentHealth = 'healthy' | 'degraded' | 'unhealthy';

type SessionStepStatus = 'pending' | 'in_progress' | 'completed';

interface SessionStep {
  name: string;
  status: SessionStepStatus;
  startedAt?: string;
  completedAt?: string;
  participants?: string[];
}

interface AgentDetailInternal extends AgentDetail {
  lastHeartbeat: string;
}

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
}

const randomSummaries = [
  'Running integration tests.',
  'Generating UI component scaffolding.',
  'Reviewing API design for scalability.',
  'Aggregating results from agents.',
  'Syncing session context across participants.'
];

const randomTasks = [
  'Investigating latency metrics',
  'Refining UI layout suggestions',
  'Preparing deployment rollout',
  'Running static analysis'
];

const initialSessionSteps: Record<string, SessionStep[]> = {
  sess_feature_profile: [
    {
      name: 'Design',
      status: 'completed',
      startedAt: new Date(Date.now() - 20 * 60_000).toLocaleTimeString(),
      completedAt: new Date(Date.now() - 15 * 60_000).toLocaleTimeString(),
      participants: ['claude-code://orchestrator']
    },
    {
      name: 'Implementation',
      status: 'in_progress',
      startedAt: new Date(Date.now() - 10 * 60_000).toLocaleTimeString(),
      participants: ['opencode://code-reviewer', 'codex://frontend-developer']
    },
    {
      name: 'Review',
      status: 'pending',
      participants: ['claude-code://orchestrator']
    }
  ]
};

const initialAgents: AgentDetailInternal[] = [
  {
    agentId: 'opencode://code-reviewer',
    framework: 'opencode',
    status: 'healthy',
    capabilities: ['code_review', 'security_audit', 'performance_check'],
    tags: ['code', 'analysis'],
    lastHeartbeat: new Date().toLocaleTimeString(),
    currentTask: 'Reviewing sample.ts'
  },
  {
    agentId: 'codex://frontend-developer',
    framework: 'codex',
    status: 'healthy',
    capabilities: ['ui_component', 'documentation', 'tests'],
    tags: ['frontend', 'react'],
    lastHeartbeat: new Date().toLocaleTimeString()
  },
  {
    agentId: 'claude-code://orchestrator',
    framework: 'claude-code',
    status: 'degraded',
    capabilities: ['task_planning', 'coordination', 'aggregation'],
    tags: ['orchestration', 'nlp'],
    lastHeartbeat: new Date().toLocaleTimeString(),
    currentTask: 'Coordinating feature rollout'
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

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default function App() {
  const wsUrl = import.meta.env.VITE_AGENT_BUS_WS_URL as string | undefined;
  const httpUrl = import.meta.env.VITE_AGENT_BUS_HTTP_URL as string | undefined;
  const { status: socketStatus } = useWebSocket(wsUrl);

  const [agents, setAgents] = useState<AgentDetailInternal[]>(initialAgents);
  const [messages, setMessages] = useState<MessageEntry[]>(baseMessages);
  const [sessions, setSessions] = useState<SessionSummary[]>(baseSessions);
  const [sessionSteps, setSessionSteps] = useState<Record<string, SessionStep[]>>(initialSessionSteps);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const [selectedSession, setSelectedSession] = useState<string | undefined>(baseSessions[0]?.id);
  const [messageFilter, setMessageFilter] = useState<MessageType | 'all'>('all');
  const [inspectedMessage, setInspectedMessage] = useState<MessageEntry | undefined>();
  const [metrics, setMetrics] = useState({
    totalMessages: baseMessages.length,
    activeSessions: baseSessions.filter(session => session.progress < 100).length,
    errorRate: 0.42,
    throughput: 4.8
  });
  const [inspectedAgent, setInspectedAgent] = useState<AgentDetail | undefined>(initialAgents[0]);
  const [messageCadence, setMessageCadence] = useState<number>(5);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const pushNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    const entry: NotificationItem = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [entry, ...prev].slice(0, 6));
    setTimeout(() => {
      setNotifications(prev => prev.filter(item => item.id !== entry.id));
    }, 6000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const sender = randomChoice(agents);
      const recipient = randomChoice(agents.filter(agent => agent.agentId !== sender.agentId));
      const typePool: MessageType[] = ['task_request', 'task_response', 'status_update', 'heartbeat'];
      const type = randomChoice(typePool);

      const message: MessageEntry = {
        id: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        sender: sender.agentId,
        recipient: recipient.agentId,
        type,
        summary: randomChoice(randomSummaries)
      };

      if (Math.random() > 0.92) {
        message.type = 'error';
        message.summary = 'Agent reported execution failure. Needs attention.';
        pushNotification({
          type: 'error',
          title: 'Agent Error',
          message: `${sender.agentId} reported a failure while processing a task.`
        });
      }

      setMessages(prev => {
        const next = [message, ...prev].slice(0, 100);
        setMetrics(mPrev => ({
          ...mPrev,
          totalMessages: mPrev.totalMessages + 1,
          throughput: Math.min(12, mPrev.throughput + Math.random() * 0.4 - 0.1),
          errorRate:
            message.type === 'error'
              ? Math.min(5, mPrev.errorRate + Math.random() * 0.3)
              : Math.max(0, mPrev.errorRate - Math.random() * 0.1)
        }));
        return next;
      });

      setAgents(prev =>
        prev.map(agent =>
          agent.agentId === sender.agentId
            ? {
                ...agent,
                currentTask: randomChoice(randomTasks),
                lastHeartbeat: new Date().toLocaleTimeString()
              }
            : agent
        )
      );
    }, messageCadence * 1000);

    return () => clearInterval(interval);
  }, [agents, messageCadence]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev =>
        prev.map(agent => {
          if (Math.random() > 0.85) {
            const nextStatus: AgentHealth =
              agent.status === 'healthy'
                ? randomChoice(['healthy', 'degraded'])
                : agent.status === 'degraded'
                ? randomChoice(['healthy', 'degraded', 'unhealthy'])
                : randomChoice(['degraded', 'unhealthy']);
            return { ...agent, status: nextStatus, lastHeartbeat: new Date().toLocaleTimeString() };
          }
          return agent;
        })
      );
    }, 12_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prev => {
        let activeCount = 0;
        const updated = prev.map(session => {
          const nextProgress = Math.min(100, session.progress + Math.random() * 10);
          const nextStep =
            nextProgress >= 100
              ? 'completed'
              : nextProgress >= 70
              ? 'review'
              : session.step;

          if (nextProgress < 100) {
            activeCount += 1;
          }

          if (nextStep !== session.step) {
            setSessionSteps(prevSteps => {
              const currentSteps = prevSteps[session.id] || [];
              return {
                ...prevSteps,
                [session.id]: currentSteps.map(step => {
                  if (step.name.toLowerCase() === nextStep) {
                    return {
                      ...step,
                      status: 'in_progress',
                      startedAt: new Date().toLocaleTimeString()
                    };
                  }
                  if (step.name.toLowerCase() === session.step) {
                    return {
                      ...step,
                      status: 'completed',
                      completedAt: new Date().toLocaleTimeString()
                    };
                  }
                  return step;
                })
              };
            });
          }

          return {
            ...session,
            progress: nextProgress,
            step: nextStep
          };
        });

        setMetrics(mPrev => ({ ...mPrev, activeSessions: activeCount }));
        return updated;
      });
    }, 8_000);

    return () => clearInterval(interval);
  }, []);

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

  const activeTimeline = selectedSession
    ? sessionSteps[selectedSession] || []
    : sessionSteps[sessions[0]?.id || ''] || [];

  const handleSimulateFailure = () => {
    setAgents(prev =>
      prev.map(agent =>
        agent.agentId === (selectedAgent || agent.agentId)
          ? {
              ...agent,
              status: 'unhealthy',
              lastHeartbeat: new Date().toLocaleTimeString()
            }
          : agent
      )
    );
    pushNotification({
      type: 'error',
      title: 'Agent Offline',
      message: `${selectedAgent || 'An agent'} has gone offline.`
    });
  };

  const handleSimulateRecovery = () => {
    setAgents(prev =>
      prev.map(agent =>
        agent.agentId === (selectedAgent || agent.agentId)
          ? {
              ...agent,
              status: 'healthy',
              lastHeartbeat: new Date().toLocaleTimeString()
            }
          : agent
      )
    );
    pushNotification({
      type: 'info',
      title: 'Agent Recovery',
      message: `${selectedAgent || 'An agent'} has recovered.`
    });
  };

  const handleReset = () => {
    setAgents(initialAgents);
    setMessages(baseMessages);
    setSessions(baseSessions);
    setSessionSteps(initialSessionSteps);
    setMetrics({
      totalMessages: baseMessages.length,
      activeSessions: baseSessions.filter(session => session.progress < 100).length,
      errorRate: 0.42,
      throughput: 4.8
    });
    pushNotification({
      type: 'info',
      title: 'Mock Reset',
      message: 'Simulation data has been reset.'
    });
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
  }, [theme]);

  return (
    <div
      className={`flex h-screen flex-col ${
        theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      <Header
        connectionLabel={connectionLabel}
        onRefresh={handleReset}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <Notifications items={notifications} onDismiss={id => setNotifications(prev => prev.filter(item => item.id !== id))} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          agents={sidebarAgents}
          selectedAgent={selectedAgent}
          onSelectAgent={agentId => {
            setSelectedAgent(agentId);
            if (agentId) {
              const detail = agents.find(agent => agent.agentId === agentId);
              if (detail) setInspectedAgent(detail);
              const candidate = messages.find(
                message => message.sender === agentId || message.recipient === agentId
              );
              setInspectedMessage(candidate);
            } else {
              setInspectedAgent(undefined);
            }
          }}
        />
        <main className="flex flex-1 flex-col gap-6 overflow-y-auto bg-transparent p-6">
          <MetricsStrip
            totalMessages={metrics.totalMessages}
            activeSessions={metrics.activeSessions}
            errorRate={metrics.errorRate}
            throughput={metrics.throughput}
          />

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {agents.map(agent => (
              <AgentStatus key={agent.agentId} {...agent} />
            ))}
            <ControlPanel
              messageCadence={messageCadence}
              onChangeCadence={setMessageCadence}
              onSimulateAgentFailure={handleSimulateFailure}
              onSimulateAgentRecovery={handleSimulateRecovery}
              onReset={handleReset}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <MessageStream
                messages={messages}
                filter={messageFilter}
                onFilterChange={setMessageFilter}
                onSelectMessage={message => setInspectedMessage(message)}
                selectedMessageId={inspectedMessage?.id}
                selectedAgent={selectedAgent}
              />
            </div>
            <div className="flex flex-col gap-6 xl:col-span-2">
              <MessageInspector message={inspectedMessage} onClose={() => setInspectedMessage(undefined)} />
              <AgentDetailDrawer agent={inspectedAgent} onClose={() => setInspectedAgent(undefined)} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SessionTimeline sessionId={selectedSession || sessions[0]?.id || 'N/A'} steps={activeTimeline} />
            </div>
            <div className="flex flex-col gap-6 lg:col-span-1">
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
