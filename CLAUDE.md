# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vibe2Vibes: Agent Communication Bus** is a framework-agnostic communication layer that enables agent-to-agent collaboration across different platforms (OpenCode, Codex CLI, Claude Code).

**Status**: Early development (experimental). Core infrastructure complete, TypeScript compilation errors blocking deployment.

## Common Development Commands

```bash
# Development workflow (from agent-communication-bus/)
npm install              # Install dependencies
npm run build           # Compile TypeScript to dist/
npm run dev             # Run with ts-node for development
npm start               # Start production server (after build)

# Quality checks
npm test                # Run Jest tests
npm run lint            # Run ESLint
npm run format          # Apply Prettier formatting

# Single test execution
npm test -- --testNamePattern="test name"
npm test -- path/to/test.test.ts
```

## Architecture Overview

### Core Components (src/)

1. **CommunicationBus** (`communication-bus.ts`)
   - Central message routing hub
   - HTTP server (Express) for REST API
   - WebSocket server for real-time communication
   - Agent registration and lifecycle management
   - Metrics collection and health monitoring

2. **SessionManager** (`session-manager.ts`)
   - Multi-agent workflow orchestration
   - Task delegation and tracking
   - Session lifecycle (create, update, terminate)
   - Workflow state management

3. **MessageRouter** (`message-router.ts`)
   - Intelligent message routing
   - Load balancing across agents
   - Routing strategy selection
   - Fallback and retry logic

4. **ModelSelector** (`model-selector.ts`)
   - Model selection based on task type, cost, latency
   - Provider preferences and constraints
   - Confidence scoring for model choices

5. **ResultAggregator** (`result-aggregator.ts`)
   - Synthesizes results from multiple agents
   - Conflict detection and resolution
   - Multiple synthesis methods (consensus, confidence-weighted, specialist priority)

### Framework Adapters (src/adapters/)

Base class: **BaseAdapter** (`base-adapter.ts`)
- Defines common interface for all adapters
- Handles WebSocket connection, reconnection, heartbeat
- Message send/receive with error handling
- Registration with communication bus

Implementations:
- **OpenCodeAdapter** (`opencode-adapter.ts`) - Spawns OpenCode CLI processes
- **CodexAdapter** (`codex-adapter.ts`) - Spawns Codex CLI processes
- **ClaudeCodeAdapter** (`claude-code-adapter.ts`) - Integrates Claude Code workspace

### Protocol Types (src/types/protocol.ts)

Core message format: **AgentMessage**
- Sender/recipient identification (agent_id, framework, session_id)
- Message types: task_request, task_response, status_update, error, heartbeat
- Priority levels: low, medium, high, critical
- Routing configuration: timeout, retry policy, fallback agents

Other key types:
- **SessionContext** - Multi-agent session state
- **AgentDescriptor** - Agent capabilities and endpoints
- **ModelDescriptor** - LLM model specifications
- **ResultAggregation** - Aggregated results from multiple agents

### Factory Pattern (src/index.ts)

**AgentCommunicationFactory.quickStart()** - One-line system initialization:
- Starts communication bus on port 8080
- Initializes OpenCode, Codex, and Claude Code adapters
- Returns system handle with shutdown() method

## Task Delegation System

### Task Directory Structure

The `tasks/` directory contains agent-specific work assignments:
- `tasks/claude` - Claude Code TypeScript compilation fixes
- `tasks/codex` - Codex CLI documentation and configuration work
- `tasks/opencode` - OpenCode testing infrastructure setup

**Important**: When delegating work between agents, respect the task directory assignments. Each agent should focus on their designated responsibilities to avoid merge conflicts.

### Agent Responsibilities

**Claude Code (this agent)**:
- TypeScript compilation error fixes
- Type safety improvements
- Core module refactoring
- Architecture coordination

**Codex CLI**:
- Documentation writing
- Docker/CI/CD configuration
- Example projects
- Web dashboard (future)
- Build scripts and utilities

**OpenCode**:
- Testing infrastructure
- Jest test suite development
- Integration tests
- Performance benchmarks

### Delegation Guidelines

When tasks require coordination between agents:

1. **Check task files first**: Read relevant files in `tasks/` to understand current assignments
2. **Avoid conflicts**: Don't modify files actively being worked on by another agent
3. **Communicate changes**: Update task files when completing or modifying work
4. **Sequential dependencies**: Some tasks must complete before others (e.g., TypeScript fixes before testing)
5. **Parallel work**: Documentation and configuration can proceed independently of code fixes

## Current Issues & Priorities

### 🔴 BLOCKING: TypeScript Compilation Errors

26 errors preventing build (see `tasks/claude` for details):
- Module import resolution issues
- Unused variable warnings (strict mode)
- Implicit `any` type errors in callbacks
- Type assignment errors with optional properties

**Next Steps**:
1. Fix module imports from `types/protocol`
2. Remove unused imports/variables or prefix with `_`
3. Add explicit types to callback parameters
4. Address `exactOptionalPropertyTypes` issues in tsconfig

### 🟠 Missing Test Suite

Zero tests currently exist. After compilation fixes:
- Unit tests for all core components
- Integration tests for message flow
- Adapter tests (with mocks initially)
- End-to-end session orchestration tests

See `NEXT_STEPS.md` for detailed implementation roadmap.

## Key Design Patterns

### Agent URI Format
```
<framework>://<agent-type>
Example: opencode://golang-pro
         codex://frontend-developer
         claude-code://task-coordinator
```

