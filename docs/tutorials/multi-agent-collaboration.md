# Tutorial: Multi-Agent Collaboration

Learn how to orchestrate multiple agents to tackle a feature end to end using the Agent Communication Bus. This walkthrough covers session creation, task delegation, and result aggregation.

## Goal

Implement a “User Profile” feature by coordinating three agents:
- **Claude Code** – Orchestrator that breaks work into tasks.
- **OpenCode** – Backend specialist.
- **Codex** – Frontend specialist.

## Prerequisites

- Bus and adapters running (see `docs/quickstart.md` and `docs/integrations/` guides).
- API key (`AGENT_BUS_API_KEY`) available for REST calls.
- Node.js ≥ 18 if executing script examples.

## 1. Create a Session

Use the Session Manager through a small script or REST endpoint (if exposed). Script example:

```ts
import { CommunicationBus } from '@vibes/agent-communication-bus';

async function createSession() {
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

  const sessionId = bus['sessionManager'].createSession(
    'claude-code://orchestrator',
    [
      { agent_id: 'opencode://backend-developer', role: 'implementer' },
      { agent_id: 'codex://frontend-developer', role: 'implementer' }
    ],
    [
      { name: 'backend_api', required_agents: ['opencode://backend-developer'] },
      { name: 'frontend_ui', required_agents: ['codex://frontend-developer'] },
      { name: 'integration_review', required_agents: ['claude-code://orchestrator'] }
    ]
  );

  console.log('Session created:', sessionId);
  await bus.stop();
}

createSession();
```

> In production you would expose a dedicated API endpoint rather than tapping into the session manager directly.

## 2. Dispatch Tasks

Send messages through the bus REST API. Example backend task:

```bash
curl -X POST http://localhost:8080/messages/send \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: ${AGENT_BUS_API_KEY}" \
  -d '{
    "message_id": "task_backend_001",
    "timestamp": "2025-02-02T10:00:00Z",
    "sender": { "agent_id": "claude-code://orchestrator", "framework": "claude-code", "session_id": "sess_user_profile" },
    "recipient": { "agent_id": "opencode://backend-developer", "framework": "opencode" },
    "message_type": "task_request",
    "priority": "high",
    "payload": {
      "task_type": "api_implementation",
      "context": {
        "endpoint": "/api/profile",
        "requirements": ["GET, PUT", "Auth required"]
      }
    },
    "routing": {
      "timeout": "600s",
      "retry_policy": { "max_retries": 1, "backoff": "linear" },
      "fallback_agents": ["codex://fullstack-backup"],
      "delivery_mode": "async"
    },
    "metadata": { "session_id": "sess_user_profile" }
  }'
```

Repeat with a frontend task assigned to Codex. Use consistent `session_id` values so the session manager tracks progress.

## 3. Monitor Progress

Agents emit `status_update` messages as they work. Tail adapter logs or subscribe to message events (adding listeners to the bus) to keep tabs on the workflow.

```ts
bus.on('task_delegated', event => {
  console.log('Task delegated:', event.taskId, '->', event.recipient);
});

bus.on('task_response_received', event => {
  console.log('Task completed:', event.task_id, 'status:', event.message.payload.status);
});
```

## 4. Aggregate Results

Once tasks finish, request aggregated output:

```ts
const aggregationId = await bus['resultAggregator'].aggregateResults({
  sessionId: 'sess_user_profile',
  taskType: 'feature_delivery',
  agentResults: [
    {
      agent_id: 'opencode://backend-developer',
      result: { api: 'Implemented /api/profile', tests: 'pass' },
      confidence: 0.92,
      completion_time: '180s'
    },
    {
      agent_id: 'codex://frontend-developer',
      result: { components: ['ProfileView', 'EditProfileForm'], tests: 'pass' },
      confidence: 0.9,
      completion_time: '220s'
    }
  ],
  synthesisMethod: 'confidence_weighted'
});

const aggregation = bus['resultAggregator'].getAggregation(aggregationId);
console.log('Combined output:', aggregation.synthesis.unified_result);
```

## 5. Wrap Up

- Close or archive the session if your workflow is complete.
- Agents may continue to collaborate; session manager automatically cleans up based on timeout settings.
- Extend this pattern by adding more workflow steps, fallback agents, or post-processing in the result aggregator.

## Tips

- Use meaningful `agent_id` prefixes so routing strategies can key off frameworks.
- `routing.fallback_agents` keeps work flowing if a primary agent is offline.
- Persist session state and metrics in a database (future enhancement) for auditability.
