# Example 02 – Multi-Agent Session

Demonstrates a coordinated workflow where Claude Code orchestrates OpenCode and Codex adapters to implement a feature. This example highlights session creation, task delegation, and result aggregation.

## Overview

1. Create a session linking three agents:
   - `claude-code://orchestrator` (controller)
   - `opencode://backend-developer`
   - `codex://frontend-developer`
2. Dispatch backend and frontend tasks referencing the session.
3. Aggregate results to produce a unified summary.

## Files

- `session-example.ts` – Main script that performs all steps.
- `payloads.ts` – Sample payloads used for delegation.

## Run the Example

```bash
ts-node examples/02-multi-agent-session/session-example.ts
```

Ensure adapters are running and registered (follow integration guides). The script logs session ID, task dispatch status, and aggregated results.
