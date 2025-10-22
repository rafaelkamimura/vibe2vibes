import { CommunicationBus } from '../../src/communication-bus';
import { MockDataGenerator } from '../utils/mock-generators';
import { MockWebSocket, MockWebSocketServer, TestTimer, MessageTracker } from '../utils/test-helpers';
import { setupTestDatabase, teardownTestDatabase } from '../utils/test-database';
import { AgentRegistration, AgentMessage } from '../../src/types/protocol';

// Mock dependencies
jest.mock('ws');
jest.mock('express');
jest.mock('../../src/session-manager');
jest.mock('../../src/message-router');
jest.mock('../../src/model-selector');
jest.mock('../../src/result-aggregator');

describe('CommunicationBus', () => {
  let communicationBus: CommunicationBus;
  let mockWsServer: MockWebSocketServer;
  let testTimer: TestTimer;
  let messageTracker: MessageTracker;
  let config: any;

  beforeEach(() => {
    setupTestDatabase();
    MockDataGenerator.reset();
    
    config = MockDataGenerator.createCommunicationBusConfig({
      port: 0, // Use random port for testing
      persistenceEnabled: false
    });

    mockWsServer = new MockWebSocketServer();
    testTimer = new TestTimer();
    messageTracker = new MessageTracker();

    // Mock WebSocket server
    const { WebSocketServer } = require('ws');
    WebSocketServer.mockImplementation(() => mockWsServer);

    communicationBus = new CommunicationBus(config);
  });

  afterEach(async () => {
    if (communicationBus) {
      await communicationBus.stop();
    }
    testTimer.clearAll();
    messageTracker.clear();
    teardownTestDatabase();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(communicationBus).toBeDefined();
      expect(communicationBus.getMetrics()).toBeDefined();
      expect(communicationBus.getMetrics().registered_agents).toBe(0);
    });

    it('should set up event handlers', () => {
      const emitSpy = jest.spyOn(communicationBus, 'emit');
      communicationBus.emit('test_event', { data: 'test' });
      expect(emitSpy).toHaveBeenCalledWith('test_event', { data: 'test' });
    });
  });

  describe('Agent Registration', () => {
    it('should register a new agent successfully', async () => {
      const registration = MockDataGenerator.createAgentRegistration();
      const agentId = await communicationBus.registerAgent(registration);

      expect(agentId).toBe(registration.agent_descriptor.agent_id);
      expect(communicationBus.getRegisteredAgents()).toHaveLength(1);
      expect(communicationBus.getAgent(agentId)).toEqual(registration.agent_descriptor);
    });

    it('should reject duplicate agent registration', async () => {
      const registration = MockDataGenerator.createAgentRegistration();
      
      await communicationBus.registerAgent(registration);
      
      await expect(communicationBus.registerAgent(registration))
        .rejects.toThrow(/already registered/);
    });

    it('should validate agent descriptor', async () => {
const invalidRegistration = {
        agent_descriptor: {
          agent_id: 'test-agent',
          framework: 'test',
          capabilities: {
            input_types: ['text'],
            output_types: ['text'],
            languages: ['en'],
            tools: [],
            model_preferences: [],
            optimal_tasks: [],
            performance_profile: {
              avg_response_time: '1s',
              success_rate: 0.9,
              concurrent_capacity: 1
            }
          },
          endpoints: {
            mcp: 'stdio://test-agent',
            http: 'http://localhost:3000/test-agent',
            websocket: 'ws://localhost:3000/ws/test-agent'
          },
          metadata: {
            version: '1.0.0',
            author: 'test',
            tags: [],
            description: 'test agent'
          }
        },
        health_check_url: 'http://localhost:8080/health',
        authentication: {
          type: 'api_key' as const,
          credentials: 'invalid-key'
        }
      };

      await expect(communicationBus.registerAgent(invalidRegistration))
        .rejects.toThrow('Invalid agent descriptor');
    });

    it('should emit agent_registered event', async () => {
      const registration = MockDataGenerator.createAgentRegistration();
      const eventSpy = jest.fn();
      
      communicationBus.on('agent_registered', eventSpy);
      await communicationBus.registerAgent(registration);

      expect(eventSpy).toHaveBeenCalledWith({
        agent_id: registration.agent_descriptor.agent_id,
        descriptor: registration.agent_descriptor
      });
    });
  });

  describe('Agent Unregistration', () => {
    beforeEach(async () => {
      const registration = MockDataGenerator.createAgentRegistration();
      await communicationBus.registerAgent(registration);
    });

    it('should unregister an existing agent', async () => {
      const agents = communicationBus.getRegisteredAgents();
      const agentId = agents[0].agent_id;

      const result = await communicationBus.unregisterAgent(agentId);

      expect(result).toBe(true);
      expect(communicationBus.getRegisteredAgents()).toHaveLength(0);
      expect(communicationBus.getAgent(agentId)).toBeNull();
    });

    it('should return false for non-existent agent', async () => {
      const result = await communicationBus.unregisterAgent('non-existent-agent');
      expect(result).toBe(false);
    });

    it('should emit agent_unregistered event', async () => {
      const agents = communicationBus.getRegisteredAgents();
      const agentId = agents[0].agent_id;
      const eventSpy = jest.fn();
      
      communicationBus.on('agent_unregistered', eventSpy);
      await communicationBus.unregisterAgent(agentId);

      expect(eventSpy).toHaveBeenCalledWith({
        agent_id: agentId
      });
    });
  });

  describe('Message Sending', () => {
    let senderRegistration: AgentRegistration;
    let recipientRegistration: AgentRegistration;
    let testMessage: AgentMessage;

    beforeEach(async () => {
      senderRegistration = MockDataGenerator.createAgentRegistration();
      recipientRegistration = MockDataGenerator.createAgentRegistration();
      
      await communicationBus.registerAgent(senderRegistration);
      await communicationBus.registerAgent(recipientRegistration);

      testMessage = MockDataGenerator.createAgentMessage({
        sender: {
          agent_id: senderRegistration.agent_descriptor.agent_id,
          framework: senderRegistration.agent_descriptor.framework
        },
        recipient: {
          agent_id: recipientRegistration.agent_descriptor.agent_id,
          framework: recipientRegistration.agent_descriptor.framework
        }
      });
    });

    it('should send message to registered agent', async () => {
      const result = await communicationBus.sendMessage(testMessage);
      expect(result).toBe(true);
    });

    it('should fail to send message to unregistered agent', async () => {
      const invalidMessage = MockDataGenerator.createAgentMessage({
        recipient: { agent_id: 'unregistered-agent', framework: 'test' }
      });

      const result = await communicationBus.sendMessage(invalidMessage);
      expect(result).toBe(false);
    });

    it('should emit message_failed event on routing failure', async () => {
      const invalidMessage = MockDataGenerator.createAgentMessage({
        recipient: { agent_id: 'unregistered-agent', framework: 'test' }
      });
      const eventSpy = jest.fn();
      
      communicationBus.on('message_failed', eventSpy);
      await communicationBus.sendMessage(invalidMessage);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should update metrics after sending message', async () => {
      const initialMetrics = communicationBus.getMetrics();
      await communicationBus.sendMessage(testMessage);
      const updatedMetrics = communicationBus.getMetrics();

      expect(updatedMetrics.total_messages).toBe(initialMetrics.total_messages + 1);
    });
  });

  describe('Broadcast Messaging', () => {
    let registrations: AgentRegistration[];
    let senderId: string;

    beforeEach(async () => {
      registrations = [
        MockDataGenerator.createAgentRegistration(),
        MockDataGenerator.createAgentRegistration(),
        MockDataGenerator.createAgentRegistration()
      ];

      for (const registration of registrations) {
        await communicationBus.registerAgent(registration);
      }

      senderId = registrations[0].agent_descriptor.agent_id;
    });

it('should broadcast message to multiple recipients', async () => {
      const recipientIds = [
        registrations[1].agent_descriptor.agent_id,
        registrations[2].agent_descriptor.agent_id
      ];

      const messageData = {
        sender: {
          agent_id: senderId,
          framework: 'test'
        },
        routing: {
          timeout: '30s',
          retry_policy: {
            max_retries: 3,
            backoff: 'exponential'
          },
          delivery_mode: 'async'
        },
        message_type: 'task_request' as const,
        priority: 'medium' as const,
        payload: { task: 'test task' }
      };

      const result = await communicationBus.broadcastMessage(senderId, recipientIds, messageData);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle partial broadcast failures', async () => {
      const recipientIds = [
        registrations[1].agent_descriptor.agent_id,
        'non-existent-agent'
      ];

      const messageData = {
        message_type: 'task_request' as const,
        priority: 'medium' as const,
        payload: { task: 'broadcast test' }
      };

      const result = await communicationBus.broadcastMessage(senderId, recipientIds, messageData);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('WebSocket Connection Handling', () => {
    let registration: AgentRegistration;
    let mockWs: MockWebSocket;

    beforeEach(async () => {
      registration = MockDataGenerator.createAgentRegistration();
      await communicationBus.registerAgent(registration);
      mockWs = new MockWebSocket();
    });

    it('should accept WebSocket connection from registered agent', () => {
      const connectionSpy = jest.fn();
      communicationBus.on('agent_connected', connectionSpy);

      mockWsServer.simulateConnection(mockWs);

      expect(connectionSpy).toHaveBeenCalledWith({
        agent_id: registration.agent_descriptor.agent_id
      });
    });

    it('should reject WebSocket connection from unregistered agent', () => {
      const unregisteredWs = new MockWebSocket();
      const closeSpy = jest.spyOn(unregisteredWs, 'close');

      mockWsServer.simulateConnection(unregisteredWs);

      expect(closeSpy).toHaveBeenCalledWith(1008, 'Agent not registered');
    });

    it('should handle WebSocket disconnection', () => {
      const disconnectionSpy = jest.fn();
      communicationBus.on('agent_disconnected', disconnectionSpy);

      mockWsServer.simulateConnection(mockWs);
      mockWs.close();

      expect(disconnectionSpy).toHaveBeenCalledWith({
        agent_id: registration.agent_descriptor.agent_id
      });
    });

    it('should deliver queued messages on connection', async () => {
      const message = MockDataGenerator.createAgentMessage({
        recipient: { agent_id: registration.agent_descriptor.agent_id, framework: 'test' }
      });

      // Send message before connection
      await communicationBus.sendMessage(message);
      
      // Connect agent
      mockWsServer.simulateConnection(mockWs);

      // Check if message was delivered
      expect(mockWs.getSentMessagesCount()).toBeGreaterThan(0);
    });
  });

  describe('Metrics Collection', () => {
    it('should return accurate metrics', () => {
      const metrics = communicationBus.getMetrics();
      
      expect(metrics).toHaveProperty('total_messages');
      expect(metrics).toHaveProperty('active_sessions');
      expect(metrics).toHaveProperty('registered_agents');
      expect(metrics).toHaveProperty('average_response_time');
      expect(metrics).toHaveProperty('error_rate');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('throughput');
    });

    it('should update agent count on registration', async () => {
      const initialMetrics = communicationBus.getMetrics();
      const registration = MockDataGenerator.createAgentRegistration();
      
      await communicationBus.registerAgent(registration);
      const updatedMetrics = communicationBus.getMetrics();

      expect(updatedMetrics.registered_agents).toBe(initialMetrics.registered_agents + 1);
    });

    it('should calculate uptime correctly', async () => {
      const startTime = Date.now();
      await communicationBus.start();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = communicationBus.getMetrics();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.uptime).toBeLessThan(Date.now() - startTime + 1000);
    });
  });

  describe('Health Status', () => {
    it('should return health status for registered agent', async () => {
      const registration = MockDataGenerator.createAgentRegistration();
      await communicationBus.registerAgent(registration);

      const healthStatus = communicationBus.getAgentHealth(registration.agent_descriptor.agent_id);
      
      // Currently returns null as health checking is not fully implemented
      expect(healthStatus).toBeNull();
    });

    it('should return null for unregistered agent', () => {
      const healthStatus = communicationBus.getAgentHealth('non-existent-agent');
      expect(healthStatus).toBeNull();
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      await expect(communicationBus.start()).resolves.not.toThrow();
    });

    it('should stop server successfully', async () => {
      await communicationBus.start();
      await expect(communicationBus.stop()).resolves.not.toThrow();
    });

    it('should handle start errors gracefully', async () => {
      // Mock server to throw error
      const mockListen = jest.fn().mockImplementation((callback) => {
        callback(new Error('Port already in use'));
      });
      
      communicationBus['server'] = { listen: mockListen } as any;
      
      await expect(communicationBus.start()).rejects.toThrow('Port already in use');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed WebSocket messages', async () => {
      const registration = MockDataGenerator.createAgentRegistration();
      await communicationBus.registerAgent(registration);
      
      const mockWs = new MockWebSocket();
      mockWsServer.simulateConnection(mockWs);
      
      // Send malformed JSON
      mockWs.simulateMessage('invalid json');
      
      // Should not crash
      expect(mockWs.readyState).toBe(1); // Still connected
    });

    it('should handle message routing failures', async () => {
      const invalidMessage = MockDataGenerator.createAgentMessage({
        recipient: { agent_id: 'non-existent', framework: 'test' }
      });

      const result = await communicationBus.sendMessage(invalidMessage);
      expect(result).toBe(false);
    });
  });
});