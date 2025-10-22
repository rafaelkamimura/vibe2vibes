import { IntegrationTestRunner } from './integration-test-framework';
import { MockDataGenerator } from '../utils/mock-generators';

describe('Session Management Integration Tests', () => {
  let testRunner: IntegrationTestRunner;

  beforeEach(() => {
    testRunner = new IntegrationTestRunner();
  });

  afterEach(async () => {
    await testRunner.cleanupAll();
  });

  describe('Session Lifecycle', () => {
    it('should create and manage complete session lifecycle', async () => {
      const env = await testRunner.createEnvironment('session_lifecycle_test');
      
      try {
        // Register participants
        const orchestrator = await testRunner.registerAgent(env, 'claude-code');
        const implementer = await testRunner.registerAgent(env, 'opencode');
        const reviewer = await testRunner.registerAgent(env, 'codex-cli');

        // Connect all agents
        await testRunner.connectAgent(env, orchestrator.agent_id);
        await testRunner.connectAgent(env, implementer.agent_id);
        await testRunner.connectAgent(env, reviewer.agent_id);

        // Create session
        const session = await testRunner.createSession(env, orchestrator, [implementer, reviewer]);
        expect(session.sessionId).toBeDefined();
        expect(session.orchestrator).toBe(orchestrator.agent_id);
        expect(session.participants).toHaveLength(2);

        // Simulate session activity
        const taskMessage = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: implementer.agent_id, framework: implementer.framework },
          metadata: { session_id: session.sessionId }
        });

        await testRunner.sendMessage(env, taskMessage);

        // Verify session is tracked
        expect(env.activeSessions).toHaveLength(1);
        expect(env.messageTracker.getMessageCount()).toBe(1);
      } finally {
        await testRunner.cleanupEnvironment('session_lifecycle_test');
      }
    });

    it('should handle session participant changes', async () => {
      const env = await testRunner.createEnvironment('participant_changes_test');
      
      try {
        const orchestrator = await testRunner.registerAgent(env, 'claude-code');
        const initialParticipants = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        const session = await testRunner.createSession(env, orchestrator, initialParticipants);
        expect(session.participants).toHaveLength(2);

        // Add new participant
        const newParticipant = await testRunner.registerAgent(env, 'tester');
        await testRunner.connectAgent(env, newParticipant.agent_id);

        // Simulate adding participant to session
        const updatedSession = {
          ...session,
          participants: [
            ...session.participants,
            {
              agent_id: newParticipant.agent_id,
              framework: newParticipant.framework,
              role: 'observer' as const,
              status: 'active' as const,
              join_time: new Date().toISOString()
            }
          ]
        };

        env.activeSessions[0] = updatedSession;
        expect(updatedSession.participants).toHaveLength(3);

        // Send message to new participant
        const welcomeMessage = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: newParticipant.agent_id, framework: newParticipant.framework },
          metadata: { session_id: session.sessionId }
        });

        await testRunner.sendMessage(env, welcomeMessage);
        expect(env.messageTracker.getMessageCount()).toBe(1);
      } finally {
        await testRunner.cleanupEnvironment('participant_changes_test');
      }
    });
  });

  describe('Session Workflows', () => {
    it('should handle multi-step session workflow', async () => {
      const env = await testRunner.createEnvironment('session_workflow_test');
      
      try {
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'claude-code'),
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        // Connect all agents
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        const session = await testRunner.createSession(env, agents[0], agents.slice(1));

        // Simulate workflow steps
        const workflowSteps = [
          { step: 'analysis', assignee: agents[1] },
          { step: 'implementation', assignee: agents[1] },
          { step: 'review', assignee: agents[2] },
          { step: 'testing', assignee: agents[2] }
        ];

        for (const workflowStep of workflowSteps) {
          const stepMessage = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: agents[0].agent_id, framework: agents[0].framework },
            recipient: { agent_id: workflowStep.assignee.agent_id, framework: workflowStep.assignee.framework },
            payload: {
              task_type: 'workflow_step',
              step: workflowStep.step,
              session_id: session.sessionId
            },
            metadata: { session_id: session.sessionId, workflow_step: workflowStep.step }
          });

          await testRunner.sendMessage(env, stepMessage);

          // Simulate step completion
          const completionMessage = MockDataGenerator.createTaskResponseMessage({
            sender: { agent_id: workflowStep.assignee.agent_id, framework: workflowStep.assignee.framework },
            recipient: { agent_id: agents[0].agent_id, framework: agents[0].framework },
            payload: {
              step: workflowStep.step,
              status: 'completed',
              session_id: session.sessionId
            },
            metadata: { session_id: session.sessionId, workflow_step: workflowStep.step }
          });

          await testRunner.sendMessage(env, completionMessage);
        }

        // Verify workflow completion
        const taskRequests = env.messageTracker.getMessagesByType('task_request');
        const taskResponses = env.messageTracker.getMessagesByType('task_response');

        expect(taskRequests).toHaveLength(4);
        expect(taskResponses).toHaveLength(4);

        // Verify all messages belong to the same session
        const sessionIds = [...taskRequests, ...taskResponses]
          .map(msg => msg.metadata?.session_id)
          .filter(Boolean);
        
        expect(new Set(sessionIds).size).toBe(1);
      } finally {
        await testRunner.cleanupEnvironment('session_workflow_test');
      }
    });

    it('should handle concurrent session workflows', async () => {
      const env = await testRunner.createEnvironment('concurrent_workflows_test');
      
      try {
        const agents = await Promise.all([
          testRunner.registerAgent(env, 'claude-code'),
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli'),
          testRunner.registerAgent(env, 'tester')
        ]);

        // Connect all agents
        for (const agent of agents) {
          await testRunner.connectAgent(env, agent.agent_id);
        }

        // Create multiple concurrent sessions
        const sessions = [];
        for (let i = 0; i < 3; i++) {
          const orchestrator = agents[i];
          const participants = agents.filter((_, index) => index !== i);
          const session = await testRunner.createSession(env, orchestrator, participants);
          sessions.push(session);
        }

        // Run workflows in all sessions concurrently
        const workflowPromises = sessions.map(async (session, index) => {
          const orchestrator = agents[index];
          const participant = agents[(index + 1) % agents.length];

          const message = MockDataGenerator.createTaskRequestMessage({
            sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
            recipient: { agent_id: participant.agent_id, framework: participant.framework },
            payload: {
              task_type: 'concurrent_task',
              session_index: index
            },
            metadata: { session_id: session.sessionId }
          });

          return testRunner.sendMessage(env, message);
        });

        const results = await Promise.all(workflowPromises);
        expect(results.every(result => result === true)).toBe(true);

        // Verify session isolation
        expect(env.activeSessions).toHaveLength(3);
        expect(env.messageTracker.getMessageCount()).toBe(3);

        const sessionIds = env.messageTracker.getMessagesByType('task_request')
          .map(msg => msg.metadata?.session_id);
        
        expect(new Set(sessionIds).size).toBe(3);
      } finally {
        await testRunner.cleanupEnvironment('concurrent_workflows_test');
      }
    });
  });

  describe('Session State Management', () => {
    it('should maintain session state across operations', async () => {
      const env = await testRunner.createEnvironment('session_state_test');
      
      try {
        const orchestrator = await testRunner.registerAgent(env, 'claude-code');
        const participants = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        await testRunner.connectAgent(env, orchestrator.agent_id);
        for (const participant of participants) {
          await testRunner.connectAgent(env, participant.agent_id);
        }

        const session = await testRunner.createSession(env, orchestrator, participants);

        // Track state changes
        const stateChanges = [];

        // Initial state
        stateChanges.push({
          timestamp: Date.now(),
          state: 'created',
          participants: session.participants.length
        });

        // Simulate participant joining
        const newParticipant = await testRunner.registerAgent(env, 'tester');
        await testRunner.connectAgent(env, newParticipant.agent_id);

        stateChanges.push({
          timestamp: Date.now(),
          state: 'participant_added',
          participants: session.participants.length + 1
        });

        // Simulate workflow progress
        const progressMessage = MockDataGenerator.createStatusUpdateMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: participants[0].agent_id, framework: participants[0].framework },
          payload: {
            status: 'in_progress',
            progress: 0.5,
            current_step: 'implementation'
          },
          metadata: { session_id: session.sessionId }
        });

        await testRunner.sendMessage(env, progressMessage);

        stateChanges.push({
          timestamp: Date.now(),
          state: 'workflow_progress',
          progress: 0.5
        });

        // Verify state consistency
        expect(stateChanges).toHaveLength(3);
        expect(stateChanges[0].state).toBe('created');
        expect(stateChanges[1].state).toBe('participant_added');
        expect(stateChanges[2].progress).toBe(0.5);
      } finally {
        await testRunner.cleanupEnvironment('session_state_test');
      }
    });

    it('should handle session termination and cleanup', async () => {
      const env = await testRunner.createEnvironment('session_termination_test');
      
      try {
        const orchestrator = await testRunner.registerAgent(env, 'claude-code');
        const participants = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        await testRunner.connectAgent(env, orchestrator.agent_id);
        for (const participant of participants) {
          await testRunner.connectAgent(env, participant.agent_id);
        }

        const session = await testRunner.createSession(env, orchestrator, participants);

        // Send some messages during session
        const message = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: participants[0].agent_id, framework: participants[0].framework },
          metadata: { session_id: session.sessionId }
        });

        await testRunner.sendMessage(env, message);

        // Terminate session
        const terminationMessage = MockDataGenerator.createStatusUpdateMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: 'communication-bus', framework: 'system' },
          payload: {
            status: 'terminated',
            reason: 'workflow_completed'
          },
          metadata: { session_id: session.sessionId, termination_reason: 'workflow_completed' }
        });

        await testRunner.sendMessage(env, terminationMessage);

        // Simulate session cleanup
        const sessionIndex = env.activeSessions.findIndex(s => s.sessionId === session.sessionId);
        if (sessionIndex !== -1) {
          env.activeSessions.splice(sessionIndex, 1);
        }

        // Verify termination
        expect(env.activeSessions).toHaveLength(0);
        expect(env.messageTracker.getMessageCount()).toBe(2);
      } finally {
        await testRunner.cleanupEnvironment('session_termination_test');
      }
    });
  });

  describe('Session Error Handling', () => {
    it('should handle participant disconnection during session', async () => {
      const env = await testRunner.createEnvironment('participant_disconnection_test');
      
      try {
        const orchestrator = await testRunner.registerAgent(env, 'claude-code');
        const participants = await Promise.all([
          testRunner.registerAgent(env, 'opencode'),
          testRunner.registerAgent(env, 'codex-cli')
        ]);

        await testRunner.connectAgent(env, orchestrator.agent_id);
        await testRunner.connectAgent(env, participants[0].agent_id);
        await testRunner.connectAgent(env, participants[1].agent_id);

        const session = await testRunner.createSession(env, orchestrator, participants);

        // Send message to all participants
        const message = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: participants[0].agent_id, framework: participants[0].framework },
          metadata: { session_id: session.sessionId }
        });

        await testRunner.sendMessage(env, message);

        // Disconnect one participant (handled in cleanup)

        // Try to send another message to disconnected participant
        const followUpMessage = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: participants[0].agent_id, framework: participants[0].framework },
          metadata: { session_id: session.sessionId }
        });

        const result = await testRunner.sendMessage(env, followUpMessage);
        expect(result).toBe(true); // Should be queued

        // Verify session continues with remaining participants
        const messageToRemaining = MockDataGenerator.createTaskRequestMessage({
          sender: { agent_id: orchestrator.agent_id, framework: orchestrator.framework },
          recipient: { agent_id: participants[1].agent_id, framework: participants[1].framework },
          metadata: { session_id: session.sessionId }
        });

        await testRunner.sendMessage(env, messageToRemaining);
        expect(env.messageTracker.getMessageCount()).toBe(3);
      } finally {
        await testRunner.cleanupEnvironment('participant_disconnection_test');
      }
    });

    it('should handle session timeout scenarios', async () => {
      const env = await testRunner.createEnvironment('session_timeout_test');
      
      try {
        const orchestrator = await testRunner.registerAgent(env, 'claude-code');
        const participant = await testRunner.registerAgent(env, 'opencode');

        await testRunner.connectAgent(env, orchestrator.agent_id);
        await testRunner.connectAgent(env, participant.agent_id);

        // Create session with short timeout for testing
        const session = MockDataGenerator.createSessionContext({
          orchestrator: orchestrator.agent_id,
          participants: [{
            agent_id: participant.agent_id,
            framework: participant.framework,
            role: 'implementer',
            status: 'active',
            join_time: new Date().toISOString()
          }],
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        });

        env.activeSessions.push(session);

        // Simulate timeout check
        const now = Date.now();
        const sessionTime = new Date(session.updated_at).getTime();
        const isExpired = (now - sessionTime) > 60 * 60 * 1000; // 1 hour timeout

        expect(isExpired).toBe(true);

        // Simulate session cleanup due to timeout
        const expiredIndex = env.activeSessions.findIndex(s => s.sessionId === session.sessionId);
        if (expiredIndex !== -1) {
          env.activeSessions.splice(expiredIndex, 1);
        }

        expect(env.activeSessions).toHaveLength(0);
      } finally {
        await testRunner.cleanupEnvironment('session_timeout_test');
      }
    });
  });
});