#!/usr/bin/env node

/**
 * Quick NLI Testing Script
 *
 * Usage: node test-nli.js
 *
 * This demonstrates the Natural Language Interface delegation system.
 */

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
      tools: ['linter', 'formatter', 'static_analyzer'],
      input_types: ['source_code'],
      output_types: ['code_review_report'],
      languages: ['typescript', 'javascript', 'python', 'go'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: {
        avg_response_time: '3000ms',
        success_rate: 0.95,
        concurrent_capacity: 5
      }
    },
    endpoints: { http: 'http://localhost:8081' },
    metadata: {
      version: '1.0.0',
      author: 'opencode-team',
      tags: ['code-review', 'quality'],
      description: 'Code review and quality analysis specialist'
    }
  },
  {
    agent_id: 'opencode://security-auditor',
    framework: 'opencode',
    capabilities: {
      optimal_tasks: ['security_analysis'],
      tools: ['vulnerability_scanner', 'sast', 'dependency_checker'],
      input_types: ['source_code'],
      output_types: ['security_report'],
      languages: ['typescript', 'javascript', 'python'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: {
        avg_response_time: '4000ms',
        success_rate: 0.92,
        concurrent_capacity: 3
      }
    },
    endpoints: { http: 'http://localhost:8082' },
    metadata: {
      version: '1.0.0',
      author: 'opencode-team',
      tags: ['security', 'vulnerability-scanning'],
      description: 'Security vulnerability analysis specialist'
    }
  },
  {
    agent_id: 'opencode://performance-pro',
    framework: 'opencode',
    capabilities: {
      optimal_tasks: ['performance_analysis'],
      tools: ['profiler', 'benchmarker', 'memory_analyzer'],
      input_types: ['source_code'],
      output_types: ['performance_report'],
      languages: ['typescript', 'javascript', 'go'],
      model_preferences: ['claude-3-sonnet'],
      performance_profile: {
        avg_response_time: '5000ms',
        success_rate: 0.90,
        concurrent_capacity: 2
      }
    },
    endpoints: { http: 'http://localhost:8083' },
    metadata: {
      version: '1.0.0',
      author: 'opencode-team',
      tags: ['performance', 'optimization'],
      description: 'Performance analysis and optimization specialist'
    }
  }
];

// Register all mock agents
mockAgents.forEach(agent => nli.registerAgent(agent));

console.log('🚀 Natural Language Interface - Agent Delegation Demo\n');
console.log(`📋 Registered Agents: ${mockAgents.length}`);
mockAgents.forEach(agent => {
  console.log(`   - ${agent.agent_id} (${agent.capabilities.optimal_tasks.join(', ')})`);
});
console.log('\n' + '='.repeat(80) + '\n');

// Test scenarios
const testScenarios = [
  {
    input: 'Review src/auth.ts for security vulnerabilities',
    description: 'Security-focused code review'
  },
  {
    input: 'URGENT: Optimize database queries in lib/query.ts for performance',
    description: 'High-priority performance optimization'
  },
  {
    input: 'Check src/api.ts and src/database.ts for bugs and code quality issues',
    description: 'Multi-file code review'
  },
  {
    input: 'Scan the authentication code for security flaws',
    description: 'Security analysis without specific files'
  },
  {
    input: 'Make the API faster',
    description: 'Vague request (low confidence)'
  }
];

async function runDemo() {
  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`Test ${i + 1}: ${scenario.description}`);
    console.log(`Input: "${scenario.input}"\n`);

    try {
      // Step 1: Parse intent
      const intent = nli.parseIntent(scenario.input);

      console.log('✓ Intent Parsed:');
      console.log(`  - Task Type: ${intent.taskType}`);
      console.log(`  - Confidence: ${(intent.confidence * 100).toFixed(1)}%`);
      console.log(`  - Priority: ${intent.priority}`);
      if (intent.targetFiles && intent.targetFiles.length > 0) {
        console.log(`  - Files: ${intent.targetFiles.join(', ')}`);
      }
      if (intent.requirements && intent.requirements.length > 0) {
        console.log(`  - Requirements: ${intent.requirements.join(', ')}`);
      }

      // Step 2: Build message
      const sender = {
        agent_id: 'claude-code://coordinator',
        framework: 'claude-code'
      };

      const message = nli.buildMessage(intent, sender, 'demo-session-123');

      if (!message) {
        console.log('✗ Message: Cannot build (no suitable agent or low confidence)\n');
      } else {
        console.log('\n✓ Message Built:');
        console.log(`  - Message ID: ${message.message_id}`);
        console.log(`  - Selected Agent: ${message.recipient.agent_id}`);
        console.log(`  - Message Type: ${message.message_type}`);
        console.log(`  - Priority: ${message.priority}`);
        console.log(`  - Timeout: ${message.routing.timeout}`);
        console.log(`  - Retry Policy: ${message.routing.retry_policy.max_retries} retries, ${message.routing.retry_policy.backoff} backoff`);

        console.log('\n✓ Ready to Send:');
        console.log(`  POST http://localhost:8080/messages/send`);
        console.log(`  → Recipient: ${message.recipient.agent_id}`);
        console.log(`  → Task: ${message.payload.task_type}`);
      }

      // Step 3: Simulate response formatting
      console.log('\n✓ Simulated Agent Response:');
      const mockResponse = {
        message_id: 'response-' + Date.now(),
        timestamp: new Date().toISOString(),
        sender: {
          agent_id: message?.recipient.agent_id || 'unknown',
          framework: message?.recipient.framework || 'unknown'
        },
        recipient: sender,
        message_type: 'task_response',
        priority: 'medium',
        payload: {
          summary: `Completed ${intent.taskType} analysis`,
          issues: [
            {
              severity: 'high',
              description: 'Example security vulnerability found',
              location: intent.targetFiles?.[0] + ':42',
              suggestion: 'Use parameterized queries'
            }
          ],
          recommendations: [
            'Add input validation',
            'Enable security headers',
            'Review authentication logic'
          ],
          completion_time: '2500ms'
        }
      };

      const formatted = nli.formatResponse(mockResponse);
      console.log(`  Summary: ${formatted.summary}`);
      if (formatted.issues && formatted.issues.length > 0) {
        console.log(`  Issues Found: ${formatted.issues.length}`);
        formatted.issues.forEach((issue, idx) => {
          console.log(`    ${idx + 1}. [${issue.severity}] ${issue.description}`);
          if (issue.location) console.log(`       Location: ${issue.location}`);
          if (issue.suggestion) console.log(`       Fix: ${issue.suggestion}`);
        });
      }
      if (formatted.recommendations && formatted.recommendations.length > 0) {
        console.log(`  Recommendations: ${formatted.recommendations.length}`);
        formatted.recommendations.forEach((rec, idx) => {
          console.log(`    ${idx + 1}. ${rec}`);
        });
      }

    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  console.log('✅ Demo Complete!\n');
  console.log('Next Steps:');
  console.log('  1. Try your own natural language inputs');
  console.log('  2. Integrate with real OpenCode/Codex adapters');
  console.log('  3. Set up CommunicationBus for actual message routing');
  console.log('\nSee docs/tutorials/nli-delegation.md for full integration guide.\n');
}

runDemo().catch(console.error);
