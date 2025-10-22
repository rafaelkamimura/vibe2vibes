import { IntegrationTestRunner, createTestScenario } from './integration-test-framework';
import { MockDataGenerator } from '../utils/mock-generators';
import { AgentMessage } from '../../src/types/protocol';

describe('Multi-Agent Orchestration Tests', () => {
  let testRunner: IntegrationTestRunner;

  beforeEach(() => {
    testRunner = new IntegrationTestRunner();
  });

  afterEach(async () => {
    await testRunner.cleanupAll();
  });

  describe('Agent Coordination', () => {
    it('should coordinate multiple agents in complex workflow', async () => {
      const env = await testRunner.createEnvironment('agent_coordination_test');
      
      try {
        // Register specialized agents
        const architect = await testRunner.registerAgent(env, 'claude-code');
        const developer = await testRunner.registerAgent(env, 'opencode');
        const tester = await testRunner.registerAgent(env, 'codex-cli');
        const reviewer = await testRunner.registerAgent(env, 'claude-code');

        // Connect all agents
        for (const agent of [architect, developer, tester, reviewer]) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Create orchestration session
        const session = await testRunner.createSession(env, architect, [developer, tester, reviewer]);

        // Step 1: Architecture design
        const designTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: architect.agent_id, framework: architect.framework },
          recipient: { agent_id: developer.agent_id, framework: developer.framework },
          payload: {
            task_type: 'architecture_design',
            requirements: ['scalability', 'security', 'maintainability'],
            constraints: ['budget', 'timeline']
          },
          metadata: { 
            session_id: session.sessionId,
            workflow_step: 'design',
            priority: 'high'
          }
        });

        await testRunner.sendMessage(env, designTask);

        // Step 2: Development (parallel to testing preparation)
        const devTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: architect.agent_id, framework: architect.framework },
          recipient: { agent_id: developer.agent_id, framework: developer.framework },
          payload: {
            task_type: 'development',
            architecture: designTask.payload,
            implementation: 'typescript'
          },
          metadata: { 
            session_id: session.sessionId,
            workflow_step: 'development',
            depends_on: 'design'
          }
        });

        // Step 3: Test preparation (parallel)
        const testPrepTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: architect.agent_id, framework: architect.framework },
          recipient: { agent_id: tester.agent_id, framework: tester.framework },
          payload: {
            task_type: 'test_preparation',
            architecture: designTask.payload,
            test_frameworks: ['jest', 'cypress']
          },
          metadata: { 
            session_id: session.sessionId,
            workflow_step: 'test_preparation',
            depends_on: 'design'
          }
        });

        // Execute parallel tasks
        await Promise.all([
          testRunner.sendMessage(env, devTask),
          testRunner.sendMessage(env, testPrepTask)
        ]);

        // Step 4: Code review
        const reviewTask = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: architect.agent_id, framework: architect.framework },
          recipient: { agent_id: reviewer.agent_id, framework: reviewer.framework },
          payload: {
            task_type: 'code_review',
            review_criteria: ['security', 'performance', 'best_practices']
          },
          metadata: { 
            session_id: session.sessionId,
            workflow_step: 'review',
            depends_on: 'development'
          }
        });

        await testRunner.sendMessage(env, reviewTask);

        // Verify orchestration
        const taskRequests = env.messageTracker.getMessagesByType('task_request');
        expect(taskRequests).toHaveLength(4);

        const workflowSteps = taskRequests.map(msg => msg.metadata?.workflow_step);
        expect(workflowSteps).toContain('design');
        expect(workflowSteps).toContain('development');
        expect(workflowSteps).toContain('test_preparation');
        expect(workflowSteps).toContain('review');

        // Verify dependency tracking
        const dependencies = taskRequests.map(msg => msg.metadata?.depends_on).filter(Boolean);
        expect(dependencies).toContain('design');
        expect(dependencies).toContain('development');
      } finally {
        await testRunner.cleanupEnvironment('agent_coordination_test');
      }
    });

    it('should handle dynamic task delegation', async () => {
      const env = await testRunner.createEnvironment('dynamic_delegation_test');
      
      try {
        const coordinator = await testRunner.registerAgent(env, 'claude-code');
        const workers = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli'),
          testRunner.registerAgent(env, 'opencode')
        ]);

        // Connect all agents
        await testRunner.connectAgent(env, coordinator.agent_id);
        for (const worker of workers) {
          await testRunner.connectAgent(env, worker.agent_id);
        }

        const session = await testRunner.createSession(env, coordinator, workers);

        // Dynamic task allocation based on agent capabilities
        const tasks = [
          {
            type: 'frontend_development',
            required_skills: ['react', 'typescript'],
            assigned_to: workers[0].agent_id
          },
          {
            type: 'backend_development',
            required_skills: ['nodejs', 'api'],
            assigned_to: workers[1].agent_id
          },
          {
            type: 'infrastructure_setup',
            required_skills: ['docker', 'kubernetes'],
            assigned_to: workers[2].agent_id
          }
        ];

        // Delegate tasks dynamically
        for (const task of tasks) {
          const delegationMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: coordinator.agent_id, framework: coordinator.framework },
            recipient: { agent_id: task.assigned_to, framework: 'opencode' },
            payload: {
              task_type: task.type,
              required_skills: task.required_skills,
              delegation_reason: 'skill_match'
            },
            metadata: { 
              session_id: session.sessionId,
              delegation_type: 'dynamic',
              skill_match: true
            }
          });

          await testRunner.sendMessage(env, delegationMessage);
        }

        // Verify dynamic delegation
        const delegations = env.messageTracker.getMessagesByType('task_request');
        expect(delegations).toHaveLength(3);

        const skillMatches = delegations.map(msg => msg.metadata?.skill_match);
        expect(skillMatches.every(match => match === true)).toBe(true);

        const taskTypes = delegations.map(msg => msg.payload.task_type);
        expect(taskTypes).toContain('frontend_development');
        expect(taskTypes).toContain('backend_development');
        expect(taskTypes).toContain('infrastructure_setup');
      } finally {
        await testRunner.cleanupEnvironment('dynamic_delegation_test');
      }
    });
  });

  describe('Load Balancing and Resource Management', () => {
    it('should balance load across multiple agents', async () => {
      const env = await testRunner.createEnvironment('load_balancing_test');
      
      try {
        const loadBalancer = await testRunner.registerAgent(env, 'claude-code');
        const workers = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli'),
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        // Connect all agents
        await testRunner.connectAgent(env, loadBalancer.agent_id);
        for (const worker of workers) {
          await testRunner.connectAgent(env, worker.agent_id);
        }

        // Simulate agent load tracking
        const agentLoad = new Map();
        workers.forEach(worker => agentLoad.set(worker.agent_id, 0));

        // Distribute tasks based on current load
        const taskCount = 12;
        for (let i = 0; i < taskCount; i++) {
          // Find least loaded agent
          let leastLoadedAgent = workers[0];
          let minLoad = agentLoad.get(leastLoadedAgent.agent_id);

          for (const worker of workers) {
            const load = agentLoad.get(worker.agent_id);
            if (load < minLoad) {
              leastLoadedAgent = worker;
              minLoad = load;
            }
          }

          // Assign task to least loaded agent
          const taskMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: loadBalancer.agent_id, framework: loadBalancer.framework },
            recipient: { agent_id: leastLoadedAgent.agent_id, framework: leastLoadedAgent.framework },
            payload: {
              task_type: 'balanced_task',
              task_id: `task_${i}`,
              load_balancing: true
            },
            metadata: { 
              load_balancing_strategy: 'round_robin',
              current_load: agentLoad.get(leastLoadedAgent.agent_id)
            }
          });

          await testRunner.sendMessage(env, taskMessage);

          // Update load
          agentLoad.set(leastLoadedAgent.agent_id, agentLoad.get(leastLoadedAgent.agent_id) + 1);
        }

        // Verify load balancing
        const tasks = env.messageTracker.getMessagesByType('task_request');
        expect(tasks).toHaveLength(taskCount);

        const finalLoad = new Map();
        tasks.forEach(task => {
          const agentId = task.recipient.agent_id;
          finalLoad.set(agentId, (finalLoad.get(agentId) || 0) + 1);
        });

        // Load should be reasonably balanced
        const loads = Array.from(finalLoad.values());
        const maxLoad = Math.max(...loads);
        const minLoad = Math.min(...loads);
        expect(maxLoad - minLoad).toBeLessThanOrEqual(2); // Allow small imbalance
      } finally {
        await testRunner.cleanupEnvironment('load_balancing_test');
      }
    });

    it('should handle agent resource constraints', async () => {
      const env = await testRunner.createEnvironment('resource_constraints_test');
      
      try {
        const coordinator = await testRunner.registerAgent(env, 'claude-code');
        const constrainedAgent = await testRunner.registerAgent(env, 'opencode');
        const availableAgent = await testRunner.registerAgent(env, 'codex-cli');

        await testRunner.connectAgent(env, coordinator.agent_id);
        await testRunner.connectAgent(env, constrainedAgent.agent_id);
        await testRunner.connectAgent(env, availableAgent.agent_id);

        // Simulate resource constraints
        const agentResources = new Map([
          [constrainedAgent.agent_id, { cpu: 0.9, memory: 0.8, max_concurrent: 1 }],
          [availableAgent.agent_id, { cpu: 0.3, memory: 0.4, max_concurrent: 5 }]
        ]);

        // Send tasks that should be routed based on resource availability
        const tasks = [
          { priority: 'high', resource_intensive: true },
          { priority: 'medium', resource_intensive: false },
          { priority: 'low', resource_intensive: true }
        ];

        for (const task of tasks) {
          // Select agent based on resource constraints
          let selectedAgent = availableAgent;
          
          if (!task.resource_intensive && agentResources.get(constrainedAgent.agent_id)!.cpu < 0.95) {
            selectedAgent = constrainedAgent;
          }

          const taskMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: coordinator.agent_id, framework: coordinator.framework },
            recipient: { agent_id: selectedAgent.agent_id, framework: selectedAgent.framework },
            payload: {
              task_type: 'resource_aware_task',
              priority: task.priority,
              resource_intensive: task.resource_intensive
            },
            metadata: {
              resource_aware_routing: true,
              selected_agent_resources: agentResources.get(selectedAgent.agent_id)
            }
          });

          await testRunner.sendMessage(env, taskMessage);
        }

        // Verify resource-aware routing
        const routedTasks = env.messageTracker.getMessagesByType('task_request');
        expect(routedTasks).toHaveLength(3);

        const resourceAwareRouting = routedTasks.map(msg => msg.metadata?.resource_aware_routing);
        expect(resourceAwareRouting.every(routing => routing === true)).toBe(true);
      } finally {
        await testRunner.cleanupEnvironment('resource_constraints_test');
      }
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts between multiple agents', async () => {
      const env = await testRunner.createEnvironment('conflict_resolution_test');
      
      try {
        const mediator = await testRunner.registerAgent(env, 'claude-code');
        const conflictingAgents = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        await testRunner.connectAgent(env, mediator.agent_id);
        for (const agent of conflictingAgents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        const session = await testRunner.createSession(env, mediator, conflictingAgents);

        // Create conflicting opinions
        const conflictScenario = {
          topic: 'architecture_approach',
          options: [
            { agent: conflictingAgents[0].agent_id, approach: 'microservices', reasoning: 'scalability' },
            { agent: conflictingAgents[1].agent_id, approach: 'monolith', reasoning: 'simplicity' }
          ]
        };

        // Agents submit conflicting proposals
        for (const option of conflictScenario.options) {
          const proposalMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: option.agent, framework: 'opencode' },
            recipient: { agent_id: mediator.agent_id, framework: mediator.framework },
            payload: {
              task_type: 'conflict_proposal',
              topic: conflictScenario.topic,
              approach: option.approach,
              reasoning: option.reasoning
            },
            metadata: { 
              session_id: session.sessionId,
              conflict_type: 'approach_disagreement'
            }
          });

          await testRunner.sendMessage(env, proposalMessage);
        }

        // Mediator facilitates resolution
        const resolutionMessage = MockDataGenerator.createTaskResponseMessage({
          sender: { agent_id: mediator.agent_id, framework: mediator.framework },
          recipient: { agent_id: 'communication-bus', framework: 'system' },
          payload: {
            task_type: 'conflict_resolution',
            topic: conflictScenario.topic,
            resolution: 'hybrid_approach',
            reasoning: 'combine benefits of both approaches',
            selected_approach: 'modular_monolith'
          },
          metadata: { 
            session_id: session.sessionId,
            conflict_resolved: true,
            resolution_strategy: 'compromise'
          }
        });

        await testRunner.sendMessage(env, resolutionMessage);

        // Verify conflict resolution process
        const proposals = env.messageTracker.getMessagesByType('task_request');
        const resolutions = env.messageTracker.getMessagesByType('task_response');

        expect(proposals).toHaveLength(2);
        expect(resolutions).toHaveLength(1);

        const conflictTypes = proposals.map(msg => msg.metadata?.conflict_type);
        expect(conflictTypes.every(type => type === 'approach_disagreement')).toBe(true);

        expect(resolutions[0].metadata?.conflict_resolved).toBe(true);
        expect(resolutions[0].payload.resolution).toBe('hybrid_approach');
      } finally {
        await testRunner.cleanupEnvironment('conflict_resolution_test');
      }
    });

    it('should handle priority-based conflict resolution', async () => {
      const env = await testRunner.createEnvironment('priority_conflict_test');
      
      try {
        const coordinator = await testRunner.registerAgent(env, 'claude-code');
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        await testRunner.connectAgent(env, coordinator.agent_id);
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Create priority conflict
        const priorityConflict = {
          task: 'security_implementation',
          conflicting_priorities: [
            { agent: agents[0].agent_id, priority: 'security', approach: 'max_security' },
            { agent: agents[1].agent_id, priority: 'performance', approach: 'balance_security' }
          ]
        };

        // Submit conflicting priorities
        for (const conflict of priorityConflict.conflicting_priorities) {
          const priorityMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: conflict.agent, framework: 'opencode' },
            recipient: { agent_id: coordinator.agent_id, framework: coordinator.framework },
            payload: {
              task_type: 'priority_conflict',
              task: priorityConflict.task,
              priority: conflict.priority,
              approach: conflict.approach
            },
            metadata: { 
              conflict_type: 'priority_conflict',
              priority_value: conflict.priority === 'security' ? 10 : 7
            }
          });

          await testRunner.sendMessage(env, priorityMessage);
        }

        // Coordinator resolves based on priority hierarchy
        const resolutionMessage = MockDataGenerator.createTaskResponseMessage({
          sender: { agent_id: coordinator.agent_id, framework: coordinator.framework },
          recipient: { agent_id: 'communication-bus', framework: 'system' },
          payload: {
            task_type: 'priority_resolution',
            task: priorityConflict.task,
            selected_priority: 'security',
            selected_approach: 'max_security',
            reasoning: 'security takes precedence over performance'
          },
          metadata: { 
            resolution_strategy: 'priority_hierarchy',
            winning_priority: 'security'
          }
        });

        await testRunner.sendMessage(env, resolutionMessage);

        // Verify priority-based resolution
        const conflicts = env.messageTracker.getMessagesByType('task_request');
        const resolutions = env.messageTracker.getMessagesByType('task_response');

        expect(conflicts).toHaveLength(2);
        expect(resolutions).toHaveLength(1);

        expect(resolutions[0].payload.selected_priority).toBe('security');
        expect(resolutions[0].metadata?.resolution_strategy).toBe('priority_hierarchy');
      } finally {
        await testRunner.cleanupEnvironment('priority_conflict_test');
      }
    });
  });

  describe('Adaptive Orchestration', () => {
    it('should adapt orchestration based on agent performance', async () => {
      const env = await testRunner.createEnvironment('adaptive_orchestration_test');
      
      try {
        const adaptiveCoordinator = await testRunner.registerAgent(env, 'claude-code');
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli'),
          testRunner.registerAgent(env, 'opencode')
        ]);

        await testRunner.connectAgent(env, adaptiveCoordinator.agent_id);
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Simulate agent performance tracking
        const agentPerformance = new Map([
          [agents[0].agent_id, { success_rate: 0.95, avg_response_time: 100 }],
          [agents[1].agent_id, { success_rate: 0.85, avg_response_time: 200 }],
          [agents[2].agent_id, { success_rate: 0.90, avg_response_time: 150 }]
        ]);

        // Adaptive task assignment based on performance
        const adaptiveTasks = [
          { type: 'critical_task', requires_high_reliability: true },
          { type: 'time_sensitive_task', requires_fast_response: true },
          { type: 'standard_task', requires_balanced_performance: true }
        ];

        for (const task of adaptiveTasks) {
          // Select agent based on task requirements and performance
          let selectedAgent = agents[0]; // Default
          
          if (task.requires_high_reliability) {
            selectedAgent = agents.reduce((best, current) => 
              agentPerformance.get(current.agent_id)!.success_rate > agentPerformance.get(best.agent_id)!.success_rate 
                ? current : best
            );
          } else if (task.requires_fast_response) {
            selectedAgent = agents.reduce((best, current) => 
              agentPerformance.get(current.agent_id)!.avg_response_time < agentPerformance.get(best.agent_id)!.avg_response_time 
                ? current : best
            );
          }

          const adaptiveMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: adaptiveCoordinator.agent_id, framework: adaptiveCoordinator.framework },
            recipient: { agent_id: selectedAgent.agent_id, framework: selectedAgent.framework },
            payload: {
              task_type: task.type,
              adaptive_selection: true
            },
            metadata: {
              adaptive_orchestration: true,
              selection_criteria: task.requires_high_reliability ? 'reliability' : 
                                 task.requires_fast_response ? 'speed' : 'balanced',
              agent_performance: agentPerformance.get(selectedAgent.agent_id)
            }
          });

          await testRunner.sendMessage(env, adaptiveMessage);
        }

        // Verify adaptive selection
        const adaptiveTasks_sent = env.messageTracker.getMessagesByType('task_request');
        expect(adaptiveTasks_sent).toHaveLength(3);

        const adaptiveSelections = adaptiveTasks_sent.map(msg => msg.metadata?.adaptive_orchestration);
        expect(adaptiveSelections.every(selection => selection === true)).toBe(true);

        const selectionCriteria = adaptiveTasks_sent.map(msg => msg.metadata?.selection_criteria);
        expect(selectionCriteria).toContain('reliability');
        expect(selectionCriteria).toContain('speed');
        expect(selectionCriteria).toContain('balanced');
      } finally {
        await testRunner.cleanupEnvironment('adaptive_orchestration_test');
      }
    });
  });
});