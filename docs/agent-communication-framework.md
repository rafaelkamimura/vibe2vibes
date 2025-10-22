# Framework-Agnostic Agent Communication Framework

## Overview

A universal protocol for agent-to-agent communication that works across OpenCode, Codex CLI, Claude Code, and future frameworks. Built on existing MCP infrastructure while adding sophisticated coordination capabilities.

## Core Architecture

### 1. Universal Agent Registry (UAR)

**Purpose**: Centralized discovery and capability management across frameworks

**Protocol**: `uar://` scheme with JSON-based capability descriptors

```json
{
  "agent_id": "opencode://code-reviewer",
  "framework": "opencode",
  "capabilities": {
    "input_types": ["code", "documentation", "test_results"],
    "output_types": ["review_report", "suggestions", "metrics"],
    "languages": ["go", "python", "javascript", "typescript"],
    "tools": ["git", "linter", "test_runner"],
    "model_preferences": ["claude-3.5-sonnet", "gpt-4"],
    "performance_profile": {
      "avg_response_time": "2.5s",
      "success_rate": 0.98,
      "concurrent_capacity": 3
    }
  },
  "endpoints": {
    "mcp": "stdio://opencode-code-reviewer",
    "http": "http://localhost:8080/agent/code-reviewer",
    "websocket": "ws://localhost:8080/ws/code-reviewer"
  },
  "metadata": {
    "version": "1.2.0",
    "author": "framework-team",
    "tags": ["security", "quality", "review"]
  }
}
```

### 2. Agent Communication Protocol (ACP)

**Purpose**: Standardized message format for inter-agent communication

**Message Structure**:
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
    "context": {
      "files": ["main.go", "utils.go"],
      "requirements": ["performance", "memory_efficiency"],
      "constraints": ["no_external_dependencies"]
    },
    "expected_output": {
      "type": "optimized_code",
      "format": "diff",
      "metrics": ["benchmark_results", "memory_usage"]
    }
  },
  "routing": {
    "timeout": "300s",
    "retry_policy": {
      "max_retries": 3,
      "backoff": "exponential"
    },
    "fallback_agents": ["codex://go-expert", "claude-code://golang-pro"]
  }
}
```

### 3. Session Management Layer (SML)

**Purpose**: Cross-framework session orchestration and state management

**Session Context**:
```json
{
  "session_id": "sess_main_20250120",
  "orchestrator": "claude-code://task-coordinator",
  "participants": [
    {
      "agent_id": "opencode://code-reviewer",
      "role": "reviewer",
      "status": "active",
      "join_time": "2025-01-20T10:25:00Z"
    },
    {
      "agent_id": "codex://frontend-developer",
      "role": "implementer", 
      "status": "waiting",
      "join_time": "2025-01-20T10:26:00Z"
    }
  ],
  "workflow": {
    "current_step": "code_review",
    "completed_steps": ["analysis", "implementation"],
    "pending_steps": ["testing", "deployment"]
  },
  "shared_context": {
    "project_root": "/Users/nagawa/projects/vibe2vibes",
    "git_branch": "feature/agent-communication",
    "environment": "development"
  }
}
```

## Implementation Components

### 1. Agent Communication Bus (ACB)

**Technology**: Node.js/TypeScript with Event-driven architecture

**Core Features**:
- Message routing and delivery
- Protocol translation between frameworks
- Load balancing and failover
- Message persistence and replay

**API Endpoints**:
```typescript
// Agent registration
POST /agents/register
{
  "agent_descriptor": {...},
  "health_check_url": "http://localhost:3001/health"
}

// Message sending
POST /messages/send
{
  "message": {...},
  "delivery_mode": "async" // or "sync"
}

// Session management
POST /sessions/create
GET /sessions/{session_id}
PUT /sessions/{session_id}/participants
```

### 2. Framework Adapters

**Purpose**: Bridge between framework-specific implementations and universal protocol

#### OpenCode Adapter
```go
type OpenCodeAdapter struct {
    agentID      string
    mcpClient    *mcp.Client
    commBus      *CommunicationBus
    messageQueue chan *ACBMessage
}

func (a *OpenCodeAdapter) HandleIncomingMessage(msg *ACBMessage) error {
    // Convert ACB message to OpenCode Task tool call
    task := &Task{
        Description:    msg.Payload.TaskType,
        Prompt:        formatPrompt(msg.Payload),
        SubagentType:  mapTaskToSubagent(msg.Payload.TaskType),
    }
    
    result, err := a.executeTask(task)
    if err != nil {
        return a.sendErrorResponse(msg, err)
    }
    
    return a.sendSuccessResponse(msg, result)
}
```

#### Codex CLI Adapter
```python
class CodexAdapter:
    def __init__(self, agent_id: str, comm_bus: CommunicationBus):
        self.agent_id = agent_id
        self.comm_bus = comm_bus
        self.cli_interface = CodexCLI()
    
    async def handle_message(self, message: ACBMessage):
        # Convert to Codex CLI command
        command = self.convert_to_command(message)
        result = await self.cli_interface.execute(command)
        
        response = ACBMessage(
            sender=self.agent_id,
            recipient=message.sender,
            message_type="task_response",
            payload={"result": result}
        )
        
        await self.comm_bus.send_message(response)
```

#### Claude Code Adapter
```typescript
class ClaudeCodeAdapter {
    private agentId: string
    private commBus: CommunicationBus
    
