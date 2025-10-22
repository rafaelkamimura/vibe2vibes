import { ModelSelector } from '../../src/model-selector';
import { MockDataGenerator } from '../utils/mock-generators';
import { ModelDescriptor } from '../../src/types/protocol';

describe('ModelSelector', () => {
  let modelSelector: ModelSelector;
  let availableModels: ModelDescriptor[];

  beforeEach(() => {
    MockDataGenerator.reset();
    modelSelector = new ModelSelector();
    
    // Create test models
    availableModels = [
      {
        model_id: 'gpt-4',
        provider: 'openai',
        capabilities: ['code_generation', 'analysis', 'debugging'],
        cost_per_token: 0.00003,
        max_tokens: 8192,
        optimal_tasks: ['coding', 'analysis', 'debugging'],
        constraints: {
          temperature_range: [0.0, 2.0],
          supported_languages: ['typescript', 'javascript', 'python'],
          special_features: ['function_calling', 'code_interpreter']
        }
      },
      {
        model_id: 'claude-3-opus',
        provider: 'anthropic',
        capabilities: ['code_review', 'documentation', 'architecture'],
        cost_per_token: 0.000015,
        max_tokens: 200000,
        optimal_tasks: ['review', 'documentation', 'design'],
        constraints: {
          temperature_range: [0.0, 1.0],
          supported_languages: ['typescript', 'javascript', 'python', 'go'],
          special_features: ['large_context', 'reasoning']
        }
      },
      {
        model_id: 'codex',
        provider: 'openai',
        capabilities: ['code_completion', 'translation', 'refactoring'],
        cost_per_token: 0.00001,
        max_tokens: 4096,
        optimal_tasks: ['completion', 'translation', 'refactoring'],
        constraints: {
          temperature_range: [0.0, 1.0],
          supported_languages: ['python', 'javascript', 'go'],
          special_features: ['fast_response', 'code_focus']
        }
      }
    ];

    // Register models with selector
    availableModels.forEach(model => {
      modelSelector.registerModel(model);
    });
  });

  describe('Constructor', () => {
    it('should initialize with default models', () => {
      const emptySelector = new ModelSelector();
      expect(emptySelector.getAllModels().length).toBeGreaterThan(0);
    });
  });

  describe('Model Registration', () => {
    it('should register new model successfully', () => {
      const newModel: ModelDescriptor = {
        model_id: 'test-model',
        provider: 'test-provider',
        capabilities: ['test'],
        cost_per_token: 0.000001,
        max_tokens: 1000,
        optimal_tasks: ['test_task'],
        constraints: {
          temperature_range: [0.0, 1.0],
          supported_languages: ['english'],
          special_features: []
        }
      };

      modelSelector.registerModel(newModel);
      
      const models = modelSelector.getAllModels();
      expect(models.length).toBeGreaterThan(4); // default models + our test model
      expect(models.some(m => m.model_id === 'test-model')).toBe(true);
    });

    it('should emit model_registered event', () => {
      const eventSpy = jest.fn();
      const newModel: ModelDescriptor = {
        model_id: 'event-test-model',
        provider: 'test-provider',
        capabilities: ['test'],
        cost_per_token: 0.000001,
        max_tokens: 1000,
        optimal_tasks: ['test_task'],
        constraints: {
          temperature_range: [0.0, 1.0],
          supported_languages: ['english'],
          special_features: []
        }
      };

      modelSelector.on('model_registered', eventSpy);
      modelSelector.registerModel(newModel);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: newModel
        })
      );
    });

    it('should handle duplicate model registration', () => {
      const duplicateModel = availableModels[0];
      
      // Should not throw, just overwrite existing
      expect(() => {
        modelSelector.registerModel(duplicateModel);
      }).not.toThrow();
    });
  });

  describe('Model Selection', () => {
    it('should select optimal model for coding task', () => {
      const criteria = {
        taskType: 'coding',
        agentCapabilities: ['code_generation', 'analysis']
      };
      
      const result = modelSelector.selectModel(criteria);
      
      expect(result).toBeDefined();
      expect(result.model.optimal_tasks).toContain('coding');
      expect(result.model.capabilities).toContain('code_generation');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.alternatives).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.estimatedLatency).toBeGreaterThan(0);
    });

    it('should select optimal model for review task', () => {
      const criteria = {
        taskType: 'code_review',
        agentCapabilities: ['code_review', 'documentation']
      };
      
      const result = modelSelector.selectModel(criteria);
      
      expect(result).toBeDefined();
      expect(result.model.optimal_tasks).toContain('code_review');
      expect(result.model.capabilities).toContain('code_review');
    });

    it('should respect provider constraints', () => {
      const criteria = {
        taskType: 'coding',
        agentCapabilities: ['code_generation'],
        constraints: {
          preferredProviders: ['anthropic']
        }
      };
      
      const result = modelSelector.selectModel(criteria);
      
      expect(result).toBeDefined();
      expect(result.model.provider).toBe('anthropic');
    });

    it('should throw error when no suitable model found', () => {
      const criteria = {
        taskType: 'non_existent_task',
        agentCapabilities: ['non_existent_capability']
      };
      
      expect(() => {
        modelSelector.selectModel(criteria);
      }).toThrow('No suitable models found');
    });

    it('should emit model_selected event', () => {
      const eventSpy = jest.fn();
      const criteria = {
        taskType: 'coding',
        agentCapabilities: ['code_generation']
      };
      
      modelSelector.on('model_selected', eventSpy);
      modelSelector.selectModel(criteria);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          criteria,
          result: expect.any(Object)
        })
      );
    });
  });

  describe('Model Selection with Constraints', () => {
    it('should respect cost constraints', () => {
      const criteria = {
        taskType: 'coding',
        agentCapabilities: ['code_generation'],
        constraints: {
          maxCost: 0.00002
        }
      };
      
      const result = modelSelector.selectModel(criteria);
      
      expect(result).toBeDefined();
      expect(result.model.cost_per_token).toBeLessThanOrEqual(0.00002);
    });

    it('should respect provider exclusion constraints', () => {
      const criteria = {
        taskType: 'coding',
        agentCapabilities: ['code_generation'],
        constraints: {
          excludedProviders: ['openai']
        }
      };
      
      const result = modelSelector.selectModel(criteria);
      
      expect(result).toBeDefined();
      expect(result.model.provider).not.toBe('openai');
    });

    it('should respect context size constraints', () => {
      const criteria = {
        taskType: 'analysis',
        agentCapabilities: ['analysis'],
        context: {
          inputSize: 100000
        }
      };
      
      const result = modelSelector.selectModel(criteria);
      
      expect(result).toBeDefined();
      expect(result.model.max_tokens).toBeGreaterThanOrEqual(100000);
    });
  });

  describe('Model Management', () => {
    it('should get model by ID', () => {
      const model = modelSelector.getModel('claude-3.5-sonnet');
      
      expect(model).toBeDefined();
      expect(model!.model_id).toBe('claude-3.5-sonnet');
      expect(model!.provider).toBe('anthropic');
    });

    it('should return null for non-existent model', () => {
      const model = modelSelector.getModel('non-existent-model');
      expect(model).toBeNull();
    });

    it('should get all models', () => {
      const models = modelSelector.getAllModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.model_id === 'claude-3.5-sonnet')).toBe(true);
      expect(models.some(m => m.model_id === 'gpt-4-turbo')).toBe(true);
    });

    it('should get models by provider', () => {
      const anthropicModels = modelSelector.getModelsByProvider('anthropic');
      
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(anthropicModels.every(m => m.provider === 'anthropic')).toBe(true);
    });

    it('should get models for task', () => {
      const codingModels = modelSelector.getModelsForTask('code_review');
      
      expect(codingModels.length).toBeGreaterThan(0);
      expect(codingModels.every(m => m.optimal_tasks.includes('code_review'))).toBe(true);
    });

    it('should return empty array for task with no models', () => {
      const models = modelSelector.getModelsForTask('non_existent_task');
      expect(models).toHaveLength(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should update performance metrics', () => {
      const metrics = {
        modelId: 'claude-3.5-sonnet',
        taskType: 'code_review',
        averageLatency: 1500,
        successRate: 0.95,
        costPerTask: 0.05,
        userSatisfaction: 4.5,
        lastUpdated: new Date().toISOString()
      };

      modelSelector.updatePerformanceMetrics(metrics);
      
      const retrieved = modelSelector.getPerformanceMetrics('claude-3.5-sonnet', 'code_review');
      expect(retrieved).toEqual(metrics);
    });

    it('should emit metrics_updated event', () => {
      const eventSpy = jest.fn();
      const metrics = {
        modelId: 'test-model',
        taskType: 'test_task',
        averageLatency: 1000,
        successRate: 0.9,
        costPerTask: 0.01,
        userSatisfaction: 4.0,
        lastUpdated: new Date().toISOString()
      };

      modelSelector.on('metrics_updated', eventSpy);
      modelSelector.updatePerformanceMetrics(metrics);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics
        })
      );
    });

    it('should return null for non-existent metrics', () => {
      const metrics = modelSelector.getPerformanceMetrics('non-existent-model', 'non_existent_task');
      expect(metrics).toBeNull();
    });
  });

  describe('Optimize Selection', () => {
    it('should use performance data for optimization', () => {
      // First add performance metrics
      const metrics = {
        modelId: 'claude-3.5-sonnet',
        taskType: 'code_review',
        averageLatency: 1000,
        successRate: 0.98,
        costPerTask: 0.03,
        userSatisfaction: 4.8,
        lastUpdated: new Date().toISOString()
      };
      modelSelector.updatePerformanceMetrics(metrics);

      const criteria = {
        taskType: 'code_review',
        agentCapabilities: ['code_review']
      };
      
      const result = modelSelector.optimizeSelection(criteria);
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedLatency).toBe(1000); // Should use real performance data
      expect(result.estimatedCost).toBe(0.03); // Should use real cost data
    });
  });
});