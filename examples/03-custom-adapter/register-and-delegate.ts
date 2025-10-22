import fetch from 'node-fetch';
import { JenkinsAdapter, JenkinsConfig } from './jenkins-adapter';

const BUS_URL = process.env.AGENT_BUS_URL || 'http://localhost:8080';
const API_KEY = process.env.AGENT_BUS_API_KEY || 'dev-key';
const AGENT_ID = process.env.JENKINS_AGENT_ID || 'jenkins://ci-runner';

async function main(): Promise<void> {
  const config: JenkinsConfig = {
    baseUrl: process.env.JENKINS_BASE_URL || 'https://jenkins.example.com',
    username: process.env.JENKINS_USER || 'bot',
    apiToken: process.env.JENKINS_API_TOKEN || 'token',
    jobName: process.env.JENKINS_JOB || 'SampleJob'
  };

  const adapter = new JenkinsAdapter(AGENT_ID, BUS_URL, config);
  await adapter.initialize();

  const message = {
    message_id: `msg_${Date.now()}`,
    timestamp: new Date().toISOString(),
    sender: { agent_id: 'claude-code://ci-coordinator', framework: 'claude-code' },
    recipient: { agent_id: AGENT_ID, framework: 'jenkins' },
    message_type: 'task_request' as const,
    priority: 'medium' as const,
    payload: {
      task_type: 'ci_pipeline',
      parameters: {
        branch: 'feature/example',
        runTests: true
      }
    },
    routing: {
      timeout: '120s',
      retry_policy: { max_retries: 0, backoff: 'linear' as const },
      delivery_mode: 'async' as const
    },
    metadata: { example: 'custom-adapter' }
  };

  const response = await fetch(`${BUS_URL}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': API_KEY
    },
    body: JSON.stringify(message)
  });

  console.log('Message status:', await response.json());

  // Give Jenkins time to respond before shutting down
  await new Promise(resolve => setTimeout(resolve, 5000));
  await adapter.shutdown();
}

main().catch(async error => {
  console.error('Custom adapter example failed', error);
  process.exit(1);
});
