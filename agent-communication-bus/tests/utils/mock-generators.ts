import { v4 as uuidv4 } from 'uuid';
import {
  AgentMessage,
  AgentDescriptor,
  AgentIdentifier,
  MessageRouting,
  SessionContext,
  AgentParticipant,
  WorkflowState,
  AgentCapability,
  ModelDescriptor,
  ResultAggregation,
  AgentResult,
  ResultSynthesis,
  CommunicationBusConfig,
  AgentRegistration,
  HealthStatus,
  BusMetrics
} from '../../src/types/protocol';

export class MockDataGenerator {
  private static counter = 0;

  static nextId(): string {
    return `test-${++this.counter}-${uuidv4().slice(0, 8)}`;
  }

  // Agent Mock Generators
  static createAgentIdentifier(overrides?: Partial<AgentIdentifier>): AgentIdentifier {
    return {
      agent_id: this.nextId(),
      framework: 'test-framework',
      session_id: this.nextId(),
      ...overrides
    };
  }

  static createAgentCapability(overrides?: Partial<AgentCapability>): AgentCapability {
    return {
      input_types: ['text', 'code', 'json'],
      output_types: ['text', 'code', 'json'],
      languages: ['typescript', 'javascript', 'python'],
      tools: ['eslint', 'prettier', 'jest'],
      model_preferences: ['gpt-4', 'claude-3'],
      performance_profile: {
        avg_response_time: '150ms',
        success_rate: 0.95,
        concurrent_capacity: 5
      },
      optimal_tasks: ['coding', 'review'],
      ...overrides
    };
  }

  static createAgentDescriptor(overrides?: Partial<AgentDescriptor>): AgentDescriptor {
    const id = this.nextId();
    return {
      agent_id: id,
      framework: 'test-framework',
      capabilities: this.createAgentCapability(),
      endpoints: {
        http: `http://localhost:3000/agents/${id}`,
        websocket: `ws://localhost:3000/agents/${id}/ws`,
        mcp: `mcp://localhost:3000/agents/${id}`
      },
      metadata: {
        version: '1.0.0',
        author: 'test-author',
        tags: ['test', 'mock'],
        description: 'Mock agent for testing',
        ...overrides?.metadata
      },
      ...overrides
    };
  }

  static createAgentRegistration(overrides?: Partial<AgentRegistration>): AgentRegistration {
    const descriptor = this.createAgentDescriptor();
    return {
      agent_descriptor: descriptor,
      health_check_url: `http://localhost:3000/agents/${descriptor.agent_id}/health`,
      status_endpoint: `http://localhost:3000/agents/${descriptor.agent_id}/status`,
      authentication: {
        type: 'api_key',
        credentials: 'test-api-key'
      },
      ...overrides
    };
  }

  // Message Mock Generators
  static createMessageRouting(overrides?: Partial<MessageRouting>): MessageRouting {
    return {
      timeout: '30s',
      retry_policy: {
        max_retries: 3,
        backoff: 'exponential'
      },
      fallback_agents: [this.nextId(), this.nextId()],
      delivery_mode: 'async',
      ...overrides
    };
  }

  static createAgentMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    const sender = this.createAgentIdentifier();
    const recipient = this.createAgentIdentifier();
    
