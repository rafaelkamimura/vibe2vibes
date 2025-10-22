import { IntegrationTestRunner } from './integration-test-framework';
import { MockDataGenerator } from '../utils/mock-generators';

describe('Adapter Integration Tests', () => {
  let testRunner: IntegrationTestRunner;

  beforeEach(() => {
    testRunner = new IntegrationTestRunner();
  });

  afterEach(async () => {
    await testRunner.cleanupAll();
  });

  describe('Claude Code Adapter Integration', () => {
    it('should handle Claude Code agent registration and messaging', async () => {
      const scenario = createTestScenario('claude_code_integration', 'Claude Code adapter workflow', {
        setupAgents: ['claude-code', 'opencode'],
        workflow: [
          { agent: 'claude-code', action: 'connect' },
          { agent: 'opencode', action: 'connect' },
          {
            agent: 'claude-code',
            action: 'send_message',
            message: {
              message_type: 'task_request' as const,
              priority: 'high' as const,
              payload: { task_type: 'code_review', files: ['test.ts'] }
            }
          },
          { agent: 'opencode', action: 'wait_for_response' }
        ],
        expectedMessages: { task_request: 1 }
      });

      testRunner.addScenario(scenario);
      await testRunner.runScenario('claude_code_integration');
    });

    it('should handle Claude Code error scenarios', async () => {
      const env = await testRunner.createEnvironment('claude_error_test');
      
      try {
        // Register Claude Code agent
        const claudeAgent = await testRunner.registerAgent(env, 'claude-code');
        await testRunner.connectAgent(env, claudeAgent.agent_id);

        // Send malformed message
        const malformedMessage = {
          message_id: 'test-id',
          sender: { agent_id: claudeAgent.agent_id, framework: 'claude-code' },
          recipient: { agent_id: 'opencode', framework: 'opencode' },
          message_type: 'invalid_type' as any,
          priority: 'medium' as const,
          payload: null,
          routing: MockDataGenerator.createMessageRouting()
        };

        const result = await testRunner.sendMessage(env, malformedMessage as any);
        expect(result).toBe(false);

        // Verify error handling
        const metrics = env.communicationBus.getMetrics();
        expect(metrics.error_rate).toBeGreaterThan(0);
      } finally {
        await testRunner.cleanupEnvironment('claude_error_test');
      }
    });
  });

  describe('OpenCode Adapter Integration', () => {
    it('should handle OpenCode agent task execution', async () => {
      const env = await testRunner.createEnvironment('opencode_task_test');
      
      try {
        const opencodeAgent = await testRunner.registerAgent(env, 'opencode');
        const claudeAgent = await testRunner.registerAgent(env, 'claude-code');

        await testRunner.connectAgent(env, opencodeAgent.agent_id);
        await testRunner.connectAgent(env, claudeAgent.agent_id);

        // Send development task
        const devTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: claudeAgent.agent_id, framework: claudeAgent.framework },
          recipient: { agent_id: opencodeAgent.agent_id, framework: opencodeAgent.framework },
          payload: {
            task_type: 'development',
            requirements: ['typescript', 'testing'],
            files: ['src/component.ts']
          }
        });

        const result = await testRunner.sendMessage(env, devTask);
        expect(result).toBe(true);

        // Simulate task response
        const taskResponse = MockDataGenerator.createTaskResponseMessage({
          sender: { agent_id: opencodeAgent.agent_id, framework: opencodeAgent.framework },
          recipient: { agent_id: claudeAgent.agent_id, framework: claudeAgent.framework },
          payload: {
            result: 'Development completed',
            output: { files_modified: ['src/component.ts'], tests_added: 5 }
          }
        });

        await testRunner.sendMessage(env, taskResponse);
        expect(env.messageTracker.getMessagesByType('task_response')).toHaveLength(1);
      } finally {
        await testRunner.cleanupEnvironment('opencode_task_test');
      }
    });
  });

  describe('Codex CLI Adapter Integration', () => {
    it('should handle Codex CLI infrastructure tasks', async () => {
      const env = await testRunner.createEnvironment('codex_infra_test');
      
      try {
        const codexAgent = await testRunner.registerAgent(env, 'codex-cli');
        const opencodeAgent = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, codexAgent.agent_id);
        await testRunner.connectAgent(env, opencodeAgent.agent_id);

        // Send infrastructure task
        const infraTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: opencodeAgent.agent_id, framework: opencodeAgent.framework },
          recipient: { agent_id: codexAgent.agent_id, framework: codexAgent.framework },
          payload: {
            task_type: 'infrastructure_setup',
            requirements: ['docker', 'kubernetes'],
            environment: 'staging'
          }
        });

        const result = await testRunner.sendMessage(env, infraTask);
        expect(result).toBe(true);

        // Verify task tracking
        const metrics = env.communicationBus.getMetrics();
        expect(metrics.total_messages).toBeGreaterThan(0);
      } finally {
        await testRunner.cleanupEnvironment('codex_infra_test');
      }
    });
  });

  describe('Cross-Adapter Communication', () => {
    it('should handle message flow between different adapters', async () => {
      const env = await testRunner.createEnvironment('cross_adapter_test');
      
      try {
        // Register all three adapter types
        const claudeAgent = await testRunner.registerAgent(env, 'claude-code');
        const opencodeAgent = await testRunner.registerAgent(env, 'opencode');
        const codexAgent = await testRunner.registerAgent(env, 'codex-cli');

        // Connect all agents
        await testRunner.connectAgent(env, claudeAgent.agent_id);
        await testRunner.connectAgent(env, opencodeAgent.agent_id);
        await testRunner.connectAgent(env, codexAgent.agent_id);

        // Simulate workflow: Claude -> OpenCode -> Codex
        const analysisTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: claudeAgent.agent_id, framework: claudeAgent.framework },
          recipient: { agent_id: opencodeAgent.agent_id, framework: opencodeAgent.framework },
          payload: {
            task_type: 'analysis',
            target: 'codebase',
            requirements: ['security', 'performance']
          }
        });

        await testRunner.sendMessage(env, analysisTask);

        // OpenCode delegates to Codex for infrastructure analysis
        const infraDelegation = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: opencodeAgent.agent_id, framework: opencodeAgent.framework },
          recipient: { agent_id: codexAgent.agent_id, framework: codexAgent.framework },
          payload: {
            task_type: 'infrastructure_analysis',
            focus: 'deployment_readiness'
          }
        });

        await testRunner.sendMessage(env, infraDelegation);

        // Verify message flow
        const allMessages = env.messageTracker.getMessagesByType('task_request');
        expect(allMessages).toHaveLength(2);
        
        const senders = allMessages.map(msg => msg.sender.agent_id);
        expect(senders).toContain(claudeAgent.agent_id);
        expect(senders).toContain(opencodeAgent.agent_id);
      } finally {
        await testRunner.cleanupEnvironment('cross_adapter_test');
      }
    });

    it('should handle adapter-specific message formats', async () => {
      const env = await testRunner.createEnvironment('adapter_formats_test');
      
      try {
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'claude-code'),
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        // Connect all agents
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Send adapter-specific messages
        const claudeMessage = MockDataGenerator.createAgentMessage({
          sender: { agent_id: agents[0].agent_id, framework: agents[0].framework },
          recipient: { agent_id: agents[1].agent_id, framework: agents[1].framework },
          message_type: 'task_request',
          payload: {
            task_type: 'code_review',
            claude_specific: {
              reasoning_style: 'analytical',
              detail_level: 'comprehensive'
            }
          }
        });

        const opencodeMessage = MockDataGenerator.createAgentMessage({
          sender: { agent_id: agents[1].agent_id, framework: agents[1].framework },
          recipient: { agent_id: agents[2].agent_id, framework: agents[2].framework },
          message_type: 'task_request',
          payload: {
            task_type: 'deployment',
            opencode_specific: {
              build_tool: 'npm',
              target_env: 'production'
            }
          }
        });

        await testRunner.sendMessage(env, claudeMessage);
        await testRunner.sendMessage(env, opencodeMessage);

        // Verify all messages were delivered
        expect(env.messageTracker.getMessageCount()).toBe(2);
      } finally {
        await testRunner.cleanupEnvironment('adapter_formats_test');
      }
    });
  });

  describe('Adapter Error Handling', () => {
    it('should handle adapter disconnection gracefully', async () => {
      const env = await testRunner.createEnvironment('adapter_disconnection_test');
      
      try {
        const agent1 = await testRunner.registerAgent(env, 'claude-code');
        const agent2 = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, agent1.agent_id);
        const ws2 = await testRunner.connectAgent(env, agent2.agent_id);

        // Send message
        const message = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: agent1.agent_id, framework: agent1.framework },
          recipient: { agent_id: agent2.agent_id, framework: agent2.framework }
        });

        await testRunner.sendMessage(env, message);

        // Disconnect agent2
        ws2.close();

        // Try to send another message (should be queued)
        const followUpMessage = MockDataGenerator.createStatusUpdateMessage({
          sender: { agent_id: agent1.agent_id, framework: agent1.framework },
          recipient: { agent_id: agent2.agent_id, framework: agent2.framework }
        });

        const result = await testRunner.sendMessage(env, followUpMessage);
        expect(result).toBe(true); // Should be queued for later delivery

        // Verify message was tracked
        expect(env.messageTracker.getMessageCount()).toBe(2);
      } finally {
        await testRunner.cleanupEnvironment('adapter_disconnection_test');
      }
    });

    it('should handle adapter timeout scenarios', async () => {
      const env = await testRunner.createEnvironment('adapter_timeout_test');
      
      try {
        const agent1 = await testRunner.registerAgent(env, 'claude-code');
        const agent2 = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, agent1.agent_id);
        await testRunner.connectAgent(env, agent2.agent_id);

        // Send message with short timeout
        const timeoutMessage = MockDataGenerator.createAgentMessage({
          sender: { agent_id: agent1.agent_id, framework: agent1.framework },
          recipient: { agent_id: agent2.agent_id, framework: agent2.framework },
          message_type: 'task_request',
          routing: MockDataGenerator.createMessageRouting({
            timeout: '1ms' // Very short timeout
          })
        });

        const result = await testRunner.sendMessage(env, timeoutMessage);
        expect(result).toBe(true);

        // Wait for timeout to potentially occur
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify system stability
        const metrics = env.communicationBus.getMetrics();
        expect(metrics.registered_agents).toBe(2);
      } finally {
        await testRunner.cleanupEnvironment('adapter_timeout_test');
      }
    });
  });
});