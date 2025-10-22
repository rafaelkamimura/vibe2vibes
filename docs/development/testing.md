# Testing Strategy

Automated tests ensure the Agent Communication Bus remains stable while adapters evolve. This guide describes the current testing stack, conventions, and best practices.

## Tooling
- **Jest** – Primary test runner (`npm test`), configured via `jest.config.js`.
- **ts-jest** – Transpiles TypeScript in tests (see dev dependency).
- **Supertest/WebSocket mocks** (future) – Recommended for simulating HTTP/WebSocket interactions once integration tests are added.

## Directory Structure
```
tests/
  unit/
    communication-bus.test.ts
    session-manager.test.ts
    message-router.test.ts
    model-selector.test.ts
    result-aggregator.test.ts
    adapters/
  integration/
  fixtures/
    messages/
    sessions/
  utils/
    test-helpers.ts
    test-database.ts
```

> Note: some files are placeholders; populate them as features stabilize.

## Writing Unit Tests
1. **Isolate Modules** – Mock timers, network calls, or child processes (`jest.spyOn(child_process, 'spawn')`).
2. **Leverage Fixtures** – Reuse sample messages/sessions from `tests/fixtures` to keep tests descriptive.
3. **Assert Events** – Many components emit events (`EventEmitter`); use `once` or mock listeners to verify side effects.
4. **Strict Assertions** – TypeScript strict mode catches unused variables; keep tests explicit to avoid false positives.

Example skeleton:

```ts
import { CommunicationBus } from '../../src/communication-bus';

describe('CommunicationBus', () => {
  it('queues messages when recipient offline', async () => {
    const bus = new CommunicationBus({
      port: 0,
      host: 'localhost',
      maxConnections: 10,
      heartbeatInterval: 1000,
      messageTimeout: 60000,
      persistenceEnabled: false,
      encryptionEnabled: false,
      apiKey: 'test'
    });

    await bus.start();
    // ...register agent, send message, assert queue length...
    await bus.stop();
  });
});
```

## Integration Tests
- Focus on end-to-end flows (HTTP request ➜ router ➜ WebSocket delivery).
- Use the in-memory adapters or stub processes to avoid launching actual CLIs during CI.
- Plan for deterministic teardown: stop the bus and close sockets in `afterAll`.

## Performance & Coverage
- Add coverage tracking (`--coverage`) once unit tests are populated.
- Benchmark high-throughput scenarios (multiple agents, large queues) using Node’s `worker_threads` or external load scripts.

## Continuous Integration
- Future GitHub Actions workflow should run:
  1. `npm ci`
  2. `npm run lint`
  3. `npm run build`
  4. `npm test -- --runInBand`
- Surface artifacts (coverage reports, logs) for debugging test failures.

## Manual QA Checklist
- Verify adapters can register/unregister sequentially without leaking sockets.
- Simulate CLI failures to ensure error messages propagate to senders.
- Confirm Docker Compose stack boots with seeded `.env` and the bus responds on `/health`.
