# Testing Requirements for TypeScript Compilation Fixes

**Project**: Agent Communication Bus
**Task**: Fix 26 TypeScript compilation errors
**Current Testing State**: Jest infrastructure configured, 5 test suites written, 0 tests passing due to compilation errors

---

## Executive Summary

This document defines the comprehensive testing strategy for fixing TypeScript compilation errors across 5 core modules. The approach follows the test pyramid principle with emphasis on rapid feedback, functional equivalence validation, and deterministic test execution.

## Current Testing Infrastructure

### Existing Assets
- **Test Framework**: Jest 29.7.0 with ts-jest preset
- **Test Utilities**:
  - `MockDataGenerator`: Factory for all protocol types (agents, messages, sessions)
  - `TestDatabase`: In-memory database for stateful testing
  - `MockWebSocket/MockWebSocketServer`: WebSocket mocking
  - `TestTimer`, `MessageTracker`, `AgentRegistry`: Test helpers
- **Test Coverage**: 5 unit test suites written but not executable
- **Coverage Target**: 80%+ for core components

### Test Suite Status
```
tests/unit/
├── communication-bus.test.ts      ❌ Cannot compile (imports broken)
├── message-router.test.ts         ❌ Cannot compile (imports broken)
├── model-selector.test.ts         ❌ Cannot compile (missing methods)
├── result-aggregator.test.ts      ❌ Cannot compile (imports broken)
└── session-manager.test.ts        ❌ Cannot compile (imports broken)
```

---

## Phase-by-Phase Testing Strategy

### Phase 1: Module Import Resolution (Priority: CRITICAL)

**Files Modified**:
- `src/message-router.ts` (import from `../types/protocol`)
- `src/model-selector.ts` (import from `../types/protocol`)
- `src/result-aggregator.ts` (import from `../types/protocol`)
- `src/session-manager.ts` (import from `../types/protocol`)

**Validation Required**:

1. **Compile-Time Validation** (Before running tests)
   ```bash
   npm run build
   # Expected: 0 errors from import resolution
   # Success: Modules compile without "Cannot find module" errors
   ```

2. **Module Loading Test** (Smoke test)
   ```typescript
   // Create: tests/smoke/module-loading.test.ts
   describe('Module Loading', () => {
     it('should load all core modules without errors', () => {
       expect(() => require('../../src/message-router')).not.toThrow();
       expect(() => require('../../src/model-selector')).not.toThrow();
       expect(() => require('../../src/result-aggregator')).not.toThrow();
       expect(() => require('../../src/session-manager')).not.toThrow();
       expect(() => require('../../src/communication-bus')).not.toThrow();
     });

     it('should load types/protocol without errors', () => {
       expect(() => require('../../src/types/protocol')).not.toThrow();
     });
   });
   ```

3. **Type Export Validation** (Type-only test)
   ```typescript
   // tests/smoke/type-exports.test.ts
   import * as Protocol from '../../src/types/protocol';

   describe('Type Exports', () => {
     it('should export all required interfaces', () => {
       const requiredExports = [
         'AgentMessage', 'AgentDescriptor', 'AgentIdentifier',
         'MessageRouting', 'SessionContext', 'AgentParticipant',
         'WorkflowState', 'ModelDescriptor', 'ResultAggregation',
         'CommunicationBusConfig', 'AgentRegistration', 'HealthStatus',
         'BusMetrics'
       ];

       requiredExports.forEach(exportName => {
         expect(Protocol).toHaveProperty(exportName);
       });
     });
   });
   ```

**Success Criteria**:
- ✅ `npm run build` completes without import errors
- ✅ All modules can be `require()`d without throwing
- ✅ Type interfaces are properly exported and accessible

---

### Phase 2: Unused Variable Cleanup (Priority: HIGH)

**Files Modified**:
- `src/communication-bus.ts` (_modelSelector, _resultAggregator)
- `src/model-selector.ts` (AgentDescriptor, maxLatency, task param)
- `src/result-aggregator.ts` (AggregationMetadata, AgentDescriptor, totalWeight, results, request)
- `src/session-manager.ts` (AgentMessage)

**Validation Required**:

1. **Compile-Time Validation**
   ```bash
   npm run build
   # Expected: 0 "declared but never read" errors
   # Success: Clean compilation with strict mode
   ```