    async handleMessage(message: ACBMessage): Promise<void> {
        // Convert to Task tool invocation
        const taskInvocation = {
            subagent_type: this.mapTaskToSubagent(message.payload.task_type),
            prompt: this.formatPrompt(message.payload),
            description: message.payload.task_type
        }
        
        const result = await this.invokeTaskTool(taskInvocation)
        
        const response = new ACBMessage({
            sender: this.agentId,
            recipient: message.sender,
            messageType: 'task_response',
            payload: { result }
        })
        
        await this.commBus.sendMessage(response)
    }
}
```

### 3. Model Selection Framework

**Purpose**: Framework-agnostic model configuration and optimization

**Model Registry**:
```json
{
  "models": {
    "claude-3.5-sonnet": {
      "provider": "anthropic",
      "capabilities": ["code", "reasoning", "analysis"],
      "cost_per_token": 0.000003,
      "max_tokens": 200000,
      "optimal_tasks": ["code_review", "architecture", "debugging"]
    },
    "gpt-4-turbo": {
      "provider": "openai",
      "capabilities": ["code", "reasoning", "multimodal"],
      "cost_per_token": 0.00001,
      "max_tokens": 128000,
      "optimal_tasks": ["generation", "translation", "summarization"]
    },
    "gemini-pro": {
      "provider": "google",
      "capabilities": ["multimodal", "reasoning", "large_context"],
      "cost_per_token": 0.000001,
      "max_tokens": 2000000,
      "optimal_tasks": ["document_analysis", "large_file_processing"]
    }
  },
  "selection_rules": {
    "code_review": ["claude-3.5-sonnet", "gpt-4-turbo"],
    "frontend_development": ["gpt-4-turbo", "claude-3.5-sonnet"],
    "backend_architecture": ["claude-3.5-sonnet"],
    "document_processing": ["gemini-pro", "claude-3.5-sonnet"]
  }
}
```

### 4. Result Aggregation System

**Purpose**: Collect, synthesize, and present results from multiple agents

**Aggregation Strategies**:
- **Consensus Building**: Compare results from multiple agents
- **Specialist Synthesis**: Combine specialized outputs into unified result
- **Conflict Resolution**: Handle disagreements between agents
- **Confidence Scoring**: Rate reliability of each result

**Result Structure**:
```json
{
  "aggregation_id": "agg_123456",
  "session_id": "sess_main_20250120",
  "task_type": "full_stack_feature_development",
  "agent_results": [
    {
      "agent_id": "opencode://backend-developer",
      "result": {...},
      "confidence": 0.95,
      "completion_time": "45s"
    },
    {
      "agent_id": "codex://frontend-developer", 
      "result": {...},
      "confidence": 0.88,
      "completion_time": "67s"
    }
  ],
  "synthesis": {
    "unified_result": {...},
    "confidence_score": 0.92,
    "conflicts": [],
    "recommendations": ["deploy_to_staging", "run_integration_tests"]
  },
  "metadata": {
    "total_time": "112s",
    "cost_estimate": 0.025,
    "quality_metrics": {
      "code_coverage": 0.87,
      "security_score": 0.94,
      "performance_score": 0.91
    }
  }
}
```

## Usage Patterns

### 1. Simple Agent Delegation
```bash
# From Claude Code
"Use opencode with golang-pro to optimize this Go code for performance"
```

### 2. Multi-Agent Collaboration
```bash
# Launch parallel agents with result synthesis
"Use opencode://code-reviewer AND codex://security-auditor to analyze this PR, then synthesize their findings"
```

### 3. Framework-Specific Model Selection
```bash
# Use specific model for specific framework
"Use codex with gpt-4-turbo for frontend development and opencode with claude-3.5-sonnet for backend architecture"
```

### 4. Session-Based Workflows
```bash
# Create persistent session across multiple tasks
"Start session 'feature-x' with opencode://backend-architect, then add codex://frontend-developer for UI implementation"
```

## Configuration

### Environment Setup
```bash
# Communication Bus
export AGENT_BUS_URL="http://localhost:8080"
export AGENT_BUS_API_KEY="your-api-key"

# Framework Adapters
export OPENCODE_ADAPTER_PORT=3001
export CODEX_ADAPTER_PORT=3002
export CLAUDE_ADAPTER_PORT=3003

# Model Selection
export DEFAULT_MODEL="claude-3.5-sonnet"
export COST_OPTIMIZATION=true
export PERFORMANCE_PRIORITY=false
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

## Security & Reliability

### 1. Authentication & Authorization
- JWT-based agent authentication
- Role-based access control
- Message encryption for sensitive data

### 2. Fault Tolerance
- Circuit breaker patterns for agent failures
- Automatic fallback to alternative agents
- Message persistence and retry mechanisms

### 3. Monitoring & Observability
- Real-time agent health monitoring
- Performance metrics and analytics
- Audit logging for all communications

## Migration Path

### Phase 1: Core Infrastructure
1. Deploy Agent Communication Bus
2. Implement basic framework adapters
3. Set up Universal Agent Registry

### Phase 2: Advanced Features
1. Add model selection framework
2. Implement result aggregation system
3. Add session management capabilities

### Phase 3: Optimization & Scaling
1. Performance optimization
2. Advanced routing algorithms
3. Multi-region deployment

This framework provides a solid foundation for sophisticated agent-to-agent communication while maintaining compatibility with existing tools and workflows.