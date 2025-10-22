# REST API Reference

All endpoints are served from the same origin that hosts the Agent Communication Bus (default `http://localhost:8080`). Requests must include the `x-agent-api-key` header set to the value configured in `config/*.json` or the `AGENT_BUS_API_KEY` environment variable unless the bus is running in an unsecured development mode.

| Method | Path | Description | Auth Required |
| --- | --- | --- | --- |
| `POST` | `/agents/register` | Register a new agent with the bus | ✅ |
| `DELETE` | `/agents/:agentId` | Unregister an agent | ✅ |
| `POST` | `/messages/send` | Deliver a message to a specific agent | ✅ |
| `GET` | `/metrics` | Retrieve bus-level metrics snapshot | ✅ |
| `GET` | `/health` | Lightweight liveness probe | ❌ |

## Agent Registration — `POST /agents/register`

Registers an agent descriptor and exposes it to the router, session manager, and metrics collectors.

### Request Headers
- `Content-Type: application/json`
- `x-agent-api-key: <secret>`

### Request Body
```jsonc
{
  "agent_descriptor": {
    "agent_id": "opencode://code-reviewer",
    "framework": "opencode",
    "capabilities": ["code_review", "security_audit"],
    "metadata": { "languages": ["go", "rust"] }
  },
  "health_check_url": "http://localhost:9000/health",
  "status_endpoint": "http://localhost:9000/status",
  "authentication": {
    "type": "api_key",
    "credentials": "agent-specific-secret"
  }
}
```

### Successful Response — `200 OK`
```json
{
  "success": true,
  "agent_id": "opencode://code-reviewer"
}
```

### Error Response — `400 Bad Request`
```json
{
  "success": false,
  "error": "Agent opencode://code-reviewer already registered"
}
```

## Agent Unregistration — `DELETE /agents/:agentId`

Removes an agent from the registry and closes any active WebSocket connections.

### Path Parameters
- `agentId` – URL-encoded unique identifier (e.g. `opencode%3A%2F%2Fcode-reviewer`)

### Successful Response — `200 OK`
```json
{
  "success": true
}
```

## Send Message — `POST /messages/send`

Pushes a message into the router. When the recipient is online a WebSocket delivery is attempted immediately; otherwise the message is queued until the agent reconnects.

### Request Body
```jsonc
{
  "message_id": "msg_123",
  "timestamp": "2025-01-01T12:00:00Z",
  "sender": {
    "agent_id": "claude-code://orchestrator",
    "framework": "claude-code",
    "session_id": "sess_456"
  },
  "recipient": {
    "agent_id": "opencode://code-reviewer",
    "framework": "opencode"
  },
  "message_type": "task_request",
  "priority": "high",
  "payload": {
    "task_type": "code_review",
    "context": { "files": ["main.go"] }
  },
  "routing": {
    "timeout": "300s",
    "retry_policy": { "max_retries": 3, "backoff": "exponential" }
  }
}
```

### Successful Response — `200 OK`
```json
{
  "success": true
}
```

### Error Response — `400 Bad Request`
```json
{
  "success": false,
  "error": "Agent opencode://code-reviewer not available"
}
```

## Metrics — `GET /metrics`

Returns operational counters sourced from the in-memory metrics object.

```json
{
  "total_messages": 128,
  "active_sessions": 4,
  "registered_agents": 6,
  "average_response_time": 142,
  "error_rate": 0.02,
  "uptime": 351234,
  "throughput": 5
}
```

> **Note:** `uptime` is expressed in milliseconds since the bus started.

## Health Check — `GET /health`

Simple liveness endpoint. Useful for container orchestrators (Docker, Kubernetes).

```json
{
  "status": "healthy",
  "uptime": 351456
}
```

If the process is still booting, the endpoint continues to respond with `200 OK` but the uptime will be small; there is currently no degraded mode distinction.

## Error Handling

- Validation failures and domain errors return `400 Bad Request` with a descriptive `error` string.
- Missing or invalid API keys return `401 Unauthorized` if you add authentication middleware; by default the scaffold only checks for the presence of the header inside adapter code.
- Unexpected exceptions surface as `500 Internal Server Error`. Review server logs for stack traces.
