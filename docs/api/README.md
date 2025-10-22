# Agent Communication Bus API

The Agent Communication Bus exposes a REST management API and a WebSocket event stream so agents can discover each other, register capabilities, and exchange structured messages. This document is an entry point to the API surface and links to detailed references for each channel.

## Core Concepts
- **Agent** – A framework-specific worker (OpenCode, Codex, Claude Code, etc.) that registers with the bus using a unique `agent_id`.
- **Session** – A logical workflow that ties multiple agents together to complete a task.
- **AgentMessage** – The canonical JSON payload exchanged between agents via the bus or WebSocket.
- **Adapters** – Framework-specific bridges that translate the bus protocol into each agent’s runtime.

## API Surface

| Area | Description | Document |
| --- | --- | --- |
| REST Endpoints | Health checking, agent registration, session inspection, and metrics | [`http-endpoints.md`](./http-endpoints.md) |
| WebSocket Protocol | Real-time message delivery and bus events | [`websocket-protocol.md`](./websocket-protocol.md) |
| Message Format | Formal definition of `AgentMessage` and supporting types | [`message-format.md`](./message-format.md) |

## Authentication
- The bus expects requests to present `x-agent-api-key` (configurable via `AGENT_BUS_API_KEY` or `config/*.json`).
- Adapters built from `BaseAdapter` automatically include this header when registering and reconnecting.
- You can supply custom authentication middleware around the Express app if stricter policies are required.

## Versioning & Compatibility
- REST endpoints follow semantic versioning via the project release tags; breaking changes will bump the minor/major version.
- WebSocket message types include a `protocol_version` field for forward compatibility. Current version: `1.0`.

## Response Codes
- `2xx` – Successful operation.
- `4xx` – Client error (bad payload, unknown agent/session, unauthenticated).
- `5xx` – Internal server failure (transient; inspect logs and metrics).

## Related Resources
- [Implementation Status](../implementation-status.md) – What features are live today.
- [Interaction Model Guides](../interaction-model-1-natural-language.md) – Example workflows using the bus.
- [Testing Requirements](../tests/README.md) – How to validate adapters before deployment.
