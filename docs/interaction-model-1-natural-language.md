# Interaction Model 1: Natural Language Interface

⭐ **RECOMMENDED FOR MOST USERS**

## Overview

The Natural Language Interface allows you to interact with multiple AI agents using plain English. You talk to ONE primary agent (like Claude Code), and it automatically orchestrates other agents behind the scenes via the communication bus.

**Key Benefit**: You don't need to know about the communication bus, protocols, or technical details. Just ask naturally.

## How It Works

```
You (Natural Language)
         ↓
   Primary Agent (e.g., Claude Code)
         ↓ [Translates to protocol]
   Communication Bus
         ↓ [Routes to specialists]
   Specialized Agents (OpenCode, Codex, etc.)
         ↓ [Execute tasks]
   Results Flow Back
         ↓
   Primary Agent (Synthesizes)
         ↓
   You (See unified response)
```

## Example Usage

### Simple Delegation

**You type**:
```
Use OpenCode to review this Go code for security issues
```

**You see**:
```
I've asked OpenCode to review your code. Here's what it found:

SECURITY REVIEW (by OpenCode - 5.2s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ GOOD PRACTICES:
  - Password hashing with bcrypt
  - JWT signature validation
  - Input sanitization

⚠️  ISSUES FOUND (3):
  1. [HIGH] SQL injection vulnerability (auth.go:45)
  2. [MEDIUM] Unchecked error return (user.go:89)
  3. [LOW] Sensitive data in logs (middleware.go:102)

CONFIDENCE: 95%
EXECUTION TIME: 5.2s
```

### Multi-Agent Collaboration

**You type**:
```
Use OpenCode to design the backend architecture for user authentication,
then use Codex to generate the frontend React components
```

**You see**:
```
I've coordinated with OpenCode and Codex to build the authentication system:

BACKEND ARCHITECTURE (by OpenCode - 6.8s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database Schema:
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

API Endpoints:
  POST /api/auth/register
  POST /api/auth/login
  POST /api/auth/refresh
  GET  /api/auth/me

FRONTEND COMPONENTS (by Codex - 8.2s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ LoginForm.tsx
✓ RegisterForm.tsx
✓ AuthContext.tsx
✓ useAuth.ts
✓ ProtectedRoute.tsx

Both components are ready. Would you like me to generate tests?
```

### Complex Workflow

**You type**:
```
Build a complete user dashboard:
1. Use OpenCode to design the backend API
2. Use Codex to create the React components
3. Use OpenCode to review security
4. Use Codex to generate tests
```

**You see** (with real-time updates):
```
Starting multi-step workflow...

STEP 1/4: Backend API Design (OpenCode)
⏳ Analyzing requirements...
✅ Complete (6.2s)

STEP 2/4: Frontend Components (Codex)
⏳ Generating React components...
✅ Complete (9.1s)

STEP 3/4: Security Review (OpenCode)
⏳ Scanning for vulnerabilities...
✅ Complete (4.7s)

STEP 4/4: Test Generation (Codex)
⏳ Writing tests...
✅ Complete (7.4s)

WORKFLOW COMPLETE (27.4s total)
All components ready! 2 security recommendations to address.
```

## Natural Language Patterns

### Delegation Patterns

**Single Agent**:
- "Use OpenCode to [task]"
- "Ask Codex to [task]"
- "Have OpenCode [task]"

**Multiple Agents (Parallel)**:
- "Use OpenCode for [X] and Codex for [Y]"
- "Ask both OpenCode and Codex to [task]"

**Multiple Agents (Sequential)**:
- "Use OpenCode to [X], then use Codex to [Y]"
- "First OpenCode designs, then Codex implements"

**Model Selection**:
- "Use OpenCode with Claude 3.5 Sonnet to review this"
- "Use the best model for code review"
- "Use the most cost-effective model"

## Advantages

✅ **Zero Learning Curve** - Just talk naturally
✅ **No Protocol Knowledge** - Don't need technical details
✅ **Automatic Orchestration** - Primary agent handles complexity
✅ **Context Preservation** - Full conversation context maintained
✅ **Smart Defaults** - System picks optimal agents and models

## Disadvantages

❌ **Less Control** - Can't fine-tune routing/load balancing
❌ **Ambiguity** - Natural language can be unclear
❌ **Dependency** - Requires primary agent to understand delegation
❌ **Hidden Complexity** - Harder to debug

## Best For

- End users who just want to get work done
- Quick tasks without configuration
- Exploratory work and learning
- Conversational workflows
- Multi-turn interactions

## See Also

- [CLI Interface](./interaction-model-2-cli.md) - For power users
- [Web Dashboard](./interaction-model-3-web-dashboard.md) - For visual interface
- [Usage Examples](./usage-example.md) - Detailed walkthroughs
