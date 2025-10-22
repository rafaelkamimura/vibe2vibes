import fetch from 'node-fetch';
import { backendTask, frontendTask } from './payloads';

const BUS_URL = process.env.AGENT_BUS_URL || 'http://localhost:8080';
const API_KEY = process.env.AGENT_BUS_API_KEY || 'dev-key';

async function createMessage(payload: any, recipient: { agent_id: string; framework: string }, sessionId: string) {
  return {
    message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    sender: {
      agent_id: 'claude-code://orchestrator',
      framework: 'claude-code',
      session_id: sessionId
    },
    recipient,
    message_type: 'task_request',
    priority: 'high',
    payload,
    routing: {
      timeout: '600s',
      retry_policy: { max_retries: 1, backoff: 'linear' },
      delivery_mode: 'async'
    },
    metadata: { session_id: sessionId }
  };
}

async function sendMessage(message: any) {
  const response = await fetch(`${BUS_URL}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': API_KEY
    },
    body: JSON.stringify(message)
  });

  const data = await response.json();
  console.log('Dispatched', message.message_id, '->', message.recipient.agent_id, data);
}

async function main() {
  const sessionId = `sess_multi_${Date.now()}`;
  console.log('Using session:', sessionId);

  const backendMessage = await createMessage(backendTask, {
    agent_id: 'opencode://backend-developer',
    framework: 'opencode'
  }, sessionId);

  const frontendMessage = await createMessage(frontendTask, {
    agent_id: 'codex://frontend-developer',
    framework: 'codex'
  }, sessionId);

  await sendMessage(backendMessage);
  await sendMessage(frontendMessage);

  console.log('Await task responses in adapter logs or via WebSocket client.');
  console.log('Use result aggregator programmatically to combine outputs if desired.');
}

main().catch(error => {
  console.error('Session orchestration failed', error);
  process.exit(1);
});