2. **Functional Equivalence Tests** (Critical path validation)

   Run existing unit tests to ensure no behavioral changes:
   ```bash
   npm test -- --testNamePattern="Constructor|should initialize"
   npm test -- --testNamePattern="Message.*Sending|Message.*Routing"
   npm test -- --testNamePattern="selectModel|routeMessage|aggregateResults"
   ```

3. **Coverage Validation** (Ensure no dead code introduced)
   ```bash
   npm test -- --coverage --coverageReporters=text
   # Verify coverage percentages don't decrease
   ```

**Success Criteria**:
- ✅ No TypeScript warnings about unused variables
- ✅ All existing tests pass with same behavior
- ✅ Code coverage maintained or improved

---

### Phase 3: Implicit `any` Type Fixes (Priority: HIGH)

**Files Modified**:
- `src/model-selector.ts` (line 103: task parameter)
- `src/result-aggregator.ts` (line 106: r parameter)
- `src/session-manager.ts` (lines 128, 280, 324: p, step, participant parameters)

**Validation Required**:

1. **Type Safety Validation** (Static analysis)
   ```bash
   npm run build -- --noEmit
   # Expected: 0 implicit any errors
   # Verify: tsc with noImplicitAny=true succeeds
   ```

2. **Method Signature Tests** (Type contract validation)
   ```typescript
   // tests/unit/type-safety.test.ts
   describe('Type Safety', () => {
     it('should accept typed parameters in ModelSelector', () => {
       const selector = new ModelSelector();
       const task = { task_type: 'test', requirements: [], constraints: {} };
       expect(() => selector.selectModel(task)).not.toThrow();
     });

     it('should accept typed parameters in ResultAggregator', () => {
       const aggregator = new ResultAggregator();
       const results = [
         { agent_id: 'a1', result: {}, confidence: 0.9, completion_time: '100ms' }
       ];
       expect(() => aggregator.aggregateResults(results, {})).not.toThrow();
     });

     it('should accept typed parameters in SessionManager', () => {
       const manager = new SessionManager();
       const participant = {
         agent_id: 'a1', framework: 'test', role: 'implementer',
         status: 'active' as const, join_time: new Date().toISOString()
       };
       expect(() => manager.addParticipant('session1', participant)).not.toThrow();
     });
   });
   ```

3. **Runtime Type Validation** (Edge case testing)
   ```typescript
   // Verify typed parameters handle edge cases correctly
   it('should handle empty arrays with typed parameters', () => {
     const aggregator = new ResultAggregator();
     expect(() => aggregator.aggregateResults([], {})).not.toThrow();
   });

   it('should handle undefined properties with typed parameters', () => {
     const manager = new SessionManager();
     const participantWithOptionals = {
       agent_id: 'a1',
       framework: 'test',
       role: 'implementer',
       status: 'active' as const,
       join_time: new Date().toISOString(),
       leave_time: undefined,
       capabilities: undefined,
       metadata: undefined
     };
     expect(() => manager.addParticipant('s1', participantWithOptionals)).not.toThrow();
   });
   ```

**Success Criteria**:
- ✅ TypeScript compiles with `noImplicitAny: true`
- ✅ All typed parameters accept correct argument types
- ✅ Edge cases (null, undefined, empty) handled correctly
- ✅ No runtime type errors in existing test suite

---

### Phase 4: `exactOptionalPropertyTypes` Compliance (Priority: MEDIUM)

**Files Modified**:
- `src/communication-bus.ts` (line 415: sessionId property)

**Validation Required**:

1. **Type Compatibility Validation**
   ```typescript
   // tests/unit/optional-properties.test.ts
   describe('Optional Property Handling', () => {
     it('should handle explicit undefined for optional sessionId', () => {
       const bus = new CommunicationBus(mockConfig);
       const routingOptions = {
         priority: 'medium' as const,
         sessionId: undefined,
         timeout: 5000
       };
       expect(() => bus.routeWithOptions(routingOptions)).not.toThrow();
     });

     it('should handle omitted sessionId property', () => {
       const bus = new CommunicationBus(mockConfig);
       const routingOptions = {
         priority: 'low' as const,
         timeout: 3000
       };
       expect(() => bus.routeWithOptions(routingOptions)).not.toThrow();
     });

     it('should handle provided sessionId string', () => {
       const bus = new CommunicationBus(mockConfig);
       const routingOptions = {
         priority: 'high' as const,
         sessionId: 'test-session-123',
         timeout: 10000
       };
       expect(() => bus.routeWithOptions(routingOptions)).not.toThrow();
     });
   });
   ```

