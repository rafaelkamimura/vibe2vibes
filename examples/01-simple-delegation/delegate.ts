import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';

const BUS_URL = process.env.AGENT_BUS_URL || 'http://localhost:8080';
const API_KEY = process.env.AGENT_BUS_API_KEY || 'dev-key';

async function main(): Promise<void> {
  const sampleFile = path.join(__dirname, 'sample.ts');
  const code = fs.readFileSync(sampleFile, 'utf8');

  const message = {
    message_id: `msg_${Date.now()}`,
    timestamp: new Date().toISOString(),
    sender: {
      agent_id: 'claude-code://orchestrator',
      framework: 'claude-code'
    },
    recipient: {
      agent_id: 'opencode://code-reviewer',
      framework: 'opencode'
    },
    message_type: 'task_request',
    priority: 'medium',
    payload: {
      task_type: 'code_review',
      files: [
        {
          path: 'sample.ts',
          content: code
        }
      ],
      context: {
        focus: 'general_quality'
      }
    },
    routing: {
      timeout: '300s',
      retry_policy: {
        max_retries: 1,
        backoff: 'linear'
      },
      delivery_mode: 'async'
    },
    metadata: {
      example: 'simple-delegation'
    }
  };

  const response = await fetch(`${BUS_URL}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': API_KEY
    },
    body: JSON.stringify(message)
  });

  const data = await response.json();
  console.log('Message dispatched:', data);
}

main().catch(error => {
  console.error('Failed to dispatch message', error);
  process.exit(1);
});
