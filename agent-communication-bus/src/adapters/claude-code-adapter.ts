import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { 
  AgentMessage, 
  AgentDescriptor, 
  AgentRegistration,
  CommunicationBusConfig
} from '../types/protocol';
import { BaseAdapter } from './base-adapter';

export interface ClaudeCodeConfig {
  claudeApiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  maxConcurrentTasks?: number;
  workspacePath?: string;
  projectContext?: Record<string, any>;
}

export interface ClaudeCodeTask {
  type: string;
  prompt: string;
  subagent_type?: string;
  description?: string;
  context?: any;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export class ClaudeCodeAdapter extends BaseAdapter {
  private config: ClaudeCodeConfig;
  private activeTasks: Map<string, Promise<any>> = new Map();
  private taskQueue: Array<{ message: AgentMessage; resolve: Function; reject: Function }> = [];
  private claudeClient: any; // Would be actual Claude client

  constructor(
    agentId: string,
    busUrl: string,
    config: ClaudeCodeConfig,
    descriptor?: AgentDescriptor
  ) {
    super(agentId, busUrl, descriptor || createDefaultClaudeCodeDescriptor(agentId));
    this.config = {
      timeout: 600000, // 10 minutes
      maxConcurrentTasks: 3,
      defaultModel: 'claude-3.5-sonnet',
      ...config
    };
  }

  /**
   * Initialize Claude Code adapter
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Initialize Claude client
    try {
      await this.initializeClaudeClient();
    } catch (error) {
      throw new Error(`Failed to initialize Claude client: ${(error as Error).message}`);
    }

    this.log('Claude Code adapter initialized successfully');
  }

  /**
   * Handle incoming message from communication bus
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    try {
      switch (message.message_type) {
        case 'task_request':
          await this.handleTaskRequest(message);
          break;
        case 'status_update':
          await this.handleStatusUpdate(message);
          break;
        default:
          this.log(`Unhandled message type: ${message.message_type}`);
      }
    } catch (error) {
      this.log(`Error handling message: ${(error as Error).message}`);
      await this.sendErrorResponse(message, error as Error);
    }
  }

  /**
   * Handle task request by invoking Claude Code with appropriate subagent
   */
  private async handleTaskRequest(message: AgentMessage): Promise<void> {
    const { task_type, payload } = message.payload;
    
    // Check concurrent task limit
    if (this.activeTasks.size >= this.config.maxConcurrentTasks!) {
      this.taskQueue.push({
        message,
        resolve: () => {},
        reject: () => {}
      });
      return;
    }

    const taskPromise = this.executeClaudeCodeTask(message);
    this.activeTasks.set(message.message_id, taskPromise);

    try {
      const result = await taskPromise;
      await this.sendSuccessResponse(message, result);
    } catch (error) {
      await this.sendErrorResponse(message, error as Error);
    } finally {
      this.activeTasks.delete(message.message_id);
      this.processQueue();
    }
  }

  /**
   * Execute Claude Code task using appropriate subagent
   */
  private async executeClaudeCodeTask(message: AgentMessage): Promise<any> {
    const { task_type, payload } = message.payload;
    
    // Convert task to Claude Code task
    const claudeTask = this.buildClaudeTask(task_type, payload);
    
    const startTime = Date.now();
    
    try {
      // Execute task with timeout
      const result = await Promise.race([
        this.invokeClaudeCode(claudeTask),
        this.createTimeoutPromise(this.config.timeout!)
      ]);

      const duration = Date.now() - startTime;

      return {
        ...result,
        metadata: {
          execution_time: duration,
          subagent_type: claudeTask.subagent_type,
          model: claudeTask.model || this.config.defaultModel,
          task_type: task_type
        }
      };
    } catch (error) {
      if ((error as Error).message === 'TIMEOUT') {
        throw new Error(`Claude Code task timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Build Claude Code task based on task type
   */
  private buildClaudeTask(taskType: string, payload: any): ClaudeCodeTask {
    const baseTask = {
      type: taskType,
      context: {
        ...this.config.projectContext,
        workspace_path: this.config.workspacePath,
        ...payload.context
      }
    };

    switch (taskType) {
      case 'code_review':
        return {
          ...baseTask,
          subagent_type: 'code-reviewer',
          prompt: `Review the following code for quality, security, and best practices:\n\n${payload.code || payload.file_path}`,
          description: 'Code review and analysis'
        };

      case 'architecture_design':
        return {
          ...baseTask,
          subagent_type: 'backend-architect',
          prompt: `Design system architecture for: ${payload.requirements}\n\nConstraints: ${payload.constraints?.join(', ') || 'none'}`,
          description: 'System architecture design'
        };

      case 'security_analysis':
        return {
          ...baseTask,
          subagent_type: 'security-auditor',
          prompt: `Perform security analysis on: ${payload.target}\n\nFocus areas: ${payload.focus_areas?.join(', ') || 'all'}`,
          description: 'Security vulnerability assessment'
        };

      case 'performance_optimization':
        return {
          ...baseTask,
          subagent_type: 'performance-engineer',
          prompt: `Optimize performance for: ${payload.target}\n\nMetrics: ${payload.metrics?.join(', ') || 'speed,memory'}`,
          description: 'Performance optimization analysis'
        };

      case 'test_generation':
        return {
          ...baseTask,
          subagent_type: 'test-automator',
          prompt: `Generate comprehensive tests for: ${payload.target}\n\nTest type: ${payload.test_type || 'unit'}`,
          description: 'Automated test generation'
        };

      case 'debugging':
        return {
          ...baseTask,
          subagent_type: 'debugger',
          prompt: `Debug the following issue: ${payload.error}\n\nContext: ${payload.context || 'No additional context'}`,
          description: 'Debugging and issue resolution'
        };

      case 'documentation':
        return {
          ...baseTask,
          subagent_type: 'technical-writer',
          prompt: `Create documentation for: ${payload.target}\n\nType: ${payload.doc_type || 'api'}`,
          description: 'Technical documentation generation'
        };

      case 'database_optimization':
        return {
          ...baseTask,
          subagent_type: 'database-optimizer',
          prompt: `Optimize database for: ${payload.target}\n\nFocus: ${payload.optimization_type || 'query_performance'}`,
          description: 'Database optimization and tuning'
        };

      case 'frontend_development':
        return {
          ...baseTask,
          subagent_type: 'frontend-developer',
          prompt: `Develop frontend component: ${payload.specification}\n\nFramework: ${payload.framework || 'React'}`,
          description: 'Frontend component development'
        };

      case 'backend_development':
        return {
          ...baseTask,
          subagent_type: 'backend-developer',
          prompt: `Develop backend service: ${payload.specification}\n\nLanguage: ${payload.language || 'TypeScript'}`,
          description: 'Backend service development'
        };

      case 'golang_development':
        return {
          ...baseTask,
          subagent_type: 'golang-pro',
          prompt: `Develop Go solution: ${payload.specification}\n\nFocus: ${payload.focus || 'idiomatic_go'}`,
          description: 'Go language development'
        };

      case 'python_development':
        return {
          ...baseTask,
          subagent_type: 'python-pro',
          prompt: `Develop Python solution: ${payload.specification}\n\nFocus: ${payload.focus || 'best_practices'}`,
          description: 'Python language development'
        };

      default:
        return {
          ...baseTask,
          subagent_type: payload.subagent_type || 'general',
          prompt: payload.prompt || `Execute task: ${taskType}\n\nDetails: ${JSON.stringify(payload)}`,
          description: payload.description || `Generic task: ${taskType}`
        };
    }
  }

  /**
   * Invoke Claude Code with task
   */
  private async invokeClaudeCode(task: ClaudeCodeTask): Promise<any> {
    // This would integrate with actual Claude Code API
    // For now, simulate the response
    
    const response = await this.simulateClaudeCodeCall(task);
    
    return {
      type: task.type,
      subagent_type: task.subagent_type,
      result: response.content,
      analysis: response.analysis,
      recommendations: response.recommendations,
      confidence: response.confidence || 0.85
    };
  }

  /**
   * Simulate Claude Code API call (placeholder)
   */
  private async simulateClaudeCodeCall(task: ClaudeCodeTask): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Generate mock response based on task type
    switch (task.type) {
      case 'code_review':
        return {
          content: 'Code review completed. Found 3 minor issues and 2 suggestions for improvement.',
          analysis: {
            issues: [
              { type: 'style', line: 15, description: 'Missing error handling' },
              { type: 'security', line: 23, description: 'Potential SQL injection' },
              { type: 'performance', line: 31, description: 'Inefficient loop' }
            ],
            suggestions: [
              'Add input validation',
              'Implement proper error handling'
            ]
          },
          recommendations: ['Address security issues first', 'Refactor for better performance'],
          confidence: 0.92
        };

      case 'architecture_design':
        return {
          content: 'Architecture design completed. Recommended microservices approach with event-driven communication.',
          analysis: {
            pattern: 'Microservices',
            components: ['API Gateway', 'Auth Service', 'Business Logic Services', 'Data Layer'],
            communication: 'REST APIs + Message Queue'
          },
          recommendations: ['Start with core services', 'Implement CI/CD pipeline'],
          confidence: 0.88
        };

      default:
        return {
          content: `Task ${task.type} completed successfully using ${task.subagent_type} subagent.`,
          analysis: { status: 'completed', method: task.subagent_type },
          recommendations: ['Review results', 'Test implementation'],
          confidence: 0.85
        };
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    });
  }

  /**
   * Initialize Claude client
   */
  private async initializeClaudeClient(): Promise<void> {
    // This would initialize actual Claude client
    // For now, just validate configuration
    const apiKey = this.config.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Claude API key not provided');
    }

    // Mock client initialization
    this.claudeClient = {
      apiKey,
      baseUrl: this.config.baseUrl || 'https://api.anthropic.com'
    };
  }

  /**
   * Handle status update messages
   */
  private async handleStatusUpdate(message: AgentMessage): Promise<void> {
    const status = message.payload.status;
    this.log(`Status update received: ${status}`);
    
    if (status === 'shutdown') {
      await this.shutdown();
    }
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.activeTasks.size >= this.config.maxConcurrentTasks!) {
      return;
    }

    const { message, resolve, reject } = this.taskQueue.shift()!;
    
    this.handleTaskRequest(message)
      .then(resolve)
      .catch(reject);
  }

  /**
   * Send success response
   */
  private async sendSuccessResponse(originalMessage: AgentMessage, result: any): Promise<void> {
    const response: AgentMessage = {
      message_id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      sender: {
        agent_id: this.agentId,
        framework: 'claude-code'
      },
      recipient: originalMessage.sender,
      message_type: 'task_response',
      priority: originalMessage.priority,
      payload: {
        task_id: originalMessage.metadata?.task_id,
        result,
        status: 'completed',
        agent_id: this.agentId
      },
      routing: {
        timeout: '30s',
        retry_policy: {
          max_retries: 3,
          backoff: 'exponential'
        },
        delivery_mode: 'async'
      }
    };

    await this.sendMessage(response);
  }

  /**
   * Send error response
   */
  private async sendErrorResponse(originalMessage: AgentMessage, error: Error): Promise<void> {
    const response: AgentMessage = {
      message_id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      sender: {
        agent_id: this.agentId,
        framework: 'claude-code'
      },
      recipient: originalMessage.sender,
      message_type: 'error',
      priority: originalMessage.priority,
      payload: {
        task_id: originalMessage.metadata?.task_id,
        error: error.message,
        status: 'failed',
        agent_id: this.agentId
      },
      routing: {
        timeout: '30s',
        retry_policy: {
          max_retries: 3,
          backoff: 'exponential'
        },
        delivery_mode: 'async'
      }
    };

    await this.sendMessage(response);
  }

  /**
   * Cleanup method
   */
  async shutdown(): Promise<void> {
    // Cancel all active tasks
    for (const [messageId, taskPromise] of this.activeTasks) {
      try {
        // Would implement task cancellation
        this.log(`Cancelling task ${messageId}`);
      } catch (error) {
        this.log(`Error cancelling task ${messageId}: ${(error as Error).message}`);
      }
    }

    this.activeTasks.clear();
    this.taskQueue.length = 0;

    await super.shutdown();
  }
}

/**
 * Create default Claude Code agent descriptor
 */
function createDefaultClaudeCodeDescriptor(agentId: string): AgentDescriptor {
  return {
    agent_id: agentId,
    framework: 'claude-code',
    capabilities: {
      input_types: ['code', 'documentation', 'requirements', 'error_logs', 'specifications'],
      output_types: ['analysis', 'recommendations', 'generated_code', 'documentation', 'fixes'],
      languages: ['javascript', 'typescript', 'python', 'go', 'java', 'c++', 'rust', 'sql', 'html', 'css'],
      tools: ['git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'testing_frameworks', 'ci_cd'],
      model_preferences: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
      performance_profile: {
        avg_response_time: '6s',
        success_rate: 0.94,
        concurrent_capacity: 3
      }
    },
    endpoints: {
      mcp: `stdio://${agentId}`,
      http: `http://localhost:3003/${agentId}`,
      websocket: `ws://localhost:3003/ws/${agentId}`
    },
    metadata: {
      version: '1.0.0',
      author: 'claude-code-team',
      tags: ['ai_assistant', 'code_analysis', 'architecture', 'debugging', 'optimization'],
      description: 'Claude Code adapter for AI-powered development assistance and analysis'
    }
  };
}