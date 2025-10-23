#!/usr/bin/env node

/**
 * Simple NLI Demonstration
 *
 * This shows the NLI system working end-to-end:
 * 1. Parse natural language into structured intent
 * 2. Select appropriate agent based on task type
 * 3. Build properly formatted message
 * 4. Show what would be sent to the agent
 *
 * This demo doesn't require a running CommunicationBus - it shows
 * the delegation logic in isolation.
 */

const { NaturalLanguageInterface } = require('./dist/interfaces/natural-language');

console.clear();
console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║          🧠 Natural Language Interface - Delegation Demo                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Create NLI instance
const nli = new NaturalLanguageInterface({
  defaultPriority: 'medium',
  confidenceThreshold: 0.6,
  defaultTimeout: '300s'
});

// Register mock agents
const agents = [
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
      performance_profile: { avg_response_time: '2000ms', success_rate: 0.95, concurrent_capacity: 5 }
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
      performance_profile: { avg_response_time: '3000ms', success_rate: 0.92, concurrent_capacity: 3 }
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
      performance_profile: { avg_response_time: '4000ms', success_rate: 0.90, concurrent_capacity: 2 }
    },
    endpoints: { http: 'http://localhost:8083' },
    metadata: { version: '1.0.0', author: 'test', tags: ['performance'] }
  }
];

agents.forEach(agent => nli.registerAgent(agent));

console.log(`📋 Registered ${agents.length} Mock Agents:`);
agents.forEach(agent => {
  console.log(`   • ${agent.agent_id.padEnd(35)} → ${agent.capabilities.optimal_tasks.join(', ')}`);
});
console.log('\n' + '═'.repeat(80) + '\n');

// Test scenarios
const testCases = [
  {
    title: 'Security-focused review with specific file',
    input: 'Review src/auth.ts for security vulnerabilities',
    expected: { agent: 'security-auditor', task: 'security_analysis' }
  },
  {
    title: 'High-priority performance optimization',
    input: 'URGENT: Optimize database queries in lib/query.ts',
    expected: { agent: 'performance-pro', task: 'performance_analysis' }
  },
  {
    title: 'Multi-file code quality review',
    input: 'Check src/api.ts and src/database.ts for code quality',
    expected: { agent: 'code-reviewer', task: 'code_review' }
  },
  {
    title: 'Vague request (lower confidence)',
    input: 'Make the API faster',
    expected: { agent: 'performance-pro', task: 'performance_analysis' }
  }
];

const sender = {
  agent_id: 'claude-code://coordinator',
  framework: 'claude-code'
};

testCases.forEach((testCase, index) => {
  console.log(`\n🎯 Test ${index + 1}: ${testCase.title}`);
  console.log(`   Input: "${testCase.input}"`);
  console.log('');

  // Step 1: Parse intent
  const intent = nli.parseIntent(testCase.input);

  console.log('   ✓ Intent Parsed:');
  console.log(`     • Task Type: ${intent.taskType}`);
  console.log(`     • Confidence: ${(intent.confidence * 100).toFixed(1)}%`);
  console.log(`     • Priority: ${intent.priority}`);

  if (intent.targetFiles && intent.targetFiles.length > 0) {
    console.log(`     • Target Files: ${intent.targetFiles.join(', ')}`);
  }

  if (intent.requirements && intent.requirements.length > 0) {
    console.log(`     • Requirements: ${intent.requirements.join(', ')}`);
  }

  if (intent.context && Object.keys(intent.context).length > 0) {
    console.log(`     • Context: ${JSON.stringify(intent.context)}`);
  }

  // Check confidence threshold
  if (intent.confidence < 0.6) {
    console.log('\n   ⚠️  Low Confidence Warning:');
    console.log('      This request may be too vague. Consider adding:');
    console.log('      - Specific file paths (e.g., src/auth.ts)');
    console.log('      - Clear task keywords (review, security, performance)');
    console.log('      - Explicit requirements (security vulnerabilities, bugs)');
    console.log('\n' + '─'.repeat(80));
    return;
  }

  // Step 2: Build message
  const message = nli.buildMessage(intent, sender, `session-${Date.now()}`);

  if (!message) {
    console.log('\n   ✗ No Suitable Agent Found');
    console.log('      Available task types: code_review, security_analysis, performance_analysis');
    console.log('\n' + '─'.repeat(80));
    return;
  }

  console.log('\n   ✓ Agent Selected:');
  console.log(`     • Agent ID: ${message.recipient.agent_id}`);
  console.log(`     • Framework: ${message.recipient.framework}`);

  console.log('\n   ✓ Message Built:');
  console.log(`     • Message ID: ${message.message_id}`);
  console.log(`     • Type: ${message.message_type}`);
  console.log(`     • Priority: ${message.priority}`);
  console.log(`     • Timeout: ${message.routing.timeout}`);
  console.log(`     • Max Retries: ${message.routing.retry_policy.max_retries}`);

  console.log('\n   ✓ Payload:');
  console.log(`     • Task Type: ${message.payload.task_type}`);
  if (message.payload.files) {
    console.log(`     • Files: ${message.payload.files.join(', ')}`);
  }
  if (message.payload.requirements) {
    console.log(`     • Requirements: ${message.payload.requirements.join(', ')}`);
  }

  console.log('\n   📡 Ready to Send:');
  console.log(`      POST http://localhost:8080/messages/send`);
  console.log(`      Content-Type: application/json`);
  console.log(`      Body: ${JSON.stringify(message, null, 2).substring(0, 200)}...`);

  // Verification
  const agentType = message.recipient.agent_id.split('://')[1];
  const taskMatches = testCase.expected.task === message.payload.task_type;
  const agentMatches = agentType === testCase.expected.agent;

  console.log('\n   🔍 Verification:');
  console.log(`      ${taskMatches ? '✓' : '✗'} Task type matches expected (${testCase.expected.task})`);
  console.log(`      ${agentMatches ? '✓' : '✗'} Agent matches expected (${testCase.expected.agent})`);

  console.log('\n' + '═'.repeat(80));
});

console.log('\n✅ NLI Delegation Demo Complete!\n');
console.log('📚 Key Takeaways:');
console.log('   • Natural language is parsed into structured intents');
console.log('   • Agents are selected based on task type and capabilities');
console.log('   • Messages are properly formatted with routing and metadata');
console.log('   • Priority is detected from keywords (URGENT, CRITICAL)');
console.log('   • Confidence scoring helps identify vague requests');
console.log('');
console.log('🚀 Next Steps:');
console.log('   1. Integrate with CommunicationBus for actual message routing');
console.log('   2. Connect OpenCode/Codex adapters (when they support NLI)');
console.log('   3. Handle responses and format results for display');
console.log('');
console.log('📖 Documentation: docs/tutorials/nli-delegation.md');
console.log('');
