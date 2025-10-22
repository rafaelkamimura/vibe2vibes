# Interaction Model 2: CLI Interface

🖥️ **FOR POWER USERS AND AUTOMATION**

## Overview

The CLI (Command-Line Interface) provides a powerful terminal-based interface to the agent communication system. Designed for developers who prefer command-line tools, need scriptability, or want fine-grained control.

**Key Benefits**:
- Scriptable and automatable
- Fine-grained control
- Works in CI/CD pipelines
- Fast and efficient

## Installation

```bash
# Global installation
npm install -g agent-orchestrator

# Or use npx
npx agent-orchestrator --help

# Or build from source
cd agent-communication-bus
npm run build
npm link
```

## Quick Start

```bash
# Start the communication bus
agent-bus start --daemon

# Check status
agent-bus status

# Delegate a task
agent-bus delegate opencode "review main.go for security"

# Stop the bus
agent-bus stop
```

## Command Reference

### Bus Management

#### `agent-bus start`

Start the communication bus server.

```bash
# Start in foreground
agent-bus start

# Start as daemon
agent-bus start --daemon

# Custom configuration
agent-bus start --port 8080 --host 0.0.0.0

# With features enabled
agent-bus start --daemon --persistence --encryption
```

**Options**:
- `--port <number>`: Server port (default: 8080)
- `--host <string>`: Server host (default: localhost)
- `--daemon`: Run in background
- `--log-level <level>`: debug|info|warn|error
- `--persistence`: Enable message persistence
- `--encryption`: Enable message encryption

#### `agent-bus status`

Show bus status and statistics.

```bash
agent-bus status

# Output:
# Agent Communication Bus
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Status:        🟢 Running
# Uptime:        2h 34m
# Address:       http://localhost:8080
#
# Agents:        3 registered, 3 healthy
# Sessions:      5 active
# Messages:      1,247 total, 12/s
# Error Rate:    0.8%
```

### Agent Management

#### `agent-bus agents list`

List all registered agents.

```bash
agent-bus agents list

# Output:
# Registered Agents
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ID                          Status    Load  Success
# ────────────────────────────────────────────────────
# opencode://code-reviewer    🟢 Healthy 2/3   95%
# codex://frontend-dev        🟢 Healthy 1/5   92%
# claude://backend-architect  🟡 Busy    3/3   98%

# With details
agent-bus agents list --detailed

# Filter by framework
agent-bus agents list --framework opencode
```

#### `agent-bus agents info <agent-id>`

Get detailed agent information.

```bash
agent-bus agents info opencode://code-reviewer

# Output:
# Agent: opencode://code-reviewer
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Framework:     opencode
# Status:        🟢 Healthy
# Uptime:        2h 15m
#
# Capabilities:
#   Languages:    go, python, javascript, typescript
#   Tools:        git, linter, debugger
#
# Performance:
#   Avg Response:  5.2s
#   Success Rate:  95%
#   Active Tasks:  2
```

### Task Delegation

#### `agent-bus delegate <agent> <task>`

Delegate a task to a specific agent.

```bash
# Basic delegation
agent-bus delegate opencode "review main.go for security"

# With options
agent-bus delegate opencode \
  --type code_review \
  --input @./code.go \
  --output results.json \
  --model claude-3.5-sonnet \
  --timeout 120s \
  --priority high \
  --wait

# Output:
# Task submitted: task_123456
# Status: pending → in_progress → completed (5.2s)
#
# Results:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [Results content]
```

**Options**:
- `--type <string>`: Task type
- `--input <file>`: Input file (use `@` prefix)
- `--output <file>`: Save results to file
- `--model <string>`: Specific model
- `--timeout <duration>`: Task timeout
- `--priority <level>`: low|medium|high|critical
- `--wait`: Wait for completion
- `--format <format>`: json|text|markdown

#### `agent-bus task status <task-id>`

Check task status.