2. **Protocol Type Consistency** (Verify all optional properties)
   ```typescript
   // Audit all interfaces in types/protocol.ts for optional property usage
   describe('Protocol Optional Properties', () => {
     it('should allow undefined for all optional fields in AgentMessage', () => {
       const message: AgentMessage = {
         message_id: 'test',
         timestamp: new Date().toISOString(),
         sender: { agent_id: 'a1', framework: 'test' },
         recipient: { agent_id: 'a2', framework: 'test' },
         message_type: 'task_request',
         priority: 'medium',
         payload: {},
         routing: {
           timeout: '30s',
           retry_policy: { max_retries: 3, backoff: 'exponential' },
           delivery_mode: 'async'
         },
         metadata: undefined // Optional field with explicit undefined
       };
       expect(message).toBeDefined();
     });
   });
   ```

**Success Criteria**:
- ✅ Compiles with `exactOptionalPropertyTypes: true`
- ✅ Optional properties accept both `undefined` and omission
- ✅ No type errors when constructing protocol objects
- ✅ All existing message-passing tests pass

---

### Phase 5: Array Type Inference Fixes (Priority: MEDIUM)

**Files Modified**:
- `src/communication-bus.ts` (lines 221, 223, 226: array type inference)

**Validation Required**:

1. **Type Inference Validation**
   ```typescript
   describe('Array Type Handling', () => {
     it('should correctly infer agent array types', () => {
       const bus = new CommunicationBus(mockConfig);
       const agents = bus.getRegisteredAgents();
       expect(Array.isArray(agents)).toBe(true);
       expect(agents.every(a => typeof a.agent_id === 'string')).toBe(true);
     });

     it('should handle empty arrays correctly', () => {
       const bus = new CommunicationBus(mockConfig);
       const emptyResult = bus.filterAgentsByCapability('nonexistent');
       expect(Array.isArray(emptyResult)).toBe(true);
       expect(emptyResult.length).toBe(0);
     });

     it('should maintain array element types through operations', () => {
       const bus = new CommunicationBus(mockConfig);
       const agents = bus.getRegisteredAgents();
       const filtered = agents.filter(a => a.framework === 'test');
       expect(filtered.every(a => 'agent_id' in a)).toBe(true);
     });
   });
   ```

2. **Collection Operations** (Ensure type safety in transformations)
   ```typescript
   it('should preserve types in map operations', () => {
     const bus = new CommunicationBus(mockConfig);
     const agentIds = bus.getRegisteredAgents().map(a => a.agent_id);
     expect(agentIds.every(id => typeof id === 'string')).toBe(true);
   });
   ```

**Success Criteria**:
- ✅ TypeScript infers correct array element types
- ✅ No "type 'never'" errors in array operations
- ✅ Array methods (map, filter, reduce) preserve type safety
- ✅ Empty arrays handled correctly

---

## Cross-Cutting Testing Concerns

### 1. Regression Prevention

**Strategy**: Run full test suite after each phase completion

```bash
# After each phase:
npm run build && npm test

# Success criteria:
# - 0 compilation errors
# - All existing tests pass
# - No new warnings introduced
```

**Test Execution Order**:
1. Module loading tests (fastest feedback)
2. Unit tests for modified modules
3. Integration tests (message flow)
4. Full test suite

### 2. No Runtime Errors Introduced

**Validation Approach**: Dynamic execution testing

```typescript
// tests/integration/runtime-validation.test.ts
describe('Runtime Error Prevention', () => {
  it('should handle typical message flow without errors', async () => {
    const bus = new CommunicationBus(mockConfig);
    await bus.start();

    // Register agents
    const agent1 = MockDataGenerator.createAgentRegistration();
    const agent2 = MockDataGenerator.createAgentRegistration();
    await bus.registerAgent(agent1);
    await bus.registerAgent(agent2);

    // Send message
    const message = MockDataGenerator.createAgentMessage({
      sender: { agent_id: agent1.agent_descriptor.agent_id, framework: 'test' },
      recipient: { agent_id: agent2.agent_descriptor.agent_id, framework: 'test' }
    });

    await expect(bus.sendMessage(message)).resolves.toBe(true);
    await bus.stop();
  });

  it('should handle session orchestration without errors', async () => {
    const manager = new SessionManager();
    const sessionId = await manager.createSession({
      orchestrator: 'agent1',
      participants: [
        { agent_id: 'agent1', framework: 'test', role: 'orchestrator',
          status: 'active', join_time: new Date().toISOString() }
      ]
    });

    expect(sessionId).toBeDefined();
    const session = manager.getSession(sessionId);
    expect(session).toBeDefined();
  });

  it('should handle result aggregation without errors', async () => {
    const aggregator = new ResultAggregator();
    const results = [
      MockDataGenerator.createAgentResult(),
      MockDataGenerator.createAgentResult()
    ];

    const aggregation = await aggregator.aggregateResults(results, {
      method: 'confidence_weighted',
      threshold: 0.7
    });

    expect(aggregation).toBeDefined();
    expect(aggregation.synthesis).toBeDefined();
  });
});
```

