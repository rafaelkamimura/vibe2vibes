import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { 
  AgentMessage, 
  AgentDescriptor, 
  AgentRegistration,
  CommunicationBusConfig
} from '../types/protocol';
import { BaseAdapter } from './base-adapter';

export interface OpenCodeConfig {
  binaryPath: string;
  workingDirectory: string;
  environment?: Record<string, string>;
  timeout?: number;
  maxConcurrentTasks?: number;
}

export class OpenCodeAdapter extends BaseAdapter {
  private config: OpenCodeConfig;
  private processes: Map<string, ChildProcess> = new Map();
  private activeTasks: Map<string, Promise<any>> = new Map();
  private taskQueue: Array<{ message: AgentMessage; resolve: Function; reject: Function }> = [];

  constructor(
    agentId: string,
    busUrl: string,
    config: OpenCodeConfig,
    descriptor?: AgentDescriptor
  ) {
    super(agentId, busUrl, descriptor || createDefaultOpenCodeDescriptor(agentId));
    this.config = {
      timeout: 300000, // 5 minutes
      maxConcurrentTasks: 3,
      ...config
    };
  }

  /**
   * Initialize OpenCode adapter
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Test OpenCode binary availability
    try {
      await this.testOpenCodeBinary();
    } catch (error) {
      throw new Error(`OpenCode binary not available: ${(error as Error).message}`);
    }

    this.log('OpenCode adapter initialized successfully');
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
   * Handle task request by executing OpenCode with appropriate parameters
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

    const taskPromise = this.executeOpenCodeTask(message);
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
   * Execute OpenCode task
   */
  private async executeOpenCodeTask(message: AgentMessage): Promise<any> {
    const { task_type, payload } = message.payload;
    
    // Convert task to OpenCode command
    const command = this.buildOpenCodeCommand(task_type, payload);
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const process = spawn(this.config.binaryPath, command.args, {
        cwd: this.config.workingDirectory,
        env: { ...process.env, ...this.config.environment },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        reject(new Error(`OpenCode task timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        if (code === 0) {
          try {
            const result = this.parseOpenCodeOutput(stdout, task_type);
            resolve({
              ...result,
              metadata: {
                execution_time: duration,
                exit_code: code,
                command: command.description
              }
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse OpenCode output: ${(parseError as Error).message}`));
          }
        } else {
          reject(new Error(`OpenCode failed with exit code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`OpenCode process error: ${error.message}`));
      });

      // Store process reference
      this.processes.set(message.message_id, process);
    });
  }

  /**
   * Build OpenCode command based on task type
   */
  private buildOpenCodeCommand(taskType: string, payload: any): { args: string[]; description: string } {
    switch (taskType) {
      case 'code_review':
        return {
          args: ['review', payload.file_path || '.', '--format', 'json'],
          description: `Code review for ${payload.file_path || 'current directory'}`
        };

      case 'code_generation':
        return {
          args: [
            'generate',
            '--prompt', payload.prompt,
            '--language', payload.language || 'auto',
            '--output', payload.output_path || '-'
          ],
          description: `Code generation: ${payload.prompt.substring(0, 50)}...`
        };

      case 'debug_analysis':
        return {
          args: [
            'debug',
            '--error', payload.error_message,
            '--context', payload.context_file || ''
          ],
          description: `Debug analysis for: ${payload.error_message.substring(0, 50)}...`
        };

      case 'architecture_analysis':
        return {
          args: [
            'analyze',
            '--type', 'architecture',
            '--path', payload.project_path || '.',
            '--focus', payload.focus_areas?.join(',') || 'all'
          ],
          description: `Architecture analysis for ${payload.project_path || 'current project'}`
        };

      case 'security_scan':
        return {
          args: [
            'security',
            '--scan-type', payload.scan_type || 'full',
            '--path', payload.target_path || '.',
            '--severity', payload.min_severity || 'medium'
          ],
          description: `Security scan: ${payload.scan_type || 'full'}`
        };

      case 'performance_optimization':
        return {
          args: [
            'optimize',
            '--target', payload.target_path || '.',
            '--metrics', payload.metrics?.join(',') || 'speed,memory',
            '--profile', payload.profile || 'default'
          ],
          description: `Performance optimization for ${payload.target_path || 'current project'}`
        };

      default:
        // Generic task execution
        return {
          args: ['task', taskType, '--json', JSON.stringify(payload)],
          description: `Generic task: ${taskType}`
        };
    }
  }

  /**
   * Parse OpenCode output based on task type
   */
  private parseOpenCodeOutput(stdout: string, taskType: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(stdout);
    } catch {
      // Fallback to text parsing
      switch (taskType) {
        case 'code_review':
          return this.parseCodeReviewOutput(stdout);
        case 'code_generation':
          return this.parseCodeGenerationOutput(stdout);
        case 'debug_analysis':
          return this.parseDebugAnalysisOutput(stdout);
        default:
          return {
            type: 'text_output',
            content: stdout,
            task_type: taskType
          };
      }
    }
  }

  private parseCodeReviewOutput(stdout: string): any {
    const lines = stdout.split('\n');
    const issues = [];
    const suggestions = [];
    
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('ISSUES:')) {
        currentSection = 'issues';
      } else if (line.startsWith('SUGGESTIONS:')) {
        currentSection = 'suggestions';
      } else if (line.trim()) {
        if (currentSection === 'issues') {
          issues.push(line.trim());
        } else if (currentSection === 'suggestions') {
          suggestions.push(line.trim());
        }
      }
    }

    return {
      type: 'code_review',
      issues,
      suggestions,
      summary: `Found ${issues.length} issues and ${suggestions.length} suggestions`
    };
  }

  private parseCodeGenerationOutput(stdout: string): any {
    return {
      type: 'code_generation',
      generated_code: stdout,
      language: this.detectLanguage(stdout),
      lines: stdout.split('\n').length
    };
  }

  private parseDebugAnalysisOutput(stdout: string): any {
    const lines = stdout.split('\n');
    const analysis = {
      root_cause: '',
      suggested_fixes: [],
      related_files: []
    };

    for (const line of lines) {
      if (line.startsWith('ROOT CAUSE:')) {
        analysis.root_cause = line.replace('ROOT CAUSE:', '').trim();
      } else if (line.startsWith('FIX:')) {
        analysis.suggested_fixes.push(line.replace('FIX:', '').trim());
      } else if (line.startsWith('FILE:')) {
        analysis.related_files.push(line.replace('FILE:', '').trim());
      }
    }

    return {
      type: 'debug_analysis',
      ...analysis
    };
  }

  private detectLanguage(code: string): string {
    if (code.includes('func ') || code.includes('package ')) return 'go';
    if (code.includes('def ') || code.includes('import ')) return 'python';
    if (code.includes('function ') || code.includes('const ')) return 'javascript';
    if (code.includes('public class ') || code.includes('import java')) return 'java';
    return 'unknown';
  }

  /**
   * Handle status update messages
   */
  private async handleStatusUpdate(message: AgentMessage): Promise<void> {
    // Update adapter status based on message
    const status = message.payload.status;
    this.log(`Status update received: ${status}`);
    
    // Could trigger health checks, cleanup, etc.
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
   * Test OpenCode binary availability
   */
  private async testOpenCodeBinary(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.binaryPath, ['--version'], {
        stdio: 'pipe'
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`OpenCode binary not accessible (exit code: ${code})`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
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
        framework: 'opencode'
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
        framework: 'opencode'
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
    // Kill all running processes
    for (const [messageId, process] of this.processes) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        this.log(`Error killing process ${messageId}: ${(error as Error).message}`);
      }
    }

    this.processes.clear();
    this.activeTasks.clear();
    this.taskQueue.length = 0;

    await super.shutdown();
  }
}

/**
 * Create default OpenCode agent descriptor
 */
function createDefaultOpenCodeDescriptor(agentId: string): AgentDescriptor {
  return {
    agent_id: agentId,
    framework: 'opencode',
    capabilities: {
      input_types: ['code', 'documentation', 'error_logs', 'project_structure'],
      output_types: ['analysis_report', 'generated_code', 'suggestions', 'fixes'],
      languages: ['go', 'python', 'javascript', 'typescript', 'java', 'c++', 'rust'],
      tools: ['git', 'linter', 'test_runner', 'debugger', 'profiler'],
      model_preferences: ['claude-3.5-sonnet', 'gpt-4-turbo'],
      performance_profile: {
        avg_response_time: '5s',
        success_rate: 0.95,
        concurrent_capacity: 3
      }
    },
    endpoints: {
      mcp: `stdio://${agentId}`,
      http: `http://localhost:3001/${agentId}`,
      websocket: `ws://localhost:3001/ws/${agentId}`
    },
    metadata: {
      version: '1.0.0',
      author: 'opencode-team',
      tags: ['code', 'analysis', 'generation', 'debugging'],
      description: 'OpenCode agent for code analysis, generation, and debugging tasks'
    }
  };
}