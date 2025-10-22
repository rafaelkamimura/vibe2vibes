import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentMessage,
  AgentDescriptor,
  CommunicationBusConfig,
  AgentRegistration,
  HealthStatus,
  BusMetrics
} from './types/protocol';
import { SessionManager } from './session-manager';
import { MessageRouter } from './message-router';
import { ModelSelector } from './model-selector';
import { ResultAggregator } from './result-aggregator';

export class CommunicationBus extends EventEmitter {
  private app: express.Application;
  private server: Server;
  private wss: WebSocketServer;
  private config: CommunicationBusConfig;
  
  private sessionManager: SessionManager;
  private messageRouter: MessageRouter;
  private _modelSelector: ModelSelector;
  private _resultAggregator: ResultAggregator;
  
  private registeredAgents: Map<string, AgentDescriptor> = new Map();
  private agentConnections: Map<string, WebSocket> = new Map();
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private metrics: BusMetrics;

  constructor(config: CommunicationBusConfig) {
    super();
    this.config = config;
    
    this.app = express();
    this.setupExpress();
    
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.sessionManager = new SessionManager({
      timeout: 3600000,
      maxParticipants: 10,
      autoCleanup: true,
      persistenceEnabled: config.persistenceEnabled
    });

    this.messageRouter = new MessageRouter(this.registeredAgents);
    this._modelSelector = new ModelSelector();
    this._resultAggregator = new ResultAggregator();
    
    this.metrics = {
      total_messages: 0,
      active_sessions: 0,
      registered_agents: 0,
      average_response_time: 0,
      error_rate: 0,
      uptime: Date.now(),
      throughput: 0
    };

    this.setupWebSocket();
    this.setupEventHandlers();
  }

