# Agent Communication Bus

A framework-agnostic communication system that enables seamless agent-to-agent collaboration across OpenCode, Codex CLI, Claude Code, and future frameworks.

## Features

- **Universal Agent Registry**: Centralized discovery and capability management
- **Framework-Agnostic Protocol**: Standardized communication across different agent frameworks
- **Session Management**: Cross-framework session orchestration and state management
- **Model Selection**: Intelligent model selection based on task requirements and performance
- **Result Aggregation**: Sophisticated synthesis of results from multiple agents
- **Load Balancing**: Intelligent routing and load distribution across agents
- **Fault Tolerance**: Circuit breakers, retries, and graceful degradation

## Quick Start

```typescript
import { AgentCommunicationFactory } from '@vibes/agent-communication-bus';

// Quick start with default configuration
const system = await AgentCommunicationFactory.quickStart();

// The system is now running with:
// - Communication Bus on port 8080
// - OpenCode adapter for code review
// - Codex adapter for frontend development  
// - Claude Code adapter for backend architecture

// Shutdown when done
await system.shutdown();
```

## Architecture

### Configuration-Driven Setup

```typescript
import { AgentCommunicationFactory } from '@vibes/agent-communication-bus';

// Automatically loads config/default.json and merges config/production.json when NODE_ENV=production
const system = await AgentCommunicationFactory.createSystemFromConfig({
  env: process.env.NODE_ENV
});

// Optional: override specific bus settings at runtime
// const system = await AgentCommunicationFactory.createSystemFromConfig({
//   env: process.env.NODE_ENV,
//   busOverrides: { port: 9090 }
// });
```

Configuration files live under `config/` with environment variables supplied via `.env` (see `.env.example`). Run `npm run validate:env` to confirm everything required is set before booting the bus.

### Core Components

1. **CommunicationBus**: Central message routing and coordination
2. **SessionManager**: Multi-agent session lifecycle management
3. **ModelSelector**: Intelligent model selection and optimization
4. **ResultAggregator**: Synthesis of multi-agent results
5. **MessageRouter**: Intelligent message routing and load balancing

### Framework Adapters

- **OpenCodeAdapter**: Integration with OpenCode CLI for code analysis
- **CodexAdapter**: Integration with Codex CLI for full-stack development
- **ClaudeCodeAdapter**: Integration with Claude Code for AI-powered assistance

## Usage Examples

### Basic Agent Delegation

```typescript
// Send task from Claude Code to OpenCode
const message = {
  message_id: 'msg_123',
  timestamp: new Date().toISOString(),
  sender: { agent_id: 'claude-code://task-coordinator', framework: 'claude-code' },
  recipient: { agent_id: 'opencode://code-reviewer', framework: 'opencode' },
  message_type: 'task_request',
  priority: 'high',
  payload: {
    task_type: 'code_review',
    file_path: './src/main.go'
  },
  routing: {
    timeout: '300s',
    retry_policy: { max_retries: 3, backoff: 'exponential' },
    delivery_mode: 'async'
  }
};

await bus.sendMessage(message);
```

### Multi-Agent Collaboration

```typescript
// Create session with multiple agents
const sessionId = sessionManager.createSession(
  'claude-code://orchestrator',
  [
    { agent_id: 'opencode://backend-developer', role: 'implementer' },
    { agent_id: 'codex://frontend-developer', role: 'implementer' },
    { agent_id: 'claude-code://code-reviewer', role: 'reviewer' }
  ],
  [
    { name: 'backend_implementation', required_agents: ['opencode://backend-developer'] },
    { name: 'frontend_implementation', required_agents: ['codex://frontend-developer'] },
    { name: 'code_review', required_agents: ['claude-code://code-reviewer'] }
  ]
);
```

### Model Selection

```typescript
// Select optimal model for task
const selection = modelSelector.selectModel({
  taskType: 'code_review',
  agentCapabilities: ['code', 'analysis', 'security'],
  constraints: {
    maxCost: 0.01,
    maxLatency: 5000,
    preferredProviders: ['anthropic']
  },
  context: {
    inputSize: 5000,
    language: 'go',
    complexity: 'medium'
  }
});

console.log(`Selected model: ${selection.model.model_id}`);
console.log(`Confidence: ${selection.confidence}`);
console.log(`Estimated cost: $${selection.estimatedCost}`);
```

### Result Aggregation