### 3. Type-Only Validation (Compile-Time Checks)

**Purpose**: Ensure type safety without runtime execution

```typescript
// tests/types/type-checking.test.ts
// NOTE: This file tests TypeScript compilation, not runtime behavior

import {
  AgentMessage,
  AgentDescriptor,
  SessionContext,
  ModelDescriptor,
  ResultAggregation
} from '../../src/types/protocol';

// Type assertion tests (checked by tsc, not Jest)
type AssertTrue<T extends true> = T;
type IsEqual<A, B> = A extends B ? (B extends A ? true : false) : false;

// Verify interface shapes
type MessageHasId = AssertTrue<IsEqual<AgentMessage['message_id'], string>>;
type MessageHasSender = AssertTrue<IsEqual<keyof AgentMessage['sender'], 'agent_id' | 'framework' | 'session_id'>>;

// Verify optional properties work correctly with exactOptionalPropertyTypes
const messageWithoutMetadata: AgentMessage = {
  message_id: 'test',
  timestamp: new Date().toISOString(),
  sender: { agent_id: 'a1', framework: 'test' },
  recipient: { agent_id: 'a2', framework: 'test' },
  message_type: 'task_request',
  priority: 'medium',
  payload: {},
  routing: {
    timeout: '30s',
    retry_policy: { max_retries: 3, backoff: 'exponential' },
    delivery_mode: 'async'
  }
  // metadata is optional, can be omitted
};

const messageWithExplicitUndefined: AgentMessage = {
  ...messageWithoutMetadata,
  metadata: undefined // Can explicitly set to undefined
};

// This should compile successfully if types are correct
describe('Type Checking (Compile-Time Only)', () => {
  it('should allow proper type constructions', () => {
    expect(messageWithoutMetadata).toBeDefined();
    expect(messageWithExplicitUndefined).toBeDefined();
  });
});
```

### 4. Functional Equivalence Verification

**Goal**: Ensure type changes don't alter behavior

```bash
# Before fixes: Capture expected behavior (may need mock data)
npm test -- --json --outputFile=tests/baseline-results.json

# After each phase: Compare behavior
npm test -- --json --outputFile=tests/current-results.json
diff tests/baseline-results.json tests/current-results.json
```

**Behavioral Test Coverage**:
```typescript
// tests/integration/behavior-equivalence.test.ts
describe('Behavioral Equivalence After Type Fixes', () => {
  describe('Message Routing Behavior', () => {
    it('should route messages to same recipients as before', () => {
      // Test routing logic produces identical results
    });

    it('should apply same fallback logic as before', () => {
      // Verify fallback behavior unchanged
    });

    it('should maintain same timeout behavior', () => {
      // Ensure timeout logic identical
    });
  });

  describe('Model Selection Behavior', () => {
    it('should select same models for same tasks', () => {
      // Model selection deterministic and unchanged
    });

    it('should apply same cost optimization', () => {
      // Cost-based selection unchanged
    });
  });

  describe('Result Aggregation Behavior', () => {
    it('should produce same synthesis results', () => {
      // Aggregation logic produces identical outputs
    });

    it('should detect same conflicts', () => {
      // Conflict detection unchanged
    });
  });
});
```

---

## Minimal Smoke Tests (Before Refactoring)

**Purpose**: Quick validation before starting each phase

```typescript
// tests/smoke/pre-refactor-smoke.test.ts
describe('Pre-Refactor Smoke Tests', () => {
  it('should create CommunicationBus instance', () => {
    const config = MockDataGenerator.createCommunicationBusConfig();
    expect(() => new CommunicationBus(config)).not.toThrow();
  });

  it('should create MessageRouter instance', () => {
    const agents = new Map();
    expect(() => new MessageRouter(agents)).not.toThrow();
  });

  it('should create ModelSelector instance', () => {
    expect(() => new ModelSelector()).not.toThrow();
  });

  it('should create ResultAggregator instance', () => {
    expect(() => new ResultAggregator()).not.toThrow();
  });

  it('should create SessionManager instance', () => {
    expect(() => new SessionManager()).not.toThrow();
  });
});
```

