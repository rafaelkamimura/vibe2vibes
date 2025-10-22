import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { AgentMessage, AgentDescriptor } from '../../src/types/protocol';

/**
 * Test helper utilities for agent communication bus testing
 */

export class MockWebSocket extends EventEmitter {
  public readyState: number = WebSocket.OPEN;
  public sentMessages: any[] = [];

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data));
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close', code, reason);
  }

  // Test helper methods
  simulateMessage(data: any): void {
    this.emit('message', JSON.stringify(data));
  }

  getLastSentMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getSentMessagesCount(): number {
    return this.sentMessages.length;
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

export class MockWebSocketServer extends EventEmitter {
  public clients: MockWebSocket[] = [];
  public connections: MockWebSocket[] = [];

  constructor() {
    super();
  }

  simulateConnection(ws: MockWebSocket): void {
    this.clients.push(ws);
    this.connections.push(ws);
    this.emit('connection', ws, { url: `ws://localhost:3000/test?agent_id=test-agent` });
  }

  simulateDisconnection(ws: MockWebSocket): void {
    const index = this.clients.indexOf(ws);
    if (index > -1) {
      this.clients.splice(index, 1);
    }
    
    const connIndex = this.connections.indexOf(ws);
    if (connIndex > -1) {
      this.connections.splice(connIndex, 1);
    }
  }

  broadcast(message: any): void {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  getClientCount(): number {
    return this.clients.length;
  }

  clearAll(): void {
    this.clients = [];
    this.connections = [];
  }
}

export class TestTimer {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  setTimeout(callback: () => void, delay: number, id?: string): string {
    const timerId = id || `timer-${Date.now()}`;
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(timerId);
    }, delay);
    
    this.timers.set(timerId, timer);
    return timerId;
  }

  setInterval(callback: () => void, interval: number, id?: string): string {
    const intervalId = id || `interval-${Date.now()}`;
    const timer = setInterval(callback, interval);
    this.timers.set(intervalId, timer);
    return intervalId;
  }

  clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  clearInterval(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
  }

  clearAll(): void {
    this.timers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.timers.clear();
  }

  getActiveTimersCount(): number {
    return this.timers.size;
  }

  hasTimer(id: string): boolean {
    return this.timers.has(id);
  }
}

export class MessageTracker {
  private messages: AgentMessage[] = [];
  private messageMap: Map<string, AgentMessage> = new Map();

  track(message: AgentMessage): void {
    this.messages.push(message);
    this.messageMap.set(message.message_id, message);
  }

  getMessage(messageId: string): AgentMessage | undefined {
    return this.messageMap.get(messageId);
  }

  getMessagesByType(type: AgentMessage['message_type']): AgentMessage[] {
    return this.messages.filter(msg => msg.message_type === type);
  }

  getMessagesByAgent(agentId: string): AgentMessage[] {
    return this.messages.filter(msg => 
      msg.sender.agent_id === agentId || msg.recipient.agent_id === agentId
    );
  }

  getMessagesBySession(sessionId: string): AgentMessage[] {
    return this.messages.filter(msg => 
      msg.sender.session_id === sessionId || msg.recipient.session_id === sessionId
    );
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  getMessageCountByType(type: AgentMessage['message_type']): number {
    return this.getMessagesByType(type).length;
  }

  clear(): void {
    this.messages = [];
    this.messageMap.clear();
  }

  getStatistics(): {
    total: number;
    byType: Record<string, number>;
    byAgent: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    this.messages.forEach(msg => {
      byType[msg.message_type] = (byType[msg.message_type] || 0) + 1;
      byAgent[msg.sender.agent_id] = (byAgent[msg.sender.agent_id] || 0) + 1;
    });

    return {
      total: this.messages.length,
      byType,
      byAgent
    };
  }
}

export class AgentRegistry {
  private agents: Map<string, AgentDescriptor> = new Map();

  register(agent: AgentDescriptor): void {
    this.agents.set(agent.agent_id, agent);
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  get(agentId: string): AgentDescriptor | undefined {
    return this.agents.get(agentId);
  }

  getAll(): AgentDescriptor[] {
    return Array.from(this.agents.values());
  }

  getByFramework(framework: string): AgentDescriptor[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.framework === framework
    );
  }

  getByCapability(capability: string): AgentDescriptor[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.capabilities.input_types.includes(capability) ||
      agent.capabilities.output_types.includes(capability) ||
      agent.capabilities.tools.includes(capability)
    );
  }

  count(): number {
    return this.agents.size;
  }

  clear(): void {
    this.agents.clear();
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }
}

export class TestEventEmitter extends EventEmitter {
  private eventLog: Array<{ event: string; args: any[]; timestamp: number }> = [];

  emit(event: string, ...args: any[]): boolean {
    this.eventLog.push({
      event,
      args,
      timestamp: Date.now()
    });
    return super.emit(event, ...args);
  }

  getEventLog(): Array<{ event: string; args: any[]; timestamp: number }> {
    return [...this.eventLog];
  }

  getEventsByName(eventName: string): Array<{ event: string; args: any[]; timestamp: number }> {
    return this.eventLog.filter(log => log.event === eventName);
  }

  getEventCount(eventName?: string): number {
    if (eventName) {
      return this.getEventsByName(eventName).length;
    }
    return this.eventLog.length;
  }

  getLastEvent(eventName?: string): { event: string; args: any[]; timestamp: number } | null {
    const events = eventName ? this.getEventsByName(eventName) : this.eventLog;
    return events.length > 0 ? events[events.length - 1] : null;
  }

  clearEventLog(): void {
    this.eventLog = [];
  }
}

// Utility functions
export function createDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createPromiseWithTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number,
  timeoutError: Error = new Error('Promise timed out')
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(timeoutError), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export function waitForEvent(
  emitter: EventEmitter,
  eventName: string,
  timeoutMs: number = 5000
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, onEvent);
      reject(new Error(`Event '${eventName}' not received within ${timeoutMs}ms`));
    }, timeoutMs);

    const onEvent = (...args: any[]) => {
      clearTimeout(timer);
      emitter.off(eventName, onEvent);
      resolve(args);
    };

    emitter.on(eventName, onEvent);
  });
}

export function createMockLogger() {
  const logs: Array<{ level: string; message: string; data?: any }> = [];
  
  return {
    logs,
    debug: (message: string, data?: any) => logs.push({ level: 'debug', message, data }),
    info: (message: string, data?: any) => logs.push({ level: 'info', message, data }),
    warn: (message: string, data?: any) => logs.push({ level: 'warn', message, data }),
    error: (message: string, data?: any) => logs.push({ level: 'error', message, data }),
    clear: () => logs.length = 0,
    getLogsByLevel: (level: string) => logs.filter(log => log.level === level),
    getLastLog: () => logs[logs.length - 1] || null
  };
}

// Test configuration helpers
export interface TestConfig {
  timeout: number;
  retries: number;
  delay: number;
  mockData: boolean;
  verbose: boolean;
}

export function createTestConfig(overrides?: Partial<TestConfig>): TestConfig {
  return {
    timeout: 5000,
    retries: 3,
    delay: 100,
    mockData: true,
    verbose: false,
    ...overrides
  };
}