// Main entry point for the Agent Communication Bus

export { CommunicationBus } from './communication-bus';
export { SessionManager } from './session-manager';
export { ModelSelector } from './model-selector';
export { ResultAggregator } from './result-aggregator';
export { MessageRouter } from './message-router';

export { OpenCodeAdapter } from './adapters/opencode-adapter';
export { CodexAdapter } from './adapters/codex-adapter';
export { ClaudeCodeAdapter } from './adapters/claude-code-adapter';
export { BaseAdapter } from './adapters/base-adapter';

export * from './types/protocol';

import { CommunicationBus } from './communication-bus';
import { OpenCodeAdapter } from './adapters/opencode-adapter';
import { CodexAdapter } from './adapters/codex-adapter';
import { ClaudeCodeAdapter } from './adapters/claude-code-adapter';

/**
 * Example usage and factory functions
 */
export class AgentCommunicationFactory {
  /**
   * Create and start a complete communication bus with adapters
   */
  static async createSystem(config: {
    bus: any;
    adapters: Array<{
      type: 'opencode' | 'codex' | 'claude-code';
      agentId: string;
      config: any;
    }>;
  }) {
    // Start communication bus
    const bus = new CommunicationBus(config.bus);
    await bus.start();

    // Create and initialize adapters
    const adapters = [];
    
    for (const adapterConfig of config.adapters) {
      let adapter;
      
      switch (adapterConfig.type) {
        case 'opencode':
          adapter = new OpenCodeAdapter(
            adapterConfig.agentId,
            `http://localhost:${config.bus.port}`,
            adapterConfig.config
          );
          break;
          
        case 'codex':
          adapter = new CodexAdapter(
            adapterConfig.agentId,
            `http://localhost:${config.bus.port}`,
            adapterConfig.config
          );
          break;
          
        case 'claude-code':
          adapter = new ClaudeCodeAdapter(
            adapterConfig.agentId,
            `http://localhost:${config.bus.port}`,
            adapterConfig.config
          );
          break;
          
        default:
          throw new Error(`Unknown adapter type: ${adapterConfig.type}`);
      }
      
      await adapter.initialize();
      adapters.push(adapter);
    }

    return {
      bus,
      adapters,
      shutdown: async () => {
        await Promise.all(adapters.map(adapter => adapter.shutdown()));
        await bus.stop();
      }
    };
  }

  /**
   * Quick start with default configuration
   */
  static async quickStart() {
    return this.createSystem({
      bus: {
        port: 8080,
        host: 'localhost',
        maxConnections: 100,
        heartbeatInterval: 30000,
        messageTimeout: 300000,
        persistenceEnabled: false,
        encryptionEnabled: false
      },
      adapters: [
        {
          type: 'opencode',
          agentId: 'opencode://code-reviewer',
          config: {
            binaryPath: '/usr/local/bin/opencode',
            workingDirectory: process.cwd(),
            maxConcurrentTasks: 3
          }
        },
        {
          type: 'codex',
          agentId: 'codex://frontend-developer',
          config: {
            cliPath: '/usr/local/bin/codex',
            maxConcurrentTasks: 5
          }
        },
        {
          type: 'claude-code',
          agentId: 'claude-code://backend-architect',
          config: {
            workspacePath: process.cwd(),
            maxConcurrentTasks: 3
          }
        }
      ]
    });
  }
}