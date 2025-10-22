import { NaturalLanguageInterface, ParsedIntent } from '../../src/interfaces/natural-language';
import { MockDataGenerator } from '../utils/mock-generators';
import { AgentDescriptor } from '../../src/types/protocol';

describe('NaturalLanguageInterface', () => {
  let nli: NaturalLanguageInterface;
  let mockAgent: AgentDescriptor;

  beforeEach(() => {
    nli = new NaturalLanguageInterface();

    mockAgent = MockDataGenerator.createAgentDescriptor({
      agent_id: 'test-agent-001',
      framework: 'test',
      capabilities: {
        ...MockDataGenerator.createAgentCapability(),
        optimal_tasks: ['code_review', 'security_analysis'],
        tools: ['eslint', 'security-scanner', 'prettier']
      }
    });

    nli.registerAgent(mockAgent);
  });

  describe('parseIntent', () => {
    it('should parse code review intent', () => {
      const input = 'Please review the code in src/auth.ts';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('code_review');
      expect(intent.targetFiles).toContain('src/auth.ts');
      expect(intent.confidence).toBeGreaterThan(0.6);
    });

    it('should parse security analysis intent', () => {
      const input = 'Check src/api.ts for security vulnerabilities';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('security_analysis');
      expect(intent.targetFiles).toContain('src/api.ts');
      expect(intent.requirements).toContain('security');
    });

    it('should parse performance analysis intent', () => {
      const input = 'Optimize the performance of lib/query.ts';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('performance_analysis');
      expect(intent.targetFiles).toContain('lib/query.ts');
      expect(intent.requirements).toContain('performance');
    });

    it('should detect critical priority', () => {
      const input = 'URGENT: Review src/payment.ts for security issues';
      const intent = nli.parseIntent(input);

      expect(intent.priority).toBe('critical');
    });

    it('should detect high priority', () => {
      const input = 'Important: Review src/core.ts soon';
      const intent = nli.parseIntent(input);

      expect(intent.priority).toBe('high');
    });

    it('should detect low priority', () => {
      const input = 'When you have time, review src/utils.ts';
      const intent = nli.parseIntent(input);

      expect(intent.priority).toBe('low');
    });

    it('should extract multiple files', () => {
      const input = 'Review src/auth.ts and lib/validation.ts for security';
      const intent = nli.parseIntent(input);

      expect(intent.targetFiles).toHaveLength(2);
      expect(intent.targetFiles).toContain('src/auth.ts');
      expect(intent.targetFiles).toContain('lib/validation.ts');
    });

    it('should extract requirements', () => {
      const input = 'Review for security, performance, and maintainability';
      const intent = nli.parseIntent(input);

      expect(intent.requirements).toContain('security');
      expect(intent.requirements).toContain('performance');
      expect(intent.requirements).toContain('maintainability');
    });

    it('should extract language context', () => {
      const input = 'Review the TypeScript code in src/app.ts';
      const intent = nli.parseIntent(input);

      expect(intent.context).toBeDefined();
      expect(intent.context?.language).toBe('typescript');
    });

    it('should extract project area context', () => {
      const input = 'Review the backend API code';
      const intent = nli.parseIntent(input);

      expect(intent.context).toBeDefined();
      expect(intent.context?.project_area).toBe('backend');
    });

    it('should handle testing task type', () => {
      const input = 'Write unit tests for src/calculator.ts';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('testing');
    });

    it('should handle documentation task type', () => {
      const input = 'Add documentation to src/api.ts';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('documentation');
    });

    it('should handle debugging task type', () => {
      const input = 'Debug the error in src/payment.ts';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('debugging');
    });

    it('should handle implementation task type', () => {
      const input = 'Implement a new authentication feature';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('implementation');
    });

    it('should handle unknown task type', () => {
      const input = 'Do something random';
      const intent = nli.parseIntent(input);

      expect(intent.taskType).toBe('unknown');
      expect(intent.confidence).toBeLessThan(0.6);
    });

    it('should calculate higher confidence with more information', () => {
      const intent1 = nli.parseIntent('Review');
      const intent2 = nli.parseIntent('Review src/auth.ts');
      const intent3 = nli.parseIntent('Review src/auth.ts for security');

      expect(intent2.confidence).toBeGreaterThan(intent1.confidence);
      expect(intent3.confidence).toBeGreaterThan(intent2.confidence);
    });
  });

  describe('buildMessage', () => {
    it('should build valid AgentMessage from intent', () => {
      const intent: ParsedIntent = {
        taskType: 'code_review',
        targetFiles: ['src/test.ts'],
        requirements: ['security'],
        priority: 'high',
        confidence: 0.9
      };

      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const message = nli.buildMessage(intent, sender);

      expect(message).toBeDefined();
      expect(message!.message_type).toBe('task_request');
      expect(message!.priority).toBe('high');
      expect(message!.payload.task_type).toBe('code_review');
      expect(message!.payload.files).toContain('src/test.ts');
      expect(message!.payload.requirements).toContain('security');
      expect(message!.metadata?.natural_language).toBe(true);
      expect(message!.metadata?.confidence).toBe(0.9);
    });

    it('should include session_id when provided', () => {
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const sessionId = 'session-123';
      const message = nli.buildMessage(intent, sender, sessionId);

      expect(message!.sender.session_id).toBe(sessionId);
    });

    it('should return null when no suitable agent found', () => {
      const nli2 = new NaturalLanguageInterface();
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const message = nli2.buildMessage(intent, sender);

      expect(message).toBeNull();
    });

    it('should use default priority when not specified', () => {
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const message = nli.buildMessage(intent, sender);

      expect(message!.priority).toBe('medium');
    });

    it('should include routing configuration', () => {
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const message = nli.buildMessage(intent, sender);

      expect(message!.routing).toBeDefined();
      expect(message!.routing.timeout).toBe('300s');
      expect(message!.routing.retry_policy.max_retries).toBe(3);
      expect(message!.routing.retry_policy.backoff).toBe('exponential');
      expect(message!.routing.delivery_mode).toBe('async');
    });

    it('should generate unique message IDs', () => {
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const message1 = nli.buildMessage(intent, sender);
      const message2 = nli.buildMessage(intent, sender);

      expect(message1!.message_id).not.toBe(message2!.message_id);
    });
  });

  describe('formatResponse', () => {
    it('should format simple string response', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          result: 'Code review completed successfully'
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.summary).toBe('Code review completed successfully');
    });

    it('should extract issues from response', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          result: 'Review complete',
          issues: [
            {
              severity: 'high',
              description: 'SQL injection vulnerability',
              location: 'src/db.ts:45',
              suggestion: 'Use parameterized queries'
            }
          ]
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.issues).toHaveLength(1);
      expect(formatted.issues![0].severity).toBe('high');
      expect(formatted.issues![0].description).toBe('SQL injection vulnerability');
      expect(formatted.issues![0].location).toBe('src/db.ts:45');
      expect(formatted.issues![0].suggestion).toBe('Use parameterized queries');
    });

    it('should extract recommendations from response', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          result: 'Analysis complete',
          recommendations: [
            'Add input validation',
            'Implement rate limiting',
            'Use HTTPS'
          ]
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.recommendations).toHaveLength(3);
      expect(formatted.recommendations).toContain('Add input validation');
      expect(formatted.recommendations).toContain('Implement rate limiting');
      expect(formatted.recommendations).toContain('Use HTTPS');
    });

    it('should extract details from response', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          result: 'Review complete',
          details: 'Found 5 issues in authentication module'
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.details).toBe('Found 5 issues in authentication module');
    });

    it('should include metadata in formatted response', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        sender: { agent_id: 'test-agent', framework: 'test' },
        payload: {
          result: 'Complete',
          completion_time: '2.5s',
          confidence: 0.95
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.metadata).toBeDefined();
      expect(formatted.metadata!.agent_id).toBe('test-agent');
      expect(formatted.metadata!.completion_time).toBe('2.5s');
      expect(formatted.metadata!.confidence).toBe(0.95);
    });

    it('should handle payload with summary field', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          summary: 'Security analysis passed',
          result: { detailed: 'data' }
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.summary).toBe('Security analysis passed');
    });

    it('should handle payload with message field', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          message: 'All tests passed',
          result: { test_count: 42 }
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.summary).toBe('All tests passed');
    });

    it('should handle suggestions as recommendations', () => {
      const message = MockDataGenerator.createTaskResponseMessage({
        payload: {
          result: 'Analysis complete',
          suggestions: ['Improve error handling', 'Add logging']
        }
      });

      const formatted = nli.formatResponse(message);

      expect(formatted.recommendations).toHaveLength(2);
      expect(formatted.recommendations).toContain('Improve error handling');
      expect(formatted.recommendations).toContain('Add logging');
    });
  });

  describe('processRequest', () => {
    it('should process valid natural language request', async () => {
      const input = 'Review src/auth.ts for security issues';
      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };

      const result = await nli.processRequest(input, sender);

      expect(result.intent).toBeDefined();
      expect(result.intent.taskType).toBe('code_review');
      expect(result.message).toBeDefined();
      expect(result.message!.payload.task_type).toBe('code_review');
    });

    it('should return null message for low confidence intent', async () => {
      const nli2 = new NaturalLanguageInterface({ confidenceThreshold: 0.9 });
      const input = 'Do something';
      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };

      const result = await nli2.processRequest(input, sender);

      expect(result.intent).toBeDefined();
      expect(result.message).toBeNull();
    });

    it('should include session ID in processed request', async () => {
      const input = 'Review src/test.ts';
      const sender = { agent_id: 'claude-code-001', framework: 'claude-code' };
      const sessionId = 'session-456';

      const result = await nli.processRequest(input, sender, sessionId);

      expect(result.message!.sender.session_id).toBe(sessionId);
    });
  });

  describe('Agent Registration', () => {
    it('should register agent successfully', () => {
      const nli2 = new NaturalLanguageInterface();
      const agent = MockDataGenerator.createAgentDescriptor();

      nli2.registerAgent(agent);

      // Verify by building a message
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli2.buildMessage(intent, sender);

      expect(message).toBeDefined();
    });

    it('should unregister agent successfully', () => {
      const nli2 = new NaturalLanguageInterface();
      const agent = MockDataGenerator.createAgentDescriptor();

      nli2.registerAgent(agent);
      nli2.unregisterAgent(agent.agent_id);

      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };
      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli2.buildMessage(intent, sender);

      expect(message).toBeNull();
    });
  });

  describe('Agent Selection', () => {
    it('should select agent with matching optimal_tasks', () => {
      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message!.recipient.agent_id).toBe(mockAgent.agent_id);
    });

    it('should select best agent based on requirements', () => {
      const agent2 = MockDataGenerator.createAgentDescriptor({
        agent_id: 'security-specialist',
        capabilities: {
          ...MockDataGenerator.createAgentCapability(),
          optimal_tasks: ['security_analysis'],
          tools: ['security-scanner', 'vulnerability-checker', 'pen-test']
        }
      });

      nli.registerAgent(agent2);

      const intent: ParsedIntent = {
        taskType: 'security_analysis',
        requirements: ['security'],
        confidence: 0.9
      };

      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message!.recipient.agent_id).toBe('security-specialist');
    });

    it('should prefer agents with higher success rates', () => {
      const agent2 = MockDataGenerator.createAgentDescriptor({
        agent_id: 'high-performance-agent',
        capabilities: {
          ...MockDataGenerator.createAgentCapability(),
          optimal_tasks: ['code_review'],
          performance_profile: {
            avg_response_time: '100ms',
            success_rate: 0.99,
            concurrent_capacity: 5
          }
        }
      });

      nli.registerAgent(agent2);

      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli.buildMessage(intent, sender);

      expect(message!.recipient.agent_id).toBe('high-performance-agent');
    });
  });

  describe('Configuration', () => {
    it('should use custom default priority', () => {
      const nli2 = new NaturalLanguageInterface({ defaultPriority: 'high' });
      nli2.registerAgent(mockAgent);

      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli2.buildMessage(intent, sender);

      expect(message!.priority).toBe('high');
    });

    it('should use custom confidence threshold', async () => {
      const nli2 = new NaturalLanguageInterface({ confidenceThreshold: 0.5 });
      nli2.registerAgent(mockAgent);

      const input = 'Review'; // Low confidence
      const sender = { agent_id: 'test', framework: 'test' };

      const result = await nli2.processRequest(input, sender);

      expect(result.message).toBeDefined();
    });

    it('should use custom timeout', () => {
      const nli2 = new NaturalLanguageInterface({ defaultTimeout: '600s' });
      nli2.registerAgent(mockAgent);

      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli2.buildMessage(intent, sender);

      expect(message!.routing.timeout).toBe('600s');
    });

    it('should use custom retry policy', () => {
      const nli2 = new NaturalLanguageInterface({
        defaultRetryPolicy: { max_retries: 5, backoff: 'linear' }
      });
      nli2.registerAgent(mockAgent);

      const intent: ParsedIntent = {
        taskType: 'code_review',
        confidence: 0.8
      };

      const sender = { agent_id: 'test', framework: 'test' };
      const message = nli2.buildMessage(intent, sender);

      expect(message!.routing.retry_policy.max_retries).toBe(5);
      expect(message!.routing.retry_policy.backoff).toBe('linear');
    });
  });
});
