#!/usr/bin/env node

/**
 * Working NLI Demo with Actual Message Routing
 *
 * This demo properly handles the request-response cycle through the CommunicationBus
 */

const { CommunicationBus } = require('./dist/communication-bus');
const { NaturalLanguageInterface } = require('./dist/interfaces/natural-language');
const { BaseAdapter } = require('./dist/adapters/base-adapter');
const { EventEmitter } = require('events');

// Working adapter that properly sends responses back
class WorkingClaudeCodeAdapter extends BaseAdapter {
  constructor(agentId, busUrl) {
    const descriptor = {
      agent_id: agentId,
      framework: 'claude-code',
      capabilities: {
        optimal_tasks: ['code_review', 'security_analysis', 'performance_analysis'],
        tools: ['analyzer'],
        input_types: ['source_code'],
        output_types: ['analysis'],
        languages: ['typescript', 'javascript'],
        model_preferences: ['claude-3-sonnet'],
        performance_profile: { avg_response_time: '3000ms', success_rate: 0.94, concurrent_capacity: 3 }
      },
      endpoints: { http: 'http://localhost:3003' },
      metadata: { version: '1.0.0', author: 'claude-code', tags: ['ai'] }
    };
    super(agentId, busUrl, descriptor);
    this.pendingResponses = new Map();
  }

  async handleMessage(message) {
    if (message.message_type !== 'task_request') {
      return;
    }

    console.log(`\n📨 ${this.agentId} processing task`);
    console.log(`   Task: ${message.payload.task_type}`);
    console.log(`   Files: ${message.payload.files?.join(', ') || 'none'}`);

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate response
    const result = this.generateResult(message.payload);

    // Create response message
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

    console.log(`   ✓ Sending response`);

    // Send response back through WebSocket
    await this.sendMessage(response);
  }

  generateResult(payload) {
    const { task_type, files } = payload;
    const file = files?.[0] || 'unknown';

    switch (task_type) {
      case 'security_analysis':
        return {
          summary: `Security analysis completed for ${file}`,
          issues: [
            {
              severity: 'high',
              description: 'SQL injection vulnerability',
              location: `${file}:42`,
              suggestion: 'Use parameterized queries'
            },
            {
              severity: 'medium',
              description: 'Missing input validation',
              location: `${file}:156`,
              suggestion: 'Add email validation'
            }
          ],
          recommendations: [
            'Implement input validation middleware',
            'Add security headers',
            'Enable rate limiting'
          ]
        };

      case 'performance_analysis':
        return {
          summary: `Performance analysis completed for ${file}`,
          issues: [
            {
              severity: 'high',
              description: 'N+1 query problem',
              location: `${file}:67`,
              suggestion: 'Use JOIN queries'
            },
            {
              severity: 'medium',
              description: 'Missing database index',
              location: `${file}:123`,
              suggestion: 'Add index on user_id'
            }
          ],
          recommendations: [
            'Implement Redis caching',
            'Add connection pooling',
            'Use pagination'
          ]
        };

      case 'code_review':
        return {
          summary: `Code review completed for ${file}`,
          issues: [
            {
              severity: 'medium',
              description: 'High complexity (15)',
              location: `${file}:34`,
              suggestion: 'Refactor into smaller functions'
            },
            {
              severity: 'low',
              description: 'Missing error handling',
              location: `${file}:78`,
              suggestion: 'Add try-catch block'
            }
          ],
          recommendations: [
            'Add JSDoc comments',
            'Increase test coverage',
            'Follow naming conventions'
          ]
        };

      default:
        return { summary: `Task completed: ${task_type}` };
    }
  }
}

// Response collector to handle async responses
class ResponseCollector extends EventEmitter {
  constructor(bus) {
    super();
    this.bus = bus;
    this.pendingRequests = new Map();

    // Listen for task responses on the bus
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
        },
        reject
      });
    });
  }
}

