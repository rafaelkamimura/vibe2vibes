/**
 * Functional Validation Test Suite for Natural Language Interface
 *
 * Tests for real-world scenarios:
 * - Code review variations
 * - Performance analysis variations
 * - Security analysis variations
 * - Complex multi-task scenarios
 */

import { NaturalLanguageInterface } from '../../src/interfaces/natural-language';
import { AgentDescriptor } from '../../src/types/protocol';

describe('NLI Functional Validation', () => {
  let nli: NaturalLanguageInterface;
  let codeReviewer: AgentDescriptor;
  let securityScanner: AgentDescriptor;
  let performanceProfiler: AgentDescriptor;

  beforeEach(() => {
    nli = new NaturalLanguageInterface();

    // Register realistic agents
    codeReviewer = {
      agent_id: 'opencode://code-reviewer',
      framework: 'opencode',
      capabilities: {
        optimal_tasks: ['code_review', 'refactoring'],
        tools: ['linter', 'formatter'],
        input_types: ['source_code'],
        output_types: ['code_review_report'],
        languages: ['typescript', 'javascript'],
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
        author: 'test',
        tags: ['code-review']
      }
    };

    securityScanner = {
      agent_id: 'opencode://security-auditor',
      framework: 'opencode',
      capabilities: {
        optimal_tasks: ['security_analysis'],
        tools: ['security_scanner'],
        input_types: ['source_code'],
        output_types: ['security_report'],
        languages: ['typescript', 'javascript'],
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
        author: 'test',
        tags: ['security']
      }
    };

    performanceProfiler = {
      agent_id: 'opencode://performance-pro',
      framework: 'opencode',
      capabilities: {
        optimal_tasks: ['performance_analysis'],
        tools: ['profiler', 'benchmarker'],
        input_types: ['source_code'],
        output_types: ['performance_report'],
        languages: ['typescript', 'javascript'],
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
        author: 'test',
        tags: ['performance']
      }
    };

    nli.registerAgent(codeReviewer);
    nli.registerAgent(securityScanner);
    nli.registerAgent(performanceProfiler);
  });

  describe('Code Review Variations', () => {
    test('formal code review request', () => {
      const intent = nli.parseIntent('Please review src/auth.ts for code quality issues');
      expect(intent.taskType).toBe('code_review');
      expect(intent.targetFiles).toContain('src/auth.ts');
      expect(intent.confidence).toBeGreaterThanOrEqual(0.6);
    });

    test('casual code review request', () => {
      const intent = nli.parseIntent('Can you look at lib/utils.ts and check if there are any bugs?');
      expect(intent.taskType).toBe('code_review');
      expect(intent.targetFiles).toContain('lib/utils.ts');
    });

    test('multiple files code review', () => {
      const intent = nli.parseIntent('Review src/api.ts and src/database.ts for maintainability');
      expect(intent.taskType).toBe('code_review');
      expect(intent.targetFiles).toContain('src/api.ts');
      expect(intent.targetFiles).toContain('src/database.ts');
      expect(intent.requirements).toContain('maintainability');
    });

    test('urgent code review with priority', () => {
      const intent = nli.parseIntent('URGENT: Review src/payment.ts immediately');
      expect(intent.taskType).toBe('code_review');
      expect(intent.priority).toBe('critical');
    });

    test('quoted path code review', () => {
      const intent = nli.parseIntent('Review "src/components/Header.tsx" for accessibility');
      expect(intent.taskType).toBe('code_review');
      expect(intent.targetFiles).toContain('src/components/Header.tsx');
    });

    test('wildcard-style request', () => {
      const intent = nli.parseIntent('Review all authentication code for bugs');
      expect(intent.taskType).toBe('code_review');
      // No specific files extracted, but requirements should include context
    });
  });

  describe('Performance Analysis Variations', () => {
    test('database query optimization request', () => {
      const intent = nli.parseIntent('Optimize database queries in lib/query.ts');
      expect(intent.taskType).toBe('performance_analysis');
      expect(intent.targetFiles).toContain('lib/query.ts');
    });

    test('API endpoint profiling', () => {
      const intent = nli.parseIntent('Analyze performance of API endpoints in src/api/ for bottlenecks');
      expect(intent.taskType).toBe('performance_analysis'); // 'performance' pattern
    });

    test('memory leak detection', () => {
      const intent = nli.parseIntent('Find and fix memory leaks in src/cache-manager.ts');
      expect(intent.taskType).toBe('debugging'); // 'find' + 'fix' patterns
    });

    test('speed optimization request', () => {
      const intent = nli.parseIntent('Make src/renderer.ts faster');
      expect(intent.taskType).toBe('performance_analysis');
    });

    test('throughput analysis', () => {
      const intent = nli.parseIntent('Check performance and throughput of src/worker.ts');
      expect(intent.taskType).toBe('performance_analysis'); // 'performance' + 'throughput' patterns
    });
  });

  describe('Security Analysis Variations', () => {
    test('security vulnerability scan', () => {
      const intent = nli.parseIntent('Scan src/api.ts for security vulnerabilities');
      expect(intent.taskType).toBe('security_analysis');
      expect(intent.targetFiles).toContain('src/api.ts');
      expect(intent.requirements).toContain('security');
    });

    test('SQL injection check', () => {
      const intent = nli.parseIntent('Scan lib/database.ts for SQL injection security vulnerabilities');
      expect(intent.taskType).toBe('security_analysis'); // 'security' + 'vulnerabilities' patterns
    });

    test('authentication audit', () => {
      const intent = nli.parseIntent('Audit authentication in src/auth/ for security flaws');
      expect(intent.taskType).toBe('security_analysis');
    });

    test('critical security issue', () => {
      const intent = nli.parseIntent('CRITICAL: Debug and fix security flaw in src/payment.ts');
      expect(intent.taskType).toBe('debugging'); // 'debug' + 'fix' patterns
      expect(intent.priority).toBe('critical');
    });

    test('vulnerability assessment', () => {
      const intent = nli.parseIntent('Assess src/upload.ts for vulnerabilities');
      expect(intent.taskType).toBe('security_analysis');
    });
  });

  describe('Complex Multi-Task Scenarios', () => {
    test('review with security focus', () => {
      const intent = nli.parseIntent('Review src/auth.ts with focus on security and performance');
      expect(intent.taskType).toBe('code_review'); // 'review' is primary pattern
      expect(intent.requirements).toContain('security');
      expect(intent.requirements).toContain('performance');
    });

    test('debug and test request', () => {
      const intent = nli.parseIntent('Debug src/api.ts and add tests');
      expect(['debugging', 'testing']).toContain(intent.taskType);
    });

    test('refactor for performance', () => {
      const intent = nli.parseIntent('Refactor and restructure src/utils.ts to improve performance');
      expect(intent.taskType).toBe('refactoring'); // 'refactor' + 'restructure' patterns
      expect(intent.requirements).toContain('performance');
    });

    test('implement with documentation', () => {
      const intent = nli.parseIntent('Implement new feature in src/feature.ts and document it');
      expect(['implementation', 'documentation']).toContain(intent.taskType);
    });
  });

  describe('Agent Selection Accuracy', () => {
    test('should select code reviewer for review task', () => {
      const intent = nli.parseIntent('Review src/auth.ts for bugs');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message).not.toBeNull();
      expect(message?.recipient.agent_id).toBe('opencode://code-reviewer');
    });

    test('should select security scanner for security task', () => {
      const intent = nli.parseIntent('Scan src/api.ts for vulnerabilities');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message).not.toBeNull();
      expect(message?.recipient.agent_id).toBe('opencode://security-auditor');
    });

    test('should select performance profiler for optimization task', () => {
      const intent = nli.parseIntent('Optimize src/query.ts performance');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message).not.toBeNull();
      expect(message?.recipient.agent_id).toBe('opencode://performance-pro');
    });

    test('should include files in message payload', () => {
      const intent = nli.parseIntent('Review src/auth.ts and src/api.ts');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message?.payload.files).toBeDefined();
      expect(message?.payload.files).toContain('src/auth.ts');
      expect(message?.payload.files).toContain('src/api.ts');
    });

    test('should include requirements in message payload', () => {
      const intent = nli.parseIntent('Review src/auth.ts for security and performance');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message?.payload.requirements).toContain('security');
      expect(message?.payload.requirements).toContain('performance');
    });

    test('should set correct priority in message', () => {
      const intent = nli.parseIntent('URGENT: Review src/payment.ts');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message?.priority).toBe('critical');
    });
  });

  describe('Confidence Scoring', () => {
    test('high confidence for clear task with files', () => {
      const intent = nli.parseIntent('Review src/auth.ts for security issues');
      expect(intent.confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('medium confidence for task without files', () => {
      const intent = nli.parseIntent('Review the authentication code');
      expect(intent.confidence).toBeGreaterThan(0.3); // Without files, confidence is lower
      expect(intent.confidence).toBeLessThan(0.9);
    });

    test('low confidence for ambiguous input', () => {
      const intent = nli.parseIntent('Do something with the code');
      expect(intent.confidence).toBeLessThan(0.6);
    });

    test('confidence increases with requirements', () => {
      const intent1 = nli.parseIntent('Review src/auth.ts');
      const intent2 = nli.parseIntent('Review src/auth.ts for security and performance');

      expect(intent2.confidence).toBeGreaterThan(intent1.confidence);
    });
  });

  describe('Context Extraction', () => {
    test('should extract language context (typescript)', () => {
      const intent = nli.parseIntent('Review the typescript code in src/auth.ts');
      expect(intent.context?.language).toBe('typescript');
    });

    test('should extract language context (python)', () => {
      const intent = nli.parseIntent('Optimize the python script for performance');
      expect(intent.context?.language).toBe('python');
    });

    test('should extract project area (backend)', () => {
      const intent = nli.parseIntent('Review the backend API code');
      expect(intent.context?.project_area).toBe('backend');
    });

    test('should extract project area (frontend)', () => {
      const intent = nli.parseIntent('Check the frontend UI components');
      expect(intent.context?.project_area).toBe('frontend');
    });
  });

  describe('End-to-End Workflow', () => {
    test('should process complete workflow: parse → select → build message', () => {
      const input = 'Review src/auth.ts for code quality and bugs';
      const sender = { agent_id: 'claude-code://coordinator', framework: 'claude-code' };

      // Step 1: Parse intent
      const intent = nli.parseIntent(input);
      expect(intent.taskType).toBe('code_review'); // 'review' + 'code' patterns
      expect(intent.confidence).toBeGreaterThanOrEqual(0.6);

      // Step 2: Build message
      const message = nli.buildMessage(intent, sender);
      expect(message).not.toBeNull();
      expect(message?.message_type).toBe('task_request');
      expect(message?.payload.task_type).toBe('code_review');

      // Step 3: Verify message structure
      expect(message?.sender.agent_id).toBe('claude-code://coordinator');
      expect(message?.recipient.agent_id).toBe('opencode://code-reviewer');
      expect(message?.routing.timeout).toBe('300s');
      expect(message?.metadata?.natural_language).toBe(true);
    });

    test('should handle low confidence with null message', async () => {
      const result = await nli.processRequest(
        'abcdefg random nonsense',
        { agent_id: 'test', framework: 'test' }
      );

      expect(result.intent.confidence).toBeLessThan(0.6);
      expect(result.message).toBeNull();
    });

    test('should include session ID when provided', () => {
      const intent = nli.parseIntent('Review src/auth.ts');
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender, 'session-123');

      expect(message?.sender.session_id).toBe('session-123');
    });
  });
});
