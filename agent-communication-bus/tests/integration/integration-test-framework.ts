import { CommunicationBus } from '../../src/communication-bus';
import { MockDataGenerator } from '../utils/mock-generators';
import { MockWebSocket, MockWebSocketServer, TestTimer, MessageTracker } from '../utils/test-helpers';
import { setupTestDatabase, teardownTestDatabase, testDb } from '../utils/test-database';
import {
  AgentMessage,
  AgentDescriptor,
  SessionContext,
  AgentRegistration,
  CommunicationBusConfig
} from '../../src/types/protocol';

/**
 * Integration Test Framework
 * Provides a complete testing environment for end-to-end agent communication scenarios
 */

export interface IntegrationTestEnvironment {
  communicationBus: CommunicationBus;
  mockWsServer: MockWebSocketServer;
  testTimer: TestTimer;
  messageTracker: MessageTracker;
  registeredAgents: AgentDescriptor[];
  activeSessions: SessionContext[];
}

export interface TestScenario {
  name: string;
  description: string;
  setup: (env: IntegrationTestEnvironment) => Promise<void>;
  execute: (env: IntegrationTestEnvironment) => Promise<void>;
  verify: (env: IntegrationTestEnvironment) => Promise<void>;
  cleanup?: (env: IntegrationTestEnvironment) => Promise<void>;
}

export class IntegrationTestRunner {
  private environments: Map<string, IntegrationTestEnvironment> = new Map();
  private scenarios: TestScenario[] = [];

  async createEnvironment(name: string, config?: Partial<CommunicationBusConfig>): Promise<IntegrationTestEnvironment> {
    setupTestDatabase();
    MockDataGenerator.reset();

    const busConfig = MockDataGenerator.createCommunicationBusConfig({
      port: 0, // Random port for testing
      persistenceEnabled: false,
      ...config
    });

    const mockWsServer = new MockWebSocketServer();
    const testTimer = new TestTimer();
    const messageTracker = new MessageTracker();

    // Mock WebSocket server
    const { WebSocketServer } = require('ws');
    WebSocketServer.mockImplementation(() => mockWsServer);

    const communicationBus = new CommunicationBus(busConfig);
    const environment: IntegrationTestEnvironment = {
      communicationBus,
      mockWsServer,
      testTimer,
      messageTracker,
      registeredAgents: [],
      activeSessions: []
    };

    this.environments.set(name, environment);
    return environment;
  }

  async registerAgent(env: IntegrationTestEnvironment, agentType?: string): Promise<AgentDescriptor> {
    const agentDescriptor = MockDataGenerator.createAgentDescriptor({
      metadata: {
        ...MockDataGenerator.createAgentDescriptor().metadata,
        tags: agentType ? [agentType] : ['test']
      }
    });

    const registration: AgentRegistration = {
      agent_descriptor: agentDescriptor,
      health_check_url: `http://localhost:3000/agents/${agentDescriptor.agent_id}/health`,
      authentication: {
        type: 'api_key',
        credentials: 'test-api-key'
      }
    };

    await env.communicationBus.registerAgent(registration);
    env.registeredAgents.push(agentDescriptor);

    return agentDescriptor;
  }

  async connectAgent(env: IntegrationTestEnvironment, agentId: string): Promise<MockWebSocket> {
    const mockWs = new MockWebSocket();
    env.mockWsServer.simulateConnection(mockWs);
    return mockWs;
  }

  async createSession(env: IntegrationTestEnvironment, orchestrator: AgentDescriptor, participants: AgentDescriptor[]): Promise<SessionContext> {
    const sessionData = MockDataGenerator.createSessionContext({
      orchestrator: orchestrator.agent_id,
      participants: participants.map(p => ({
        agent_id: p.agent_id,
        framework: p.framework,
        role: 'implementer',
        status: 'active',
        join_time: new Date().toISOString(),
        capabilities: p.capabilities.input_types
      }))
    });

    // For integration tests, we'll simulate session creation
    env.activeSessions.push(sessionData);
    return sessionData;
  }

  async sendMessage(env: IntegrationTestEnvironment, message: AgentMessage): Promise<boolean> {
    env.messageTracker.track(message);
    return await env.communicationBus.sendMessage(message);
  }