### Message Flow
1. Agent sends message via HTTP POST `/messages/send` or WebSocket
2. MessageRouter validates and routes message
3. CommunicationBus delivers to recipient (WebSocket if connected, else queue)
4. Recipient processes and sends response
5. SessionManager tracks task status if part of workflow

### Adapter Lifecycle
1. Create adapter instance with agent_id and bus URL
2. Call `initialize()` - registers with bus, starts WebSocket connection
3. Send/receive messages via `sendMessage()` / message event handler
4. Call `shutdown()` on cleanup - gracefully closes connections

### Session Orchestration
1. SessionManager.createSession() with orchestrator and participants
2. Delegate tasks to specific agents via delegateTask()
3. Agents send responses, SessionManager updates workflow state
4. ResultAggregator synthesizes multiple agent results
5. Session terminates when workflow completes or times out

## TypeScript Configuration Notes

**Strict Mode**: Enabled with aggressive type checking:
- `noImplicitAny`, `noImplicitReturns`, `noImplicitThis`
- `noUnusedLocals`, `noUnusedParameters`
- `exactOptionalPropertyTypes` (requires explicit `| undefined` for optional fields)

**Module Resolution**: CommonJS with Node.js resolution strategy
- Imports use relative paths: `'../types/protocol'`
- Target ES2020 for modern JavaScript features
- Output to `dist/` with source maps and declarations

## Environment Configuration

When implementing environment setup:
```bash
# Core communication bus
AGENT_BUS_URL="http://localhost:8080"
AGENT_BUS_API_KEY="your-api-key"

# OpenCode integration
OPENCODE_BINARY_PATH="/usr/local/bin/opencode"
OPENCODE_WORKING_DIR="$PWD"

# Codex CLI integration
CODEX_CLI_PATH="/usr/local/bin/codex"
CODEX_API_KEY="your-codex-key"

# Claude Code integration
ANTHROPIC_API_KEY="your-anthropic-key"
CLAUDE_WORKSPACE_PATH="$PWD"
```

## Common Pitfalls

1. **Variable Shadowing**: Don't name variables `process` (conflicts with Node.js global)
   - Use `childProcess`, `proc`, or `spawnedProcess` instead

2. **Event Handler Types**: Always type callback parameters explicitly
   ```typescript
   // Bad: (data) => {}
   // Good: (data: Buffer) => {}
   ```

3. **Optional Properties**: With `exactOptionalPropertyTypes`, optional means `T | undefined`
   - Use `field: string | undefined` not `field?: string` if undefined is intentional

4. **Unused Imports**: Remove or use them. Prefix with `_` if intentionally unused for future use

5. **Module Imports**: Use consistent path format without file extensions
   - `'../types/protocol'` not `'../types/protocol.ts'` or `'../types/protocol.js'`

## Integration Points

### For OpenCode
- Spawns CLI processes via `child_process.spawn()`
- Captures stdout/stderr for task results
- Maps task types to OpenCode subagent capabilities

### For Codex CLI
- Similar process spawning pattern to OpenCode
- Interactive mode support via stdin piping
- Session management for stateful interactions

### For Claude Code
- Uses Anthropic SDK for task execution
- Workspace-aware file operations
- Natural language task parsing (future feature)

## Next Implementation Priorities

Based on `NEXT_STEPS.md`:

1. **Week 1**: Fix TypeScript errors, write test suite
2. **Week 2**: Natural Language Interface for Claude Code delegation, documentation
3. **Week 3**: Docker/CI/CD, deployment infrastructure
4. **Week 4+**: CLI interface, web dashboard (optional enhancements)

## File Structure

```
agent-communication-bus/
├── src/
│   ├── communication-bus.ts       # Central hub
│   ├── session-manager.ts         # Workflow orchestration
│   ├── message-router.ts          # Routing logic
│   ├── model-selector.ts          # Model selection
│   ├── result-aggregator.ts       # Result synthesis
│   ├── index.ts                   # Public API + factory
│   ├── adapters/
│   │   ├── base-adapter.ts        # Abstract base
│   │   ├── opencode-adapter.ts    # OpenCode integration
│   │   ├── codex-adapter.ts       # Codex integration
│   │   └── claude-code-adapter.ts # Claude Code integration
│   └── types/
│       └── protocol.ts            # All TypeScript interfaces
├── tasks/                         # Agent work assignments
│   ├── claude                     # Claude Code tasks
│   ├── codex                      # Codex CLI tasks
│   └── opencode                   # OpenCode tasks
├── package.json
├── tsconfig.json
├── README.md                      # User-facing documentation
├── AGENTS.md                      # Agent development guidelines
├── NEXT_STEPS.md                  # Implementation roadmap
└── CLAUDE.md                      # This file
```

## Testing Strategy

Once tests are implemented:

**Unit Tests**: Mock all external dependencies (WebSocket, HTTP, child processes)
**Integration Tests**: Test message flow between components with test doubles
**End-to-End Tests**: Full system tests with actual adapters (or realistic mocks)

Coverage target: 80%+ for core components

## Documentation References

- `README.md` - User-facing overview and examples
- `AGENTS.md` - Code style and development standards
- `NEXT_STEPS.md` - Detailed implementation roadmap with priorities
- `tasks/` - Agent-specific work assignments and status
- `docs/` (future) - Comprehensive API and integration documentation
