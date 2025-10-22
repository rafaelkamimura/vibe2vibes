import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  AgentMessage,
  AgentDescriptor,
  AgentRegistration
} from '../types/protocol';

export abstract class BaseAdapter extends EventEmitter {
  protected agentId: string;
  protected busUrl: string;
  protected descriptor: AgentDescriptor;
  protected ws?: WebSocket;
  protected isConnected: boolean = false;
  protected reconnectAttempts: number = 0;
  protected maxReconnectAttempts: number = 5;
  protected reconnectDelay: number = 5000;

  constructor(
    agentId: string,
    busUrl: string,
    descriptor: AgentDescriptor
  ) {
    super();
    this.agentId = agentId;
    this.busUrl = busUrl;
    this.descriptor = descriptor;
  }

  /**
   * Initialize adapter and connect to communication bus
   */
  async initialize(): Promise<void> {
    await this.connectToBus();
    await this.registerAgent();
  }

  /**
   * Connect to communication bus via WebSocket
   */
  private async connectToBus(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.busUrl.replace('http', 'ws') + `?agent_id=${this.agentId}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.log('Connected to communication bus');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: AgentMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.log(`Error parsing message: ${(error as Error).message}`);
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.log('Disconnected from communication bus');
        this.handleReconnect();
      });

      this.ws.on('error', (error) => {
        this.log(`WebSocket error: ${error.message}`);
        if (!this.isConnected) {
          reject(error);
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Register agent with communication bus
   */
  private async registerAgent(): Promise<void> {
    const registration: AgentRegistration = {
      agent_descriptor: this.descriptor,
      health_check_url: `http://localhost:3000/health/${this.agentId}`,
      authentication: {
        type: 'api_key',
        credentials: process.env.AGENT_API_KEY || 'default-key'
      }
    };

    const response = await this.makeHttpRequest('/agents/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registration)
    });

    if (!response.success) {
      throw new Error(`Failed to register agent: ${response.error}`);
    }

    this.log(`Agent registered successfully: ${this.agentId}`);
  }

  /**
   * Handle incoming messages (to be implemented by subclasses)
   */
  protected abstract handleMessage(message: AgentMessage): Promise<void>;

  /**
   * Send message to communication bus
   */
  protected async sendMessage(message: AgentMessage): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to communication bus');
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.log(`Message sent: ${message.message_type} to ${message.recipient.agent_id}`);
    } catch (error) {
      this.log(`Error sending message: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Generate unique message ID
   */
  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connectToBus().catch(error => {
          this.log(`Reconnection failed: ${error.message}`);
        });
      }, this.reconnectDelay);
    } else {
      this.log('Max reconnection attempts reached');
      this.emit('reconnect_failed');
    }
  }

  /**
   * Make HTTP request to communication bus
   */
  private async makeHttpRequest(
    endpoint: string,
    options: RequestInit
  ): Promise<any> {
    try {
      const response = await fetch(`${this.busUrl}${endpoint}`, options);
      const data: any = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`
        };
      }
      
      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Log message with agent ID prefix
   */
  protected log(message: string): void {
    console.log(`[${this.agentId}] ${message}`);
  }

  /**
   * Shutdown adapter
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down adapter...');
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.isConnected = false;
    this.removeAllListeners();
    
    this.log('Adapter shutdown complete');
  }

  /**
   * Get agent descriptor
   */
  getDescriptor(): AgentDescriptor {
    return this.descriptor;
  }

  /**
   * Check if adapter is connected
   */
  isAgentConnected(): boolean {
    return this.isConnected;
  }
}