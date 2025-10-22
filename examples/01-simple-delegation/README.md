# Example 01 – Simple Delegation

This example shows Claude Code delegating a task to the OpenCode adapter through the Agent Communication Bus.

## Scenario

- Claude Code formulates a task: review a TypeScript file for potential issues.
- OpenCode receives the task, runs the CLI, and returns findings.

## Prerequisites

- OpenCode CLI installed and configured (see `docs/integrations/opencode.md`).
- Bus running with OpenCode adapter enabled (`OPENCODE_ENABLED=true`).
- `AGENT_BUS_API_KEY` set in environment.

## Files

- `delegate.ts` – Sends a `task_request` message from Claude Code to OpenCode.
- `sample.ts` – Example code file to “review”.

## Run the Example

```bash
cd examples/01-simple-delegation
npm install # optional if you want local ts-node; otherwise use repo scripts
ts-node delegate.ts
```

Or from project root:

```bash
ts-node examples/01-simple-delegation/delegate.ts
```

You should see OpenCode logs indicating CLI execution and a `task_response` message in the adapter output.

## Expected Output

- OpenCode logs:
  ```
  [opencode://code-reviewer] Executing OpenCode task: code_review
  [opencode://code-reviewer] Task completed successfully
  ```
- `delegate.ts` logs the HTTP response:
  ```
  Message dispatched: { success: true }
  ```

Use this example as a foundation for more advanced workflows (sessions, aggregation).
