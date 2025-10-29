#!/usr/bin/env node

/**
 * Direct NLI Execution Demo
 *
 * Simplified demo that shows natural language → task execution → results
 * without needing CommunicationBus WebSocket complexity.
 */

const { NaturalLanguageInterface } = require('./dist/interfaces/natural-language');

// Mock Claude Code task executor
class ClaudeCodeExecutor {
  constructor() {
    this.descriptor = {
      agent_id: 'claude-code://task-executor',
      framework: 'claude-code',
      capabilities: {
        optimal_tasks: ['code_review', 'security_analysis', 'performance_analysis'],
        tools: ['analyzer', 'scanner'],
        input_types: ['source_code'],
        output_types: ['analysis', 'recommendations'],
        languages: ['typescript', 'javascript'],
        model_preferences: ['claude-3-sonnet'],
        performance_profile: { avg_response_time: '3000ms', success_rate: 0.94, concurrent_capacity: 3 }
      },
      endpoints: { http: 'http://localhost:3003' },
      metadata: { version: '1.0.0', author: 'claude-code', tags: ['ai-assistant'] }
    };
  }

  async executeTask(message) {
    const { task_type, files, requirements } = message.payload;

    console.log(`\n⚙️  Executing ${task_type}...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    switch (task_type) {
      case 'security_analysis':
        return {
          summary: `Security analysis completed for ${files?.join(', ') || 'target files'}`,
          issues: [
            {
              severity: 'high',
              description: 'SQL injection vulnerability in user input handling',
              location: `${files?.[0] || 'unknown'}:42`,
              suggestion: 'Use parameterized queries or prepared statements'
            },
            {
              severity: 'medium',
              description: 'Missing input validation on authentication endpoint',
              location: `${files?.[0] || 'unknown'}:156`,
              suggestion: 'Add email format validation and sanitization'
            },
            {
              severity: 'low',
              description: 'Weak password strength requirements',
              location: `${files?.[0] || 'unknown'}:89`,
              suggestion: 'Require minimum 12 characters with special characters'
            }
          ],
          recommendations: [
            'Implement centralized input validation middleware',
            'Add Content Security Policy headers',
            'Enable rate limiting on authentication endpoints',
            'Use HTTPS-only secure cookies',
            'Implement CSRF token protection'
          ],
          completion_time: '500ms'
        };

      case 'performance_analysis':
        return {
          summary: `Performance analysis completed for ${files?.join(', ') || 'target files'}`,
          issues: [
            {
              severity: 'high',
              description: 'N+1 query problem detected in data fetching',
              location: `${files?.[0] || 'unknown'}:67`,
              suggestion: 'Use JOIN queries or batch loading'
            },
            {
              severity: 'medium',
              description: 'Missing database index on frequently queried column',
              location: `${files?.[0] || 'unknown'}:123`,
              suggestion: 'Add composite index on (user_id, created_at)'
            },
            {
              severity: 'medium',
              description: 'Inefficient array operations in loop',
              location: `${files?.[0] || 'unknown'}:201`,
              suggestion: 'Replace Array.find() with Map for O(1) lookups'
            }
          ],
          recommendations: [
            'Implement Redis caching layer',
            'Add database connection pooling',
            'Use pagination for large datasets',
            'Enable response compression (gzip)',
            'Add query result memoization'
          ],
          completion_time: '500ms'
        };

      case 'code_review':
        return {
          summary: `Code review completed for ${files?.join(', ') || 'target files'}`,
          issues: [
            {
              severity: 'medium',
              description: 'High cyclomatic complexity (15) in function',
              location: `${files?.[0] || 'unknown'}:34`,
              suggestion: 'Refactor into smaller, single-responsibility functions'
            },
            {
              severity: 'low',
              description: 'Missing error handling in async function',
              location: `${files?.[0] || 'unknown'}:78`,
              suggestion: 'Add try-catch block for promise rejection'
            },
            {
              severity: 'low',
              description: 'Unused import statements',
              location: `${files?.[0] || 'unknown'}:5`,
              suggestion: 'Remove unused imports'
            }
          ],
          recommendations: [
            'Add comprehensive JSDoc documentation',
            'Increase test coverage to 80%+',
            'Follow consistent naming conventions',
            'Extract magic numbers to constants',
            'Add input parameter validation'
          ],
          completion_time: '500ms'
        };

      default:
        return {
          summary: `Task completed: ${task_type}`,
          details: `Processed request with ${files?.length || 0} files`,
          completion_time: '500ms'
        };
    }
  }
}

async function runDemo() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       🚀 Natural Language Interface - Direct Execution Demo                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize
  const nli = new NaturalLanguageInterface({
    defaultPriority: 'medium',
    confidenceThreshold: 0.6,
    defaultTimeout: '300s'
  });

  const executor = new ClaudeCodeExecutor();
  nli.registerAgent(executor.descriptor);

  console.log(`📋 Agent Registered: ${executor.descriptor.agent_id}`);
  console.log(`   Capabilities: ${executor.descriptor.capabilities.optimal_tasks.join(', ')}`);
  console.log('');
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

    // Step 1: Parse natural language
    console.log('📝 Parsing natural language...');
    const intent = nli.parseIntent(input);
    console.log(`   ✓ Task Type: ${intent.taskType}`);
    console.log(`   ✓ Confidence: ${(intent.confidence * 100).toFixed(0)}%`);
    console.log(`   ✓ Priority: ${intent.priority}`);
    if (intent.targetFiles) console.log(`   ✓ Files: ${intent.targetFiles.join(', ')}`);
    if (intent.requirements) console.log(`   ✓ Requirements: ${intent.requirements.join(', ')}`);

    // Step 2: Build message
    console.log('\n🔧 Building message...');
    const message = nli.buildMessage(intent, sender, `session-${Date.now()}`);
    console.log(`   ✓ Selected Agent: ${message.recipient.agent_id}`);
    console.log(`   ✓ Message ID: ${message.message_id}`);
    console.log(`   ✓ Priority: ${message.priority}`);

    // Step 3: Execute task
    try {
      const result = await executor.executeTask(message);

      // Step 4: Format response
      console.log('\n📊 Results:\n');
      console.log(`   ${result.summary}\n`);

      if (result.issues && result.issues.length > 0) {
        console.log(`   🔍 Issues Found: ${result.issues.length}\n`);
        result.issues.forEach((issue, idx) => {
          console.log(`   ${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
          console.log(`      📍 Location: ${issue.location}`);
          console.log(`      💡 Fix: ${issue.suggestion}\n`);
        });
      }

