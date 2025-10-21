import { EventEmitter } from 'events';
import { ModelDescriptor, AgentDescriptor } from '../types/protocol';

export interface ModelSelectionCriteria {
  taskType: string;
  agentCapabilities: string[];
  constraints?: {
    maxCost?: number;
    maxLatency?: number;
    minAccuracy?: number;
    preferredProviders?: string[];
    excludedProviders?: string[];
  };
  context?: {
    inputSize?: number;
    outputSize?: number;
    language?: string;
    complexity?: 'simple' | 'medium' | 'complex';
  };
}

export interface ModelSelectionResult {
  model: ModelDescriptor;
  confidence: number;
  reasoning: string[];
  alternatives: ModelDescriptor[];
  estimatedCost: number;
  estimatedLatency: number;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  taskType: string;
  averageLatency: number;
  successRate: number;
  costPerTask: number;
  userSatisfaction: number;
  lastUpdated: string;
}

export class ModelSelector extends EventEmitter {
  private models: Map<string, ModelDescriptor> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private taskModelMapping: Map<string, string[]> = new Map();
  private providerModels: Map<string, string[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultModels();
    this.initializeTaskMappings();
  }

  /**
   * Select optimal model for given criteria
   */
  selectModel(criteria: ModelSelectionCriteria): ModelSelectionResult {
    const candidates = this.filterModels(criteria);
    
    if (candidates.length === 0) {
      throw new Error('No suitable models found for the given criteria');
    }

    // Score each candidate
    const scoredCandidates = candidates.map(model => ({
      model,
      score: this.scoreModel(model, criteria),
      reasoning: this.getScoreReasoning(model, criteria)
    }));

    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0];
    const alternatives = scoredCandidates.slice(1, 4).map(sc => sc.model);

    const result: ModelSelectionResult = {
      model: best.model,
      confidence: this.calculateConfidence(best.score),
      reasoning: best.reasoning,
      alternatives,
      estimatedCost: this.estimateCost(best.model, criteria),
      estimatedLatency: this.estimateLatency(best.model, criteria)
    };

