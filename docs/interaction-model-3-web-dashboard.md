# Interaction Model 3: Web Dashboard Interface

🌐 **FOR TEAMS AND VISUAL MONITORING**

## Overview

The Web Dashboard provides a browser-based visual interface for agent orchestration. It's designed for teams, real-time monitoring, and users who prefer graphical interfaces.

**Key Benefits**:
- Visual representation of agent activity
- Real-time monitoring and updates
- Easy for non-technical users
- Team collaboration features
- Comprehensive metrics and analytics

## Access

```bash
# Start the communication bus with dashboard
agent-bus start --dashboard

# Or standalone dashboard
cd agent-communication-bus/dashboard
npm install
npm start

# Access at: http://localhost:8080/dashboard
```

## Dashboard Overview

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Agent Communication Dashboard                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Dashboard] [Agents] [Sessions] [Tasks] [Metrics]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Main Views

### 1. Dashboard View (Home)

**Shows**: Overview of entire system

```
┌─────────────────────────────────────────────────────────────┐
│  System Status                                              │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │   Agents     │   Sessions   │   Messages   │           │
│  │      3       │      5       │    1,247     │           │
│  │  🟢 Healthy  │  🟢 Active   │   12/s       │           │
│  └──────────────┴──────────────┴──────────────┘           │
│                                                              │
│  Active Agents                                              │
│  ┌────────────────┬──────────┬─────────┬──────────────┐   │
│  │ Agent ID       │ Status   │ Load    │ Success Rate │   │
│  ├────────────────┼──────────┼─────────┼──────────────┤   │
│  │ opencode://    │ 🟢 Healthy│  2/3   │ 95%          │   │
│  │ codex://       │ 🟢 Healthy│  1/5   │ 92%          │   │
│  │ claude://      │ 🟡 Busy  │  3/3   │ 98%          │   │
│  └────────────────┴──────────┴─────────┴──────────────┘   │
│                                                              │
│  Recent Activity                                            │
│  ⏰ 2s ago  - Task completed: code_review (5.2s)          │
│  ⏰ 15s ago - Session created: feature-x-development       │
│  ⏰ 1m ago  - Agent registered: opencode://tester          │
│                                                              │
│  Performance Metrics (Last Hour)                           │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Response Time: ▃▄▅▆▅▄▃ Avg: 145ms                 │   │
│  │  Throughput:    ▂▃▅▆▇▆▄ 12 msg/s                   │   │
│  │  Error Rate:    ▁▁▁▂▁▁▁ 0.8%                       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2. Agents View

**Shows**: Detailed agent information and management

```
┌─────────────────────────────────────────────────────────────┐
│  Agents                                     [+ Register New] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔍 Filter: [All Frameworks ▼] [All Statuses ▼]           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  opencode://code-reviewer                    🟢      │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Framework:  opencode                               │   │
│  │  Uptime:     2h 15m                                 │   │
│  │  Load:       2/3 tasks                              │   │
│  │  Success:    95% (87 tasks completed)               │   │
│  │                                                      │   │
│  │  Capabilities:                                       │   │
│  │    Languages: go, python, javascript, typescript    │   │
│  │    Tasks: code_review, security_scan, debug         │   │
│  │                                                      │   │
│  │  Performance:                                        │   │
│  │    Avg Response: 5.2s                               │   │
│  │    Last Task: 2s ago (code_review)                  │   │
│  │                                                      │   │
│  │  [View Details] [Health Check] [Restart]           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [Similar cards for other agents...]                       │
└─────────────────────────────────────────────────────────────┘
```

**Click "View Details"**:

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Details: opencode://code-reviewer          [✕ Close] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Info] [Tasks] [Performance] [Configuration]              │
│                                                              │
│  Task History (Last 20)                                     │
│  ┌────────────┬──────────────┬─────────┬────────┬─────┐   │
│  │ Time       │ Type         │ Status  │ Time   │ ... │   │
│  ├────────────┼──────────────┼─────────┼────────┼─────┤   │
│  │ 2s ago     │ code_review  │ ✅ Done │ 5.2s   │ ... │   │
│  │ 5m ago     │ security     │ ✅ Done │ 8.1s   │ ... │   │
│  │ 12m ago    │ code_review  │ ❌ Failed│ -     │ ... │   │
│  └────────────┴──────────────┴─────────┴────────┴─────┘   │
│                                                              │
│  Performance Graphs                                         │
│  Response Time (24h): [Line chart]                         │
│  Success Rate (7d):   [Bar chart]                          │
│  Task Distribution:   [Pie chart]                          │
└─────────────────────────────────────────────────────────────┘
```

### 3. Sessions View

**Shows**: Active and historical sessions

