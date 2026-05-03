#!/usr/bin/env node

/**
 * Interactive NLI Demo with Full Execution
 *
 * Type natural language queries and see them execute in real-time
 * through the full CommunicationBus → Adapter → Response cycle
 */

const readline = require('readline');
const { CommunicationBus } = require('./dist/communication-bus');
const { NaturalLanguageInterface } = require('./dist/interfaces/natural-language');
const { BaseAdapter } = require('./dist/adapters/base-adapter');
const { EventEmitter } = require('events');

// Working adapter that processes tasks
class WorkingClaudeCodeAdapter extends BaseAdapter {
  constructor(agentId, busUrl) {
    const descriptor = {
      agent_id: agentId,
      framework: 'claude-code',
      capabilities: {
        optimal_tasks: ['code_review', 'security_analysis', 'performance_analysis', 'refactoring', 'testing', 'debugging'],
        tools: ['analyzer', 'scanner', 'profiler'],
        input_types: ['source_code'],
        output_types: ['analysis', 'recommendations'],
        languages: ['typescript', 'javascript', 'python', 'go'],
        model_preferences: ['claude-3-sonnet'],
        performance_profile: { avg_response_time: '3000ms', success_rate: 0.94, concurrent_capacity: 3 }
      },
      endpoints: { http: 'http://localhost:3003' },
      metadata: { version: '1.0.0', author: 'claude-code', tags: ['ai-assistant'] }
    };
    super(agentId, busUrl, descriptor);
  }

  async handleMessage(message) {
    if (message.message_type !== 'task_request') {
      return;
    }

    console.log(`\n📨 Agent processing: ${message.payload.task_type}`);
    console.log(`   Files: ${message.payload.files?.join(', ') || 'none'}`);

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate response
    const result = this.generateResult(message.payload);

    // Create response
    const response = {
      message_id: 'resp-' + Date.now(),
      timestamp: new Date().toISOString(),
      sender: message.recipient,
      recipient: message.sender,
      message_type: 'task_response',
      priority: message.priority,
      payload: result,
      correlation_id: message.message_id,
      routing: {
        timeout: '60s',
        priority: 'medium',
        retry_policy: { max_retries: 0, backoff: 'none' },
        delivery_mode: 'async'
      }
    };

    console.log(`   ✓ Task completed`);

    // Send response
    await this.sendMessage(response);
  }

