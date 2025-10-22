import { EventEmitter } from 'events';
import { AgentMessage, AgentDescriptor } from './types/protocol';

export interface RoutingResult {
  success: boolean;
  route?: string;
  error?: string;
  alternatives?: string[];
}

export interface RoutingRule {
  id: string;
  condition: (message: AgentMessage) => boolean;
  action: (message: AgentMessage) => RoutingResult;
  priority: number;
  description: string;
}

export interface LoadBalancingStrategy {
  name: string;
  selectAgent: (candidates: string[], message: AgentMessage) => string;
}

export class MessageRouter extends EventEmitter {
  private routingRules: Map<string, RoutingRule> = new Map();
  private loadBalancingStrategies: Map<string, LoadBalancingStrategy> = new Map();
  private agentLoad: Map<string, number> = new Map();
  private agentHealth: Map<string, boolean> = new Map();
  private currentStrategy: string = 'round_robin';
  private roundRobinIndex: number = 0;

  constructor(private registeredAgents: Map<string, AgentDescriptor>) {
    super();
    this.initializeDefaultRules();
    this.initializeLoadBalancingStrategies();
  }

  /**
   * Route message to appropriate agent
   */
  routeMessage(message: AgentMessage): RoutingResult {
    try {
      // Apply routing rules in priority order
      const sortedRules = Array.from(this.routingRules.values())
        .sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        if (rule.condition(message)) {
          const result = rule.action(message);
          if (result.success) {
            this.emit('message_routed', { message, route: result.route, rule: rule.id });
            return result;
          }
        }
      }

      // Default routing
      return this.defaultRouting(message);
    } catch (error) {
      this.emit('routing_failed', { message, error: (error as Error).message });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Add custom routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.set(rule.id, rule);
    this.emit('rule_added', { rule });
  }

