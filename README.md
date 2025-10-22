# Vibe2Vibes: Agent Communication Bus

> **⚠️ EXPERIMENTAL - EARLY DEVELOPMENT**
> This project is in active development and not production-ready. APIs and architectures are subject to significant changes.

The universal communication layer for agent frameworks. A standardized protocol that enables seamless collaboration between specialized development agents across different platforms.

---

## What This Actually Does

A framework-agnostic communication bus that enables agent-to-agent collaboration. Whether you're using OpenCode for systems programming, Codex CLI for full-stack development, or other agent frameworks—this bus makes them all speak the same language and work together.

**The Problem**: Development agents are isolated islands. You want the Go specialist to review the backend API while the frontend expert builds the UI, with proper coordination between them. Right now, that's a manual coordination nightmare.

**The Solution**: One unified communication layer that lets agents discover each other, collaborate on sessions, and synthesize their results into coherent outcomes.

---

## Quick Start: Zero to Multi-Agent in 30 Seconds

```typescript
import { AgentCommunicationFactory } from '@vibes/agent-communication-bus';

// Fire up the entire ecosystem
const system = await AgentCommunicationFactory.quickStart();

// Boom. You now have:
// - Communication Bus running on port 8080
// - OpenCode adapter ready for Go/Python/Systems work
// - Codex adapter handling frontend development
// - Claude Code adapter managing architecture and coordination

// When you're done conquering the world
await system.shutdown();
```

That's it. No complex setup, no configuration hell, no wrestling with APIs.

---

## 📚 Documentation

Complete documentation is available in the [`docs/`](./docs/) directory:

### Getting Started
- **[Quick Start Guide](./docs/quickstart.md)** - Get running in 5 minutes
- **[API Reference](./docs/api/)** - HTTP endpoints, WebSocket protocol, message format
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions

### Integration Guides
- **[Claude Code Integration](./docs/integrations/claude-code.md)** - Natural language delegation
- **[OpenCode Integration](./docs/integrations/opencode.md)** - Systems programming tasks
- **[Codex CLI Integration](./docs/integrations/codex-cli.md)** - Full-stack development

### Development
- **[Architecture Overview](./docs/development/architecture.md)** - System design and components
- **[Contributing Guide](./docs/development/CONTRIBUTING.md)** - How to contribute
- **[Testing Guide](./docs/development/testing.md)** - Writing and running tests
- **[Deployment Guide](./docs/development/deployment.md)** - Production deployment

### Tutorials
- **[Multi-Agent Collaboration](./docs/tutorials/multi-agent-collaboration.md)** - Coordinate multiple agents
- **[Custom Adapter Development](./docs/tutorials/custom-adapter.md)** - Build your own adapter
- **[Session Management](./docs/tutorials/session-management.md)** - Manage workflows

### Project Planning
- **[Roadmap](./docs/roadmap.md)** - Current status and future plans
- **[Implementation Status](./docs/implementation-status.md)** - Detailed progress tracking

---

## Real-World Usage Patterns

### The "Swarm Attack" - Parallel Processing

```typescript
// Send the same task to multiple specialists and get the best result
const message = {
  message_id: 'perf_audit_001',
  sender: { agent_id: 'claude-code://coordinator', framework: 'claude-code' },
  recipient: { agent_id: 'opencode://performance-pro', framework: 'opencode' },
  message_type: 'task_request',
  priority: 'high',
  payload: {
    task_type: 'performance_audit',
    target: './src/api/',
    metrics: ['latency', 'memory', 'throughput']
  },
  routing: {
    timeout: '300s',
    retry_policy: { max_retries: 3, backoff: 'exponential' },
    fallback_agents: ['codex://performance-expert']
  }
};

await bus.sendMessage(message);
```

### The "Assembly Line" - Sequential Workflow

```typescript
// Create a session where agents build on each other's work
const sessionId = sessionManager.createSession(
  'claude-code://orchestrator',
  [
    { agent_id: 'opencode://backend-architect', role: 'designer' },
    { agent_id: 'codex://frontend-developer', role: 'implementer' },
    { agent_id: 'opencode://security-auditor', role: 'reviewer' }
  ],
  [
    { name: 'api_design', required_agents: ['opencode://backend-architect'] },
    { name: 'ui_implementation', required_agents: ['codex://frontend-developer'] },
    { name: 'security_review', required_agents: ['opencode://security-auditor'] }
  ]
);
```