  generateResult(payload) {
    const { task_type, files } = payload;
    const file = files?.[0] || 'target';

    const results = {
      security_analysis: {
        summary: `Security analysis completed for ${file}`,
        issues: [
          { severity: 'high', description: 'SQL injection vulnerability in user input', location: `${file}:42`, suggestion: 'Use parameterized queries or prepared statements' },
          { severity: 'medium', description: 'Missing authentication check on endpoint', location: `${file}:156`, suggestion: 'Add JWT token validation middleware' },
          { severity: 'low', description: 'Weak password hashing algorithm (MD5)', location: `${file}:89`, suggestion: 'Use bcrypt or Argon2 for password hashing' }
        ],
        recommendations: [
          'Implement centralized input validation',
          'Add Content Security Policy headers',
          'Enable rate limiting on auth endpoints',
          'Use secure session management',
          'Implement CSRF protection'
        ]
      },
      performance_analysis: {
        summary: `Performance analysis completed for ${file}`,
        issues: [
          { severity: 'high', description: 'N+1 query problem in data fetching loop', location: `${file}:67`, suggestion: 'Use JOIN queries or eager loading' },
          { severity: 'medium', description: 'Missing database index on user_email column', location: `${file}:123`, suggestion: 'Add composite index on (user_id, created_at)' },
          { severity: 'medium', description: 'Inefficient array operations (O(n²) complexity)', location: `${file}:201`, suggestion: 'Replace Array.find() with Map for O(1) lookups' }
        ],
        recommendations: [
          'Implement Redis caching layer',
          'Add database connection pooling',
          'Use pagination for large datasets',
          'Enable gzip compression',
          'Add query result memoization'
        ]
      },
      code_review: {
        summary: `Code review completed for ${file}`,
        issues: [
          { severity: 'medium', description: 'High cyclomatic complexity (18) in function', location: `${file}:34`, suggestion: 'Refactor into smaller single-responsibility functions' },
          { severity: 'low', description: 'Missing error handling in async function', location: `${file}:78`, suggestion: 'Add try-catch block for promise rejections' },
          { severity: 'low', description: 'Unused import statements detected', location: `${file}:5`, suggestion: 'Remove unused imports' }
        ],
        recommendations: [
          'Add comprehensive JSDoc documentation',
          'Increase test coverage to 80%+',
          'Follow consistent naming conventions',
          'Extract magic numbers to constants',
          'Add input validation on all public methods'
        ]
      },
      refactoring: {
        summary: `Refactoring suggestions for ${file}`,
        issues: [
          { severity: 'medium', description: 'Duplicate code blocks detected', location: `${file}:112,${file}:245`, suggestion: 'Extract common logic into shared utility function' },
          { severity: 'low', description: 'Long parameter list (7 parameters)', location: `${file}:56`, suggestion: 'Use options object pattern instead' }
        ],
        recommendations: [
          'Apply Single Responsibility Principle',
          'Use dependency injection for testability',
          'Extract configuration to separate module',
          'Implement builder pattern for complex objects'
        ]
      },
      testing: {
        summary: `Test analysis for ${file}`,
        issues: [
          { severity: 'high', description: 'No test coverage for critical function', location: `${file}:89`, suggestion: 'Add unit tests with edge cases' },
          { severity: 'medium', description: 'Missing integration tests for API endpoints', location: `${file}:234`, suggestion: 'Add request/response tests' }
        ],
        recommendations: [
          'Aim for 80% code coverage',
          'Add end-to-end tests for critical flows',
          'Use test fixtures for consistent data',
          'Implement snapshot testing for UI components'
        ]
      },
      debugging: {
        summary: `Debugging analysis for ${file}`,
        issues: [
          { severity: 'high', description: 'Potential null pointer dereference', location: `${file}:78`, suggestion: 'Add null check before property access' },
          { severity: 'medium', description: 'Race condition in async operations', location: `${file}:145`, suggestion: 'Use proper locking or sequential execution' }
        ],
        recommendations: [
          'Add comprehensive logging',
          'Use debugger breakpoints effectively',
          'Implement error boundaries',
          'Add monitoring and alerting'
        ]
      }
    };

    return results[task_type] || {
      summary: `Task completed: ${task_type}`,
      details: `Processed ${files?.length || 0} file(s)`,
      recommendations: ['Review implementation', 'Add documentation', 'Increase test coverage']
    };
  }
}

// Response collector
class ResponseCollector extends EventEmitter {
  constructor(bus) {
    super();
    this.bus = bus;
    this.pendingRequests = new Map();

    this.bus.on('task_response_received', (data) => {
      const message = data.message;
      if (message.correlation_id) {
        const resolver = this.pendingRequests.get(message.correlation_id);
        if (resolver) {
          resolver.resolve(message);
          this.pendingRequests.delete(message.correlation_id);
        }
      }
    });
  }

  async waitForResponse(messageId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error('Response timeout'));
      }, timeout);

      this.pendingRequests.set(messageId, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        }
      });
    });
  }
}

// Global state
let bus, adapter, nli, collector, rl;

async function initialize() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🤖 Interactive NLI Demo - Full Execution                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  console.log('🚀 Initializing system...\n');

  // Start bus
  console.log('   Starting CommunicationBus...');
  bus = new CommunicationBus({
    port: 8080,
    host: 'localhost',
    maxConnections: 100,
    heartbeatInterval: 30000,
    messageTimeout: 300000,
    persistenceEnabled: false,
    encryptionEnabled: false
  });
  await bus.start();

  // Create collector
  collector = new ResponseCollector(bus);

  // Start adapter
  console.log('   Starting adapter...');
  adapter = new WorkingClaudeCodeAdapter('claude-code://executor', 'http://localhost:8080');
  await adapter.initialize();

  // Setup NLI
  console.log('   Setting up NLI...');
  nli = new NaturalLanguageInterface({
    defaultPriority: 'medium',
    confidenceThreshold: 0.6,
    defaultTimeout: '300s'
  });
  nli.registerAgent(adapter.descriptor);

  console.log('\n✅ System ready!\n');
  console.log('═'.repeat(80));
  console.log('\n📋 Available Task Types:');
  console.log('   • code_review - Review code quality, complexity, and best practices');
  console.log('   • security_analysis - Scan for vulnerabilities and security issues');
  console.log('   • performance_analysis - Identify performance bottlenecks');
  console.log('   • refactoring - Suggest code improvements and refactoring');
  console.log('   • testing - Analyze test coverage and suggest tests');
  console.log('   • debugging - Help identify and fix bugs\n');

  console.log('💡 Example Queries:');
  console.log('   • "Review src/auth.ts for security vulnerabilities"');
  console.log('   • "URGENT: Optimize database queries in lib/query.ts"');
  console.log('   • "Check src/api.ts for code quality issues"');
  console.log('   • "Debug the null pointer error in utils/parser.ts"');
  console.log('   • "Suggest refactoring for components/UserProfile.tsx"\n');

  console.log('⌨️  Commands:');
  console.log('   help   - Show this help message');
  console.log('   clear  - Clear screen');
  console.log('   exit   - Quit the console\n');

  console.log('═'.repeat(80));
  console.log('');
}

