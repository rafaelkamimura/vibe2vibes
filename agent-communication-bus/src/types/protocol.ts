export interface AgentMessage {
  message_id: string;
  timestamp: string;
  sender: AgentIdentifier;
  recipient: AgentIdentifier;
  message_type: 'task_request' | 'task_response' | 'status_update' | 'error' | 'heartbeat';
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: any;
  routing: MessageRouting;
  metadata?: Record<string, any>;
}

export interface AgentIdentifier {
  agent_id: string;
  framework: string;
  session_id?: string;
}

export interface MessageRouting {
  timeout: string;
  retry_policy: {
    max_retries: number;
    backoff: 'linear' | 'exponential';
  };
  fallback_agents?: string[];
  delivery_mode: 'async' | 'sync';
}

export interface SessionContext {
  sessionId: string;
  orchestrator: string;
  participants: AgentParticipant[];
  workflow: WorkflowState;
  shared_context: Record<string, any>;
  created_at: string;
  updated_at: string;
  terminated_at?: string;
  termination_reason?: string;
}

export interface AgentParticipant {
  agent_id: string;
  framework: string;
  role: 'orchestrator' | 'implementer' | 'reviewer' | 'tester' | 'observer' | string;
  status: 'active' | 'waiting' | 'busy' | 'left' | 'session_terminated';
  join_time: string;
  leave_time?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowState {
  current_step: string;
  completed_steps: string[];
  pending_steps: string[];
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  name: string;
  description: string;
  required_agents: string[];
  optional_agents?: string[];
  estimated_duration: number;
  dependencies?: string[];
  outputs: string[];
}

export interface AgentCapability {
  input_types: string[];
  output_types: string[];
  languages: string[];
  tools: string[];
  model_preferences: string[];
  performance_profile: {
    avg_response_time: string;
    success_rate: number;
    concurrent_capacity: number;
  };
}

export interface AgentDescriptor {
  agent_id: string;
  framework: string;
  capabilities: AgentCapability;
  endpoints: {
    mcp?: string;
    http?: string;
    websocket?: string;
  };
  metadata: {
    version: string;
    author: string;
    tags: string[];
    description?: string;
  };
}

export interface ModelDescriptor {
  model_id: string;
  provider: string;
  capabilities: string[];
  cost_per_token: number;
  max_tokens: number;
  optimal_tasks: string[];
  constraints?: {
    temperature_range?: [number, number];
    supported_languages?: string[];
    special_features?: string[];
  };
}

export interface ResultAggregation {
  aggregation_id: string;
  session_id: string;
  task_type: string;
  agent_results: AgentResult[];
  synthesis: ResultSynthesis;
  metadata: AggregationMetadata;
}

export interface AgentResult {
  agent_id: string;
  result: any;
  confidence: number;
  completion_time: string;
  error?: string;
  metrics?: Record<string, number>;
}

export interface ResultSynthesis {
  unified_result: any;
  confidence_score: number;
  conflicts: Conflict[];
  recommendations: string[];
  synthesis_method: 'consensus' | 'specialist_priority' | 'confidence_weighted' | 'manual';
}

export interface Conflict {
  type: 'result_disagreement' | 'approach_difference' | 'priority_conflict';
  agents: string[];
  description: string;
  resolution?: string;
}

export interface AggregationMetadata {
  total_time: string;
  cost_estimate: number;
  quality_metrics: {
    code_coverage?: number;
    security_score?: number;
    performance_score?: number;
    maintainability_score?: number;
  };
  agent_performance: Record<string, {
    response_time: string;
    success_rate: number;
    resource_usage?: number;
  }>;
}

export interface CommunicationBusConfig {
  port: number;
  host: string;
  maxConnections: number;
  heartbeatInterval: number;
  messageTimeout: number;
  persistenceEnabled: boolean;
  encryptionEnabled: boolean;
  apiKey?: string;
}

export interface AgentRegistration {
  agent_descriptor: AgentDescriptor;
  health_check_url: string;
  status_endpoint?: string;
  authentication: {
    type: 'jwt' | 'api_key' | 'certificate';
    credentials: string;
  };
}

export interface HealthStatus {
  agent_id: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_check: string;
  response_time: number;
  error_rate: number;
  active_sessions: number;
  resource_usage: {
    cpu: number;
    memory: number;
    network?: number;
  };
}

export interface BusMetrics {
  total_messages: number;
  active_sessions: number;
  registered_agents: number;
  average_response_time: number;
  error_rate: number;
  uptime: number;
  throughput: number;
}