```bash
agent-bus task status task_123456

# Watch in real-time
agent-bus task status task_123456 --watch
```

### Multi-Agent Collaboration

#### `agent-bus collaborate`

Orchestrate multiple agents.

```bash
# Parallel execution
agent-bus collaborate \
  --agents "opencode://code-reviewer,codex://frontend-dev" \
  --task "Build authentication feature" \
  --synthesis consensus

# Sequential workflow
agent-bus collaborate \
  --agents "opencode,codex,opencode" \
  --tasks "design API,create frontend,review security" \
  --mode sequential

# With custom synthesis
agent-bus collaborate \
  --agents "opencode,codex,claude" \
  --synthesis specialist_priority \
  --specialists "opencode://backend-architect" \
  --output results.json
```

**Options**:
- `--agents <list>`: Comma-separated agent IDs
- `--task <string>`: Task description
- `--synthesis <method>`: consensus|specialist_priority|confidence_weighted
- `--mode <mode>`: parallel|sequential
- `--output <file>`: Save aggregated results

### Session Management

#### `agent-bus session create`

Create a persistent session.

```bash
agent-bus session create \
  --name "feature-x-development" \
  --orchestrator "claude://main" \
  --participants "opencode,codex"

# Output: session_abc123
```

#### `agent-bus session info <session-id>`

Get session information.

```bash
agent-bus session info session_abc123
```

## Scripting Examples

### Bash: Automated Code Review

```bash
#!/bin/bash
# automated-review.sh

# Start bus if not running
if ! agent-bus status &>/dev/null; then
  agent-bus start --daemon
  sleep 2
fi

# Review all Go files
for file in $(find . -name "*.go"); do
  agent-bus delegate opencode \
    --type code_review \
    --input "@$file" \
    --output "reviews/$(basename $file).json" \
    --wait
done

echo "Review complete! Results in reviews/"
```

### Python: Multi-Agent Pipeline

```python
#!/usr/bin/env python3
import subprocess
import json

def delegate(agent, task):
    cmd = f'agent-bus delegate {agent} --wait --format json "{task}"'
    result = subprocess.run(cmd, shell=True, capture_output=True)
    return json.loads(result.stdout)

# Step 1: Design
design = delegate("opencode", "design REST API for user management")

# Step 2: Frontend
frontend = delegate("codex", f"create React components for {design['api']}")

# Step 3: Security
review = delegate("opencode", "review security of backend and frontend")

# Save results
results = {"design": design, "frontend": frontend, "security": review}
with open('results.json', 'w') as f:
    json.dump(results, f, indent=2)
```

### CI/CD Integration

```yaml
# .github/workflows/agent-review.yml
name: AI Agent Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Agent CLI
        run: npm install -g agent-orchestrator

      - name: Start Agent Bus
        run: agent-bus start --daemon

      - name: Review Changed Files
        run: |
          files=$(git diff --name-only origin/main...HEAD)
          for file in $files; do
            agent-bus delegate opencode \
              --type code_review \
              --input "@$file" \
              --wait
          done
```

## Advantages

✅ **Scriptable** - Integrate into any workflow
✅ **Precise Control** - Fine-tune every parameter
✅ **Fast** - No GUI overhead
✅ **Automatable** - Perfect for CI/CD
✅ **Portable** - Works on any platform

## Disadvantages

❌ **Learning Curve** - Need to learn commands
❌ **Less Visual** - Text-only interface
❌ **More Verbose** - Longer commands
❌ **No Real-time UI** - Have to poll for updates

## Best For

- DevOps engineers and automation
- Power users who live in the terminal
- Scripting and batch processing
- SSH/remote work
- Debugging and troubleshooting

## See Also

- [Natural Language Interface](./interaction-model-1-natural-language.md) - For easier use
- [Web Dashboard](./interaction-model-3-web-dashboard.md) - For visual interface
- [Usage Examples](./usage-example.md) - Detailed walkthroughs