async function processQuery(input) {
  const trimmed = input.trim();

  if (!trimmed) return;

  if (trimmed.toLowerCase() === 'help') {
    console.log('\n📖 Help:\n');
    console.log('Type natural language requests to delegate tasks to the agent.');
    console.log('The system will parse your intent, select the appropriate agent,');
    console.log('execute the task, and display results.\n');
    console.log('Available commands: help, clear, exit\n');
    return;
  }

  if (trimmed.toLowerCase() === 'clear') {
    console.clear();
    return;
  }

  console.log('\n' + '─'.repeat(80));

  try {
    // Parse
    console.log('\n📝 Parsing natural language...');
    const intent = nli.parseIntent(trimmed);
    console.log(`   ✓ Task Type: ${intent.taskType}`);
    console.log(`   ✓ Confidence: ${(intent.confidence * 100).toFixed(0)}%`);
    console.log(`   ✓ Priority: ${intent.priority}`);
    if (intent.targetFiles) console.log(`   ✓ Files: ${intent.targetFiles.join(', ')}`);
    if (intent.requirements) console.log(`   ✓ Requirements: ${intent.requirements.join(', ')}`);

    // Check confidence
    if (intent.confidence < 0.6) {
      console.log('\n⚠️  Low Confidence Warning:');
      console.log('   Your request may be too vague. Try adding:');
      console.log('   - Specific file paths (e.g., src/auth.ts)');
      console.log('   - Clear task keywords (review, security, performance)');
      console.log('   - Explicit requirements\n');
      return;
    }

    // Build message
    console.log('\n🔧 Building message...');
    const sender = { agent_id: 'user://interactive', framework: 'cli' };
    const message = nli.buildMessage(intent, sender, `session-${Date.now()}`);

    if (!message) {
      console.log('   ✗ No suitable agent found\n');
      return;
    }

    console.log(`   ✓ Agent: ${message.recipient.agent_id}`);
    console.log(`   ✓ Message ID: ${message.message_id}`);

    // Send
    console.log('\n🚀 Sending to CommunicationBus...');
    const sent = await bus.sendMessage(message);

    if (!sent) {
      console.log('   ✗ Failed to send\n');
      return;
    }

    console.log('   ✓ Message sent');
    console.log('\n⏳ Waiting for response...');

    // Wait for response
    const response = await collector.waitForResponse(message.message_id, 10000);

    // Display results
    console.log('\n📊 Results:\n');
    const formatted = nli.formatResponse(response);

    console.log(`   ${formatted.summary}\n`);

    if (formatted.issues && formatted.issues.length > 0) {
      console.log(`   🔍 Issues Found: ${formatted.issues.length}\n`);
      formatted.issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
        console.log(`      📍 Location: ${issue.location}`);
        console.log(`      💡 Fix: ${issue.suggestion}\n`);
      });
    }

    if (formatted.recommendations && formatted.recommendations.length > 0) {
      console.log(`   📌 Recommendations:\n`);
      formatted.recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
      console.log('');
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  console.log('─'.repeat(80));
  console.log('');
}

async function shutdown() {
  console.log('\n\n🛑 Shutting down...');
  if (adapter) await adapter.shutdown();
  if (bus) await bus.stop();
  console.log('   ✓ Clean shutdown\n');
  console.log('👋 Goodbye!\n');
  process.exit(0);
}

async function main() {
  await initialize();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      rl.close();
      await shutdown();
      return;
    }

    await processQuery(input);
    rl.prompt();
  });

  rl.on('close', async () => {
    await shutdown();
  });

  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    rl.close();
    await shutdown();
  });
}

main().catch(async (error) => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  if (adapter) await adapter.shutdown();
  if (bus) await bus.stop();
  process.exit(1);
});
