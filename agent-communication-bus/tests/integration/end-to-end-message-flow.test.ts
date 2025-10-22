import { IntegrationTestRunner, createTestScenario } from './integration-test-framework';
import { MockDataGenerator } from '../utils/mock-generators';

describe('End-to-End Message Flow Tests', () => {
  let testRunner: IntegrationTestRunner;

  beforeEach(() => {
    testRunner = new IntegrationTestRunner();
  });

  afterEach(async () => {
    await testRunner.cleanupAll();
  });

  describe('Basic Message Flow', () => {
    it('should handle complete request-response cycle', async () => {
      const scenario = createTestScenario('request_response_cycle', 'Complete request-response workflow', {
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
              payload: { task_type: 'code_review', files: ['app.ts'] }
            }
          },
          {
            agent: 'opencode',
            action: 'send_message',
            message: {
              message_type: 'task_response' as const,
              priority: 'medium' as const,
              payload: { result: 'Review completed', issues_found: 3 }
            }
          }
        ],
        expectedMessages: { task_request: 1, task_response: 1 }
      });

      testRunner.addScenario(scenario);
      await testRunner.runScenario('request_response_cycle');
    });

    it('should handle message broadcasting to multiple agents', async () => {
      const env = await testRunner.createEnvironment('broadcast_test');
      
      try {
        // Register multiple agents
        const orchestrator = await testRunner.registerAgent(env, 'orchestrator');
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'implementer'),
          testRunner.registerAgent(env, 'reviewer'),
          testRunner.registerAgent(env, 'tester')
        ]);

        // Connect all agents
        await testRunner.connectAgent(env, orchestrator.agent_id);
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Broadcast message
        const recipientIds = agents.map(a => a.agent_id);
        const broadcastResult = await env.communicationBus.broadcastMessage(
          orchestrator.agent_id,
          recipientIds,
          {
            sender: {
              agent_id: orchestrator.agent_id,
              framework: orchestrator.framework
            },
            routing: {
              timeout: '30s',
              retry_policy: {
                max_retries: 3,
                backoff: 'exponential' as const
              },
              delivery_mode: 'async'
            },
            message_type: 'status_update' as const,
            priority: 'medium' as const,
            payload: { status: 'project_ready', phase: 'testing' }
          }
        );

        expect(broadcastResult.successful).toHaveLength(3);
        expect(broadcastResult.failed).toHaveLength(0);

        // Verify all agents received the message
        const statusUpdates = env.messageTracker.getMessagesByType('status_update');
        expect(statusUpdates).toHaveLength(3);
      } finally {
        await testRunner.cleanupEnvironment('broadcast_test');
      }
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle multi-step development workflow', async () => {
      const env = await testRunner.createEnvironment('dev_workflow_test');
      
      try {
        // Register workflow participants
        const architect = await testRunner.registerAgent(env, 'claude-code');
        const developer = await testRunner.registerAgent(env, 'opencode');
        const tester = await testRunner.registerAgent(env, 'codex-cli');

        // Connect all agents
        await testRunner.connectAgent(env, architect.agent_id);
        await testRunner.connectAgent(env, developer.agent_id);
        await testRunner.connectAgent(env, tester.agent_id);

        // Step 1: Architecture design
        const designTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: architect.agent_id, framework: architect.framework },
          recipient: { agent_id: developer.agent_id, framework: developer.framework },
          payload: {
            task_type: 'architecture_design',
            requirements: ['scalability', 'security'],
            constraints: ['budget', 'timeline']
          }
        });

        await testRunner.sendMessage(env, designTask);

        // Step 2: Development
        const devTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: developer.agent_id, framework: developer.framework },
          recipient: { agent_id: developer.agent_id, framework: developer.framework },
          payload: {
            task_type: 'development',
            design: designTask.payload,
            implementation: 'typescript'
          }
        });

        await testRunner.sendMessage(env, devTask);

        // Step 3: Testing
        const testTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: developer.agent_id, framework: developer.framework },
          recipient: { agent_id: tester.agent_id, framework: tester.framework },
          payload: {
            task_type: 'testing',
            code: devTask.payload,
            test_types: ['unit', 'integration', 'e2e']
          }
        });

        await testRunner.sendMessage(env, testTask);

        // Verify workflow progression
        const taskRequests = env.messageTracker.getMessagesByType('task_request');
        expect(taskRequests).toHaveLength(3);

        const taskTypes = taskRequests.map(msg => msg.payload.task_type);
        expect(taskTypes).toContain('architecture_design');
        expect(taskTypes).toContain('development');
        expect(taskTypes).toContain('testing');
      } finally {
        await testRunner.cleanupEnvironment('dev_workflow_test');
      }
    });

    it('should handle parallel task execution', async () => {
      const env = await testRunner.createEnvironment('parallel_execution_test');
      
      try {
        const coordinator = await testRunner.registerAgent(env, 'claude-code');
        const workers = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli'),
          testRunner.registerAgent(env, 'opencode')
        ]);

        // Connect all agents
        await testRunner.connectAgent(env, coordinator.agent_id);
        for (const worker of workers) {
          await testRunner.connectAgent(env, worker.agent_id);
        }

        // Dispatch parallel tasks
        const parallelTasks = workers.map((worker, index) => 
          MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: coordinator.agent_id, framework: coordinator.framework },
            recipient: { agent_id: worker.agent_id, framework: worker.framework },
            payload: {
              task_type: 'parallel_analysis',
              component: `module_${index}`,
              analysis_type: 'security'
            },
            metadata: { parallel_group: 'security_analysis', task_index: index }
          })
        );

        // Send all tasks in parallel
        const results = await Promise.all(
          parallelTasks.map(task => testRunner.sendMessage(env, task))
        );

        expect(results.every(result => result === true)).toBe(true);

        // Verify parallel execution tracking
        const securityTasks = env.messageTracker.getMessagesByType('task_request');
        expect(securityTasks).toHaveLength(3);

        const parallelGroups = securityTasks.map(msg => msg.metadata?.parallel_group);
        expect(parallelGroups.every(group => group === 'security_analysis')).toBe(true);
      } finally {
        await testRunner.cleanupEnvironment('parallel_execution_test');
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle message delivery failures with retry', async () => {
      const env = await testRunner.createEnvironment('retry_test');
      
      try {
        const sender = await testRunner.registerAgent(env, 'claude-code');
        const receiver = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, sender.agent_id);
        // Don't connect receiver to simulate failure

        const messageWithRetry = MockDataGenerator.createAgentMessage({
          sender: { agent_id: sender.agent_id, framework: sender.framework },
          recipient: { agent_id: receiver.agent_id, framework: receiver.framework },
          routing: MockDataGenerator.createMessageRouting({
            retry_policy: { max_retries: 3, backoff: 'linear' }
          })
        });

        const result = await testRunner.sendMessage(env, messageWithRetry);
        expect(result).toBe(true); // Should be queued for retry

        // Now connect receiver and verify delivery
        const receiverWs = await testRunner.connectAgent(env, receiver.agent_id);
        
        // Wait a bit for queued message delivery
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(receiverWs.getSentMessagesCount()).toBeGreaterThan(0);
      } finally {
        await testRunner.cleanupEnvironment('retry_test');
      }
    });

    it('should handle partial broadcast failures', async () => {
      const env = await testRunner.createEnvironment('partial_broadcast_test');
      
      try {
        const sender = await testRunner.registerAgent(env, 'claude-code');
        const availableReceivers = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);
        const unavailableReceiver = await testRunner.registerAgent(env, 'tester');

        // Connect only available receivers
        await testRunner.connectAgent(env, sender.agent_id);
        for (const receiver of availableReceivers) {
          await testRunner.connectAgent(env, receiver.agent_id);
        }

        // Broadcast to all (including unavailable)
        const allReceivers = [...availableReceivers, unavailableReceiver].map(r => r.agent_id);
        const broadcastResult = await env.communicationBus.broadcastMessage(
          sender.agent_id,
          allReceivers,
          {
            sender: {
              agent_id: sender.agent_id,
              framework: sender.framework
            },
            routing: {
              timeout: '30s',
              retry_policy: {
                max_retries: 3,
                backoff: 'exponential' as const
              },
              delivery_mode: 'async'
            },
            message_type: 'status_update' as const,
            priority: 'medium' as const,
            payload: { status: 'system_update' }
          }
        );

        expect(broadcastResult.successful).toHaveLength(2);
        expect(broadcastResult.failed).toHaveLength(1);
        expect(broadcastResult.failed).toContain(unavailableReceiver.agent_id);
      } finally {
        await testRunner.cleanupEnvironment('partial_broadcast_test');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high message volume', async () => {
      const env = await testRunner.createEnvironment('high_volume_test');
      
      try {
        const sender = await testRunner.registerAgent(env, 'claude-code');
        const receiver = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, sender.agent_id);
        await testRunner.connectAgent(env, receiver.agent_id);

        // Send many messages rapidly
        const messageCount = 100;
        const messages = Array.from({ length: messageCount }, (_, index) =>
          MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: sender.agent_id, framework: sender.framework },
            recipient: { agent_id: receiver.agent_id, framework: receiver.framework },
            payload: { task_index: index, batch_id: 'high_volume_test' }
          })
        );

        const startTime = Date.now();
        const results = await Promise.all(
          messages.map(message => testRunner.sendMessage(env, message))
        );
        const endTime = Date.now();

        expect(results.every(result => result === true)).toBe(true);
        expect(env.messageTracker.getMessageCount()).toBe(messageCount);

        // Verify performance metrics
        const metrics = env.communicationBus.getMetrics();
        expect(metrics.total_messages).toBe(messageCount);
        expect(metrics.throughput).toBeGreaterThan(0);

        // Should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(5000);
      } finally {
        await testRunner.cleanupEnvironment('high_volume_test');
      }
    });

    it('should handle concurrent sessions', async () => {
      const env = await testRunner.createEnvironment('concurrent_sessions_test');
      
      try {
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'claude-code'),
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli'),
          testRunner.registerAgent(env, 'tester')
        ]);

        // Connect all agents
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Create multiple concurrent sessions
        const sessionCount = 5;
        const sessions = [];

        for (let i = 0; i < sessionCount; i++) {
          const orchestrator = agents[i % agents.length];
          const participants = agents.filter((_, index) => index !== i % agents.length);
          
          const session = await testRunner.createSession(env, orchestrator, participants);
          sessions.push(session);

          // Send message in each session
          const sessionMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
            recipient: { agent_id: participants[0].agent_id, framework: participants[0].framework },
            metadata: { session_id: session.sessionId }
          });

          await testRunner.sendMessage(env, sessionMessage);
        }

        // Verify all sessions are active
        expect(env.activeSessions).toHaveLength(sessionCount);
        expect(env.messageTracker.getMessageCount()).toBe(sessionCount);

        // Verify session isolation
        const sessionIds = env.messageTracker.getMessagesByType('task_request')
          .map(msg => msg.metadata?.session_id)
          .filter(Boolean);
        
        expect(new Set(sessionIds).size).toBe(sessionCount);
      } finally {
        await testRunner.cleanupEnvironment('concurrent_sessions_test');
      }
    });
  });

  describe('Message Ordering and Consistency', () => {
    it('should maintain message order within a session', async () => {
      const env = await testRunner.createEnvironment('message_order_test');
      
      try {
        const sender = await testRunner.registerAgent(env, 'claude-code');
        const receiver = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, sender.agent_id);
        await testRunner.connectAgent(env, receiver.agent_id);

        // Send sequential messages
        const messageCount = 10;
        for (let i = 0; i < messageCount; i++) {
          const message = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: sender.agent_id, framework: sender.framework },
            recipient: { agent_id: receiver.agent_id, framework: receiver.framework },
            payload: { sequence_number: i, step: `step_${i}` }
          });

          await testRunner.sendMessage(env, message);
        }

        // Verify message order
        const taskRequests = env.messageTracker.getMessagesByType('task_request');
        expect(taskRequests).toHaveLength(messageCount);

        for (let i = 0; i < messageCount; i++) {
          expect(taskRequests[i].payload.sequence_number).toBe(i);
        }
      } finally {
        await testRunner.cleanupEnvironment('message_order_test');
      }
    });

    it('should handle message priority correctly', async () => {
      const env = await testRunner.createEnvironment('message_priority_test');
      
      try {
        const sender = await testRunner.registerAgent(env, 'claude-code');
        const receiver = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, sender.agent_id);
        await testRunner.connectAgent(env, receiver.agent_id);

        // Send messages with different priorities
        const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
        
        for (const priority of priorities) {
          const message = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: sender.agent_id, framework: sender.framework },
            recipient: { agent_id: receiver.agent_id, framework: receiver.framework },
            priority
          });

          await testRunner.sendMessage(env, message);
        }

        // Verify all messages were sent
        const taskRequests = env.messageTracker.getMessagesByType('task_request');
        expect(taskRequests).toHaveLength(4);

        const receivedPriorities = taskRequests.map(msg => msg.priority);
        expect(receivedPriorities).toContain('low');
        expect(receivedPriorities).toContain('medium');
        expect(receivedPriorities).toContain('high');
        expect(receivedPriorities).toContain('critical');
      } finally {
        await testRunner.cleanupEnvironment('message_priority_test');
      }
    });
  });
});