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

export interface CodexConfig {
  cliPath: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  maxConcurrentTasks?: number;
  environment?: Record<string, string>;
}

export class CodexAdapter extends BaseAdapter {
  private config: CodexConfig;
  private processes: Map<string, ChildProcess> = new Map();
  private activeTasks: Map<string, Promise<any>> = new Map();
  private taskQueue: Array<{ message: AgentMessage; resolve: Function; reject: Function }> = [];

  constructor(
    agentId: string,
    busUrl: string,
    config: CodexConfig,
    descriptor?: AgentDescriptor
  ) {
    super(agentId, busUrl, descriptor || createDefaultCodexDescriptor(agentId));
    this.config = {
      timeout: 300000, // 5 minutes
      maxConcurrentTasks: 5,
      defaultModel: 'gpt-4-turbo',
      ...config
    };
  }

  /**
   * Initialize Codex adapter
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Test Codex CLI availability
    try {
      await this.testCodexCli();
    } catch (error) {
      throw new Error(`Codex CLI not available: ${(error as Error).message}`);
    }

    this.log('Codex adapter initialized successfully');
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
   * Handle task request by executing Codex CLI
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

    const taskPromise = this.executeCodexTask(message);
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
   * Execute Codex CLI task
   */
  private async executeCodexTask(message: AgentMessage): Promise<any> {
    const { task_type, payload } = message.payload;
    
    // Convert task to Codex CLI command
    const command = this.buildCodexCommand(task_type, payload);
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const env = {
        ...process.env,
        ...this.config.environment,
        CODEX_API_KEY: this.config.apiKey || process.env.CODEX_API_KEY,
        CODEX_BASE_URL: this.config.baseUrl || process.env.CODEX_BASE_URL
      };

      const process = spawn(this.config.cliPath, command.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
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
        reject(new Error(`Codex task timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        if (code === 0) {
          try {
            const result = this.parseCodexOutput(stdout, task_type);
            resolve({
              ...result,
              metadata: {
                execution_time: duration,
                exit_code: code,
                command: command.description,
                model: payload.model || this.config.defaultModel
              }
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse Codex output: ${(parseError as Error).message}`));
          }
        } else {
          reject(new Error(`Codex CLI failed with exit code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Codex CLI process error: ${error.message}`));
      });

      // Store process reference
      this.processes.set(message.message_id, process);
    });
  }

  /**
   * Build Codex CLI command based on task type
   */
  private buildCodexCommand(taskType: string, payload: any): { args: string[]; description: string } {
    const model = payload.model || this.config.defaultModel;
    
    switch (taskType) {
      case 'frontend_development':
        return {
          args: [
            'generate',
            '--type', 'frontend',
            '--framework', payload.framework || 'react',
            '--model', model,
            '--prompt', payload.prompt,
            '--output', payload.output_path || '-'
          ],
          description: `Frontend development with ${payload.framework || 'React'}`
        };

      case 'ui_component':
        return {
          args: [
            'component',
            '--type', payload.component_type || 'functional',
            '--framework', payload.framework || 'react',
            '--model', model,
            '--specification', payload.specification,
            '--styling', payload.styling || 'css'
          ],
          description: `UI component: ${payload.component_type || 'functional'}`
        };

      case 'api_development':
        return {
          args: [
            'api',
            '--type', payload.api_type || 'rest',
            '--language', payload.language || 'typescript',
            '--model', model,
            '--specification', payload.openapi_spec || payload.description
          ],
          description: `API development: ${payload.api_type || 'REST'}`
        };

      case 'database_schema':
        return {
          args: [
            'schema',
            '--database', payload.database_type || 'postgresql',
            '--model', model,
            '--requirements', payload.requirements,
            '--format', payload.format || 'sql'
          ],
          description: `Database schema for ${payload.database_type || 'PostgreSQL'}`
        };

      case 'testing':
        return {
          args: [
            'test',
            '--type', payload.test_type || 'unit',
            '--framework', payload.test_framework || 'jest',
            '--model', model,
            '--target', payload.target_file || '.',
            '--coverage', payload.coverage ? 'true' : 'false'
          ],
          description: `Test generation: ${payload.test_type || 'unit'}`
        };

      case 'documentation':
        return {
          args: [
            'docs',
            '--type', payload.doc_type || 'api',
            '--format', payload.format || 'markdown',
            '--model', model,
            '--source', payload.source_path || '.',
            '--target', payload.output_path || '-'
          ],
          description: `Documentation: ${payload.doc_type || 'API'}`
        };

      case 'migration':
        return {
          args: [
            'migrate',
            '--from', payload.from_framework || 'legacy',
            '--to', payload.to_framework || 'modern',
            '--model', model,
            '--source', payload.source_path,
            '--target', payload.target_path
          ],
          description: `Migration: ${payload.from_framework} to ${payload.to_framework}`
        };

      case 'deployment':
        return {
          args: [
            'deploy',
            '--platform', payload.platform || 'docker',
            '--model', model,
            '--config', payload.deployment_config,
            '--environment', payload.environment || 'production'
          ],
          description: `Deployment configuration for ${payload.platform || 'Docker'}`
        };

      default:
        // Generic task execution
        return {
          args: [
            'task',
            taskType,
            '--model', model,
            '--input', JSON.stringify(payload),
            '--format', 'json'
          ],
          description: `Generic task: ${taskType}`
        };
    }
  }

  /**
   * Parse Codex CLI output based on task type
   */
  private parseCodexOutput(stdout: string, taskType: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(stdout);
    } catch {
      // Fallback to text parsing
      switch (taskType) {
        case 'frontend_development':
        case 'ui_component':
          return this.parseCodeOutput(stdout, taskType);
        case 'api_development':
          return this.parseApiOutput(stdout);
        case 'database_schema':
          return this.parseSchemaOutput(stdout);
        case 'testing':
          return this.parseTestOutput(stdout);
        case 'documentation':
          return this.parseDocumentationOutput(stdout);
        default:
          return {
            type: 'text_output',
            content: stdout,
            task_type: taskType
          };
      }
    }
  }

  private parseCodeOutput(stdout: string, taskType: string): any {
    return {
      type: taskType,
      generated_code: stdout,
      language: this.detectLanguage(stdout),
      lines: stdout.split('\n').length,
      files: this.extractFiles(stdout)
    };
  }

  private parseApiOutput(stdout: string): any {
    const lines = stdout.split('\n');
    const endpoints = [];
    const models = [];
    
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('ENDPOINTS:')) {
        currentSection = 'endpoints';
      } else if (line.startsWith('MODELS:')) {
        currentSection = 'models';
      } else if (line.trim()) {
        if (currentSection === 'endpoints') {
          endpoints.push(line.trim());
        } else if (currentSection === 'models') {
          models.push(line.trim());
        }
      }
    }

    return {
      type: 'api_development',
      endpoints,
      models,
      summary: `Generated ${endpoints.length} endpoints and ${models.length} models`
    };
  }

  private parseSchemaOutput(stdout: string): any {
    const tables = this.extractTables(stdout);
    const relationships = this.extractRelationships(stdout);

    return {
      type: 'database_schema',
      tables,
      relationships,
      summary: `Generated schema with ${tables.length} tables`
    };
  }

  private parseTestOutput(stdout: string): any {
    const testCases = this.extractTestCases(stdout);
    const coverage = this.extractCoverage(stdout);

    return {
      type: 'testing',
      test_cases: testCases,
      coverage: coverage,
      summary: `Generated ${testCases.length} test cases`
    };
  }

  private parseDocumentationOutput(stdout: string): any {
    return {
      type: 'documentation',
      content: stdout,
      format: 'markdown',
      sections: this.extractSections(stdout)
    };
  }

  private extractFiles(stdout: string): string[] {
    const files = [];
    const fileRegex = /File:\s*(.+)$/gm;
    let match;
    
    while ((match = fileRegex.exec(stdout)) !== null) {
      files.push(match[1]);
    }
    
    return files;
  }

  private extractTables(stdout: string): any[] {
    const tables = [];
    const tableRegex = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\);/g;
    let match;
    
    while ((match = tableRegex.exec(stdout)) !== null) {
      tables.push({
        name: match[1],
        definition: match[2].trim()
      });
    }
    
    return tables;
  }

  private extractRelationships(stdout: string): any[] {
    const relationships = [];
    const fkRegex = /FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/g;
    let match;
    
    while ((match = fkRegex.exec(stdout)) !== null) {
      relationships.push({
        from_table: '', // Would need more complex parsing
        from_column: match[1],
        to_table: match[2],
        to_column: match[3]
      });
    }
    
    return relationships;
  }

  private extractTestCases(stdout: string): any[] {
    const testCases = [];
    const testRegex = /test\s+['"]([^'"]+)['"]\s*\{([\s\S]*?)\}/g;
    let match;
    
    while ((match = testRegex.exec(stdout)) !== null) {
      testCases.push({
        name: match[1],
        body: match[2].trim()
      });
    }
    
    return testCases;
  }

  private extractCoverage(stdout: string): any {
    const coverageMatch = stdout.match(/Coverage:\s*(\d+)%/);
    return {
      percentage: coverageMatch ? parseInt(coverageMatch[1]) : 0
    };
  }

  private extractSections(stdout: string): string[] {
    const sections = [];
    const headerRegex = /^#{1,6}\s+(.+)$/gm;
    let match;
    
    while ((match = headerRegex.exec(stdout)) !== null) {
      sections.push(match[1]);
    }
    
    return sections;
  }

  private detectLanguage(code: string): string {
    if (code.includes('import React') || code.includes('export default')) return 'javascript';
    if (code.includes('from ')) return 'python';
    if (code.includes('package ') || code.includes('func ')) return 'go';
    if (code.includes('public class ')) return 'java';
    if (code.includes('CREATE TABLE')) return 'sql';
    return 'unknown';
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
   * Test Codex CLI availability
   */
  private async testCodexCli(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.cliPath, ['--version'], {
        stdio: 'pipe'
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Codex CLI not accessible (exit code: ${code})`));
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
        framework: 'codex'
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
        framework: 'codex'
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
 * Create default Codex agent descriptor
 */
function createDefaultCodexDescriptor(agentId: string): AgentDescriptor {
  return {
    agent_id: agentId,
    framework: 'codex',
    capabilities: {
      input_types: ['specifications', 'requirements', 'existing_code', 'api_docs'],
      output_types: ['generated_code', 'configurations', 'documentation', 'test_suites'],
      languages: ['javascript', 'typescript', 'python', 'java', 'go', 'sql', 'yaml', 'json'],
      tools: ['npm', 'yarn', 'docker', 'kubernetes', 'aws', 'azure', 'gcp'],
      model_preferences: ['gpt-4-turbo', 'claude-3.5-sonnet', 'gemini-pro'],
      performance_profile: {
        avg_response_time: '8s',
        success_rate: 0.92,
        concurrent_capacity: 5
      }
    },
    endpoints: {
      mcp: `stdio://${agentId}`,
      http: `http://localhost:3002/${agentId}`,
      websocket: `ws://localhost:3002/ws/${agentId}`
    },
    metadata: {
      version: '1.0.0',
      author: 'codex-team',
      tags: ['generation', 'frontend', 'backend', 'fullstack', 'devops'],
      description: 'Codex CLI adapter for full-stack development and deployment tasks'
    }
  };
}