### The "Dream Team" - Intelligent Model Selection

```typescript
// Let the system pick the right model for each job
const selection = modelSelector.selectModel({
  taskType: 'code_review',
  constraints: {
    maxCost: 0.01,
    maxLatency: 5000,
    preferredProviders: ['anthropic']
  },
  context: {
    language: 'go',
    complexity: 'high',
    securityCritical: true
  }
});

// System picks Claude 3.5 Sonnet for Go security reviews
// Automatically falls back to GPT-4 if Claude is unavailable
console.log(`Selected: ${selection.model.model_id} with ${selection.confidence}% confidence`);
```

---

## Architecture That Actually Makes Sense

### Core Components

1. **CommunicationBus** - The central nervous system. Routes messages, handles failures, keeps everything alive.
2. **SessionManager** - Orchestrates multi-agent workflows. Think of it as the project manager for AI agents.
3. **ModelSelector** - Intelligent model routing. Picks the right tool for the job based on cost, speed, and capability.
4. **ResultAggregator** - Synthesizes multiple agent outputs into coherent results. Handles conflicts and builds consensus.
5. **MessageRouter** - Load balancing and intelligent routing. Prevents bottlenecks and optimizes performance.

### Framework Adapters

- **OpenCodeAdapter** - Bridges OpenCode's specialized agents (golang-pro, python-pro, security-auditor)
- **CodexAdapter** - Connects Codex CLI's full-stack capabilities
- **ClaudeCodeAdapter** - Integrates Claude Code's architectural and coordination strengths

---

## The Protocol: How Agents Actually Talk

Every message follows a strict but flexible format:

```json
{
  "message_id": "msg_123456789",
  "timestamp": "2025-01-20T10:30:00Z",
  "sender": {
    "agent_id": "claude-code://task-coordinator",
    "framework": "claude-code",
    "session_id": "sess_feature_x"
  },
  "recipient": {
    "agent_id": "opencode://golang-pro",
    "framework": "opencode"
  },
  "message_type": "task_request",
  "priority": "high",
  "payload": {
    "task_type": "code_optimization",
    "context": {
      "files": ["main.go", "utils.go"],
      "requirements": ["performance", "memory_efficiency"]
    }
  },
  "routing": {
    "timeout": "300s",
    "retry_policy": {
      "max_retries": 3,
      "backoff": "exponential"
    },
    "delivery_mode": "async"
  }
}
```

This isn't just JSON—it's a contract. Every agent knows exactly what to expect and how to respond.

---

## Development Setup

### Prerequisites
- Node.js 18+
- TypeScript 5.0+
- The agent frameworks you want to integrate (OpenCode, Codex CLI, Claude Code)

### Installation

```bash
# Clone and install
git clone https://github.com/vibes/agent-communication-bus
cd agent-communication-bus
npm install

# Build the system
npm run build

# Run tests
npm test

# Start development
npm run dev
```

### Environment Configuration

```bash
# Core communication bus
export AGENT_BUS_URL="http://localhost:8080"
export AGENT_BUS_API_KEY="your-api-key-here"

# OpenCode integration
export OPENCODE_BINARY_PATH="/usr/local/bin/opencode"
export OPENCODE_WORKING_DIR="$PWD"

# Codex CLI setup
export CODEX_CLI_PATH="/usr/local/bin/codex"
export CODEX_API_KEY="your-codex-key"

# Claude Code configuration
export ANTHROPIC_API_KEY="your-anthropic-key"
export CLAUDE_WORKSPACE_PATH="$PWD"
```

---

## Advanced Features

### Fault Tolerance That Actually Works

- **Circuit Breakers**: Automatically route around failing agents
- **Intelligent Retries**: Exponential backoff with jitter prevents thundering herd
- **Graceful Degradation**: System keeps working even when some agents are down
- **Health Monitoring**: Real-time health checks with automatic recovery

### Performance Optimization

