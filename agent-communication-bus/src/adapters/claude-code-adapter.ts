import { spawn, ChildProcess } from 'child_process';
import { 
  AgentMessage, 
  AgentDescriptor
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
  pathToClaudeCodeExecutable?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  settingSources?: ('user' | 'project' | 'local')[];
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
  private taskQueue: Array<{ message: AgentMessage; resolve: () => void; reject: (error: Error) => void }> = [];
  private claudeProcesses: Map<string, ChildProcess> = new Map();

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
    
    // Test Claude Code executable availability
    try {
      await this.testClaudeCodeExecutable();
    } catch (error) {
      throw new Error(`Claude Code executable not available: ${(error as Error).message}`);
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
    // Check concurrent task limit
    if (this.activeTasks.size >= this.config.maxConcurrentTasks!) {
      this.taskQueue.push({
        message,
        resolve: () => {},
        reject: (_error: Error) => {}
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
    
    // Convert task to Claude Code command
    const command = this.buildClaudeCommand(task_type, payload);
    
    const startTime = Date.now();
    
    try {
      // Execute Claude Code process
      const result = await this.spawnClaudeProcess(command, message.message_id);
      
      const duration = Date.now() - startTime;

      return {
        ...result,
        metadata: {
          execution_time: duration,
          command: command.description,
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
   * Build Claude Code command based on task type
   */
  private buildClaudeCommand(taskType: string, payload: any): { args: string[]; description: string } {
    switch (taskType) {
      case 'code_review':
        return {
          args: [
            'task',
            'code-review',
            '--subagent', 'code-reviewer',
            '--prompt', `Review the following code for quality, security, and best practices:\n\n${payload.code || payload.file_path}`
          ],
          description: 'Code review and analysis'
        };

      case 'architecture_design':
        return {
          args: [
            'task',
            'architecture-design',
            '--subagent', 'backend-architect',
            '--prompt', `Design system architecture for: ${payload.requirements}\n\nConstraints: ${payload.constraints?.join(', ') || 'none'}`
          ],
          description: 'System architecture design'
        };

      case 'security_analysis':
        return {
          args: [
            'task',
            'security-analysis',
            '--subagent', 'security-auditor',
            '--prompt', `Perform security analysis on: ${payload.target}\n\nFocus areas: ${payload.focus_areas?.join(', ') || 'all'}`
          ],
          description: 'Security vulnerability assessment'
        };

      case 'performance_optimization':
        return {
          args: [
            'task',
            'performance-optimization',
            '--subagent', 'performance-engineer',
            '--prompt', `Optimize performance for: ${payload.target}\n\nMetrics: ${payload.metrics?.join(', ') || 'speed,memory'}`
          ],
          description: 'Performance optimization analysis'
        };

      case 'test_generation':
        return {
          args: [
            'task',
            'test-generation',
            '--subagent', 'test-automator',
            '--prompt', `Generate comprehensive tests for: ${payload.target}\n\nTest type: ${payload.test_type || 'unit'}`
          ],
          description: 'Automated test generation'
        };

      case 'debugging':
        return {
          args: [
            'task',
            'debugging',
            '--subagent', 'debugger',
            '--prompt', `Debug the following issue: ${payload.error}\n\nContext: ${payload.context || 'No additional context'}`
          ],
          description: 'Debugging and issue resolution'
        };

      case 'documentation':
        return {
          args: [
            'task',
            'documentation',
            '--subagent', 'technical-writer',
            '--prompt', `Create documentation for: ${payload.target}\n\nType: ${payload.doc_type || 'api'}`
          ],
          description: 'Technical documentation generation'
        };

      case 'database_optimization':
        return {
          args: [
            'task',
            'database-optimization',
            '--subagent', 'database-optimizer',
            '--prompt', `Optimize database for: ${payload.target}\n\nFocus: ${payload.optimization_type || 'query_performance'}`
          ],
          description: 'Database optimization and tuning'
        };

      case 'frontend_development':
        return {
          args: [
            'task',
            'frontend-development',
            '--subagent', 'frontend-developer',
            '--prompt', `Develop frontend component: ${payload.specification}\n\nFramework: ${payload.framework || 'React'}`
          ],
          description: 'Frontend component development'
        };

      case 'backend_development':
        return {
          args: [
            'task',
            'backend-development',
            '--subagent', 'backend-developer',
            '--prompt', `Develop backend service: ${payload.specification}\n\nLanguage: ${payload.language || 'TypeScript'}`
          ],
          description: 'Backend service development'
        };

      case 'golang_development':
        return {
          args: [
            'task',
            'golang-development',
            '--subagent', 'golang-pro',
            '--prompt', `Develop Go solution: ${payload.specification}\n\nFocus: ${payload.focus || 'idiomatic_go'}`
          ],
          description: 'Go language development'
        };

      case 'python_development':
        return {
          args: [
            'task',
            'python-development',
            '--subagent', 'python-pro',
            '--prompt', `Develop Python solution: ${payload.specification}\n\nFocus: ${payload.focus || 'best_practices'}`
          ],
          description: 'Python language development'
        };

      default:
        return {
          args: [
            'task',
            taskType,
            '--subagent', payload.subagent_type || 'general',
            '--prompt', payload.prompt || `Execute task: ${taskType}\n\nDetails: ${JSON.stringify(payload)}`
          ],
          description: payload.description || `Generic task: ${taskType}`
        };
    }
  }

/**
   * Spawn Claude Code process with command
   */
  private async spawnClaudeProcess(command: { args: string[]; description: string }, messageId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const childProcess = spawn(this.config.pathToClaudeCodeExecutable || 'claude', command.args, {
        cwd: this.config.workspacePath || process.cwd(),
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: this.config.claudeApiKey || process.env.ANTHROPIC_API_KEY
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        childProcess.kill('SIGKILL');
        reject(new Error(`Claude Code task timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        if (code === 0) {
          try {
            const result = this.parseClaudeOutput(stdout, command.description);
            resolve({
              ...result,
              metadata: {
                execution_time: duration,
                exit_code: code,
                command: command.description
              }
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse Claude Code output: ${(parseError as Error).message}`));
          }
        } else {
          reject(new Error(`Claude Code failed with exit code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Claude Code process error: ${error.message}`));
      });

      // Store process reference
      this.claudeProcesses.set(messageId, childProcess);
    });
  }

  /**
   * Parse Claude Code output
   */
  private parseClaudeOutput(stdout: string, taskDescription: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(stdout);
    } catch {
      // Fallback to text parsing
      return {
        type: 'claude_code_response',
        content: stdout,
        task_description: taskDescription,
        raw_output: stdout
      };
    }
  }

  /**
   * Test Claude Code executable availability
   */
  private async testClaudeCodeExecutable(): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(this.config.pathToClaudeCodeExecutable || 'claude', ['--version'], {
        stdio: 'pipe'
      });

      childProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude Code executable not accessible (exit code: ${code})`));
        }
      });

      childProcess.on('error', (error: Error) => {
        reject(error);
      });
    });
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

    const { message } = this.taskQueue.shift()!;

    this.handleTaskRequest(message).catch(err => this.log(`Error processing queued task: ${err.message}`));
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
    // Kill all running Claude processes
    for (const [messageId, process] of this.claudeProcesses) {
      try {
        process.kill('SIGTERM');
        this.log(`Killed Claude process for task ${messageId}`);
      } catch (error) {
        this.log(`Error killing process ${messageId}: ${(error as Error).message}`);
      }
    }

    this.claudeProcesses.clear();
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
      tools: ['git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'testing_frameworks', 'ci_cd', 'claude-code-cli'],
      model_preferences: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
      optimal_tasks: ['architecture', 'code_review', 'refactoring', 'testing', 'debugging', 'documentation', 'api_design'],
      performance_profile: {
        avg_response_time: '8s',
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
      description: 'Claude Code adapter for AI-powered development assistance and analysis using Claude Agent SDK'
    }
  };
}