```
┌─────────────────────────────────────────────────────────────┐
│  Sessions                                    [+ New Session] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Active Sessions (5)                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Session: feature-x-development              🟢 Active│  │
│  │  ──────────────────────────────────────────────────  │  │
│  │  ID: session_abc123                                  │  │
│  │  Orchestrator: claude-code://main                    │  │
│  │  Created: 45m ago                                    │  │
│  │                                                       │  │
│  │  Participants (3):                                   │  │
│  │    🟢 opencode://backend (active)                   │  │
│  │    🟢 codex://frontend (active)                     │  │
│  │    ⏸️  opencode://reviewer (waiting)                │  │
│  │                                                       │  │
│  │  Workflow Progress:                                  │  │
│  │    ✅ analysis (completed)                           │  │
│  │    🔄 implementation (in progress) ████████░░░░ 60% │  │
│  │    ⏸️  review (pending)                             │  │
│  │                                                       │  │
│  │  [View Details] [Add Participant] [Terminate]       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4. Tasks View

**Shows**: Task creation and monitoring

**Create New Task**:

```
┌─────────────────────────────────────────────┐
│  Create New Task                             │
├─────────────────────────────────────────────┤
│                                              │
│  Task Type:                                 │
│  ┌──────────────────────────────────────┐  │
│  │ Code Review                        ▼ │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  Description:                                │
│  ┌──────────────────────────────────────┐  │
│  │ Review main.go for security issues  │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  Target Agent:                              │
│  ⚪ Automatic (router decides)              │
│  🔘 Specific: [opencode://code-reviewer ▼] │
│                                              │
│  Model: [claude-3.5-sonnet ▼]              │
│                                              │
│  Priority: [High ▼]                         │
│                                              │
│  Advanced Options: [⊕ Show]                 │
│                                              │
│  [Cancel]  [Submit Task]                    │
└─────────────────────────────────────────────┘
```

**Task Progress View** (Real-time):

```
┌─────────────────────────────────────────────────────────────┐
│  Task: task_abc123                              [✕ Close]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Status Timeline:                                           │
│  ────●────●────●────●────○                                  │
│     Submit Route Start  Progress  Complete                 │
│                                                              │
│  Current Status: 🔄 In Progress                            │
│  Agent: opencode://code-reviewer                           │
│  Elapsed: 3.2s                                             │
│  Progress: ████████░░░░░░ 60%                              │
│                                                              │
│  Live Output:                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [12:34:15] Starting security scan...                 │  │
│  │ [12:34:16] Analyzing auth.go...                      │  │
│  │ [12:34:17] Found potential SQL injection (line 45)  │  │
│  │ [12:34:18] Checking user.go...                       │  │
│  │ [12:34:18] ⏳ Processing...                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Cancel Task]                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5. Metrics View

**Shows**: System analytics and insights

```
┌─────────────────────────────────────────────────────────────┐
│  Metrics & Analytics                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Time Range: [Last 24 Hours ▼]  [Export CSV]              │
│                                                              │
│  System Performance                                         │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Response Time                                      │   │
│  │  200ms ┤                                            │   │
│  │        │     ╱╲                                     │   │
│  │  150ms ┤    ╱  ╲     ╱╲                            │   │
│  │        │   ╱    ╲   ╱  ╲                           │   │
│  │  100ms ┤  ╱      ╲ ╱    ╲                          │   │
│  │        │ ╱        ╲      ╲                         │   │
│  │   50ms ┼──────────────────────────────────────     │   │
│  │        0h    6h    12h   18h   24h                 │   │
│  │        Avg: 145ms | p95: 312ms | p99: 576ms        │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  Agent Utilization                                          │
│  ┌────────────────────────────────────────────────────┐   │
│  │  opencode   ████████████░░░░░░░░░░  60%           │   │
│  │  codex      ████░░░░░░░░░░░░░░░░░░░  20%           │   │
│  │  claude     ████████████████████░░░  95%           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  Task Success Rate (by Type)                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Code Review:        ████████████████░░  95%       │   │
│  │  Code Generation:    ██████████████░░░░  88%       │   │
│  │  Security Scan:      ███████████████████  98%      │   │
│  │  Debugging:          ████████████░░░░░░░  78%       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  Cost Analysis                                              │
│  Total Cost (24h): $2.47                                   │
│  By Agent:  opencode: $1.20 | codex: $0.95 | claude: $0.32│
└─────────────────────────────────────────────────────────────┘
```

## Features

### Real-Time Updates

WebSocket-based live updates:
- Task status changes
- New agent registration
- Session progress
- Performance metrics

### Multi-User Support

- User authentication (planned)
- Role-based access control (planned)
- Shared sessions
- Activity feed

### Notifications

- Browser notifications for task completion
- Email alerts for failures (planned)
- Slack integration (planned)

### Search and Filtering

- Search tasks by keyword
- Filter agents by framework/status
- Filter sessions by date/status
- Advanced query builder

## Use Cases

### Team Collaboration

Multiple team members can:
- Monitor shared sessions
- See what agents are doing
- Track team-wide metrics
- Coordinate multi-agent workflows

### Debugging

Visual debugging tools:
- See message flow
- Inspect agent communication
- View error details
- Replay failed tasks

### Monitoring

Production monitoring:
- Real-time health checks
- Performance dashboards
- Alert on failures
- Track SLAs

## Advantages

✅ **Visual** - Easy to understand at a glance
✅ **Real-Time** - Live updates via WebSocket
✅ **User-Friendly** - No technical knowledge required
✅ **Team-Ready** - Multi-user collaboration
✅ **Rich Metrics** - Comprehensive analytics

## Disadvantages

❌ **Requires Browser** - Not terminal-friendly
❌ **More Resources** - GUI overhead
❌ **Less Scriptable** - Harder to automate
❌ **Network Required** - Need web access

## Best For

- Teams collaborating on projects
- Visual learners and non-technical users
- Production monitoring and operations
- Debugging complex workflows
- Analytics and reporting

## Technology Stack

**Frontend**:
- React + TypeScript
- TailwindCSS for styling
- Recharts for visualizations
- WebSocket for real-time

**Backend**:
- Integrated with Communication Bus
- REST API for actions
- WebSocket for updates

## See Also

- [Natural Language Interface](./interaction-model-1-natural-language.md) - For conversational use
- [CLI Interface](./interaction-model-2-cli.md) - For automation
- [Usage Examples](./usage-example.md) - Detailed walkthroughs
