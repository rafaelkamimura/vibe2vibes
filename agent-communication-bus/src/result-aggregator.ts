import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ResultAggregation,
  AgentResult,
  ResultSynthesis,
  Conflict
} from './types/protocol';

export interface AggregationRequest {
  sessionId: string;
  taskType: string;
  agentResults: AgentResult[];
  synthesisMethod: 'consensus' | 'specialist_priority' | 'confidence_weighted' | 'manual';
  weights?: Record<string, number>; // For confidence_weighted method
  specialistAgents?: string[]; // For specialist_priority method
  timeout?: number;
}

export interface ConflictResolution {
  conflict: Conflict;
  resolution: string;
  confidence: number;
  resolver: string;
}

export class ResultAggregator extends EventEmitter {
  private activeAggregations: Map<string, ResultAggregation> = new Map();
  private conflictResolvers: Map<string, ConflictResolution[]> = new Map();
  private agentSpecializations: Map<string, string[]> = new Map();

  constructor() {
    super();
    this.initializeAgentSpecializations();
  }

  /**
   * Start aggregating results from multiple agents
   */
  async aggregateResults(request: AggregationRequest): Promise<string> {
    const aggregationId = `agg_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    const aggregation: ResultAggregation = {
      aggregation_id: aggregationId,
      session_id: request.sessionId,
      task_type: request.taskType,
      agent_results: request.agentResults,
      synthesis: {
        unified_result: null,
        confidence_score: 0,
        conflicts: [],
        recommendations: [],
        synthesis_method: request.synthesisMethod
      },
      metadata: {
        total_time: '0ms',
        cost_estimate: this.calculateCostEstimate(request.agentResults),
        quality_metrics: {},
        agent_performance: {}
      }
    };

    this.activeAggregations.set(aggregationId, aggregation);
    this.emit('aggregation_started', { aggregation_id: aggregationId, request });

    // Start synthesis process
    this.performSynthesis(aggregationId, request);

    return aggregationId;
  }

  /**
   * Get aggregation status and results
   */
  getAggregation(aggregationId: string): ResultAggregation | null {
    return this.activeAggregations.get(aggregationId) || null;
  }

  /**
   * Cancel ongoing aggregation
   */
  cancelAggregation(aggregationId: string): boolean {
    const aggregation = this.activeAggregations.get(aggregationId);
    if (!aggregation) {
      return false;
    }

    this.activeAggregations.delete(aggregationId);
    this.emit('aggregation_cancelled', { aggregation_id: aggregationId });
    
    return true;
  }

  /**
   * Add agent result to existing aggregation
   */
  addAgentResult(aggregationId: string, result: AgentResult): boolean {
    const aggregation = this.activeAggregations.get(aggregationId);
    if (!aggregation) {
      return false;
    }

    // Check if agent already has a result
    const existingIndex = aggregation.agent_results.findIndex(r => r.agent_id === result.agent_id);
    if (existingIndex >= 0) {
      aggregation.agent_results[existingIndex] = result;
    } else {
      aggregation.agent_results.push(result);
    }

    // Re-run synthesis with new result
    this.performSynthesis(aggregationId, {
      sessionId: aggregation.session_id,
      taskType: aggregation.task_type,
      agentResults: aggregation.agent_results,
      synthesisMethod: aggregation.synthesis.synthesis_method
    });

    this.emit('agent_result_added', { aggregation_id: aggregationId, result });
    
    return true;
  }

  /**
   * Register agent specializations
   */
  registerAgentSpecialization(agentId: string, specializations: string[]): void {
    this.agentSpecializations.set(agentId, specializations);
    this.emit('specialization_registered', { agent_id: agentId, specializations });
  }

  /**
   * Get conflict resolution strategies
   */
  getConflictResolutions(aggregationId: string): ConflictResolution[] {
    return this.conflictResolvers.get(aggregationId) || [];
  }

  /**
   * Private synthesis methods
   */
  private async performSynthesis(aggregationId: string, request: AggregationRequest): Promise<void> {
    const aggregation = this.activeAggregations.get(aggregationId);
    if (!aggregation) {
      return;
    }

    try {
      const startTime = Date.now();
      
      // Detect conflicts
      const conflicts = this.detectConflicts(aggregation.agent_results);
      aggregation.synthesis.conflicts = conflicts;

      // Resolve conflicts
      const resolvedConflicts = await this.resolveConflicts(conflicts, request);
      this.conflictResolvers.set(aggregationId, resolvedConflicts);

      // Perform synthesis based on method
      let synthesis: ResultSynthesis;
      switch (request.synthesisMethod) {
        case 'consensus':
          synthesis = this.consensusSynthesis(aggregation.agent_results, conflicts);
          break;
        case 'specialist_priority':
          synthesis = this.specialistPrioritySynthesis(
            aggregation.agent_results, 
            conflicts, 
            request.specialistAgents || []
          );
          break;
        case 'confidence_weighted':
          synthesis = this.confidenceWeightedSynthesis(
            aggregation.agent_results, 
            conflicts, 
            request.weights || {}
          );
          break;
        case 'manual':
          synthesis = this.manualSynthesis(aggregation.agent_results, conflicts);
          break;
        default:
          throw new Error(`Unknown synthesis method: ${request.synthesisMethod}`);
      }

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(aggregation.agent_results);
      const agentPerformance = this.calculateAgentPerformance(aggregation.agent_results);

      // Update aggregation
      aggregation.synthesis = synthesis;
      aggregation.metadata.quality_metrics = qualityMetrics;
      aggregation.metadata.agent_performance = agentPerformance;
      aggregation.metadata.total_time = `${Date.now() - startTime}ms`;

      this.activeAggregations.set(aggregationId, aggregation);
      this.emit('synthesis_completed', { aggregation_id: aggregationId, synthesis });

    } catch (error) {
      this.emit('synthesis_failed', { 
        aggregation_id: aggregationId, 
        error: (error as Error).message 
      });
    }
  }

  private detectConflicts(results: AgentResult[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check for result disagreements
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const result1 = results[i];
        const result2 = results[j];

        if (this.haveConflictingResults(result1, result2)) {
          conflicts.push({
            type: 'result_disagreement',
            agents: [result1.agent_id, result2.agent_id],
            description: `Conflicting results between ${result1.agent_id} and ${result2.agent_id}`
          });
        }
      }
    }

    // Check for approach differences
    const approaches = this.extractApproaches(results);
    if (approaches.length > 1) {
      conflicts.push({
        type: 'approach_difference',
        agents: results.map(r => r.agent_id),
        description: `Different approaches detected: ${approaches.join(', ')}`
      });
    }

    return conflicts;
  }

  private async resolveConflicts(
    conflicts: Conflict[], 
    request: AggregationRequest
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      let resolution: ConflictResolution;

      switch (conflict.type) {
        case 'result_disagreement':
          resolution = this.resolveResultDisagreement(conflict, request);
          break;
        case 'approach_difference':
          resolution = this.resolveApproachDifference(conflict, request);
          break;
        case 'priority_conflict':
          resolution = this.resolvePriorityConflict(conflict, request);
          break;
        default:
          resolution = {
            conflict,
            resolution: 'Manual review required',
            confidence: 0.5,
            resolver: 'system'
          };
      }

      resolutions.push(resolution);
    }

    return resolutions;
  }

  private consensusSynthesis(
    results: AgentResult[], 
    conflicts: Conflict[]
  ): ResultSynthesis {
    // Find common elements across results
    const commonElements = this.findCommonElements(results);
    const conflictingElements = this.extractConflictingElements(conflicts);

    // Calculate consensus confidence
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const consensusPenalty = conflicts.length * 0.1;
    const finalConfidence = Math.max(0, avgConfidence - consensusPenalty);

    return {
      unified_result: {
        consensus: commonElements,
        conflicts: conflictingElements,
        requires_review: conflicts.length > 0
      },
      confidence_score: finalConfidence,
      conflicts,
      recommendations: this.generateConsensusRecommendations(results, conflicts),
      synthesis_method: 'consensus'
    };
  }

  private specialistPrioritySynthesis(
    results: AgentResult[], 
    conflicts: Conflict[], 
    specialistAgents: string[]
  ): ResultSynthesis {
    // Prioritize results from specialist agents
    const specialistResults = results.filter(r => specialistAgents.includes(r.agent_id));
    const generalResults = results.filter(r => !specialistAgents.includes(r.agent_id));

    // Use specialist results as primary, general as fallback
    const primaryResult = specialistResults.length > 0 
      ? specialistResults.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        )
      : generalResults.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );

    return {
      unified_result: primaryResult.result,
      confidence_score: primaryResult.confidence,
      conflicts,
      recommendations: [
        `Primary result from specialist agent: ${primaryResult.agent_id}`,
        ...this.generateSpecialistRecommendations(specialistResults, generalResults)
      ],
      synthesis_method: 'specialist_priority'
    };
  }

  private confidenceWeightedSynthesis(
    results: AgentResult[], 
    conflicts: Conflict[], 
    weights: Record<string, number>
  ): ResultSynthesis {
    // Calculate weighted average of results
    const _totalWeight = results.reduce((sum, r) =>
      sum + (weights[r.agent_id] || r.confidence), 0
    );
    void _totalWeight; // Reserved for future weighted calculation

    const weightedResult = this.combineWeightedResults(results, weights);
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      unified_result: weightedResult,
      confidence_score: avgConfidence,
      conflicts,
      recommendations: this.generateWeightedRecommendations(results, weights),
      synthesis_method: 'confidence_weighted'
    };
  }

  private manualSynthesis(_results: AgentResult[], conflicts: Conflict[]): ResultSynthesis {
    return {
      unified_result: null, // Requires manual intervention
      confidence_score: 0,
      conflicts,
      recommendations: [
        'Manual synthesis required due to complexity',
        'Review all agent results carefully',
        'Consider domain expertise for final decision'
      ],
      synthesis_method: 'manual'
    };
  }

  // Helper methods
  private haveConflictingResults(result1: AgentResult, result2: AgentResult): boolean {
    // Simple conflict detection - can be made more sophisticated
    if (result1.error && result2.error) {
      return false; // Both failed, not a conflict
    }
    
    if (result1.error || result2.error) {
      return true; // One succeeded, one failed
    }

    // Compare result structures (simplified)
    return JSON.stringify(result1.result) !== JSON.stringify(result2.result);
  }

  private extractApproaches(results: AgentResult[]): string[] {
    const approaches = new Set<string>();
    
    results.forEach(result => {
      if (result.result && typeof result.result === 'object') {
        const approach = (result.result as any).approach || (result.result as any).method;
        if (approach) {
          approaches.add(approach);
        }
      }
    });

    return Array.from(approaches);
  }

  private findCommonElements(results: AgentResult[]): any {
    const successfulResults = results.filter(r => !r.error);
    if (successfulResults.length === 0) {
      return null;
    }

    // For now, return the most common successful result
    // This can be made more sophisticated with proper diffing
    const resultStrings = successfulResults.map(r => JSON.stringify(r.result));
    const frequency: Record<string, number> = {};
    
    resultStrings.forEach(str => {
      frequency[str] = (frequency[str] || 0) + 1;
    });

    const mostCommon = Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    return JSON.parse(mostCommon);
  }

  private extractConflictingElements(conflicts: Conflict[]): any[] {
    return conflicts.map(conflict => ({
      type: conflict.type,
      agents: conflict.agents,
      description: conflict.description
    }));
  }

  private generateConsensusRecommendations(
    results: AgentResult[], 
    conflicts: Conflict[]
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length > 0) {
      recommendations.push(`${conflicts.length} conflicts detected - manual review recommended`);
    }

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    if (avgConfidence < 0.7) {
      recommendations.push('Low average confidence - consider additional analysis');
    }

    const failedResults = results.filter(r => r.error);
    if (failedResults.length > 0) {
      recommendations.push(`${failedResults.length} agents failed - investigate errors`);
    }

    return recommendations;
  }

  private generateSpecialistRecommendations(
    specialistResults: AgentResult[], 
    generalResults: AgentResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (specialistResults.length > 0) {
      recommendations.push(`Prioritizing ${specialistResults.length} specialist agent results`);
    }

    if (generalResults.length > 0) {
      recommendations.push(`Using ${generalResults.length} general agent results as supplementary`);
    }

    return recommendations;
  }

  private generateWeightedRecommendations(
    _results: AgentResult[],
    weights: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    const weightedAgents = Object.entries(weights).sort(([,a], [,b]) => b - a);

    if (weightedAgents.length > 0) {
      recommendations.push(`Highest weight: ${weightedAgents[0][0]} (${weightedAgents[0][1]})`);
    }

    return recommendations;
  }

  private combineWeightedResults(
    results: AgentResult[], 
    weights: Record<string, number>
  ): any {
    // Simplified weighted combination
    // In practice, this would need to be more sophisticated based on result types
    const totalWeight = results.reduce((sum, r) => 
      sum + (weights[r.agent_id] || r.confidence), 0
    );

    let weightedSum = 0;
    results.forEach(result => {
      const weight = weights[result.agent_id] || result.confidence;
      if (typeof result.result === 'number') {
        weightedSum += result.result * weight;
      }
    });

    return weightedSum / totalWeight;
  }

  private resolveResultDisagreement(
    conflict: Conflict,
    _request: AggregationRequest
  ): ConflictResolution {
    // Simple resolution - prefer higher confidence agent
    // In practice, this would be more sophisticated
    return {
      conflict,
      resolution: 'Prefer result from higher confidence agent',
      confidence: 0.7,
      resolver: 'system'
    };
  }

  private resolveApproachDifference(
    conflict: Conflict,
    _request: AggregationRequest
  ): ConflictResolution {
    return {
      conflict,
      resolution: 'Document multiple approaches for manual review',
      confidence: 0.5,
      resolver: 'system'
    };
  }

  private resolvePriorityConflict(
    conflict: Conflict,
    _request: AggregationRequest
  ): ConflictResolution {
    return {
      conflict,
      resolution: 'Escalate to human decision maker',
      confidence: 0.3,
      resolver: 'system'
    };
  }

  private calculateCostEstimate(results: AgentResult[]): number {
    // Simplified cost calculation
    return results.length * 0.01; // Placeholder
  }

  private calculateQualityMetrics(results: AgentResult[]): Record<string, number> {
    const successfulResults = results.filter(r => !r.error);
    const avgConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;
    
    return {
      code_coverage: 0.85, // Placeholder
      security_score: 0.92, // Placeholder
      performance_score: 0.88, // Placeholder
      maintainability_score: avgConfidence
    };
  }

  private calculateAgentPerformance(results: AgentResult[]): Record<string, any> {
    const performance: Record<string, any> = {};
    
    results.forEach(result => {
      performance[result.agent_id] = {
        response_time: result.completion_time,
        success_rate: result.error ? 0 : 1,
        confidence: result.confidence
      };
    });

    return performance;
  }

  private initializeAgentSpecializations(): void {
    // Default specializations
    this.agentSpecializations.set('opencode://code-reviewer', ['code_review', 'security', 'quality']);
    this.agentSpecializations.set('codex://frontend-developer', ['frontend', 'ui', 'ux']);
    this.agentSpecializations.set('claude-code://backend-architect', ['backend', 'architecture', 'scalability']);
  }
}