# Tutorial: Mastering Session Management

Sessions coordinate multi-step workflows across agents. This tutorial demonstrates how to create, monitor, and terminate sessions using the `SessionManager`.

## Concept Recap

A session groups participants, workflow steps, and shared context. Each message can reference the session via `sender.session_id`.

## Prerequisites

- Bus running locally with adapters registered.
- Access to the project source (we will interact with `SessionManager` directly).

## 1. Start the Bus and Access SessionManager

```ts
import { CommunicationBus } from '@vibes/agent-communication-bus';

const bus = new CommunicationBus({
  port: 8080,
  host: 'localhost',
  maxConnections: 100,
  heartbeatInterval: 30000,
  messageTimeout: 300000,
  persistenceEnabled: false,
  encryptionEnabled: false,
  apiKey: process.env.AGENT_BUS_API_KEY ?? 'dev-key'
});

await bus.start();

const sessionManager = bus['sessionManager'];
```

> Until a public API is exposed, you can reach the session manager through the bus instance as shown.

## 2. Create a Session

```ts
const sessionId = sessionManager.createSession(
  'claude-code://orchestrator',
  [
    { agent_id: 'opencode://backend', role: 'implementer' },
    { agent_id: 'codex://frontend', role: 'implementer' },
    { agent_id: 'claude-code://qa', role: 'reviewer' }
  ],
  [
    { name: 'design', required_agents: ['claude-code://orchestrator'] },
    { name: 'implementation', required_agents: ['opencode://backend', 'codex://frontend'] },
    { name: 'review', required_agents: ['claude-code://qa'] }
  ],
  {
    project: 'feature/notifications',
    requirements: ['real-time updates', 'audit logs']
  }
);

console.log('New session:', sessionId);
```

Participants automatically enter the `active` state. You can add or remove participants later:

```ts
sessionManager.addParticipant(sessionId, {
  agent_id: 'opencode://security',
  framework: 'opencode',
  role: 'reviewer'
});
```

## 3. Track Workflow Progress

As messages flow, update shared context and workflow steps:

```ts
sessionManager.updateWorkflow(sessionId, {
  current_step: 'implementation',
  completed_steps: ['design'],
  pending_steps: ['review']
});

sessionManager.updateSharedContext(sessionId, {
  ...sessionManager.getSession(sessionId)?.shared_context,
  branch: 'feature/notifications',
  latestCommit: 'abc123'
});
```

The session manager emits events for key milestones:

```ts
sessionManager.on('session_created', event => console.log('Session created', event.sessionId));
sessionManager.on('task_delegated', event => console.log('Task delegated', event));
sessionManager.on('session_completed', event => console.log('Session done', event.sessionId));
```

## 4. Delegate Tasks with Session Context

Include `session_id` in messages:

```bash
curl -X POST http://localhost:8080/messages/send \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: ${AGENT_BUS_API_KEY}" \
  -d '{
    "message_id": "task_impl_backend",
    "timestamp": "2025-02-02T11:00:00Z",
    "sender": {
      "agent_id": "claude-code://orchestrator",
      "framework": "claude-code",
      "session_id": "'"$sessionId"'"
    },
    "recipient": { "agent_id": "opencode://backend", "framework": "opencode" },
    "message_type": "task_request",
    "priority": "high",
    "payload": { "task_type": "implementation", "context": { "component": "notification-service" } },
    "routing": {
      "timeout": "300s",
      "retry_policy": { "max_retries": 1, "backoff": "linear" },
      "delivery_mode": "async"
    }
  }'
```

Responses referencing the same session let the bus correlate tasks with workflow steps.

## 5. Terminate or Complete Sessions

When work is finished:

```ts
sessionManager.completeSession(sessionId, {
  summary: 'All tasks completed successfully',
  artifacts: ['s3://artifacts/build.zip']
});
```

Handle exceptional cases:

```ts
sessionManager.terminateSession(sessionId, {
  reason: 'timeout',
  details: 'Frontend agent offline'
});
```

## 6. Cleanup

Stop the bus when done:

```ts
await bus.stop();
```

## Tips

- Persist session data externally if you need durability across restarts (future enhancement).
- Attach metadata about deployments, approvals, or test runs in `shared_context`.
- Invent naming conventions for `sessionId` (e.g., `sess_<project>_<timestamp>`) to keep logs searchable.
- Combine sessions with the result aggregator to produce executive summaries at the end of a workflow.