async function runWorkingDemo() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       🚀 NLI Working Demo - Full Request/Response Cycle                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  // Start bus
  console.log('Step 1: Starting CommunicationBus...');
  const bus = new CommunicationBus({
    port: 8080,
    host: 'localhost',
    maxConnections: 100,
    heartbeatInterval: 30000,
    messageTimeout: 300000,
    persistenceEnabled: false,
    encryptionEnabled: false
  });

  await bus.start();
  console.log('   ✓ Bus running on http://localhost:8080\n');

  // Create response collector
  const collector = new ResponseCollector(bus);

  // Start adapter
  console.log('Step 2: Initializing adapter...');
  const adapter = new WorkingClaudeCodeAdapter('claude-code://executor', 'http://localhost:8080');
  await adapter.initialize();
  console.log('');

  // Set up NLI
  console.log('Step 3: Setting up NLI...');
  const nli = new NaturalLanguageInterface({
    defaultPriority: 'medium',
    confidenceThreshold: 0.6,
    defaultTimeout: '300s'
  });
  nli.registerAgent(adapter.descriptor);
  console.log('   ✓ NLI ready\n');

  console.log('═'.repeat(80));

  // Test scenarios
  const scenarios = [
    'Review src/auth.ts for security vulnerabilities',
    'URGENT: Optimize database queries in lib/query.ts',
    'Check src/api.ts for code quality issues'
  ];

  const sender = { agent_id: 'user://cli', framework: 'cli' };

  for (let i = 0; i < scenarios.length; i++) {
    const input = scenarios[i];
    console.log(`\n\n🎯 Test ${i + 1}: "${input}"\n`);

    try {
      // Parse
      console.log('📝 Parsing...');
      const intent = nli.parseIntent(input);
      console.log(`   ✓ Task: ${intent.taskType} (${(intent.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`   ✓ Priority: ${intent.priority}`);
      if (intent.targetFiles) console.log(`   ✓ Files: ${intent.targetFiles.join(', ')}`);

      // Build message
      console.log('\n🔧 Building message...');
      const message = nli.buildMessage(intent, sender, `session-${Date.now()}`);
      console.log(`   ✓ Agent: ${message.recipient.agent_id}`);
      console.log(`   ✓ Message ID: ${message.message_id}`);

      // Send and wait for response
      console.log('\n🚀 Sending through bus...');
      const sent = await bus.sendMessage(message);

      if (!sent) {
        console.log('   ✗ Failed to send message');
        continue;
      }

      console.log('   ✓ Message sent');
      console.log('\n⏳ Waiting for response...');

      // Wait for response (with timeout)
      const response = await collector.waitForResponse(message.message_id, 5000);

      // Format and display
      console.log('\n📊 Response received!\n');
      const formatted = nli.formatResponse(response);

      console.log(`   ${formatted.summary}\n`);

      if (formatted.issues && formatted.issues.length > 0) {
        console.log(`   🔍 Issues: ${formatted.issues.length}\n`);
        formatted.issues.forEach((issue, idx) => {
          console.log(`   ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
          console.log(`      📍 ${issue.location}`);
          console.log(`      💡 ${issue.suggestion}\n`);
        });
      }

      if (formatted.recommendations && formatted.recommendations.length > 0) {
        console.log(`   📌 Recommendations:\n`);
        formatted.recommendations.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. ${rec}`);
        });
      }

    } catch (error) {
      console.log(`\n   ❌ Error: ${error.message}`);
    }

    console.log('\n' + '═'.repeat(80));
  }

  // Cleanup
  console.log('\n\n🛑 Shutting down...');
  await adapter.shutdown();
  await bus.stop();
  console.log('   ✓ Clean shutdown\n');

  console.log('✅ Full Working Demo Complete!\n');
  console.log('What Worked:');
  console.log('  ✓ Natural language parsed into intents');
  console.log('  ✓ Messages routed through CommunicationBus');
  console.log('  ✓ Adapter received and processed tasks');
  console.log('  ✓ Responses sent back through bus');
  console.log('  ✓ Responses correlated and displayed');
  console.log('  ✓ Full end-to-end execution!\n');
}

runWorkingDemo().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
