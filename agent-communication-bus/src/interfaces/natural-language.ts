import { v4 as uuidv4 } from 'uuid';
import {
  AgentMessage,
  AgentIdentifier,
  AgentDescriptor
} from '../types/protocol';

/**
 * Parsed intent from natural language input
 */
export interface ParsedIntent {
  taskType: TaskType;
  targetFiles?: string[];
  requirements?: string[];
  constraints?: Record<string, any>;
  context?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

/**
 * Supported task types for natural language delegation
 */
export type TaskType =
  | 'code_review'
  | 'security_analysis'
  | 'performance_analysis'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'debugging'
  | 'implementation'
  | 'architecture_design'
  | 'unknown';

/**
 * Configuration for Natural Language Interface
 */
export interface NaturalLanguageConfig {
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
  defaultTimeout?: string;
  defaultRetryPolicy?: {
    max_retries: number;
    backoff: 'linear' | 'exponential';
  };
  confidenceThreshold?: number;
}

/**
 * Formatted response from agent
 */
export interface FormattedResponse {
  summary: string;
  details?: string;
  issues?: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: string;
    suggestion?: string;
  }>;
  recommendations?: string[];
  metadata?: Record<string, any>;
}

/**
 * Natural Language Interface for Agent Communication Bus
 *
 * Enables users to delegate tasks to agents using natural language input.
 * Handles intent parsing, message construction, and response formatting.
 */
export class NaturalLanguageInterface {
  private config: NaturalLanguageConfig;
  private taskPatterns: Map<TaskType, RegExp[]>;
  private agentRegistry: Map<string, AgentDescriptor>;

  constructor(config?: NaturalLanguageConfig) {
    this.config = {
      defaultPriority: config?.defaultPriority || 'medium',
      defaultTimeout: config?.defaultTimeout || '300s',
      defaultRetryPolicy: config?.defaultRetryPolicy || {
        max_retries: 3,
        backoff: 'exponential'
      },
      confidenceThreshold: config?.confidenceThreshold || 0.6
    };

    this.agentRegistry = new Map();
    this.taskPatterns = this.initializeTaskPatterns();
  }

