# Quickstart Guide

Get the Agent Communication Bus running in minutes and see agents exchanging messages end to end.

## 1. Prerequisites

- Node.js ≥ 18 and npm ≥ 9
- Git
- Optional: Docker + Compose (for containerized setup)

## 2. Clone & Install

```bash
git clone https://github.com/vibes/agent-communication-bus.git
cd agent-communication-bus
npm install
```

## 3. Configure Environment

Copy the sample environment file and adjust values as needed:

```bash
cp .env.example .env
```

At minimum set:

```env
AGENT_BUS_API_KEY=dev-key
OPENCODE_ENABLED=true
CODEX_ENABLED=true
CLAUDE_ENABLED=true
```

Skip adapter sections if you do not plan to run a particular CLI.

Validate configuration (requires basic variables to be present; you can inline them for the command):

```bash
AGENT_BUS_PORT=8080 \
AGENT_BUS_HOST=0.0.0.0 \
DATABASE_URL=postgres://vibes:vibes@localhost:5432/agent_bus \
REDIS_URL=redis://localhost:6379 \
npm run validate:env
```

Warnings about optional variables are safe; address missing required vars before continuing.

## 4. Build the Project

```bash
npm run build
```

This compiles TypeScript sources to `dist/`.

## 5. Launch the System (Code Path)

Use the factory helper to spin up the bus and adapters:

```ts
// examples/quickstart.ts
import { AgentCommunicationFactory } from '@vibes/agent-communication-bus';

async function main() {
  const system = await AgentCommunicationFactory.createSystemFromConfig({
    env: process.env.NODE_ENV ?? 'development'
  });

  console.log('Agent Communication Bus is running on port', system.configuration.bus.port);
  console.log('Adapters online:', system.adapters.map(a => a.constructor.name));

  // Keep running until terminated (CTRL+C)
}

main().catch(err => {
  console.error('Failed to start system', err);
  process.exit(1);
});
```

Run it with:

```bash
node dist/examples/quickstart.js
```

Alternatively launch the compiled entry directly:

```bash
node dist/index.js
```

You should see log lines for each adapter registering with the bus.

## 6. Send a Test Message

With the bus running (default port 8080), send a sample task request:

```bash
curl -X POST http://localhost:8080/messages/send \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: ${AGENT_BUS_API_KEY}" \
  -d '{
    "message_id": "msg_demo_001",
    "timestamp": "2025-02-01T12:00:00Z",
    "sender": { "agent_id": "claude-code://coordinator", "framework": "claude-code" },
    "recipient": { "agent_id": "opencode://code-reviewer", "framework": "opencode" },
    "message_type": "task_request",
    "priority": "medium",
    "payload": { "task_type": "code_review", "files": ["src/index.ts"] },
    "routing": { "timeout": "300s", "retry_policy": { "max_retries": 1, "backoff": "linear" }, "delivery_mode": "async" }
  }'
```

Watch the console output from the OpenCode adapter for CLI execution and the resulting `task_response`.

## 7. Docker Workflow (Optional)

```bash
docker compose up --build
```

This starts the bus, Postgres, and Redis using settings from `.env`. Health checks ensure dependencies are ready before the bus accepts traffic.

## 8. Next Steps

- Explore the REST/API docs: `docs/api/`
- Read integration guides for detailed adapter configuration: `docs/integrations/`
- Review architecture details: `docs/development/architecture.md`
- Contribute tests or features using the guidance in `docs/development/CONTRIBUTING.md`
