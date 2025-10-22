import fetch from 'node-fetch';
import { BaseAdapter } from '../../agent-communication-bus/src/adapters/base-adapter';
import { AgentDescriptor, AgentMessage } from '../../agent-communication-bus/src/types/protocol';

export interface JenkinsConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  jobName: string;
  maxConcurrentTasks?: number;
}

export class JenkinsAdapter extends BaseAdapter {
  private config: JenkinsConfig;
  private runningTasks = new Set<string>();

  constructor(agentId: string, busUrl: string, config: JenkinsConfig, descriptor?: AgentDescriptor) {
    super(agentId, busUrl, descriptor ?? createDefaultDescriptor(agentId));
    this.config = { maxConcurrentTasks: 2, ...config };
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    if (message.message_type !== 'task_request') {
      this.log(`Ignoring message type: ${message.message_type}`);
      return;
    }

    if (this.runningTasks.size >= this.config.maxConcurrentTasks!) {
      this.log('Max concurrent Jenkins jobs reached in example adapter');
      return;
    }

    this.runningTasks.add(message.message_id);
    try {
      await this.triggerJob(message);
      await this.sendTaskResponse(message, 'completed');
    } catch (error) {
      await this.sendTaskResponse(message, 'failed', (error as Error).message);
    } finally {
      this.runningTasks.delete(message.message_id);
    }
  }

  private async triggerJob(message: AgentMessage): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/job/${this.config.jobName}/buildWithParameters`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message.payload)
      }
    );

    if (!response.ok) {
      throw new Error(`Jenkins responded with ${response.status}`);
    }
  }

  private async sendTaskResponse(original: AgentMessage, status: 'completed' | 'failed', error?: string) {
    const response: AgentMessage = {
      message_id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      sender: { agent_id: this.agentId, framework: 'jenkins' },
      recipient: original.sender,
      message_type: status === 'completed' ? 'task_response' : 'error',
      priority: original.priority,
      payload: {
        status,
        error,
        job: this.config.jobName
      },
      routing: {
        timeout: '60s',
        retry_policy: { max_retries: 0, backoff: 'linear' },
        delivery_mode: 'async'
      },
      metadata: { original_message_id: original.message_id }
    };

    await this.sendMessage(response);
  }
}

function createDefaultDescriptor(agentId: string): AgentDescriptor {
  return {
    agent_id: agentId,
    framework: 'jenkins',
    capabilities: {
      input_types: ['pipeline_parameters'],
      output_types: ['build_status'],
      languages: [],
      tools: ['jenkins'],
      model_preferences: [],
      optimal_tasks: ['ci_pipeline'],
      performance_profile: {
        avg_response_time: '30s',
        success_rate: 0.9,
        concurrent_capacity: 2
      }
    },
    endpoints: {},
    metadata: {
      version: '0.1.0',
      author: 'your-team',
      tags: ['ci', 'jenkins'],
      description: 'Triggers Jenkins jobs via the Agent Communication Bus'
    }
  };
}