    return {
      message_id: this.nextId(),
      timestamp: new Date().toISOString(),
      sender,
      recipient,
      message_type: 'task_request',
      priority: 'medium',
      payload: {
        task_type: 'test_task',
        description: 'Test task for unit testing',
        requirements: ['requirement1', 'requirement2']
      },
      routing: this.createMessageRouting(),
      metadata: {
        source: 'test-suite',
        version: '1.0.0'
      },
      ...overrides
    };
  }

  static createTaskRequestMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    return this.createAgentMessage({
      message_type: 'task_request',
      payload: {
        task_type: 'code_review',
        description: 'Review this code for quality and security',
        files: ['src/test.ts'],
        requirements: ['security', 'performance', 'maintainability']
      },
      ...overrides
    });
  }

  static createTaskResponseMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    return this.createAgentMessage({
      message_type: 'task_response',
      payload: {
        task_id: this.nextId(),
        result: 'Task completed successfully',
        output: {
          files_modified: ['src/test.ts'],
          issues_found: 0,
          recommendations: ['Consider adding more tests']
        }
      },
      ...overrides
    });
  }

  static createStatusUpdateMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    return this.createAgentMessage({
      message_type: 'status_update',
      payload: {
        status: 'in_progress',
        progress: 0.75,
        current_step: 'code_analysis',
        estimated_completion: '2024-01-01T12:00:00Z'
      },
      ...overrides
    });
  }

  static createErrorMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    return this.createAgentMessage({
      message_type: 'error',
      priority: 'high',
      payload: {
        error_code: 'TASK_FAILED',
        error_message: 'Task execution failed',
        details: {
          step: 'code_compilation',
          error: 'TypeScript compilation error'
        }
      },
      ...overrides
    });
  }

  static createHeartbeatMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    return this.createAgentMessage({
      message_type: 'heartbeat',
      priority: 'low',
      payload: {
        status: 'healthy',
        uptime: '3600s',
        active_tasks: 2,
        resource_usage: {
          cpu: 0.25,
          memory: 0.60
        }
      },
      ...overrides
    });
  }

  // Session Mock Generators
  static createAgentParticipant(overrides?: Partial<AgentParticipant>): AgentParticipant {
    return {
      agent_id: this.nextId(),
      framework: 'test-framework',
      role: 'implementer',
      status: 'active',
      join_time: new Date().toISOString(),
      capabilities: ['coding', 'testing', 'review'],
      metadata: {
        experience: 'senior',
        specialization: 'typescript'
      },
      ...overrides
    };
  }

  static createWorkflowState(overrides?: Partial<WorkflowState>): WorkflowState {
    return {
      current_step: 'implementation',
      completed_steps: ['analysis', 'design'],
      pending_steps: ['testing', 'deployment'],
      steps: [
        {
          name: 'analysis',
          description: 'Analyze requirements',
          required_agents: ['analyst'],
          estimated_duration: 300,
          outputs: ['requirements.md']
        },
        {
          name: 'design',
          description: 'Design solution',
          required_agents: ['architect'],
          estimated_duration: 600,
          outputs: ['architecture.md']
        }
      ],
      ...overrides
    };
  }

  static createSessionContext(overrides?: Partial<SessionContext>): SessionContext {
    const sessionId = this.nextId();
    return {
      sessionId,
      orchestrator: this.nextId(),
      participants: [
        this.createAgentParticipant({ role: 'orchestrator' }),
        this.createAgentParticipant({ role: 'implementer' }),
        this.createAgentParticipant({ role: 'reviewer' })
      ],
      workflow: this.createWorkflowState(),
      shared_context: {
        project_name: 'test-project',
        requirements: ['req1', 'req2'],
        constraints: ['budget', 'timeline']
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  // Result Aggregation Mock Generators
  static createAgentResult(overrides?: Partial<AgentResult>): AgentResult {
    return {
      agent_id: this.nextId(),
      result: {
        code: 'function test() { return true; }',
        tests_passed: 10,
        coverage: 0.85
      },
      confidence: 0.9,
      completion_time: '150ms',
      metrics: {
        lines_written: 25,
        complexity: 3,
        security_score: 0.95
      },
      ...overrides
    };
  }

  static createResultSynthesis(overrides?: Partial<ResultSynthesis>): ResultSynthesis {
    return {
      unified_result: {
        final_code: 'function optimizedTest() { return true; }',
        total_tests: 15,
        final_coverage: 0.92
      },
      confidence_score: 0.88,
      conflicts: [
        {
          type: 'approach_difference',
          agents: ['agent1', 'agent2'],
          description: 'Different coding styles detected',
          resolution: 'Adopted team standard'
        }
      ],
      recommendations: ['Add more edge case tests', 'Improve documentation'],
      synthesis_method: 'confidence_weighted',
      ...overrides
    };
  }

  static createResultAggregation(overrides?: Partial<ResultAggregation>): ResultAggregation {
    return {
      aggregation_id: this.nextId(),
      session_id: this.nextId(),
      task_type: 'code_implementation',
      agent_results: [
        this.createAgentResult(),
        this.createAgentResult(),
        this.createAgentResult()
      ],
      synthesis: this.createResultSynthesis(),
      metadata: {
        total_time: '450ms',
        cost_estimate: 0.05,
        quality_metrics: {
          code_coverage: 0.92,
          security_score: 0.95,
          performance_score: 0.88,
          maintainability_score: 0.90
        },
        agent_performance: {
          'agent1': { response_time: '150ms', success_rate: 0.95 },
          'agent2': { response_time: '200ms', success_rate: 0.90 },
          'agent3': { response_time: '100ms', success_rate: 0.98 }
        }
      },
      ...overrides
    };
  }

  // Configuration Mock Generators
  static createCommunicationBusConfig(overrides?: Partial<CommunicationBusConfig>): CommunicationBusConfig {
    return {
      port: 3000,
      host: 'localhost',
      maxConnections: 100,
      heartbeatInterval: 30000,
      messageTimeout: 60000,
      persistenceEnabled: false,
      encryptionEnabled: false,
      apiKey: 'test-api-key',
      ...overrides
    };
  }

  static createHealthStatus(overrides?: Partial<HealthStatus>): HealthStatus {
    return {
      agent_id: this.nextId(),
      status: 'healthy',
      last_check: new Date().toISOString(),
      response_time: 45,
      error_rate: 0.02,
      active_sessions: 3,
      resource_usage: {
        cpu: 0.35,
        memory: 0.60,
        network: 0.15
      },
      ...overrides
    };
  }

  static createBusMetrics(overrides?: Partial<BusMetrics>): BusMetrics {
    return {
      total_messages: 1250,
      active_sessions: 8,
      registered_agents: 12,
      average_response_time: 145,
      error_rate: 0.025,
      uptime: 86400000, // 24 hours in ms
      throughput: 15.5,
      ...overrides
    };
  }

  // Utility Methods
  static createMessageSequence(count: number, type?: AgentMessage['message_type']): AgentMessage[] {
    const messages: AgentMessage[] = [];
    for (let i = 0; i < count; i++) {
      if (type) {
        messages.push(this.createAgentMessage({ message_type: type }));
      } else {
        const types: AgentMessage['message_type'][] = ['task_request', 'task_response', 'status_update', 'heartbeat'];
        messages.push(this.createAgentMessage({ 
          message_type: types[i % types.length] 
        }));
      }
    }
    return messages;
  }

  static createAgentPool(size: number): AgentDescriptor[] {
    return Array.from({ length: size }, () => this.createAgentDescriptor());
  }

  static createSessionWithParticipants(participantCount: number): SessionContext {
    const participants = Array.from({ length: participantCount }, (_, i) => 
      this.createAgentParticipant({ 
        role: i === 0 ? 'orchestrator' : 'implementer' 
      })
    );
    
    return this.createSessionContext({ participants });
  }

  static reset(): void {
    this.counter = 0;
  }
}