  async waitForMessage(env: IntegrationTestEnvironment, messageType: string, timeout: number = 5000): Promise<AgentMessage | null> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const messages = env.messageTracker.getMessagesByType(messageType as any);
        if (messages.length > 0) {
          clearInterval(checkInterval);
          resolve(messages[messages.length - 1]);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, timeout);
    });
  }

  async simulateAgentWorkflow(env: IntegrationTestEnvironment, workflow: {
    name: string;
    steps: Array<{
      agent: string;
      action: string;
      message?: Partial<AgentMessage>;
      expectResponse?: boolean;
    }>;
  }): Promise<void> {
    for (const step of workflow.steps) {
      const agent = env.registeredAgents.find(a => a.agent_id === step.agent);
      if (!agent) {
        throw new Error(`Agent ${step.agent} not found`);
      }

      switch (step.action) {
        case 'connect':
          await this.connectAgent(env, step.agent);
          break;

        case 'send_message':
          if (step.message) {
            const message = MockDataGenerator.createAgentMessage({
              sender: { agent_id: step.agent, framework: agent.framework },
              ...step.message
            });
            await this.sendMessage(env, message);
          }
          break;

        case 'wait_for_response':
          if (step.expectResponse) {
            await this.waitForMessage(env, 'task_response');
          }
          break;
      }
    }
  }

  addScenario(scenario: TestScenario): void {
    this.scenarios.push(scenario);
  }

  async runScenario(scenarioName: string): Promise<void> {
    const scenario = this.scenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioName} not found`);
    }

    const env = await this.createEnvironment(scenarioName);
    
    try {
      await scenario.setup(env);
      await scenario.execute(env);
      await scenario.verify(env);
    } finally {
      await scenario.cleanup?.(env);
      await this.cleanupEnvironment(scenarioName);
    }
  }

  async runAllScenarios(): Promise<void> {
    for (const scenario of this.scenarios) {
      try {
        await this.runScenario(scenario.name);
      } catch (error) {
        console.error(`Scenario ${scenario.name} failed:`, error);
        throw error;
      }
    }
  }

  async cleanupEnvironment(name: string): Promise<void> {
    const env = this.environments.get(name);
    if (env) {
      if (env.communicationBus) {
        await env.communicationBus.stop();
      }
      env.testTimer.clearAll();
      env.messageTracker.clear();
      this.environments.delete(name);
    }
    teardownTestDatabase();
  }

  async cleanupAll(): Promise<void> {
    for (const name of this.environments.keys()) {
      await this.cleanupEnvironment(name);
    }
  }

  getEnvironment(name: string): IntegrationTestEnvironment | undefined {
    return this.environments.get(name);
  }

  // Utility methods for common test patterns
  static createBasicWorkflow(): TestScenario {
    return {
      name: 'basic_workflow',
      description: 'Basic agent communication workflow',
      setup: async (env) => {
        // Register agents
        await this.registerAgent(env, 'orchestrator');
        await this.registerAgent(env, 'implementer');
        await this.registerAgent(env, 'reviewer');
      },
      execute: async (env) => {
        const orchestrator = env.registeredAgents[0];
        const implementer = env.registeredAgents[1];
        
        // Connect agents
        await this.connectAgent(env, orchestrator.agent_id);
        await this.connectAgent(env, implementer.agent_id);
        
        // Send task request
        const taskMessage = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: implementer.agent_id, framework: implementer.framework }
        });
        
        await this.sendMessage(env, taskMessage);
      },
      verify: async (env) => {
        const messages = env.messageTracker.getMessagesByType('task_request');
        expect(messages).toHaveLength(1);
        expect(messages[0].sender.agent_id).toBe(env.registeredAgents[0].agent_id);
      }
    };
  }

  static createMultiAgentSession(): TestScenario {
    return {
      name: 'multi_agent_session',
      description: 'Multi-agent session with task delegation',
      setup: async (env) => {
        // Register multiple agents
        const orchestrator = await this.registerAgent(env, 'orchestrator');
        const implementer1 = await this.registerAgent(env, 'implementer');
        const implementer2 = await this.registerAgent(env, 'implementer');
        const reviewer = await this.registerAgent(env, 'reviewer');
        
        // Create session
        await this.createSession(env, orchestrator, [implementer1, implementer2, reviewer]);
      },
      execute: async (env) => {
        const session = env.activeSessions[0];
        const orchestrator = env.registeredAgents.find(a => a.agent_id === session.orchestrator)!;
        
        // Simulate task delegation
        for (const participant of session.participants.slice(0, 2)) {
          const taskMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
            recipient: { agent_id: participant.agent_id, framework: participant.framework },
            metadata: { session_id: session.sessionId }
          });
          
          await this.sendMessage(env, taskMessage);
        }
      },
      verify: async (env) => {
        const taskRequests = env.messageTracker.getMessagesByType('task_request');
        expect(taskRequests.length).toBeGreaterThan(1);
        
        // Verify all messages have the same session ID
        const sessionIds = taskRequests.map(msg => msg.metadata?.session_id).filter(Boolean);
        expect(new Set(sessionIds).size).toBe(1);
      }
    };
  }

  static createErrorRecoveryScenario(): TestScenario {
    return {
      name: 'error_recovery',
      description: 'Test error handling and recovery mechanisms',
      setup: async (env) => {
        await this.registerAgent(env, 'sender');
        await this.registerAgent(env, 'receiver');
      },
      execute: async (env) => {
        const sender = env.registeredAgents[0];
        const receiver = env.registeredAgents[1];
        
        // Send message to non-existent agent (should fail)
        const invalidMessage = MockDataGenerator.createAgentMessage({
          sender: { agent_id: sender.agent_id, framework: sender.framework },
          recipient: { agent_id: 'non-existent', framework: 'test' }
        });
        
        await this.sendMessage(env, invalidMessage);
        
        // Send valid message (should succeed)
        const validMessage = MockDataGenerator.createAgentMessage({
          sender: { agent_id: sender.agent_id, framework: sender.framework },
          recipient: { agent_id: receiver.agent_id, framework: receiver.framework }
        });
        
        await this.sendMessage(env, validMessage);
      },
      verify: async (env) => {
        const allMessages = env.messageTracker.getMessagesByType('task_request');
        expect(allMessages).toHaveLength(2);
        
        // Check that communication bus handled both messages appropriately
        const metrics = env.communicationBus.getMetrics();
        expect(metrics.total_messages).toBe(2);
        expect(metrics.error_rate).toBeGreaterThanOrEqual(0);
      }
    };
  }
}

// Helper function to create test scenarios
export function createTestScenario(
  name: string,
  description: string,
  options: {
    setupAgents?: string[];
    setupSessions?: number;
    workflow?: Array<{
      agent: string;
      action: string;
      message?: Partial<AgentMessage>;
    }>;
    expectedMessages?: Record<string, number>;
    expectedMetrics?: Partial<ReturnType<CommunicationBus['getMetrics']>>;
  }
): TestScenario {
  return {
    name,
    description,
    setup: async (env) => {
      // Register agents
      if (options.setupAgents) {
        for (const agentType of options.setupAgents) {
          await IntegrationTestRunner.prototype.registerAgent(env, agentType);
        }
      }
      
      // Create sessions
      if (options.setupSessions && options.setupSessions > 0) {
        const orchestrator = env.registeredAgents[0];
        const participants = env.registeredAgents.slice(1);
        
        for (let i = 0; i < options.setupSessions; i++) {
          await IntegrationTestRunner.prototype.createSession(env, orchestrator, participants);
        }
      }
    },
    execute: async (env) => {
      if (options.workflow) {
        await IntegrationTestRunner.prototype.simulateAgentWorkflow(env, {
          name: 'test_workflow',
          steps: options.workflow
        });
      }
    },
    verify: async (env) => {
      // Verify message counts
      if (options.expectedMessages) {
        for (const [messageType, expectedCount] of Object.entries(options.expectedMessages)) {
          const messages = env.messageTracker.getMessagesByType(messageType as any);
          expect(messages).toHaveLength(expectedCount);
        }
      }
      
      // Verify metrics
      if (options.expectedMetrics) {
        const metrics = env.communicationBus.getMetrics();
        for (const [key, expectedValue] of Object.entries(options.expectedMetrics)) {
          expect(metrics[key as keyof typeof metrics]).toBe(expectedValue);
        }
      }
    }
  };
}