  /**
   * Register an agent for task delegation
   */
  registerAgent(agent: AgentDescriptor): void {
    this.agentRegistry.set(agent.agent_id, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agentRegistry.delete(agentId);
  }

  /**
   * Parse natural language input into structured intent
   */
  parseIntent(input: string): ParsedIntent {
    const normalizedInput = input.toLowerCase().trim();

    // Detect task type
    const taskType = this.detectTaskType(normalizedInput);

    // Extract file paths
    const targetFiles = this.extractFilePaths(input);

    // Extract requirements
    const requirements = this.extractRequirements(normalizedInput);

    // Detect priority
    const priority = this.detectPriority(normalizedInput);

    // Extract context
    const context = this.extractContext(normalizedInput);

    // Calculate confidence
    const confidence = this.calculateConfidence(taskType, targetFiles, requirements);

    const finalPriority = priority || this.config.defaultPriority!;

    return {
      taskType,
      confidence,
      priority: finalPriority,
      ...(targetFiles !== undefined && { targetFiles }),
      ...(requirements !== undefined && { requirements }),
      ...(context !== undefined && { context })
    };
  }

  /**
   * Build AgentMessage from parsed intent
   */
  buildMessage(
    intent: ParsedIntent,
    sender: AgentIdentifier,
    sessionId?: string
  ): AgentMessage | null {
    // Select appropriate agent based on task type
    const targetAgent = this.selectAgent(intent.taskType, intent.requirements);

    if (!targetAgent) {
      return null;
    }

    const message: AgentMessage = {
      message_id: uuidv4(),
      timestamp: new Date().toISOString(),
      sender: {
        ...sender,
        ...(sessionId !== undefined && { session_id: sessionId })
      },
      recipient: {
        agent_id: targetAgent.agent_id,
        framework: targetAgent.framework
      },
      message_type: 'task_request',
      priority: intent.priority || this.config.defaultPriority!,
      payload: {
        task_type: intent.taskType,
        files: intent.targetFiles,
        requirements: intent.requirements,
        context: intent.context
      },
      routing: {
        timeout: this.config.defaultTimeout!,
        retry_policy: this.config.defaultRetryPolicy!,
        delivery_mode: 'async'
      },
      metadata: {
        natural_language: true,
        confidence: intent.confidence
      }
    };

    return message;
  }

  /**
   * Format agent response for user-friendly display
   */
  formatResponse(message: AgentMessage): FormattedResponse {
    const payload = message.payload;

    // Generate summary
    const summary = this.generateSummary(message);

    // Extract issues if present
    const issues = this.extractIssues(payload);

    // Extract recommendations
    const recommendations = this.extractRecommendations(payload);

    // Extract details
    const details = this.extractDetails(payload);

    return {
      summary,
      ...(details !== undefined && { details }),
      ...(issues !== undefined && { issues }),
      ...(recommendations !== undefined && { recommendations }),
      metadata: {
        agent_id: message.sender.agent_id,
        completion_time: payload.completion_time,
        confidence: payload.confidence
      }
    };
  }

  /**
   * Process natural language request end-to-end
   */
  async processRequest(
    input: string,
    sender: AgentIdentifier,
    sessionId?: string
  ): Promise<{ message: AgentMessage | null; intent: ParsedIntent }> {
    // Parse intent
    const intent = this.parseIntent(input);

    // Check confidence threshold
    if (intent.confidence < this.config.confidenceThreshold!) {
      return { message: null, intent };
    }

    // Build message
    const message = this.buildMessage(intent, sender, sessionId);

    return { message, intent };
  }

  /**
   * Initialize task detection patterns
   */
  private initializeTaskPatterns(): Map<TaskType, RegExp[]> {
    return new Map([
      ['code_review', [
        /\b(review|check|analyze|inspect|examine)\b/i,
        /\bcode\s+(review|analysis|inspection)/i,
        /\blook\s+at\b/i
      ]],
      ['security_analysis', [
        /\b(security|vulnerabilit(y|ies)|exploit|attack)\b/i,
        /\b(check|scan|test)\s+.*\bfor\s+security\b/i,
        /\bsecurity\s+(review|analysis|audit|vulnerabilit)/i
      ]],
      ['performance_analysis', [
        /\b(performance|optimization|speed|latency|throughput)\b/i,
        /\boptimize\b/i,
        /\bmake.*faster\b/i,
        /\bperformance\s+(analysis|review)/i
      ]],
      ['refactoring', [
        /\b(refactor|restructure|reorganize|improve\s+structure)\b/i,
        /\bclean\s+up\b.*\bcode\b/i
      ]],
      ['testing', [
        /\b(tests?|unit\s+tests?|integration\s+tests?|e2e)\b/i,
        /\bwrite\s+tests?\b/i,
        /\btest\s+coverage\b/i
      ]],
      ['documentation', [
        /\b(document|documentation|docstring|comment)\b/i,
        /\bwrite\s+docs?\b/i,
        /\badd\s+(documentation|comments)\b/i
      ]],
      ['debugging', [
        /\b(debug|fix|bug|error|issue|problem)\b/i,
        /\bfind\s+the\s+(bug|error|issue)\b/i,
        /\bwhy.*not\s+working\b/i
      ]],
      ['implementation', [
        /\b(implement|create|build|develop|add\s+feature)\b/i,
        /\bnew\s+feature\b/i,
        /\badd\s+functionality\b/i
      ]],
      ['architecture_design', [
        /\b(architect|design|structure|blueprint)\b/i,
        /\bsystem\s+design\b/i,
        /\barchitecture\b/i
      ]]
    ]);
  }

  /**
   * Detect task type from natural language input
   */
  private detectTaskType(input: string): TaskType {
    let bestMatch: TaskType = 'unknown';
    let maxMatches = 0;

    for (const [taskType, patterns] of this.taskPatterns.entries()) {
      const matches = patterns.filter(pattern => pattern.test(input)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = taskType;
      }
    }

    return bestMatch;
  }

  /**
   * Extract file paths from input
   */
  private extractFilePaths(input: string): string[] | undefined {
    const files: Set<string> = new Set();

    // Pattern 1: Standard file paths (e.g., src/auth.ts, lib/utils.js)
    const pathPattern = /\b([\w-]+\/)+[\w-]+\.[\w]+\b/g;
    const pathMatches = input.matchAll(pathPattern);
    for (const match of pathMatches) {
      files.add(match[0]);
    }

    // Pattern 2: Quoted file paths (e.g., "src/file.ts", 'lib/util.js')
    const quotedPattern = /['"`](.*?\.[\w]+)['"`]/g;
    const quotedMatches = input.matchAll(quotedPattern);
    for (const match of quotedMatches) {
      if (match[1]) {
        files.add(match[1]);
      }
    }

    return files.size > 0 ? Array.from(files) : undefined;
  }

  /**
   * Extract requirements from input
   */
  private extractRequirements(input: string): string[] | undefined {
    const requirementKeywords = [
      'security', 'performance', 'maintainability', 'scalability',
      'readability', 'testability', 'documentation', 'type safety',
      'best practices', 'code quality'
    ];

    const requirements = requirementKeywords.filter(keyword =>
      input.includes(keyword)
    );

    return requirements.length > 0 ? requirements : undefined;
  }

  /**
   * Detect priority from input
   */
  private detectPriority(input: string): 'low' | 'medium' | 'high' | 'critical' | undefined {
    if (/\b(urgent|critical|asap|emergency|immediately)\b/i.test(input)) {
      return 'critical';
    }
    if (/\b(important|high\s+priority|soon)\b/i.test(input)) {
      return 'high';
    }
    if (/\b(low\s+priority|when\s+you\s+have\s+time|no\s+rush)\b/i.test(input)) {
      return 'low';
    }
    return undefined; // Use default
  }

  /**
   * Extract contextual information
   */
  private extractContext(input: string): Record<string, any> | undefined {
    const context: Record<string, any> = {};

    // Extract language
    const languages = ['typescript', 'javascript', 'python', 'go', 'rust', 'java'];
    for (const lang of languages) {
      if (input.includes(lang)) {
        context.language = lang;
        break;
      }
    }

    // Extract project context
    if (input.includes('backend') || input.includes('api')) {
      context.project_area = 'backend';
    } else if (input.includes('frontend') || input.includes('ui')) {
      context.project_area = 'frontend';
    }

    return Object.keys(context).length > 0 ? context : undefined;
  }

  /**
   * Calculate confidence score for parsed intent
   */
  private calculateConfidence(
    taskType: TaskType,
    files?: string[],
    requirements?: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Task type detection
    if (taskType !== 'unknown') {
      confidence += 0.3;
    }

    // File paths present
    if (files && files.length > 0) {
      confidence += 0.15;
    }

    // Requirements specified
    if (requirements && requirements.length > 0) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Select appropriate agent for task
   */
  private selectAgent(taskType: TaskType, requirements?: string[]): AgentDescriptor | null {
    // Find agents with matching capabilities
    const candidates: Array<{ agent: AgentDescriptor; score: number }> = [];

    for (const agent of this.agentRegistry.values()) {
      const score = this.scoreAgentForTask(agent, taskType, requirements);
      if (score > 0) {
        candidates.push({ agent, score });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by score and return best match
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].agent;
  }

  /**
   * Score agent suitability for task
   */
  private scoreAgentForTask(
    agent: AgentDescriptor,
    taskType: TaskType,
    requirements?: string[]
  ): number {
    let score = 0;

    // Check optimal_tasks
    if (agent.capabilities.optimal_tasks.includes(taskType)) {
      score += 10;

      // Bonus for specialists (fewer tasks = more specialized)
      const taskCount = agent.capabilities.optimal_tasks.length;
      if (taskCount === 1) {
        score += 3; // High specialist bonus
      } else if (taskCount === 2) {
        score += 1; // Moderate specialist bonus
      }
    }

    // Check requirements match with tools/capabilities
    if (requirements) {
      const agentCapabilities = [
        ...agent.capabilities.tools,
        ...agent.capabilities.input_types,
        ...agent.capabilities.output_types
      ].map(c => c.toLowerCase());

      for (const req of requirements) {
        // Count how many capabilities match this requirement
        const matchCount = agentCapabilities.filter(cap => cap.includes(req)).length;
        score += matchCount * 0.5; // Each matching capability adds 0.5 points
      }
    }

    // Consider performance profile (scaled by success rate)
    const successRate = agent.capabilities.performance_profile.success_rate;
    score += successRate * 5; // Scale: 0.0-1.0 becomes 0-5 points

    return score;
  }

  /**
   * Generate user-friendly summary from response
   */
  private generateSummary(message: AgentMessage): string {
    const taskType = message.payload.task_type;
    const payload = message.payload;

    // Check payload level first
    if (payload.summary && typeof payload.summary === 'string') {
      return payload.summary;
    }

    if (payload.message && typeof payload.message === 'string') {
      return payload.message;
    }

    // Then check result field
    const result = payload.result;

    if (typeof result === 'string') {
      return result;
    }

    if (result && typeof result === 'object') {
      if (result.summary) {
        return result.summary;
      }
      if (result.message) {
        return result.message;
      }
    }

    return `Task ${taskType} completed by ${message.sender.agent_id}`;
  }

  /**
   * Extract issues from payload
   */
  private extractIssues(payload: any): FormattedResponse['issues'] | undefined {
    if (!payload.issues && !payload.problems && !payload.errors) {
      return undefined;
    }

    const rawIssues = payload.issues || payload.problems || payload.errors || [];

    return rawIssues.map((issue: any) => ({
      severity: issue.severity || 'medium',
      description: issue.description || issue.message || String(issue),
      location: issue.location || issue.file,
      suggestion: issue.suggestion || issue.fix
    }));
  }

  /**
   * Extract recommendations from payload
   */
  private extractRecommendations(payload: any): string[] | undefined {
    if (payload.recommendations) {
      return Array.isArray(payload.recommendations)
        ? payload.recommendations
        : [payload.recommendations];
    }

    if (payload.suggestions) {
      return Array.isArray(payload.suggestions)
        ? payload.suggestions
        : [payload.suggestions];
    }

    return undefined;
  }

  /**
   * Extract detailed information from payload
   */
  private extractDetails(payload: any): string | undefined {
    if (payload.details) {
      return typeof payload.details === 'string'
        ? payload.details
        : JSON.stringify(payload.details, null, 2);
    }

    if (payload.analysis) {
      return typeof payload.analysis === 'string'
        ? payload.analysis
        : JSON.stringify(payload.analysis, null, 2);
    }

    return undefined;
  }
}
