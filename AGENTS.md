# Agent Development Guidelines

## Build/Lint/Test Commands
- **Build**: `npm run build` - Compile TypeScript to dist/
- **Test**: `npm test` - Run Jest tests (use `npm test -- --testNamePattern="testName"` for single test)
- **Lint**: `npm run lint` - ESLint with TypeScript rules
- **Format**: `npm run format` - Prettier formatting
- **Dev**: `npm run dev` - Run with ts-node for development

## Code Style Guidelines

### TypeScript Configuration
- Strict mode enabled with `noImplicitAny`, `noImplicitReturns`, `noUnusedLocals`
- Use exact optional properties and consistent casing
- Target ES2020 with CommonJS modules

### Import Organization
```typescript
// External libraries first
import { EventEmitter } from 'events';
import WebSocket from 'ws';

// Internal imports using relative paths
import { AgentMessage, AgentDescriptor } from '../types/protocol';
```

### Naming Conventions
- **Classes**: PascalCase (`BaseAdapter`, `CommunicationBus`)
- **Methods/Variables**: camelCase (`handleMessage`, `agentId`)
- **Interfaces**: PascalCase with descriptive names (`AgentMessage`, `SessionContext`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RECONNECT_ATTEMPTS`)

### Error Handling
- Always use try-catch for async operations
- Log errors with agent ID prefix using protected `log()` method
- Throw descriptive errors with context
- Handle WebSocket reconnection gracefully

### Type Safety
- Use interface definitions for all data structures
- Provide explicit return types for public methods
- Use union types for constrained values (`'low' | 'medium' | 'high'`)
- Leverage TypeScript's strict mode features

### Documentation
- Use JSDoc comments for public methods and classes
- Document parameters with `@param` and return values with `@returns`
- Include usage examples in factory methods