**Run Before Each Phase**:
```bash
npm test -- tests/smoke/pre-refactor-smoke.test.ts
# Expected: All 5 tests pass (once compilation succeeds)
```

---

## Integration Testing After All Fixes

**Purpose**: Validate end-to-end system functionality

```typescript
// tests/integration/full-system.test.ts
describe('Full System Integration', () => {
  let bus: CommunicationBus;
  let router: MessageRouter;
  let selector: ModelSelector;
  let aggregator: ResultAggregator;
  let manager: SessionManager;

  beforeEach(async () => {
    const config = MockDataGenerator.createCommunicationBusConfig();
    bus = new CommunicationBus(config);
    await bus.start();

    router = bus['router']; // Access via test API
    selector = bus['modelSelector'];
    aggregator = bus['resultAggregator'];
    manager = bus['sessionManager'];
  });

  afterEach(async () => {
    await bus.stop();
  });

  it('should complete full agent workflow', async () => {
    // 1. Register agents
    const agent1 = MockDataGenerator.createAgentRegistration();
    const agent2 = MockDataGenerator.createAgentRegistration();
    await bus.registerAgent(agent1);
    await bus.registerAgent(agent2);

    // 2. Create session
    const sessionId = await manager.createSession({
      orchestrator: agent1.agent_descriptor.agent_id,
      participants: [
        { agent_id: agent1.agent_descriptor.agent_id, framework: 'test',
          role: 'orchestrator', status: 'active', join_time: new Date().toISOString() },
        { agent_id: agent2.agent_descriptor.agent_id, framework: 'test',
          role: 'implementer', status: 'active', join_time: new Date().toISOString() }
      ]
    });

    // 3. Send task request
    const taskMessage = MockDataGenerator.createTaskRequestMessage({
      sender: { agent_id: agent1.agent_descriptor.agent_id, framework: 'test', session_id: sessionId },
      recipient: { agent_id: agent2.agent_descriptor.agent_id, framework: 'test', session_id: sessionId }
    });
    const sendResult = await bus.sendMessage(taskMessage);
    expect(sendResult).toBe(true);

    // 4. Receive task response
    const responseMessage = MockDataGenerator.createTaskResponseMessage({
      sender: { agent_id: agent2.agent_descriptor.agent_id, framework: 'test', session_id: sessionId },
      recipient: { agent_id: agent1.agent_descriptor.agent_id, framework: 'test', session_id: sessionId }
    });
    await bus.sendMessage(responseMessage);

    // 5. Verify session state
    const session = manager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session!.participants).toHaveLength(2);

    // 6. Terminate session
    await manager.terminateSession(sessionId, 'completed');
    const terminatedSession = manager.getSession(sessionId);
    expect(terminatedSession!.terminated_at).toBeDefined();
  });

  it('should handle message routing with fallback', async () => {
    const agents = [
      MockDataGenerator.createAgentRegistration(),
      MockDataGenerator.createAgentRegistration(),
      MockDataGenerator.createAgentRegistration()
    ];
    for (const agent of agents) {
      await bus.registerAgent(agent);
    }

    const message = MockDataGenerator.createAgentMessage({
      sender: { agent_id: agents[0].agent_descriptor.agent_id, framework: 'test' },
      recipient: { agent_id: 'non-existent-agent', framework: 'test' },
      routing: MockDataGenerator.createMessageRouting({
        fallback_agents: [agents[1].agent_descriptor.agent_id, agents[2].agent_descriptor.agent_id]
      })
    });

    const result = await bus.sendMessage(message);
    expect(result).toBe(true); // Should succeed via fallback
  });

  it('should aggregate results from multiple agents', async () => {
    const results = [
      MockDataGenerator.createAgentResult({ confidence: 0.9 }),
      MockDataGenerator.createAgentResult({ confidence: 0.85 }),
      MockDataGenerator.createAgentResult({ confidence: 0.95 })
    ];

    const aggregation = await aggregator.aggregateResults(results, {
      method: 'confidence_weighted',
      threshold: 0.8
    });

    expect(aggregation).toBeDefined();
    expect(aggregation.synthesis.unified_result).toBeDefined();
    expect(aggregation.synthesis.confidence_score).toBeGreaterThan(0.8);
  });
});
```

---

## Test Execution Strategy

### Continuous Validation (During Fixes)