    this.emit('model_selected', { criteria, result });
    return result;
  }

  /**
   * Register a new model
   */
  registerModel(model: ModelDescriptor): void {
    this.models.set(model.model_id, model);
    
    // Update provider mapping
    const providerModels = this.providerModels.get(model.provider) || [];
    if (!providerModels.includes(model.model_id)) {
      providerModels.push(model.model_id);
      this.providerModels.set(model.provider, providerModels);
    }

    // Update task mappings
    model.optimal_tasks.forEach(task => {
      const taskModels = this.taskModelMapping.get(task) || [];
      if (!taskModels.includes(model.model_id)) {
        taskModels.push(model.model_id);
        this.taskModelMapping.set(task, taskModels);
      }
    });

    this.emit('model_registered', { model });
  }

  /**
   * Update performance metrics for a model
   */
  updatePerformanceMetrics(metrics: ModelPerformanceMetrics): void {
    this.performanceMetrics.set(`${metrics.modelId}:${metrics.taskType}`, metrics);
    this.emit('metrics_updated', { metrics });
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelDescriptor | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Get all models
   */
  getAllModels(): ModelDescriptor[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): ModelDescriptor[] {
    const modelIds = this.providerModels.get(provider) || [];
    return modelIds.map(id => this.models.get(id)).filter(Boolean) as ModelDescriptor[];
  }

  /**
   * Get models for specific task
   */
  getModelsForTask(taskType: string): ModelDescriptor[] {
    const modelIds = this.taskModelMapping.get(taskType) || [];
    return modelIds.map(id => this.models.get(id)).filter(Boolean) as ModelDescriptor[];
  }

  /**
   * Get performance metrics for model
   */
  getPerformanceMetrics(modelId: string, taskType: string): ModelPerformanceMetrics | null {
    return this.performanceMetrics.get(`${modelId}:${taskType}`) || null;
  }

  /**
   * Optimize model selection based on historical performance
   */
  optimizeSelection(criteria: ModelSelectionCriteria): ModelSelectionResult {
    const result = this.selectModel(criteria);
    
    // Apply performance-based adjustments
    const metrics = this.getPerformanceMetrics(result.model.model_id, criteria.taskType);
    if (metrics) {
      // Adjust confidence based on actual performance
      const performanceMultiplier = metrics.successRate * (1 - metrics.averageLatency / 10000);
      result.confidence = Math.min(1.0, result.confidence * performanceMultiplier);
      
      // Update estimates with real data
      result.estimatedLatency = metrics.averageLatency;
      result.estimatedCost = metrics.costPerTask;
    }

    return result;
  }

  /**
   * Private helper methods
   */
  private initializeDefaultModels(): void {
    const defaultModels: ModelDescriptor[] = [
      {
        model_id: 'claude-3.5-sonnet',
        provider: 'anthropic',
        capabilities: ['code', 'reasoning', 'analysis', 'writing'],
        cost_per_token: 0.000003,
        max_tokens: 200000,
        optimal_tasks: [
          'code_review',
          'architecture_design',
          'debugging',
          'code_optimization',
          'technical_writing'
        ],
        constraints: {
          temperature_range: [0.0, 1.0],
          supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja'],
          special_features: ['tool_use', 'vision', 'long_context']
        }
      },
      {
        model_id: 'gpt-4-turbo',
        provider: 'openai',
        capabilities: ['code', 'reasoning', 'multimodal', 'generation'],
        cost_per_token: 0.00001,
        max_tokens: 128000,
        optimal_tasks: [
          'code_generation',
          'translation',
          'summarization',
          'frontend_development',
          'content_creation'
        ],
        constraints: {
          temperature_range: [0.0, 2.0],
          supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru'],
          special_features: ['multimodal', 'function_calling', 'json_mode']
        }
      },
      {
        model_id: 'gemini-pro',
        provider: 'google',
        capabilities: ['multimodal', 'reasoning', 'large_context', 'analysis'],
        cost_per_token: 0.000001,
        max_tokens: 2000000,
        optimal_tasks: [
          'document_analysis',
          'large_file_processing',
          'data_extraction',
          'research_synthesis',
          'content_analysis'
        ],
        constraints: {
          temperature_range: [0.0, 2.0],
          supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru', 'hi', 'ar'],
          special_features: ['multimodal', 'very_large_context', 'native_multilingual']
        }
      },
      {
        model_id: 'llama-3.1-405b',
        provider: 'meta',
        capabilities: ['reasoning', 'code', 'analysis', 'generation'],
        cost_per_token: 0.0000005,
        max_tokens: 128000,
        optimal_tasks: [
          'general_reasoning',
          'code_completion',
          'data_analysis',
          'cost_sensitive_tasks',
          'batch_processing'
        ],
        constraints: {
          temperature_range: [0.0, 1.0],
          supported_languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru'],
          special_features: ['open_source', 'cost_effective', 'strong_reasoning']
        }
      }
    ];

    defaultModels.forEach(model => this.registerModel(model));
  }

  private initializeTaskMappings(): void {
    // Additional task-specific mappings
    const taskMappings: Record<string, string[]> = {
      'security_analysis': ['claude-3.5-sonnet', 'gpt-4-turbo'],
      'performance_optimization': ['claude-3.5-sonnet', 'llama-3.1-405b'],
      'ui_ux_design': ['gpt-4-turbo', 'claude-3.5-sonnet'],
      'database_design': ['claude-3.5-sonnet', 'gpt-4-turbo'],
      'api_development': ['claude-3.5-sonnet', 'gpt-4-turbo'],
      'testing_strategy': ['claude-3.5-sonnet', 'gpt-4-turbo'],
      'documentation': ['claude-3.5-sonnet', 'gpt-4-turbo', 'gemini-pro'],
      'research': ['gemini-pro', 'claude-3.5-sonnet'],
      'data_processing': ['gemini-pro', 'llama-3.1-405b']
    };

    Object.entries(taskMappings).forEach(([task, modelIds]) => {
      this.taskModelMapping.set(task, modelIds);
    });
  }

  private filterModels(criteria: ModelSelectionCriteria): ModelDescriptor[] {
    return Array.from(this.models.values()).filter(model => {
      // Check task compatibility
      if (!model.optimal_tasks.includes(criteria.taskType)) {
        return false;
      }

      // Check capability compatibility
      const hasRequiredCapabilities = criteria.agentCapabilities.every(cap =>
        model.capabilities.includes(cap)
      );
      if (!hasRequiredCapabilities) {
        return false;
      }

      // Apply constraints
      if (criteria.constraints) {
        const { maxCost, maxLatency, preferredProviders, excludedProviders } = criteria.constraints;

        if (maxCost && model.cost_per_token > maxCost) {
          return false;
        }

        if (excludedProviders && excludedProviders.includes(model.provider)) {
          return false;
        }

        if (preferredProviders && !preferredProviders.includes(model.provider)) {
          return false;
        }
      }

      // Apply context constraints
      if (criteria.context) {
        const { inputSize, outputSize } = criteria.context;

        if (inputSize && inputSize > model.max_tokens) {
          return false;
        }

        if (outputSize && outputSize > model.max_tokens) {
          return false;
        }
      }

      return true;
    });
  }

  private scoreModel(model: ModelDescriptor, criteria: ModelSelectionCriteria): number {
    let score = 0;

    // Base score for task compatibility
    if (model.optimal_tasks.includes(criteria.taskType)) {
      score += 40;
    }

    // Capability matching score
    const capabilityMatch = criteria.agentCapabilities.filter(cap =>
      model.capabilities.includes(cap)
    ).length / criteria.agentCapabilities.length;
    score += capabilityMatch * 30;

    // Cost score (lower is better)
    const costScore = Math.max(0, 20 - (model.cost_per_token * 1000000));
    score += costScore;

    // Context size score
    if (criteria.context?.inputSize) {
      const contextScore = Math.min(10, (model.max_tokens / criteria.context.inputSize) * 10);
      score += contextScore;
    }

    // Performance bonus
    const metrics = this.getPerformanceMetrics(model.model_id, criteria.taskType);
    if (metrics) {
      score += metrics.successRate * 10;
      score += Math.max(0, 10 - (metrics.averageLatency / 1000));
    }

    return score;
  }

  private getScoreReasoning(model: ModelDescriptor, criteria: ModelSelectionCriteria): string[] {
    const reasoning: string[] = [];

    if (model.optimal_tasks.includes(criteria.taskType)) {
      reasoning.push(`Optimized for ${criteria.taskType}`);
    }

    const matchedCapabilities = criteria.agentCapabilities.filter(cap =>
      model.capabilities.includes(cap)
    );
    if (matchedCapabilities.length > 0) {
      reasoning.push(`Supports required capabilities: ${matchedCapabilities.join(', ')}`);
    }

    if (model.cost_per_token < 0.000005) {
      reasoning.push('Cost-effective option');
    }

    if (model.max_tokens > 1000000) {
      reasoning.push('Large context window support');
    }

    const metrics = this.getPerformanceMetrics(model.model_id, criteria.taskType);
    if (metrics && metrics.successRate > 0.9) {
      reasoning.push('High success rate for this task type');
    }

    return reasoning;
  }

  private calculateConfidence(score: number): number {
    // Normalize score to 0-1 range (assuming max score is 100)
    return Math.min(1.0, Math.max(0.0, score / 100));
  }

  private estimateCost(model: ModelDescriptor, criteria: ModelSelectionCriteria): number {
    // Estimate based on input/output size and model cost
    const inputTokens = criteria.context?.inputSize || 1000;
    const outputTokens = criteria.context?.outputSize || 500;
    const totalTokens = inputTokens + outputTokens;
    
    return totalTokens * model.cost_per_token;
  }

  private estimateLatency(model: ModelDescriptor, criteria: ModelSelectionCriteria): number {
    // Base latency estimates by provider (in milliseconds)
    const baseLatency: Record<string, number> = {
      'anthropic': 2000,
      'openai': 1500,
      'google': 2500,
      'meta': 3000
    };

    const latency = baseLatency[model.provider] || 2000;
    
    // Adjust based on input size
    const inputSize = criteria.context?.inputSize || 1000;
    const sizeMultiplier = Math.log10(inputSize / 1000) + 1;
    
    return Math.max(latency, latency * sizeMultiplier);
  }
}