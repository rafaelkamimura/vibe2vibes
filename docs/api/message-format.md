# AgentMessage Specification

All communication flowing through the bus—REST-delivered messages, WebSocket frames, queued payloads—follows the `AgentMessage` schema defined in `src/types/protocol.ts`. This document explains each field, valid values, and provides practical examples.

## Top-Level Structure

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `message_id` | `string` | ✅ | Globally unique identifier. Recommended format: `msg_<timestamp>_<random>` |
| `timestamp` | `string (ISO 8601)` | ✅ | Time the message was created |
| `sender` | [`AgentIdentifier`](#agentidentifier) | ✅ | Originating agent |
| `recipient` | [`AgentIdentifier`](#agentidentifier) | ✅ | Target agent |
| `message_type` | `'task_request' \| 'task_response' \| 'status_update' \| 'error' \| 'heartbeat'` | ✅ | Message intent |
| `priority` | `'low' \| 'medium' \| 'high' \| 'critical'` | ✅ | Delivery urgency used by the router |
| `payload` | `any` | ✅ | Message body, shape depends on `message_type` |
| `routing` | [`MessageRouting`](#messagerouting) | ✅ | Delivery hints (timeout, retries, fallback agents) |
| `metadata` | `Record<string, any>` | Optional | Additional context (task IDs, diagnostics, etc.) |

## AgentIdentifier

```ts
interface AgentIdentifier {
  agent_id: string;
  framework: string;
  session_id?: string;
}
```

- `agent_id` – Fully qualified identifier, e.g., `opencode://code-reviewer`.
- `framework` – Name of the runtime (`opencode`, `codex`, `claude-code`, etc.).
- `session_id` – Optional session association for workflow tracking.

## MessageRouting

```ts
interface MessageRouting {
  timeout: string; // e.g., "300s"
  retry_policy: {
    max_retries: number;
    backoff: 'linear' | 'exponential';
  };
  fallback_agents?: string[];
  delivery_mode: 'async' | 'sync';
}
```

- `timeout` – Human-readable duration (string). Adapters typically parse to milliseconds when needed.
- `retry_policy` – How the bus should retry or reschedule the message if the primary recipient fails.
- `fallback_agents` – Optional list of agent IDs to attempt if the primary recipient is unavailable.
- `delivery_mode` – Determines whether the sender expects a synchronous response (`sync`) or is satisfied with asynchronous handling (`async`).

## Common Message Types

### Task Request
Used to delegate work to another agent.

```jsonc
{
  "message_id": "msg_1719000000000_abcd123",
  "timestamp": "2025-02-01T10:00:00Z",
  "sender": {
    "agent_id": "claude-code://orchestrator",
    "framework": "claude-code",
    "session_id": "sess_feature_x"
  },
  "recipient": {
    "agent_id": "opencode://code-reviewer",
    "framework": "opencode"
  },
  "message_type": "task_request",
  "priority": "high",
  "payload": {
    "task_type": "code_review",
    "files": ["src/api/user-service.ts"],
    "acceptance_criteria": ["no high severity lint issues"]
  },
  "routing": {
    "timeout": "300s",
    "retry_policy": { "max_retries": 2, "backoff": "exponential" },
    "fallback_agents": ["codex://fullstack-reviewer"],
    "delivery_mode": "async"
  },
  "metadata": {
    "task_id": "task_12345"
  }
}
```

### Task Response
Reports completion status or results.

```jsonc
{
  "message_id": "msg_1719000100000_xyz789",
  "timestamp": "2025-02-01T10:02:30Z",
  "sender": {
    "agent_id": "opencode://code-reviewer",
    "framework": "opencode",
    "session_id": "sess_feature_x"
  },
  "recipient": {
    "agent_id": "claude-code://orchestrator",
    "framework": "claude-code"
  },
  "message_type": "task_response",
  "priority": "medium",
  "payload": {
    "status": "completed",
    "findings": [
      { "severity": "medium", "file": "src/api/user-service.ts", "line": 84, "message": "Potential SQL injection" }
    ]
  },
  "routing": {
    "timeout": "60s",
    "retry_policy": { "max_retries": 0, "backoff": "linear" },
    "delivery_mode": "sync"
  },
  "metadata": {
    "task_id": "task_12345"
  }
}
```

### Status Update
Emitted to broadcast progress or state changes.

```jsonc
{
  "message_type": "status_update",
  "priority": "low",
  "payload": {
    "phase": "analysis",
    "percent_complete": 65,
    "notes": "Scanning dependency graph"
  },
  "...": "Other standard AgentMessage fields omitted for brevity"
}
```

### Error
Communicates operational errors or failures.

```jsonc
{
  "message_type": "error",
  "priority": "critical",
  "payload": {
    "code": "PROCESS_EXIT",
    "message": "OpenCode CLI exited with status 1",
    "details": "stderr logs ..."
  },
  "metadata": {
    "task_id": "task_98765",
    "retryable": false
  }
}
```

### Heartbeat
Periodic health check from agents.

```jsonc
{
  "message_type": "heartbeat",
  "priority": "low",
  "payload": {
    "status": "healthy",
    "active_tasks": 1,
    "cpu": 0.41,
    "memory": 512
  }
}
```

## Metadata Recommendations

- **`task_id`** – Link requests and responses.
- **`session_trace`** – Store workflow breadcrumbs.
- **`diagnostics`** – Include CLI stdout/stderr for debugging.

Metadata should remain lightweight; large binaries or artifacts should be shared via external storage and referenced by URL.

## Validation Tips

- Ensure `message_id` values are unique to avoid deduping collisions.
- Always supply `routing.delivery_mode`; adapters fall back to `async` if omitted, but explicit values improve traceability.
- Use ISO 8601 timestamps (UTC) to avoid timezone drift across agents.
