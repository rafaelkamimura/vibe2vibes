# Agent Communication Framework Documentation

Complete documentation for the framework-agnostic agent-to-agent communication system.

## 📚 Documentation Index

### User Interaction Models
Choose how you want to interact with the agent orchestration system:

1. **[Natural Language Interface](./interaction-model-1-natural-language.md)** ⭐ **RECOMMENDED**
   - Talk to one agent, it delegates to others automatically
   - Most user-friendly approach
   - Best for: Claude Code, Codex, OpenCode users

2. **[CLI Interface](./interaction-model-2-cli.md)** 🖥️
   - Command-line tool for power users
   - Scriptable and automatable
   - Best for: DevOps, CI/CD pipelines, scripts

3. **[Web Dashboard Interface](./interaction-model-3-web-dashboard.md)** 🌐
   - Visual browser-based interface
   - Real-time monitoring and control
   - Best for: Teams, monitoring, debugging

### Architecture & Technical Docs
- **[Architecture Overview](./architecture-overview.md)** - System design and components *(coming soon)*
- **[Usage Examples](./usage-example.md)** - End-to-end walkthrough *(coming soon)*
- **[Implementation Status](./implementation-status.md)** - Detailed analysis of what's complete and what's missing

## Implementation Status

**Current**: ~85% Complete (Core Infrastructure)

**What's Working**: ✅ Bus, Session Manager, Router, Model Selector, Result Aggregator, ALL Adapters (BaseAdapter, OpenCode, Codex, Claude Code)

**What's Blocking**: ⚠️ 43 TypeScript compilation errors, missing test suite

**What's Missing**: ❌ User interfaces (Natural Language, CLI, Dashboard), integration with vibes-mcp-cli

**See**: [Detailed Implementation Status](./implementation-status.md) for complete analysis and recommended next steps