  /**
   * Remove routing rule
   */
  removeRoutingRule(ruleId: string): boolean {
    const removed = this.routingRules.delete(ruleId);
    if (removed) {
      this.emit('rule_removed', { rule_id: ruleId });
    }
    return removed;
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancingStrategy(strategy: string): boolean {
    if (this.loadBalancingStrategies.has(strategy)) {
      this.currentStrategy = strategy;
      this.emit('strategy_changed', { strategy });
      return true;
    }
    return false;
  }

  /**
   * Update agent load information
   */
  updateAgentLoad(agentId: string, load: number): void {
    this.agentLoad.set(agentId, load);
    this.emit('load_updated', { agent_id: agentId, load });
  }

  /**
   * Update agent health status
   */
  updateAgentHealth(agentId: string, healthy: boolean): void {
    this.agentHealth.set(agentId, healthy);
    this.emit('health_updated', { agent_id: agentId, healthy });
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalAgents: number;
    healthyAgents: number;
    averageLoad: number;
    currentStrategy: string;
    activeRules: number;
  } {
    const totalAgents = this.registeredAgents.size;
    const healthyAgents = Array.from(this.agentHealth.values()).filter(h => h).length;
    const loads = Array.from(this.agentLoad.values());
    const averageLoad = loads.length > 0 ? loads.reduce((sum, load) => sum + load, 0) / loads.length : 0;

    return {
      totalAgents,
      healthyAgents,
      averageLoad,
      currentStrategy: this.currentStrategy,
      activeRules: this.routingRules.size
    };
  }

  /**
   * Private initialization methods
   */
  private initializeDefaultRules(): void {
    // Rule 1: Direct message routing
    this.addRoutingRule({
      id: 'direct_routing',
      priority: 100,
      description: 'Route directly to specified recipient',
      condition: (message) => !!message.recipient.agent_id,
      action: (message) => {
        const agentId = message.recipient.agent_id;
        if (this.registeredAgents.has(agentId) && this.isAgentHealthy(agentId)) {
          return {
            success: true,
            route: `direct://${agentId}`
          };
        }
        return {
          success: false,
          error: `Agent ${agentId} not available`
        };
      }
    });

    // Rule 2: Task type routing
    this.addRoutingRule({
      id: 'task_type_routing',
      priority: 90,
      description: 'Route based on task type to specialized agents',
      condition: (message) => !!message.payload?.task_type,
      action: (message) => {
        const taskType = message.payload.task_type;
        const candidates = this.findAgentsForTask(taskType);
        
        if (candidates.length === 0) {
          return {
            success: false,
            error: `No agents available for task type: ${taskType}`
          };
        }

        const selected = this.selectAgentByLoadBalancing(candidates, message);
        return {
          success: true,
          route: `task://${taskType}/${selected}`,
          alternatives: candidates.filter(a => a !== selected)
        };
      }
    });

    // Rule 3: Capability-based routing
    this.addRoutingRule({
      id: 'capability_routing',
      priority: 80,
      description: 'Route based on required capabilities',
      condition: (message) => !!message.payload?.required_capabilities,
      action: (message) => {
        const requiredCapabilities = message.payload.required_capabilities;
        const candidates = this.findAgentsWithCapabilities(requiredCapabilities);
        
        if (candidates.length === 0) {
          return {
            success: false,
            error: `No agents with required capabilities: ${requiredCapabilities.join(', ')}`
          };
        }

        const selected = this.selectAgentByLoadBalancing(candidates, message);
        return {
          success: true,
          route: `capability://${requiredCapabilities.join(',')}/${selected}`,
          alternatives: candidates.filter(a => a !== selected)
        };
      }
    });

    // Rule 4: Framework-specific routing
    this.addRoutingRule({
      id: 'framework_routing',
      priority: 70,
      description: 'Route to specific framework if requested',
      condition: (message) => !!message.payload?.preferred_framework,
      action: (message) => {
        const framework = message.payload.preferred_framework;
        const candidates = this.findAgentsByFramework(framework);
        
        if (candidates.length === 0) {
          return {
            success: false,
            error: `No agents available for framework: ${framework}`
          };
        }

        const selected = this.selectAgentByLoadBalancing(candidates, message);
        return {
          success: true,
          route: `framework://${framework}/${selected}`,
          alternatives: candidates.filter(a => a !== selected)
        };
      }
    });
  }

  private initializeLoadBalancingStrategies(): void {
    // Round Robin
    this.loadBalancingStrategies.set('round_robin', {
      name: 'Round Robin',
      selectAgent: (candidates: string[]) => {
        const agent = candidates[this.roundRobinIndex % candidates.length];
        this.roundRobinIndex++;
        return agent;
      }
    });

    // Least Loaded
    this.loadBalancingStrategies.set('least_loaded', {
      name: 'Least Loaded',
      selectAgent: (candidates: string[]) => {
        return candidates.reduce((least, current) => {
          const leastLoad = this.agentLoad.get(least) || 0;
          const currentLoad = this.agentLoad.get(current) || 0;
          return currentLoad < leastLoad ? current : least;
        });
      }
    });

    // Random Selection
    this.loadBalancingStrategies.set('random', {
      name: 'Random',
      selectAgent: (candidates: string[]) => {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    });

    // Priority-based (based on agent capabilities and performance)
    this.loadBalancingStrategies.set('priority', {
      name: 'Priority-based',
      selectAgent: (candidates: string[], message: AgentMessage) => {
        return candidates.reduce((best, current) => {
          const bestScore = this.calculateAgentScore(best, message);
          const currentScore = this.calculateAgentScore(current, message);
          return currentScore > bestScore ? current : best;
        });
      }
    });
  }

  private defaultRouting(message: AgentMessage): RoutingResult {
    // Fallback to any available healthy agent
    const healthyAgents = Array.from(this.registeredAgents.keys())
      .filter(agentId => this.isAgentHealthy(agentId));

    if (healthyAgents.length === 0) {
      return {
        success: false,
        error: 'No healthy agents available'
      };
    }

    const selected = this.selectAgentByLoadBalancing(healthyAgents, message);
    return {
      success: true,
      route: `fallback://${selected}`,
      alternatives: healthyAgents.filter(a => a !== selected)
    };
  }

  private findAgentsForTask(taskType: string): string[] {
    return Array.from(this.registeredAgents.entries())
      .filter(([_, descriptor]) => 
        descriptor.capabilities.optimal_tasks.includes(taskType)
      )
      .map(([agentId, _]) => agentId)
      .filter(agentId => this.isAgentHealthy(agentId));
  }

  private findAgentsWithCapabilities(capabilities: string[]): string[] {
    return Array.from(this.registeredAgents.entries())
      .filter(([_, descriptor]) => 
        capabilities.every(cap => 
          descriptor.capabilities.input_types.includes(cap) ||
          descriptor.capabilities.output_types.includes(cap) ||
          descriptor.capabilities.tools.includes(cap)
        )
      )
      .map(([agentId, _]) => agentId)
      .filter(agentId => this.isAgentHealthy(agentId));
  }

  private findAgentsByFramework(framework: string): string[] {
    return Array.from(this.registeredAgents.entries())
      .filter(([_, descriptor]) => descriptor.framework === framework)
      .map(([agentId, _]) => agentId)
      .filter(agentId => this.isAgentHealthy(agentId));
  }

  private selectAgentByLoadBalancing(candidates: string[], message: AgentMessage): string {
    const strategy = this.loadBalancingStrategies.get(this.currentStrategy);
    if (!strategy) {
      // Fallback to round robin
      return candidates[this.roundRobinIndex++ % candidates.length];
    }
    return strategy.selectAgent(candidates, message);
  }

  private calculateAgentScore(agentId: string, message: AgentMessage): number {
    const descriptor = this.registeredAgents.get(agentId);
    if (!descriptor) {
      return 0;
    }

    let score = 0;

    // Base score from success rate
    score += descriptor.capabilities.performance_profile.success_rate * 50;

    // Load penalty
    const load = this.agentLoad.get(agentId) || 0;
    score -= load * 10;

    // Task type matching
    if (message.payload?.task_type && 
        descriptor.capabilities.optimal_tasks.includes(message.payload.task_type)) {
      score += 30;
    }

    // Response time bonus
    const avgResponseTime = parseFloat(descriptor.capabilities.performance_profile.avg_response_time);
    if (avgResponseTime < 2000) { // Less than 2 seconds
      score += 20;
    }

    return Math.max(0, score);
  }

  private isAgentHealthy(agentId: string): boolean {
    return this.agentHealth.get(agentId) !== false; // Default to healthy if not specified
  }
}