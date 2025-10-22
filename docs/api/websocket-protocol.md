# WebSocket Protocol

The WebSocket interface delivers real-time messages and lifecycle events between the Agent Communication Bus and registered adapters. Each adapter opens a persistent socket to receive tasks and to stream responses back to the bus.

## Connection Flow

1. **Register via REST** – Call `POST /agents/register` with the agent descriptor and API key.
2. **Upgrade to WebSocket** – Connect to `ws://<bus-host>:<port>?agent_id=<agent-id>`.
   - Example: `ws://localhost:8080?agent_id=opencode://code-reviewer`
   - The connection is rejected with close code `1008` if the agent is not registered.
3. **Receive Queued Messages** – Any messages that arrived while the adapter was offline are replayed immediately after the socket opens.
4. **Stream Messages** – All subsequent messages for the agent are delivered in real time as JSON-encoded `AgentMessage` payloads.

Adapters built from `BaseAdapter` handle this sequence automatically.

## Outgoing Messages (Bus ➜ Agent)

Payloads conform to the [`AgentMessage`](./message-format.md) schema. Common message types include:

- `task_request` – A new task delegation.
- `task_response` – Broadcasts results from other agents (e.g., when coordinating).
- `status_update` – Informational updates about session progress.
- `heartbeat` – Periodic check-ins to confirm agent liveness.

Each message is delivered as a single JSON text frame.

## Incoming Messages (Agent ➜ Bus)

Adapters send responses back over the same socket by serialising `AgentMessage` payloads. The bus parses the frame and routes it through:

- `handleTaskRequest` – For new delegations targeting other agents.
- `handleTaskResponse` – To mark tasks complete and forward results.
- `handleStatusUpdate` – For progress or telemetry updates.
- `handleHeartbeat` – To update agent health statistics.

> **Important:** Messages originating from adapters must include a valid `recipient.agent_id`. The bus uses the routing rules and connection map to deliver the payload.

## Disconnection & Reconnection

- When the socket closes the bus emits `agent_disconnected` and removes the connection from its registry.
- Adapters should implement exponential backoff before reconnecting (the provided `BaseAdapter` retries up to 5 times with a 5s delay).
- Messages sent while the agent is offline are added to a queue (`messageQueue`) and flushed when the socket reopens.

## Error Handling

- Invalid JSON frames are ignored and logged (`Invalid message format`).
- Unrecognised `message_type` values trigger a warning but do not close the socket.
- To forcefully disconnect an agent the bus closes the socket; adapters should handle close codes gracefully.

## Authentication

The WebSocket handshake uses the same API key that authenticated the REST registration. The current implementation relies on the adapter to supply a valid `agent_id`; if you require stronger guarantees add a reverse proxy (e.g., API Gateway) that validates headers during the upgrade request.
