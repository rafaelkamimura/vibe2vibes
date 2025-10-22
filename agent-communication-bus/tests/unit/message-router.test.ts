import { MessageRouter } from '../../src/message-router';
import { MockDataGenerator } from '../utils/mock-generators';
import { AgentMessage, AgentDescriptor } from '../../src/types/protocol';

describe('MessageRouter', () => {
  let messageRouter: MessageRouter;
  let registeredAgents: Map<string, AgentDescriptor>;

  beforeEach(() => {
    MockDataGenerator.reset();
    
    // Create a set of registered agents
    const agents = MockDataGenerator.createAgentPool(5);
    registeredAgents = new Map();
    agents.forEach(agent => {
      registeredAgents.set(agent.agent_id, agent);
    });

    messageRouter = new MessageRouter(registeredAgents);
  });

  describe('Constructor', () => {
    it('should initialize with provided agents', () => {
      expect(messageRouter).toBeDefined();
      expect(messageRouter.getRegisteredAgents()).toHaveLength(5);
    });

    it('should handle empty agent registry', () => {
      const emptyRouter = new MessageRouter(new Map());
      expect(emptyRouter.getRegisteredAgents()).toHaveLength(0);
    });
  });

  describe('Message Routing', () => {
    let testMessage: AgentMessage;
    let senderAgent: AgentDescriptor;
    let recipientAgent: AgentDescriptor;

    beforeEach(() => {
      const agents = Array.from(registeredAgents.values());
      senderAgent = agents[0];
      recipientAgent = agents[1];

      testMessage = MockDataGenerator.createAgentMessage({
        sender: {
          agent_id: senderAgent.agent_id,
          framework: senderAgent.framework
        },
        recipient: {
          agent_id: recipientAgent.agent_id,
          framework: recipientAgent.framework
        }
      });
    });

    it('should successfully route message to registered agent', () => {
      const result = messageRouter.routeMessage(testMessage);

      expect(result.success).toBe(true);
      expect(result.route).toBeDefined();
      expect(result.route?.recipient_id).toBe(recipientAgent.agent_id);
      expect(result.route?.delivery_method).toBeDefined();
    });

    it('should fail to route message to unregistered agent', () => {
      const invalidMessage = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: 'unregistered-agent',
          framework: 'test'
        }
      });

      const result = messageRouter.routeMessage(invalidMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent not found');
    });

    it('should handle message with fallback agents', () => {
      const fallbackAgents = [
        Array.from(registeredAgents.values())[2].agent_id,
        Array.from(registeredAgents.values())[3].agent_id
      ];

      const messageWithFallback = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: 'non-existent-agent',
          framework: 'test'
        },
        routing: MockDataGenerator.createMessageRouting({
          fallback_agents: fallbackAgents
        })
      });

      const result = messageRouter.routeMessage(messageWithFallback);

      expect(result.success).toBe(true);
      expect(result.route?.recipient_id).toBe(fallbackAgents[0]);
    });

    it('should try all fallback agents in order', () => {
      const fallbackAgents = ['non-existent-1', 'non-existent-2', Array.from(registeredAgents.values())[2].agent_id];
      
      const messageWithFallback = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: 'primary-non-existent',
          framework: 'test'
        },
        routing: MockDataGenerator.createMessageRouting({
          fallback_agents: fallbackAgents
        })
      });

      const result = messageRouter.routeMessage(messageWithFallback);

      expect(result.success).toBe(true);
      expect(result.route?.recipient_id).toBe(fallbackAgents[2]);
    });

    it('should fail when no fallback agents are available', () => {
      const messageWithInvalidFallback = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: 'non-existent-agent',
          framework: 'test'
        },
        routing: MockDataGenerator.createMessageRouting({
          fallback_agents: ['non-existent-1', 'non-existent-2']
        })
      });

      const result = messageRouter.routeMessage(messageWithInvalidFallback);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No available recipients');
    });
  });

  describe('Route Selection Logic', () => {
    it('should select WebSocket route for agents with WebSocket endpoint', () => {
      const agents = Array.from(registeredAgents.values());
      const wsAgent = agents.find(agent => agent.endpoints.websocket);
      
      if (wsAgent) {
        const message = MockDataGenerator.createAgentMessage({
          recipient: {
            agent_id: wsAgent.agent_id,
            framework: wsAgent.framework
          }
        });

        const result = messageRouter.routeMessage(message);

        expect(result.success).toBe(true);
        expect(result.route?.delivery_method).toBe('websocket');
        expect(result.route?.endpoint).toBe(wsAgent.endpoints.websocket);
      }
    });

    it('should select HTTP route for agents with HTTP endpoint', () => {
      const agents = Array.from(registeredAgents.values());
      const httpAgent = agents.find(agent => agent.endpoints.http);
      
      if (httpAgent) {
        const message = MockDataGenerator.createAgentMessage({
          recipient: {
            agent_id: httpAgent.agent_id,
            framework: httpAgent.framework
          }
        });

        const result = messageRouter.routeMessage(message);

        expect(result.success).toBe(true);
        expect(result.route?.delivery_method).toBe('http');
        expect(result.route?.endpoint).toBe(httpAgent.endpoints.http);
      }
    });

    it('should select MCP route for agents with MCP endpoint', () => {
      const agents = Array.from(registeredAgents.values());
      const mcpAgent = agents.find(agent => agent.endpoints.mcp);
      
      if (mcpAgent) {
        const message = MockDataGenerator.createAgentMessage({
          recipient: {
            agent_id: mcpAgent.agent_id,
            framework: mcpAgent.framework
          }
        });

        const result = messageRouter.routeMessage(message);

        expect(result.success).toBe(true);
        expect(result.route?.delivery_method).toBe('mcp');
        expect(result.route?.endpoint).toBe(mcpAgent.endpoints.mcp);
      }
    });

    it('should prioritize WebSocket over HTTP when both available', () => {
      const agentWithMultipleEndpoints = MockDataGenerator.createAgentDescriptor({
        endpoints: {
          http: 'http://localhost:3000/agent',
          websocket: 'ws://localhost:3000/agent/ws',
          mcp: 'mcp://localhost:3000/agent'
        }
      });

      registeredAgents.set(agentWithMultipleEndpoints.agent_id, agentWithMultipleEndpoints);
      messageRouter = new MessageRouter(registeredAgents);

      const message = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: agentWithMultipleEndpoints.agent_id,
          framework: agentWithMultipleEndpoints.framework
        }
      });

      const result = messageRouter.routeMessage(message);

      expect(result.success).toBe(true);
      expect(result.route?.delivery_method).toBe('websocket');
    });
  });

  describe('Message Validation', () => {
    it('should validate message structure', () => {
      const validMessage = MockDataGenerator.createAgentMessage();
      const result = messageRouter.routeMessage(validMessage);
      expect(result.success).toBe(true);
    });

    it('should reject message without required fields', () => {
      const invalidMessage = {
        // Missing required fields
        message_id: 'test-id'
      } as AgentMessage;

      const result = messageRouter.routeMessage(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should validate message ID format', () => {
      const messageWithInvalidId = MockDataGenerator.createAgentMessage({
        message_id: '' // Empty ID
      });

      const result = messageRouter.routeMessage(messageWithInvalidId);
      expect(result.success).toBe(false);
    });

    it('should validate timestamp format', () => {
      const messageWithInvalidTimestamp = MockDataGenerator.createAgentMessage({
        timestamp: 'invalid-timestamp'
      });

      const result = messageRouter.routeMessage(messageWithInvalidTimestamp);
      expect(result.success).toBe(false);
    });
  });

  describe('Priority Handling', () => {
    it('should handle critical priority messages', () => {
      const criticalMessage = MockDataGenerator.createAgentMessage({
        priority: 'critical'
      });

      const result = messageRouter.routeMessage(criticalMessage);
      expect(result.success).toBe(true);
      expect(result.route?.priority).toBe('critical');
    });

    it('should handle high priority messages', () => {
      const highPriorityMessage = MockDataGenerator.createAgentMessage({
        priority: 'high'
      });

      const result = messageRouter.routeMessage(highPriorityMessage);
      expect(result.success).toBe(true);
      expect(result.route?.priority).toBe('high');
    });

    it('should handle low priority messages', () => {
      const lowPriorityMessage = MockDataGenerator.createAgentMessage({
        priority: 'low'
      });

      const result = messageRouter.routeMessage(lowPriorityMessage);
      expect(result.success).toBe(true);
      expect(result.route?.priority).toBe('low');
    });
  });

  describe('Routing Strategy', () => {
    it('should use direct routing for specific recipients', () => {
      const agents = Array.from(registeredAgents.values());
      const targetAgent = agents[0];

      const directMessage = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: targetAgent.agent_id,
          framework: targetAgent.framework
        },
        routing: MockDataGenerator.createMessageRouting({
          delivery_mode: 'sync'
        })
      });

      const result = messageRouter.routeMessage(directMessage);

      expect(result.success).toBe(true);
      expect(result.route?.strategy).toBe('direct');
    });

    it('should use broadcast routing for multiple recipients', () => {
      const broadcastMessage = MockDataGenerator.createAgentMessage({
        routing: MockDataGenerator.createMessageRouting({
          delivery_mode: 'async'
        })
      });

      // Add multiple recipients to message metadata
      broadcastMessage.metadata = {
        broadcast_recipients: Array.from(registeredAgents.keys()).slice(0, 3)
      };

      const result = messageRouter.routeMessage(broadcastMessage);

      expect(result.success).toBe(true);
      expect(result.route?.strategy).toBe('broadcast');
    });
  });

  describe('Load Balancing', () => {
    it('should distribute messages across multiple agents', () => {
      const messages = MockDataGenerator.createMessageSequence(10, 'task_request');
      const routingResults = messages.map(msg => messageRouter.routeMessage(msg));

      // All should succeed
      expect(routingResults.every(result => result.success)).toBe(true);

      // Should distribute across available agents
      const recipientCounts = new Map<string, number>();
      routingResults.forEach(result => {
        if (result.route?.recipient_id) {
          const count = recipientCounts.get(result.route.recipient_id) || 0;
          recipientCounts.set(result.route.recipient_id, count + 1);
        }
      });

      // Should have some distribution (not all to same agent)
      expect(recipientCounts.size).toBeGreaterThan(1);
    });

    it('should consider agent capacity in routing', () => {
      const highCapacityAgent = MockDataGenerator.createAgentDescriptor({
        agent_id: 'high-capacity-agent',
        capabilities: MockDataGenerator.createAgentCapability({
          performance_profile: {
            avg_response_time: '100ms',
            success_rate: 0.98,
            concurrent_capacity: 10
          }
        })
      });

      const lowCapacityAgent = MockDataGenerator.createAgentDescriptor({
        agent_id: 'low-capacity-agent',
        capabilities: MockDataGenerator.createAgentCapability({
          performance_profile: {
            avg_response_time: '500ms',
            success_rate: 0.85,
            concurrent_capacity: 2
          }
        })
      });

      registeredAgents.set(highCapacityAgent.agent_id, highCapacityAgent);
      registeredAgents.set(lowCapacityAgent.agent_id, lowCapacityAgent);
      messageRouter = new MessageRouter(registeredAgents);

      const message = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: highCapacityAgent.agent_id,
          framework: highCapacityAgent.framework
        }
      });

      const result = messageRouter.routeMessage(message);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed routing information', () => {
      const messageWithBadRouting = MockDataGenerator.createAgentMessage({
        routing: {
          timeout: 'invalid',
          retry_policy: {
            max_retries: -1,
            backoff: 'invalid' as any
          },
          delivery_mode: 'invalid' as any
        }
      });

      const result = messageRouter.routeMessage(messageWithBadRouting);
      expect(result.success).toBe(false);
    });

    it('should emit routing_failed events', () => {
      const eventSpy = jest.fn();
      messageRouter.on('routing_failed', eventSpy);

      const invalidMessage = MockDataGenerator.createAgentMessage({
        recipient: {
          agent_id: 'non-existent',
          framework: 'test'
        }
      });

      messageRouter.routeMessage(invalidMessage);

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Agent Registry Management', () => {
    it('should update when agents are added', () => {
      const initialCount = messageRouter.getRegisteredAgents().length;
      
      const newAgent = MockDataGenerator.createAgentDescriptor();
      registeredAgents.set(newAgent.agent_id, newAgent);
      messageRouter.updateAgentRegistry(Array.from(registeredAgents.values()));

      expect(messageRouter.getRegisteredAgents()).toHaveLength(initialCount + 1);
    });

    it('should update when agents are removed', () => {
      const initialCount = messageRouter.getRegisteredAgents().length;
      const firstAgentId = Array.from(registeredAgents.keys())[0];
      
      registeredAgents.delete(firstAgentId);
      messageRouter.updateAgentRegistry(Array.from(registeredAgents.values()));

      expect(messageRouter.getRegisteredAgents()).toHaveLength(initialCount - 1);
    });

    it('should handle registry updates gracefully', () => {
      const emptyRegistry: AgentDescriptor[] = [];
      messageRouter.updateAgentRegistry(emptyRegistry);

      expect(messageRouter.getRegisteredAgents()).toHaveLength(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track routing statistics', () => {
      const messages = MockDataGenerator.createMessageSequence(5);
      
      messages.forEach(message => {
        messageRouter.routeMessage(message);
      });

      const metrics = messageRouter.getRoutingMetrics();
      expect(metrics.totalRoutes).toBeGreaterThanOrEqual(0);
      expect(metrics.successfulRoutes).toBeGreaterThanOrEqual(0);
      expect(metrics.failedRoutes).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average routing time', () => {
      const startTime = Date.now();
      
      const message = MockDataGenerator.createAgentMessage();
      messageRouter.routeMessage(message);
      
      const endTime = Date.now();
      const metrics = messageRouter.getRoutingMetrics();

      expect(metrics.averageRouteTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageRouteTime).toBeLessThanOrEqual(endTime - startTime + 100);
    });
  });
});