      if (result.recommendations && result.recommendations.length > 0) {
        console.log(`   📌 Recommendations:\n`);
        result.recommendations.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. ${rec}`);
        });
      }

      console.log(`\n   ⏱️  Completed in: ${result.completion_time}`);

    } catch (error) {
      console.log(`\n   ❌ Error: ${error.message}`);
    }

    console.log('\n' + '═'.repeat(80));
  }

  console.log('\n\n✅ Demo Complete!\n');
  console.log('What You Just Saw:');
  console.log('  ✓ Natural language parsed into structured intents');
  console.log('  ✓ Correct agents selected based on task keywords');
  console.log('  ✓ Messages built with proper routing and metadata');
  console.log('  ✓ Tasks executed and returned realistic results');
  console.log('  ✓ Responses formatted for easy reading\n');

  console.log('🎓 Key Features Demonstrated:');
  console.log('  • Intent parsing (task type, files, requirements, priority)');
  console.log('  • Intelligent agent selection');
  console.log('  • Priority detection (URGENT → critical priority)');
  console.log('  • Security vulnerability reporting');
  console.log('  • Performance issue detection');
  console.log('  • Code quality analysis');
  console.log('  • Actionable recommendations\n');

  console.log('🚀 Next Steps:');
  console.log('  • Integrate with real OpenCode/Codex when they support NLI');
  console.log('  • Add more specialized task types');
  console.log('  • Implement response caching and history');
  console.log('  • Build web dashboard for monitoring\n');
}

runDemo().catch(console.error);