```bash
# Watch mode for rapid feedback
npm test -- --watch --testPathPattern=smoke

# After each file fix:
npm run build && npm test -- --testPathPattern="module-name"
```

### Phase Completion Validation

```bash
# Run after completing each phase:
npm run build                                    # Verify compilation
npm test -- --testPathPattern=smoke             # Smoke tests
npm test -- --testPathPattern="ModuleName"      # Unit tests for that module
npm test -- --coverage                          # Full test suite with coverage
```

### Final Validation (All Phases Complete)

```bash
# Full quality check:
npm run lint                                     # Code style
npm run format                                   # Code formatting
npm run build                                    # Clean compilation
npm test -- --coverage --verbose                # All tests with coverage
npm test -- --testPathPattern=integration       # Integration tests
```

---

## Success Metrics

### Quantitative Metrics
- **Compilation**: 0 TypeScript errors, 0 warnings
- **Test Pass Rate**: 100% of existing tests passing
- **Coverage**: Maintain or exceed 80% for core modules
- **Performance**: Test suite completes in < 30 seconds

### Qualitative Metrics
- **Type Safety**: No `any` types, all parameters explicitly typed
- **Maintainability**: Clear type annotations improve code readability
- **Functional Equivalence**: All behaviors identical to pre-fix state
- **No Regressions**: No new runtime errors introduced

---

## Risk Mitigation

### Risk: Breaking Existing Functionality
**Mitigation**:
- Run existing tests after each file change
- Maintain functional equivalence tests
- Use git branches for each phase

### Risk: Type Fixes Introduce Runtime Errors
**Mitigation**:
- Comprehensive integration tests
- Runtime validation tests with edge cases
- Manual smoke testing of critical paths

### Risk: `exactOptionalPropertyTypes` Creates Incompatibilities
**Mitigation**:
- Audit all protocol interfaces first
- Create optional property test suite
- Use union types (`T | undefined`) consistently

### Risk: Test Suite Becomes Unmaintainable
**Mitigation**:
- Use factory pattern (MockDataGenerator) for test data
- Keep tests focused and atomic
- Document test purpose and expected behavior

---

## Test Execution Commands Reference

```bash
# Quick smoke tests (< 5 seconds)
npm test -- tests/smoke/

# Single module tests
npm test -- tests/unit/message-router.test.ts

# Integration tests only
npm test -- tests/integration/

# Full test suite with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch

# Run tests matching pattern
npm test -- --testNamePattern="should route message"

# Verbose output for debugging
npm test -- --verbose

# Run tests in specific file with line number
npm test -- tests/unit/message-router.test.ts:56

# Generate coverage report
npm test -- --coverage --coverageReporters=html
# View: open coverage/index.html
```

---

## Appendix: Test Data Patterns

### Creating Test Instances

```typescript
// Agent with specific capabilities
const agent = MockDataGenerator.createAgentDescriptor({
  capabilities: {
    input_types: ['typescript'],
    output_types: ['javascript'],
    languages: ['typescript'],
    tools: ['tsc'],
    model_preferences: ['gpt-4'],
    performance_profile: {
      avg_response_time: '100ms',
      success_rate: 0.95,
      concurrent_capacity: 3
    }
  }
});

// Message with specific routing
const message = MockDataGenerator.createAgentMessage({
  priority: 'critical',
  routing: {
    timeout: '10s',
    retry_policy: { max_retries: 5, backoff: 'exponential' },
    delivery_mode: 'sync',
    fallback_agents: ['backup-agent-1', 'backup-agent-2']
  }
});

// Session with multiple participants
const session = MockDataGenerator.createSessionWithParticipants(5);
```

### Edge Cases to Test

```typescript
// Empty collections
const emptyRouter = new MessageRouter(new Map());
const emptyResults = aggregator.aggregateResults([], {});

// Null/undefined values
const messageWithoutSession = { ...message, sender: { ...message.sender, session_id: undefined } };

// Large datasets
const manyMessages = MockDataGenerator.createMessageSequence(1000);
const manyAgents = MockDataGenerator.createAgentPool(100);

// Concurrent operations
await Promise.all([
  bus.sendMessage(msg1),
  bus.sendMessage(msg2),
  bus.sendMessage(msg3)
]);
```

---

## Document Metadata

**Version**: 1.0
**Last Updated**: 2025-10-22
**Author**: Test Automation Specialist
**Status**: Active

**Change Log**:
- 2025-10-22: Initial comprehensive testing requirements document
