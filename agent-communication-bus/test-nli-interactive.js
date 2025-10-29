#!/usr/bin/env node

/**
 * Interactive NLI Testing Console
 *
 * Usage: node test-nli-interactive.js
 *
 * Type natural language delegation requests and see how NLI processes them.
 */

const readline = require('readline');
const { NaturalLanguageInterface } = require('./dist/interfaces/natural-language');

// Create NLI instance
const nli = new NaturalLanguageInterface({
  defaultPriority: 'medium',
  confidenceThreshold: 0.6,
  defaultTimeout: '300s'
});

// Register mock agents
const mockAgents = [
  {
    agent_id: 'opencode://code-reviewer',
    framework: 'opencode',
    capabilities: {
      optimal_tasks: ['code_review', 'refactoring'],
      tools: ['linter', 'formatter'],
      input_types: ['source_code'],
      output_types: ['code_review_report'],
      languages: ['typescript', 'javascript'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: { avg_response_time: '3000ms', success_rate: 0.95, concurrent_capacity: 5 }
    },
    endpoints: { http: 'http://localhost:8081' },
    metadata: { version: '1.0.0', author: 'test', tags: ['code-review'] }
  },
  {
    agent_id: 'opencode://security-auditor',
    framework: 'opencode',
    capabilities: {
      optimal_tasks: ['security_analysis'],
      tools: ['vulnerability_scanner'],
      input_types: ['source_code'],
      output_types: ['security_report'],
      languages: ['typescript', 'javascript'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: { avg_response_time: '4000ms', success_rate: 0.92, concurrent_capacity: 3 }
    },
    endpoints: { http: 'http://localhost:8082' },
    metadata: { version: '1.0.0', author: 'test', tags: ['security'] }
  },
  {
    agent_id: 'opencode://performance-pro',
    framework: 'opencode',
    capabilities: {
      optimal_tasks: ['performance_analysis'],
      tools: ['profiler'],
      input_types: ['source_code'],
      output_types: ['performance_report'],
      languages: ['typescript', 'javascript'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: { avg_response_time: '5000ms', success_rate: 0.90, concurrent_capacity: 2 }
    },
    endpoints: { http: 'http://localhost:8083' },
    metadata: { version: '1.0.0', author: 'test', tags: ['performance'] }
  },
  {
    agent_id: 'opencode://test-automator',
    framework: 'opencode',
    capabilities: {
      optimal_tasks: ['testing'],
      tools: ['jest', 'test-generator'],
      input_types: ['source_code'],
      output_types: ['test_suite'],
      languages: ['typescript', 'javascript'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: { avg_response_time: '3500ms', success_rate: 0.93, concurrent_capacity: 4 }
    },
    endpoints: { http: 'http://localhost:8084' },
    metadata: { version: '1.0.0', author: 'test', tags: ['testing'] }
  }
];

mockAgents.forEach(agent => nli.registerAgent(agent));

console.clear();
console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║       🚀 Natural Language Interface - Interactive Testing Console          ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📋 Registered ${mockAgents.length} Mock Agents:`);
mockAgents.forEach(agent => {
  console.log(`   • ${agent.agent_id.padEnd(35)} → ${agent.capabilities.optimal_tasks.join(', ')}`);
});
console.log('');
console.log('💡 Example Queries:');
console.log('   • "Review src/auth.ts for security vulnerabilities"');
console.log('   • "URGENT: Optimize database queries in lib/query.ts"');
console.log('   • "Add tests for src/api.ts and src/database.ts"');
console.log('   • "Check the authentication code for bugs"');
console.log('');
console.log('⌨️  Type your delegation request (or "exit" to quit):');
console.log('─'.repeat(80));
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

rl.prompt();

rl.on('line', (input) => {
  const trimmed = input.trim();

  if (!trimmed) {
    rl.prompt();
    return;
  }

  if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
    console.log('\n👋 Goodbye!\n');
    process.exit(0);
  }

  if (trimmed.toLowerCase() === 'help') {
    console.log('\n📖 Available Commands:');
    console.log('   help   - Show this help message');
    console.log('   agents - List registered agents');
    console.log('   clear  - Clear screen');
    console.log('   exit   - Quit the console');
    console.log('\n   Or type any natural language delegation request!\n');
    rl.prompt();
    return;
  }

  if (trimmed.toLowerCase() === 'agents') {
    console.log(`\n📋 Registered ${mockAgents.length} Agents:`);
    mockAgents.forEach(agent => {
      console.log(`\n   ${agent.agent_id}`);
      console.log(`   └─ Tasks: ${agent.capabilities.optimal_tasks.join(', ')}`);
      console.log(`   └─ Tools: ${agent.capabilities.tools.join(', ')}`);
      console.log(`   └─ Success Rate: ${(agent.capabilities.performance_profile.success_rate * 100).toFixed(0)}%`);
    });
    console.log('');
    rl.prompt();
    return;
  }

  if (trimmed.toLowerCase() === 'clear') {
    console.clear();
    rl.prompt();
    return;
  }

  try {
    console.log('');

    // Parse intent
    const intent = nli.parseIntent(trimmed);

    console.log('✓ Intent Analysis:');
    console.log(`  └─ Task Type: ${intent.taskType}`);
    console.log(`  └─ Confidence: ${(intent.confidence * 100).toFixed(1)}%`);
    console.log(`  └─ Priority: ${intent.priority}`);

    if (intent.targetFiles && intent.targetFiles.length > 0) {
      console.log(`  └─ Files: ${intent.targetFiles.join(', ')}`);
    }

    if (intent.requirements && intent.requirements.length > 0) {
      console.log(`  └─ Requirements: ${intent.requirements.join(', ')}`);
    }

    if (intent.context && Object.keys(intent.context).length > 0) {
      console.log(`  └─ Context: ${JSON.stringify(intent.context)}`);
    }

    // Check confidence
    if (intent.confidence < 0.6) {
      console.log('\n⚠️  Low Confidence Warning:');
      console.log('  └─ Request may be too vague or ambiguous');
      console.log('  └─ Try including specific file paths and task keywords');
      console.log('  └─ Example: "Review src/auth.ts for security issues"');
      console.log('');
      rl.prompt();
      return;
    }

    // Build message
    const sender = {
      agent_id: 'claude-code://interactive-console',
      framework: 'claude-code'
    };

    const message = nli.buildMessage(intent, sender, 'interactive-' + Date.now());

    if (!message) {
      console.log('\n✗ No Suitable Agent Found');
      console.log('  └─ Task type may not match any registered agent');
      console.log('  └─ Available agents handle: code_review, security_analysis, performance_analysis, testing');
      console.log('');
      rl.prompt();
      return;
    }

    console.log('\n✓ Agent Selected:');
    console.log(`  └─ ${message.recipient.agent_id}`);
    console.log(`  └─ Framework: ${message.recipient.framework}`);

    console.log('\n✓ Message Details:');
    console.log(`  └─ Message ID: ${message.message_id}`);
    console.log(`  └─ Type: ${message.message_type}`);
    console.log(`  └─ Priority: ${message.priority}`);
    console.log(`  └─ Timeout: ${message.routing.timeout}`);
    console.log(`  └─ Max Retries: ${message.routing.retry_policy.max_retries}`);

    console.log('\n✓ Payload:');
    console.log(`  └─ Task: ${message.payload.task_type}`);
    if (message.payload.files) {
      console.log(`  └─ Files: ${message.payload.files.join(', ')}`);
    }
    if (message.payload.requirements) {
      console.log(`  └─ Requirements: ${message.payload.requirements.join(', ')}`);
    }

    console.log('\n📡 Ready to Send:');
    console.log(`  POST http://localhost:8080/messages/send`);
    console.log(`  Body: ${JSON.stringify(message, null, 2).split('\n').slice(0, 5).join('\n  ')}...`);

  } catch (error) {
    console.log(`\n✗ Error: ${error.message}`);
    if (error.message.includes('at least 3 characters')) {
      console.log('  └─ Input must be at least 3 characters long');
    } else if (error.message.includes('exceed 10,000')) {
      console.log('  └─ Input must not exceed 10,000 characters');
    }
  }

  console.log('');
  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});
