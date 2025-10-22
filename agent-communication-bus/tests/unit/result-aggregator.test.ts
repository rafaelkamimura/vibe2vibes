import { ResultAggregator, AggregationRequest } from '../../src/result-aggregator';
import { MockDataGenerator } from '../utils/mock-generators';

describe('ResultAggregator', () => {
  let resultAggregator: ResultAggregator;

  beforeEach(() => {
    MockDataGenerator.reset();
    resultAggregator = new ResultAggregator();
  });

  describe('Constructor', () => {
    it('should initialize with empty aggregations', () => {
      expect(resultAggregator).toBeDefined();
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate results successfully', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [
          MockDataGenerator.createAgentResult({
            agent_id: 'claude-code',
            result: { score: 95, feedback: 'Excellent code' }
          }),
          MockDataGenerator.createAgentResult({
            agent_id: 'opencode',
            result: { score: 88, feedback: 'Good code with minor issues' }
          })
        ],
        synthesisMethod: 'consensus'
      };

      const aggregationId = await resultAggregator.aggregateResults(request);
      
      expect(aggregationId).toBeDefined();
      expect(typeof aggregationId).toBe('string');
      expect(aggregationId).toMatch(/^agg_\d+_[a-f0-9]{8}$/);
    });

    it('should emit aggregation_started event', async () => {
      const eventSpy = jest.fn();
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [MockDataGenerator.createAgentResult()],
        synthesisMethod: 'consensus'
      };

      resultAggregator.on('aggregation_started', eventSpy);
      await resultAggregator.aggregateResults(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregationId: expect.any(String),
          request
        })
      );
    });

    it('should get aggregation by ID', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [MockDataGenerator.createAgentResult()],
        synthesisMethod: 'consensus'
      };

      const aggregationId = await resultAggregator.aggregateResults(request);
      const aggregation = resultAggregator.getAggregation(aggregationId);

      expect(aggregation).toBeDefined();
      expect(aggregation!.aggregation_id).toBe(aggregationId);
      expect(aggregation!.session_id).toBe(request.sessionId);
      expect(aggregation!.task_type).toBe(request.taskType);
    });

    it('should return null for non-existent aggregation', () => {
      const aggregation = resultAggregator.getAggregation('non-existent');
      expect(aggregation).toBeNull();
    });
  });

  describe('Synthesis Methods', () => {
    it('should handle consensus synthesis', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [
          MockDataGenerator.createAgentResult({
            result: { score: 90, recommendation: 'approve' }
          }),
          MockDataGenerator.createAgentResult({
            result: { score: 85, recommendation: 'approve' }
          })
        ],
        synthesisMethod: 'consensus'
      };

      const aggregationId = await resultAggregator.aggregateResults(request);
      const aggregation = resultAggregator.getAggregation(aggregationId);

      expect(aggregation).toBeDefined();
      expect(aggregation!.synthesis.unified_result).toBeDefined();
      expect(aggregation!.synthesis.confidence_score).toBeGreaterThan(0);
    });

    it('should handle confidence_weighted synthesis', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [
          MockDataGenerator.createAgentResult({
            confidence: 0.9,
            result: { score: 90 }
          }),
          MockDataGenerator.createAgentResult({
            confidence: 0.7,
            result: { score: 80 }
          })
        ],
        synthesisMethod: 'confidence_weighted',
        weights: { 'agent-1': 0.9, 'agent-2': 0.7 }
      };

      const aggregationId = await resultAggregator.aggregateResults(request);
      const aggregation = resultAggregator.getAggregation(aggregationId);

      expect(aggregation).toBeDefined();
      expect(aggregation!.synthesis.unified_result).toBeDefined();
    });

    it('should handle specialist_priority synthesis', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'security_review',
        agentResults: [
          MockDataGenerator.createAgentResult({
            agent_id: 'security-specialist',
            result: { vulnerabilities: 2, severity: 'medium' }
          }),
          MockDataGenerator.createAgentResult({
            agent_id: 'general-reviewer',
            result: { vulnerabilities: 1, severity: 'low' }
          })
        ],
        synthesisMethod: 'specialist_priority',
        specialistAgents: ['security-specialist']
      };

      const aggregationId = await resultAggregator.aggregateResults(request);
      const aggregation = resultAggregator.getAggregation(aggregationId);

      expect(aggregation).toBeDefined();
      expect(aggregation!.synthesis.unified_result).toBeDefined();
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts in results', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [
          MockDataGenerator.createAgentResult({
            result: { decision: 'approve', confidence: 0.9 }
          }),
          MockDataGenerator.createAgentResult({
            result: { decision: 'reject', confidence: 0.8 }
          })
        ],
        synthesisMethod: 'consensus'
      };

      const aggregationId = await resultAggregator.aggregateResults(request);
      const aggregation = resultAggregator.getAggregation(aggregationId);

      expect(aggregation).toBeDefined();
      // Conflicts should be stored internally and affect synthesis
      expect(aggregation!.synthesis.conflicts_detected).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty agent results', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [],
        synthesisMethod: 'consensus'
      };

      await expect(resultAggregator.aggregateResults(request))
        .rejects.toThrow();
    });

    it('should handle invalid synthesis method', async () => {
      const request: AggregationRequest = {
        sessionId: 'test-session',
        taskType: 'code_review',
        agentResults: [MockDataGenerator.createAgentResult()],
        synthesisMethod: 'invalid_method' as any
      };

      // Should handle gracefully or throw appropriate error
      const result = await resultAggregator.aggregateResults(request);
      expect(result).toBeDefined();
    });
  });
});