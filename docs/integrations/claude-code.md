# Claude Code Integration Guide

Claude Code acts as an orchestrator or specialist agent within the Agent Communication Bus. The `ClaudeCodeAdapter` bridges the bus protocol with the Claude Agent SDK or CLI, allowing natural-language task delegation and code editing workflows.

## Prerequisites

- Claude Code CLI or Agent SDK installed (ensure `claude --version` works if using CLI).
- Anthropic API key with Claude Code access.
- Communication Bus running with API key, Redis/PostgreSQL (optional but recommended).
- Node.js ≥ 18 for adapter execution.

## Step 1 – Environment Setup

Populate `.env` in `agent-communication-bus/`:

```env
CLAUDE_ENABLED=true
CLAUDE_AGENT_ID=claude-code://backend-architect
CLAUDE_WORKSPACE_PATH=/path/to/workspace
CLAUDE_MAX_CONCURRENT_TASKS=3
ANTHROPIC_API_KEY=sk-ant-...
```

If you run the Claude CLI from a non-default location, also set:

```env
CLAUDE_CODE_EXECUTABLE=/usr/local/bin/claude
```

Run the validator with required bus variables set:

```bash
cd agent-communication-bus
AGENT_BUS_PORT=8080 AGENT_BUS_HOST=0.0.0.0 \
AGENT_BUS_API_KEY=dev-key DATABASE_URL=postgres://vibes:vibes@localhost:5432/agent_bus \
REDIS_URL=redis://localhost:6379 \
npm run validate:env
```

## Step 2 – Configure `config/default.json`

```json
{
  "adapters": {
    "claudeCode": {
      "enabled": true,
      "agentId": "claude-code://backend-architect",
      "config": {
        "workspacePath": "/path/to/workspace",
        "maxConcurrentTasks": 3,
        "apiKey": "sk-ant-...",
        "pathToClaudeCodeExecutable": "/usr/local/bin/claude",
        "defaultModel": "claude-3.5-sonnet"
      }
    }
  }
}
```

Move secrets to `config/production.json` by using `env:` references (`"apiKey": "env:ANTHROPIC_API_KEY"`).

## Step 3 – Start the Adapter

```bash
cd agent-communication-bus
npm run build
node dist/index.js
```

Expected logs:

```
[claude-code://backend-architect] Connected to communication bus
[claude-code://backend-architect] Agent registered successfully: claude-code://backend-architect
[claude-code://backend-architect] Claude Code adapter initialized successfully
```

The adapter pings the Claude executable/SDK (`testClaudeCodeExecutable`) before taking on tasks.

## Step 4 – Delegate a Natural Language Task

Claude often coordinates other agents. Example request to perform architecture design then trigger OpenCode:

```bash
curl -X POST http://localhost:8080/messages/send \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: ${AGENT_BUS_API_KEY}" \
  -d '{
    "message_id": "msg_architecture_001",
    "timestamp": "2025-02-02T09:00:00Z",
    "sender": { "agent_id": "opencode://code-reviewer", "framework": "opencode" },
    "recipient": { "agent_id": "claude-code://backend-architect", "framework": "claude-code" },
    "message_type": "task_request",
    "priority": "high",
    "payload": {
      "task_type": "architecture_plan",
      "requirements": [
        "Design a scalable backend for real-time chat",
        "Use PostgreSQL and Redis",
        "Prepare follow-up tasks for OpenCode and Codex"
      ]
    },
    "routing": {
      "timeout": "600s",
      "retry_policy": { "max_retries": 1, "backoff": "exponential" },
      "delivery_mode": "async"
    }
  }'
```

The adapter spawns Claude Code, streams prompts/responses, and returns a structured `task_response` containing architecture notes plus delegation instructions (which can be turned into further `task_request` messages for OpenCode or Codex).

## Recommended Workflows

- **Orchestration** – Interpret natural language requirements, break them into subtasks, dispatch to OpenCode/Codex, and aggregate results.
- **Refactoring & Reviews** – Use `task_type: "code_review"` or `task_type: "refactor"` to leverage Claude’s reasoning and editing tools.
- **Documentation** – Generate API docs or ADRs and broadcast via the bus.

Integrate with `AgentCommunicationFactory.quickStart()` to launch all three adapters for end-to-end coordination.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Claude Code executable not available` | Wrong binary path or CLI not installed | Install CLI/SDK, update `pathToClaudeCodeExecutable` |
| Requests hang | Workspace path missing or CLI awaiting confirmation | Ensure CLI runs non-interactively (use `--yes` flags if available) |
| Frequent rate limits | Model quotas exceeded | Implement backoff (configurable in adapter) or switch to another model |
| Output missing follow-up tasks | Prompt lacks directives | Include explicit `requirements` or use structured payload fields |

For advanced scenarios (streaming tokens, plan/execute modes), extend the adapter to call the Agent SDK directly rather than spawning a CLI process.