```typescript
// Aggregate results from multiple agents
const aggregationId = await resultAggregator.aggregateResults({
  sessionId: 'sess_feature_x',
  taskType: 'full_stack_development',
  agentResults: [
    {
      agent_id: 'opencode://backend-developer',
      result: { api_code: '...', endpoints: 5 },
      confidence: 0.92,
      completion_time: '45s'
    },
    {
      agent_id: 'codex://frontend-developer', 
      result: { ui_code: '...', components: 12 },
      confidence: 0.88,
      completion_time: '67s'
    }
  ],
  synthesisMethod: 'confidence_weighted'
});

// Get aggregation results
const aggregation = resultAggregator.getAggregation(aggregationId);
console.log('Unified result:', aggregation.synthesis.unified_result);
console.log('Confidence score:', aggregation.synthesis.confidence_score);
```

## Configuration

### Environment Variables

```bash
# Communication Bus
export AGENT_BUS_URL="http://localhost:8080"
export AGENT_BUS_API_KEY="your-api-key"

# OpenCode Adapter
export OPENCODE_BINARY_PATH="/usr/local/bin/opencode"
export OPENCODE_WORKING_DIR="/path/to/project"

# Codex Adapter  
export CODEX_CLI_PATH="/usr/local/bin/codex"
export CODEX_API_KEY="your-codex-api-key"

# Claude Code Adapter
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export CLAUDE_WORKSPACE_PATH="/path/to/workspace"
```

### Agent Registration

```yaml
# ~/.agent-config/agents.yaml
agents:
  opencode-reviewer:
    framework: opencode
    endpoint: "stdio://opencode-code-reviewer"
    capabilities: ["code_review", "security_analysis"]
    preferred_models: ["claude-3.5-sonnet"]
    
  codex-frontend:
    framework: codex
    endpoint: "http://localhost:3002"
    capabilities: ["frontend_development", "ui_ux"]
    preferred_models: ["gpt-4-turbo"]
```

## API Reference

### Communication Bus

```typescript
// Start bus
const bus = new CommunicationBus(config);
await bus.start();

// Register agent
await bus.registerAgent(registration);

// Send message
await bus.sendMessage(message);

// Get metrics
const metrics = bus.getMetrics();
```

### Session Manager

```typescript
// Create session
const sessionId = sessionManager.createSession(orchestrator, participants, workflow);

// Add participant
sessionManager.addParticipant(sessionId, participant);

// Delegate task
const taskId = sessionManager.delegateTask(delegator, delegatee, taskType, payload);

// Get workflow progress
const progress = sessionManager.getWorkflowProgress(sessionId);
```

### Model Selector

```typescript
// Select model
const result = modelSelector.selectModel(criteria);

// Register model
modelSelector.registerModel(descriptor);

// Update performance
modelSelector.updatePerformanceMetrics(metrics);
```

### Result Aggregator

```typescript
// Start aggregation
const id = await resultAggregator.aggregateResults(request);

// Get results
const aggregation = resultAggregator.getAggregation(id);

// Add result
resultAggregator.addAgentResult(id, result);
```

## Development

### Installation

```bash
npm install
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run format
```

## Protocol Specification

### Message Format

```json
{
  "message_id": "msg_123456789",
  "timestamp": "2025-01-20T10:30:00Z",
  "sender": {
    "agent_id": "claude-code://task-coordinator",
    "framework": "claude-code",
    "session_id": "sess_abc123"
  },
  "recipient": {
    "agent_id": "opencode://golang-pro",
    "framework": "opencode"
  },
  "message_type": "task_request",
  "priority": "high",
  "payload": {
    "task_type": "code_optimization",
    "context": { ... }
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

### Agent Descriptor

```json
{
  "agent_id": "opencode://code-reviewer",
  "framework": "opencode",
  "capabilities": {
    "input_types": ["code", "documentation"],
    "output_types": ["review_report", "suggestions"],
    "languages": ["go", "python", "javascript"],
    "tools": ["git", "linter", "test_runner"],
    "model_preferences": ["claude-3.5-sonnet"],
    "performance_profile": {
      "avg_response_time": "2.5s",
      "success_rate": 0.98,
      "concurrent_capacity": 3
    }
  },
  "endpoints": {
    "mcp": "stdio://opencode-code-reviewer",
    "http": "http://localhost:8080/agent/code-reviewer"
  },
  "metadata": {
    "version": "1.2.0",
    "author": "framework-team",
    "tags": ["security", "quality", "review"]
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