- **Load Balancing**: Distribute tasks across available agents based on current load
- **Result Caching**: Cache and reuse results for similar tasks
- **Parallel Processing**: Run multiple agents simultaneously and aggregate results
- **Smart Routing**: Route tasks to the most capable available agent

### Security & Compliance

- **JWT Authentication**: Secure agent-to-agent communication
- **Role-Based Access**: Control what each agent can do
- **Message Encryption**: Protect sensitive data in transit
- **Audit Logging**: Complete traceability of all agent interactions

---

## Real-World Examples

### Example 1: Full-Stack Feature Development

```typescript
// Architect designs the system
const architecture = await claudeCodeAgent.designAPI({
  requirements: userStories,
  constraints: { techStack: ['Go', 'React', 'PostgreSQL'] }
});

// Backend implements the API
const backend = await openCodeAgent.implementBackend({
  architecture: architecture,
  language: 'go',
  framework: 'gin'
});

// Frontend builds the UI
const frontend = await codexAgent.implementFrontend({
  apiSpec: backend.apiSpec,
  framework: 'react',
  styling: 'tailwind'
});

// Security audit
const security = await openCodeAgent.auditSecurity({
  code: { backend: backend.code, frontend: frontend.code },
  standards: ['OWASP', 'SOC2']
});

// Aggregate everything into a complete feature
const feature = await resultAggregator.synthesize({
  results: [architecture, backend, frontend, security],
  synthesisMethod: 'specialist_priority'
});
```

### Example 2: Performance Optimization Sprint

```typescript
// Parallel analysis by different specialists
const tasks = await Promise.all([
  openCodeAgent.analyzePerformance({ target: './api/', focus: 'database' }),
  codexAgent.analyzeFrontendPerformance({ target: './web/', focus: 'bundle' }),
  claudeCodeAgent.analyzeArchitecture({ target: './', focus: 'scalability' })
]);

// Intelligent synthesis of recommendations
const optimization = await resultAggregator.synthesize({
  results: tasks,
  synthesisMethod: 'confidence_weighted',
  priority: 'impact_vs_effort'
});
```

---

## Monitoring & Observability

### Real-Time Metrics

```typescript
// Get system health
const metrics = bus.getMetrics();
console.log(`
Active Sessions: ${metrics.active_sessions}
Registered Agents: ${metrics.registered_agents}
Average Response Time: ${metrics.average_response_time}ms
Error Rate: ${(metrics.error_rate * 100).toFixed(2)}%
Throughput: ${metrics.throughput} messages/second
Uptime: ${metrics.uptime}ms
`);
```

### Agent Health Monitoring

```typescript
// Check individual agent health
const health = await bus.getAgentHealth('opencode://golang-pro');
console.log(`
Status: ${health.status}
Response Time: ${health.response_time}ms
Error Rate: ${(health.error_rate * 100).toFixed(2)}%
CPU Usage: ${(health.resource_usage.cpu * 100).toFixed(1)}%
Memory Usage: ${(health.resource_usage.memory * 100).toFixed(1)}%
`);
```

---

## Contributing

We're building this in the open. Here's how to help:

1. **Fork the repo** and create a feature branch
2. **Add tests** for any new functionality
3. **Ensure all tests pass**: `npm test`
4. **Check linting**: `npm run lint`
5. **Format your code**: `npm run format`
6. **Submit a PR** with a clear description of what you've built

### Areas Where We Need Help

- **New Framework Adapters**: Support for more agent frameworks
- **Performance Optimization**: Help us make this faster
- **Security Enhancements**: Auditing and hardening the system
- **Documentation**: Examples, tutorials, and guides
- **Testing**: More comprehensive test coverage

---

## License

MIT License. Do what you want with it. Build cool stuff. Make the world better.

---

## The Bottom Line

Stop treating your AI tools like separate apps. Start using them like a coordinated team.

This isn't just another integration library. It's a fundamental shift in how we think about AI agent collaboration. It's the difference between having a toolbox and having a workshop full of expert craftsmen working together.

**Ready to orchestrate your AI swarm?**

```bash
npm install @vibes/agent-communication-bus
```

Let's build something incredible. Together.