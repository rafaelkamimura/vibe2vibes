# OpenCode Integration Guide

This guide walks through connecting the OpenCode CLI to the Agent Communication Bus using the provided `OpenCodeAdapter`. You’ll configure environment variables, register the agent, and observe a full task lifecycle from dispatch to result aggregation.

## Prerequisites

- OpenCode CLI installed and accessible on the host running the adapter.
- Node.js ≥ 18 if you plan to run the adapter via the bus project directly.
- Communication Bus running locally (`npm run dev` or `docker compose up agent-bus`).
- API key configured in `.env` or `config/default.json` (`AGENT_BUS_API_KEY`).

## Step 1 – Configure Environment

1. Copy `.env.example` inside `agent-communication-bus/` to `.env`.
2. Update the OpenCode-specific settings:

```env
OPENCODE_ENABLED=true
OPENCODE_AGENT_ID=opencode://code-reviewer
OPENCODE_BINARY_PATH=/usr/local/bin/opencode
OPENCODE_WORKING_DIRECTORY=/path/to/your/project
OPENCODE_MAX_CONCURRENT_TASKS=3
OPENCODE_TIMEOUT=300000 # ms
```

3. Verify the configuration:

```bash
cd agent-communication-bus
npm run validate:env
```

## Step 2 – Configure `config/default.json`

Ensure the adapter block matches your environment:

```json
{
  "adapters": {
    "opencode": {
      "enabled": true,
      "agentId": "opencode://code-reviewer",
      "config": {
        "binaryPath": "/usr/local/bin/opencode",
        "workingDirectory": "/path/to/your/project",
        "maxConcurrentTasks": 3
      }
    }
  }
}
```

For production overrides use `config/production.json` with `env:` placeholders.

## Step 3 – Launch the Bus with OpenCode Adapter

```bash
cd agent-communication-bus
npm run build
node dist/index.js
# or
npm run dev
```

Programmatic option:

```ts
import { AgentCommunicationFactory } from '@vibes/agent-communication-bus';

const system = await AgentCommunicationFactory.createSystemFromConfig({
  env: process.env.NODE_ENV ?? 'development'
});
```

When the adapter initializes you should see:

```
[opencode://code-reviewer] Connected to communication bus
[opencode://code-reviewer] Agent registered successfully: opencode://code-reviewer
[opencode://code-reviewer] OpenCode adapter initialized successfully
```

## Step 4 – Send a Task

Use the REST endpoint (`POST /messages/send`) or another agent to dispatch a message:

```bash
curl -X POST http://localhost:8080/messages/send \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: ${AGENT_BUS_API_KEY}" \
  -d '{
    "message_id": "msg_demo_001",
    "timestamp": "2025-02-01T12:00:00Z",
    "sender": { "agent_id": "claude-code://orchestrator", "framework": "claude-code" },
    "recipient": { "agent_id": "opencode://code-reviewer", "framework": "opencode" },
    "message_type": "task_request",
    "priority": "high",
    "payload": {
      "task_type": "code_review",
      "files": ["src/api/user-service.ts"],
      "context": { "focus": "security" }
    },
    "routing": {
      "timeout": "300s",
      "retry_policy": { "max_retries": 1, "backoff": "linear" },
      "delivery_mode": "async"
    }
  }'
```

OpenCode CLI runs with the appropriate arguments and the adapter pushes a `task_response` message when the process exits.

## Example Workflow

1. Claude Code orchestrator sends a `task_request`.
2. OpenCode adapter spawns the CLI (`opencode --analyze ...`).
3. Results parsed and wrapped into `payload.result`.
4. Response sent back to orchestrator, optionally aggregated with other agents.

## Troubleshooting

| Symptom | Cause | Resolution |
| --- | --- | --- |
| Adapter logs `OpenCode binary not available` | `OPENCODE_BINARY_PATH` invalid | Update path and re-run `npm run validate:env` |
| REST call returns `Agent not available` | Adapter failed to register or socket dropped | Check adapter logs, ensure WebSocket connectivity |
| CLI runs but response missing | Parsing failed due to unexpected output | Inspect stdout/stderr in logs; adjust `parseOpenCodeOutput` |
| Tasks queue endlessly | `OPENCODE_MAX_CONCURRENT_TASKS` too low or tasks long-running | Increase concurrency or tune timeout |

Enable debug logging by wrapping execution in `DEBUG=agent-bus:* node dist/index.js` (if you integrate with `debug` library) or instrument additional `this.log()` calls in the adapter.
