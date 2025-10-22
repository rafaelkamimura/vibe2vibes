# Codex CLI Integration Guide

This document explains how to wire the Codex CLI into the Agent Communication Bus using the built-in `CodexAdapter`. You’ll configure credentials, launch the adapter, and trigger a sample frontend workflow.

## Prerequisites

- Codex CLI binary installed on the host (ensure `codex --version` works).
- API key for Codex (if your CLI requires authentication).
- Communication Bus running locally with the API key set.
- Node.js ≥ 18 when running the adapter from the bus repository.

## Step 1 – Environment Configuration

Copy `.env.example` to `.env` inside `agent-communication-bus/` and update the Codex section:

```env
CODEX_ENABLED=true
CODEX_AGENT_ID=codex://frontend-developer
CODEX_CLI_PATH=/usr/local/bin/codex
CODEX_MAX_CONCURRENT_TASKS=5
CODEX_BASE_URL=https://api.codex.local
CODEX_API_KEY=your-codex-api-key
```

The adapter merges these values with `config/default.json`, so keep both files in sync.

Run the validator to ensure required variables are present (either via `.env` or inline exports):

```bash
cd agent-communication-bus
AGENT_BUS_PORT=8080 AGENT_BUS_HOST=0.0.0.0 \
AGENT_BUS_API_KEY=dev-key DATABASE_URL=postgres://vibes:vibes@localhost:5432/agent_bus \
REDIS_URL=redis://localhost:6379 \
npm run validate:env
```

## Step 2 – Update `config/default.json`

```json
{
  "adapters": {
    "codex": {
      "enabled": true,
      "agentId": "codex://frontend-developer",
      "config": {
        "cliPath": "/usr/local/bin/codex",
        "maxConcurrentTasks": 5,
        "baseUrl": "https://api.codex.local",
        "apiKey": "your-codex-api-key"
      }
    }
  }
}
```

Remember to replace secret values with `env:` references inside `config/production.json`.

## Step 3 – Start the System

```bash
cd agent-communication-bus
npm run build
node dist/index.js
```

The factory method works as well:

```ts
const system = await AgentCommunicationFactory.createSystemFromConfig({
  env: process.env.NODE_ENV ?? 'development'
});
```

Adapter boot logs should show:

```
[codex://frontend-developer] Connected to communication bus
[codex://frontend-developer] Agent registered successfully: codex://frontend-developer
[codex://frontend-developer] Codex adapter initialized successfully
```

## Step 4 – Trigger a Task

Example REST request to create a UI component:

```bash
curl -X POST http://localhost:8080/messages/send \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: ${AGENT_BUS_API_KEY}" \
  -d '{
    "message_id": "msg_ui_001",
    "timestamp": "2025-02-01T15:00:00Z",
    "sender": { "agent_id": "claude-code://orchestrator", "framework": "claude-code" },
    "recipient": { "agent_id": "codex://frontend-developer", "framework": "codex" },
    "message_type": "task_request",
    "priority": "medium",
    "payload": {
      "task_type": "ui_component",
      "spec": {
        "name": "UserCard",
        "props": ["name", "title", "avatarUrl"],
        "style": "tailwind"
      }
    },
    "routing": {
      "timeout": "180s",
      "retry_policy": { "max_retries": 1, "backoff": "linear" },
      "delivery_mode": "async"
    }
  }'
```

The adapter spawns `codex` with appropriate arguments, captures stdout/stderr, and generates a `task_response` with generated UI code.

## Common Workflows

- **Frontend Implementation** – Generate React/Vue components from Claude or OpenCode design specs.
- **Bug Fixes** – Apply patches by sending diffs; Codex CLI runs `codex fix`.
- **Documentation** – Produce component docs or Storybook stories using `task_type: "documentation"`.

Codex results are merged with other agents via the bus result aggregator when multiple agents collaborate on the same session.

## Troubleshooting

| Issue | Possible Cause | Suggested Fix |
| --- | --- | --- |
| `Codex CLI not available` error | Wrong `CODEX_CLI_PATH` or CLI missing | Verify path; run `which codex`; reinstall CLI |
| HTTP 401 from CLI | Missing/invalid API key | Set `CODEX_API_KEY` in `.env` or secret store |
| Tasks stuck in queue | CLI commands running longer than timeout | Increase `timeout` in adapter config |
| Generated code missing styling/framework specifics | Provide richer `payload` context (framework, styling system) |

Enable verbose logging by instrumenting `this.log()` in `codex-adapter.ts` or wrapping the CLI with `DEBUG=* codex ...` when supported.
