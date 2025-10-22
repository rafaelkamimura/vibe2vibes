import fetch from 'node-fetch';
import { utterances } from './utterances';

const BUS_URL = process.env.AGENT_BUS_URL || 'http://localhost:8080';
const API_KEY = process.env.AGENT_BUS_API_KEY || 'dev-key';

interface ParsedIntent {
  agentId: string;
  framework: string;
  payload: any;
}

function parseUtterance(text: string): ParsedIntent | null {
  const lower = text.toLowerCase();

  if (lower.includes('opencode')) {
    return {
      agentId: 'opencode://code-reviewer',
      framework: 'opencode',
      payload: {
        task_type: 'code_review',
        files: [{ path: 'sample.ts', content: '// TODO: supply file contents' }],
        context: { focus: 'security' }
      }
    };
  }

  if (lower.includes('codex')) {
    return {
      agentId: 'codex://frontend-developer',
      framework: 'codex',
      payload: {
        task_type: 'ui_component',
        context: { component: 'ProfileCard', framework: 'react', styling: 'tailwind' }
      }
    };
  }

  if (lower.includes('coordinate') || lower.includes('have claude')) {
    return {
      agentId: 'claude-code://orchestrator',
      framework: 'claude-code',
      payload: {
        task_type: 'orchestration_plan',
        context: {
          goal: 'Implement notifications feature',
          subtasks: ['backend_api', 'frontend_ui', 'qa_review']
        }
      }
    };
  }

  return null;
}

async function sendIntent(intent: ParsedIntent) {
  const message = {
    message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    sender: { agent_id: 'claude-code://natural-language-interface', framework: 'claude-code' },
    recipient: { agent_id: intent.agentId, framework: intent.framework },
    message_type: 'task_request',
    priority: 'medium',
    payload: intent.payload,
    routing: {
      timeout: '300s',
      retry_policy: { max_retries: 1, backoff: 'linear' },
      delivery_mode: 'async'
    },
    metadata: { example: 'natural-language' }
  };

  const response = await fetch(`${BUS_URL}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': API_KEY
    },
    body: JSON.stringify(message)
  });

  console.log('Utterance dispatched to', intent.agentId, await response.json());
}

async function main() {
  for (const utterance of utterances) {
    const intent = parseUtterance(utterance);
    if (!intent) {
      console.log('No intent parser matched:', utterance);
      continue;
    }

    console.log('\nUtterance:', utterance);
    console.log('Parsed intent:', intent);
    await sendIntent(intent);
  }
}

main().catch(error => {
  console.error('Natural language example failed', error);
  process.exit(1);
});