  /**
   * Start the communication bus
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Agent Communication Bus started on ${this.config.host}:${this.config.port}`);
          this.startMetricsCollection();
          resolve();
        }
      });
    });
  }

  /**
   * Stop the communication bus
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.wss.clients.forEach(ws => {
        ws.close();
      });

      this.server.close(() => {
        console.log('Agent Communication Bus stopped');
        resolve();
      });
    });
  }

  /**
   * Register a new agent
   */
  async registerAgent(registration: AgentRegistration): Promise<string> {
    const { agent_descriptor } = registration;
    
    // Validate agent descriptor
    if (!this.validateAgentDescriptor(agent_descriptor)) {
      throw new Error('Invalid agent descriptor');
    }

    // Check if agent already exists
    if (this.registeredAgents.has(agent_descriptor.agent_id)) {
      throw new Error(`Agent ${agent_descriptor.agent_id} already registered`);
    }

    // Register agent
    this.registeredAgents.set(agent_descriptor.agent_id, agent_descriptor);
    this.messageQueue.set(agent_descriptor.agent_id, []);
    
    // Update metrics
    this.metrics.registered_agents = this.registeredAgents.size;
    
    // Setup health checking
    this.setupHealthCheck(agent_descriptor.agent_id, registration.health_check_url);
    
    this.emit('agent_registered', { agent_id: agent_descriptor.agent_id, descriptor: agent_descriptor });
    
    return agent_descriptor.agent_id;
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<boolean> {
    if (!this.registeredAgents.has(agentId)) {
      return false;
    }

    // Remove from registry
    this.registeredAgents.delete(agentId);
    this.messageQueue.delete(agentId);
    
    // Close WebSocket connection if exists
    const ws = this.agentConnections.get(agentId);
    if (ws) {
      ws.close();
      this.agentConnections.delete(agentId);
    }

    // Update metrics
    this.metrics.registered_agents = this.registeredAgents.size;
    
    this.emit('agent_unregistered', { agent_id: agentId });
    
    return true;
  }

  /**
   * Send message to specific agent
   */
  async sendMessage(message: AgentMessage): Promise<boolean> {
    try {
      // Route message
      const routing = this.messageRouter.routeMessage(message);
      if (!routing.success) {
        throw new Error(routing.error || 'Message routing failed');
      }

      // Update metrics
      this.metrics.total_messages++;
      
      // Send via WebSocket if connected
      const ws = this.agentConnections.get(message.recipient.agent_id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
      }

      // Queue message for later delivery
      const queue = this.messageQueue.get(message.recipient.agent_id);
      if (queue) {
        queue.push(message);
        return true;
      }

      throw new Error(`Agent ${message.recipient.agent_id} not available`);
    } catch (error) {
      this.metrics.error_rate = this.calculateErrorRate();
      this.emit('message_failed', { message, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcastMessage(
    senderId: string,
    recipientIds: string[],
    message: Omit<AgentMessage, 'recipient' | 'message_id' | 'timestamp'>
  ): Promise<{ successful: string[], failed: string[] }> {
    const results: { successful: string[], failed: string[] } = { successful: [], failed: [] };

    for (const recipientId of recipientIds) {
      const fullMessage: AgentMessage = {
        ...message,
        message_id: uuidv4(),
        timestamp: new Date().toISOString(),
        sender: { agent_id: senderId, framework: 'communication-bus' },
        recipient: { agent_id: recipientId, framework: this.extractFramework(recipientId) }
      };

      try {
        const success = await this.sendMessage(fullMessage);
        if (success) {
          results.successful.push(recipientId);
        } else {
          results.failed.push(recipientId);
        }
      } catch (error) {
        results.failed.push(recipientId);
      }
    }

    return results;
  }

  /**
   * Get registered agents
   */
  getRegisteredAgents(): AgentDescriptor[] {
    return Array.from(this.registeredAgents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentDescriptor | null {
    return this.registeredAgents.get(agentId) || null;
  }

  /**
   * Get bus metrics
   */
  getMetrics(): BusMetrics {
    return {
      ...this.metrics,
      active_sessions: this.sessionManager.getActiveSessions().length,
      uptime: Date.now() - this.metrics.uptime
    };
  }

  /**
   * Get agent health status
   */
  getAgentHealth(_agentId: string): HealthStatus | null {
    // This would be implemented with actual health checking logic
    return null;
  }

  /**
   * Private setup methods
   */
  private setupExpress(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Agent registration endpoint
    this.app.post('/agents/register', async (req, res) => {
      try {
        const registration: AgentRegistration = req.body;
        const agentId = await this.registerAgent(registration);
        res.json({ success: true, agent_id: agentId });
      } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
      }
    });

    // Agent unregistration endpoint
    this.app.delete('/agents/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const success = await this.unregisterAgent(agentId);
        res.json({ success: success });
      } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
      }
    });

    // Message sending endpoint
    this.app.post('/messages/send', async (req, res) => {
      try {
        const message: AgentMessage = req.body;
        const success = await this.sendMessage(message);
        res.json({ success: success });
      } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', (_req, res) => {
      res.json(this.getMetrics());
    });

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', uptime: Date.now() - this.metrics.uptime });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const agentId = this.extractAgentIdFromRequest(req);
      
      if (!agentId || !this.registeredAgents.has(agentId)) {
        ws.close(1008, 'Agent not registered');
        return;
      }

      this.agentConnections.set(agentId, ws);
      
      // Send queued messages
      const queue = this.messageQueue.get(agentId);
      if (queue && queue.length > 0) {
        queue.forEach(message => {
          ws.send(JSON.stringify(message));
        });
        queue.length = 0; // Clear queue
      }

      ws.on('message', (data: string | Buffer) => {
        try {
          const message: AgentMessage = JSON.parse(data.toString());
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error('Invalid message format:', error);
        }
      });

      ws.on('close', () => {
        this.agentConnections.delete(agentId);
        this.emit('agent_disconnected', { agent_id: agentId });
      });

      this.emit('agent_connected', { agent_id: agentId });
    });
  }

  private setupEventHandlers(): void {
    this.sessionManager.on('session_created', (event) => {
      this.emit('session_created', event);
    });

    this.sessionManager.on('task_delegated', (event) => {
      this.emit('task_delegated', event);
    });

    this.messageRouter.on('routing_failed', (event) => {
      this.emit('routing_failed', event);
    });
  }

  private setupHealthCheck(agentId: string, _healthCheckUrl: string): void {
    setInterval(async () => {
      try {
        // This would implement actual health checking
        // For now, just emit a heartbeat event
        this.emit('agent_heartbeat', { agent_id: agentId, status: 'healthy' });
      } catch (error) {
        this.emit('agent_health_failed', { agent_id: agentId, error: (error as Error).message });
      }
    }, 30000); // Check every 30 seconds
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.metrics.throughput = this.calculateThroughput();
      this.metrics.average_response_time = this.calculateAverageResponseTime();
    }, 10000); // Update every 10 seconds
  }

  private handleIncomingMessage(message: AgentMessage): void {
    // Route message to appropriate handler
    switch (message.message_type) {
      case 'task_request':
        this.handleTaskRequest(message);
        break;
      case 'task_response':
        this.handleTaskResponse(message);
        break;
      case 'status_update':
        this.handleStatusUpdate(message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
      default:
        console.warn('Unknown message type:', message.message_type);
    }
  }

  private handleTaskRequest(message: AgentMessage): void {
    // Delegate task to appropriate agent
    const taskId = this.sessionManager.delegateTask(
      message.sender.agent_id,
      message.recipient.agent_id,
      message.payload.task_type,
      message.payload,
      {
        priority: message.priority,
        sessionId: message.sender.session_id,
        timeout: parseInt(message.routing.timeout)
      }
    );

    // Update message with task ID
    message.metadata = { ...message.metadata, task_id: taskId };
    
    this.emit('task_request_received', { message, task_id: taskId });
  }

  private handleTaskResponse(message: AgentMessage): void {
    const taskId = message.metadata?.task_id;
    if (taskId) {
      this.sessionManager.updateTaskStatus(taskId, 'completed', message.payload);
    }
    
    this.emit('task_response_received', { message, task_id: taskId });
  }

  private handleStatusUpdate(message: AgentMessage): void {
    this.emit('status_update_received', { message });
  }

  private handleHeartbeat(message: AgentMessage): void {
    this.emit('heartbeat_received', { agent_id: message.sender.agent_id });
  }

  private validateAgentDescriptor(descriptor: AgentDescriptor): boolean {
    return !!(
      descriptor.agent_id &&
      descriptor.framework &&
      descriptor.capabilities &&
      descriptor.endpoints &&
      descriptor.metadata
    );
  }

  private extractFramework(agentId: string): string {
    const match = agentId.match(/^(\w+):\/\//);
    return match ? match[1] : 'unknown';
  }

  private extractAgentIdFromRequest(req: any): string | null {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    return url.searchParams.get('agent_id');
  }

  private calculateErrorRate(): number {
    // This would be implemented with actual error tracking
    return 0.05; // Placeholder
  }

  private calculateThroughput(): number {
    // This would be implemented with actual throughput calculation
    return 10.5; // Placeholder
  }

  private calculateAverageResponseTime(): number {
    // This would be implemented with actual response time tracking
    return 150; // Placeholder in milliseconds
  }
}