# Tutorial: Building a Custom Adapter

Extend the Agent Communication Bus with your own framework or tooling by implementing a new adapter. This guide walks through creating a `JenkinsAdapter` that triggers CI pipelines.

## Prerequisites

- Bus project cloned locally, `npm install` completed.
- Familiarity with TypeScript and Promises.
- Access to the tool you plan to integrate (Jenkins REST API in this example).

## 1. Scaffold the Adapter

Create a new file `src/adapters/jenkins-adapter.ts`:

```ts
import fetch from 'node-fetch';
import { BaseAdapter } from './base-adapter';
import { AgentDescriptor, AgentMessage } from '../types/protocol';

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
      this.log('Max concurrent Jenkins jobs reached, queueing not implemented in example');
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
      description: 'Triggers Jenkins CI jobs through the Agent Communication Bus'
    }
  };
}
```

Key takeaways:
- Inherit from `BaseAdapter` to reuse connection logic.
- Annotate configs and payloads with interfaces for strict typing.
- Use `sendMessage` to communicate back to the bus.

## 2. Export Adapter

Update `src/index.ts` to export your adapter for external use:

```ts
export { JenkinsAdapter } from './adapters/jenkins-adapter';
```

## 3. Update Configuration

Extend `config/default.json`:

```json
"jenkins": {
  "enabled": true,
  "agentId": "jenkins://ci-runner",
  "config": {
    "baseUrl": "https://jenkins.example.com",
    "username": "bot",
    "apiToken": "env:JENKINS_API_TOKEN",
    "jobName": "Build_Project"
  }
}
```

Mirror the structure in `config/production.json` with `env:` placeholders. Add environment variables to `.env.example`.

## 4. Wire Into Factory

Inside `AgentCommunicationFactory.createSystemFromConfig`, instantiate your adapter when enabled. Follow the pattern used for existing adapters (OpenCode, Codex, Claude Code).

```ts
if (adapterConfigs.jenkins?.enabled) {
  const adapter = new JenkinsAdapter(
    adapterConfigs.jenkins.agentId,
    busUrl,
    adapterConfigs.jenkins.config
  );
  await adapter.initialize();
  adapters.push(adapter);
}
```

## 5. Test the Adapter

1. Ensure Jenkins credentials are valid.
2. Start the system (`node dist/index.js`).
3. Send a `task_request` targeting `jenkins://ci-runner` with payload parameters required by the job.
4. Observe Jenkins triggered builds and confirm `task_response` or `error` messages return to the sender.

## Best Practices

- Protect secrets using environment variables (`env:KEY` in configuration files).
- Set reasonable `maxConcurrentTasks` to avoid overloading external services.
- Provide clear metadata (tags, description) so routing strategies can pick the adapter intelligently.
- Add unit tests with mocked HTTP calls to ensure error handling behaves as expected.
