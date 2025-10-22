import { SessionManager } from '../../src/session-manager';
import { MockDataGenerator } from '../utils/mock-generators';
import { setupTestDatabase, teardownTestDatabase } from '../utils/test-database';
import { AgentParticipant } from '../../src/types/protocol';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let config: any;

  beforeEach(() => {
    setupTestDatabase();
    MockDataGenerator.reset();
    
    config = {
      timeout: 3600000, // 1 hour
      maxParticipants: 10,
      autoCleanup: true,
      persistenceEnabled: false
    };

    sessionManager = new SessionManager(config);
  });

  afterEach(() => {
    teardownTestDatabase();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(sessionManager).toBeDefined();
      expect(sessionManager.getActiveSessions()).toHaveLength(0);
    });

    it('should use default configuration when none provided', () => {
      const defaultManager = new SessionManager();
      expect(defaultManager).toBeDefined();
    });
  });

  describe('Session Creation', () => {
    it('should create a new session successfully', () => {
      const orchestrator = 'claude://test-agent';
      const participants = [MockDataGenerator.createAgentParticipant()];
      const workflow = MockDataGenerator.createWorkflowState().steps || [];
      
      const sessionId = sessionManager.createSession(orchestrator, participants, workflow);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^sess_\d+_[a-f0-9]{8}$/);
      
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.orchestrator).toBe(orchestrator);
      expect(session!.participants).toHaveLength(2); // orchestrator + 1 participant
    });

    it('should emit session_created event', () => {
      const orchestrator = 'claude://test-agent';
      const eventSpy = jest.fn();
      
      sessionManager.on('session_created', eventSpy);
      sessionManager.createSession(orchestrator);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          session: expect.any(Object)
        })
      );
    });

    it('should create session with minimal parameters', () => {
      const orchestrator = 'opencode://minimal-agent';
      
      sessionManager.createSession(orchestrator);
      const session = sessionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session!.orchestrator).toBe(orchestrator);
      expect(session!.participants).toHaveLength(1); // only orchestrator
      expect(session!.workflow.current_step).toBe('initialization');
    });
  });

  describe('Session Retrieval', () => {
    let testSessionId: string;

    beforeEach(() => {
      const orchestrator = 'claude://test-agent';
      const participants = [MockDataGenerator.createAgentParticipant()];
      testSessionId = sessionManager.createSession(orchestrator, participants);
    });

    it('should retrieve existing session by ID', () => {
      const retrieved = sessionManager.getSession(testSessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(testSession.sessionId);
    });

    it('should return null for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent-session');
      expect(retrieved).toBeNull();
    });

    it('should return all active sessions', () => {
      const orchestrator2 = 'opencode://second-agent';
      sessionManager.createSession(orchestrator2);

      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
    });
  });

  describe('Participant Management', () => {
    let testSessionId: string;
    let newParticipant: AgentParticipant;

    beforeEach(() => {
      const orchestrator = 'claude://test-agent';
      testSessionId = sessionManager.createSession(orchestrator);
      
      newParticipant = MockDataGenerator.createAgentParticipant({
        agent_id: 'new-participant',
        role: 'tester'
      });
    });

    it('should add participant to existing session', () => {
      const result = sessionManager.addParticipant(testSessionId, newParticipant);
      expect(result).toBe(true);

      const updatedSession = sessionManager.getSession(testSessionId);
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.participants).toHaveLength(2); // orchestrator + 1 participant
      expect(updatedSession!.participants.some(p => p.agent_id === 'new-participant'))
        .toBe(true);
    });

    it('should emit participant_added event', () => {
      const eventSpy = jest.fn();
      
      sessionManager.on('participant_added', eventSpy);
      sessionManager.addParticipant(testSessionId, newParticipant);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: testSession.sessionId,
          participant: newParticipant
        })
      );
    });

    it('should remove participant from session', () => {
      const session = sessionManager.getSession(testSessionId);
      const participantToRemove = session!.participants[0];
      
      const result = sessionManager.removeParticipant(testSessionId, participantToRemove.agent_id);
      expect(result).toBe(true);

      const updatedSession = sessionManager.getSession(testSessionId);
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.participants.some(p => p.agent_id === participantToRemove.agent_id && p.status === 'left'))
        .toBe(true);
    });

    it('should emit participant_removed event', () => {
      const session = sessionManager.getSession(testSessionId);
      const participantToRemove = session!.participants[0];
      const eventSpy = jest.fn();
      
      sessionManager.on('participant_removed', eventSpy);
      sessionManager.removeParticipant(testSessionId, participantToRemove.agent_id);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: testSessionId,
          agentId: participantToRemove.agent_id
        })
      );
    });

    it('should handle participant removal for non-existent participant', () => {
      const result = sessionManager.removeParticipant(testSessionId, 'non-existent-participant');
      expect(result).toBe(false);
    });
  });

  describe('Workflow Management', () => {
    let testSessionId: string;

    beforeEach(() => {
      const orchestrator = 'claude://test-agent';
      const workflow = MockDataGenerator.createWorkflowState().steps || [];
      testSessionId = sessionManager.createSession(orchestrator, [], workflow);
    });

    it('should advance workflow step', () => {
      const session = sessionManager.getSession(testSessionId);
      const initialStep = session!.workflow.current_step;

      const result = sessionManager.advanceWorkflow(testSessionId);
      expect(result).toBe(true);

      const updatedSession = sessionManager.getSession(testSessionId);
      expect(updatedSession!.workflow.completed_steps).toContain(initialStep);
      expect(updatedSession!.workflow.current_step).not.toBe(initialStep);
    });

    it('should emit workflow_advanced event', () => {
      const eventSpy = jest.fn();
      
      sessionManager.on('workflow_advanced', eventSpy);
      sessionManager.advanceWorkflow(testSessionId);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: testSessionId,
          currentStep: expect.any(String)
        })
      );
    });

    it('should advance to specific step', () => {
      const workflow = MockDataGenerator.createWorkflowState().steps || [];
      const targetStep = workflow[1]?.name || 'custom_step';

      const result = sessionManager.advanceWorkflow(testSessionId, targetStep);
      expect(result).toBe(true);

      const updatedSession = sessionManager.getSession(testSessionId);
      expect(updatedSession!.workflow.current_step).toBe(targetStep);
    });
  });

  describe('Task Delegation', () => {
    let testSessionId: string;
    let orchestrator: string;
    let participant: AgentParticipant;

    beforeEach(() => {
      orchestrator = 'claude://orchestrator';
      participant = MockDataGenerator.createAgentParticipant({ agent_id: 'opencode://participant' });
      testSessionId = sessionManager.createSession(orchestrator, [participant]);
    });

    it('should delegate task to participant', () => {
      const taskId = sessionManager.delegateTask(
        orchestrator,
        participant.agent_id,
        'code_review',
        { files: ['test.ts'] },
        { priority: 'high', sessionId: testSessionId, timeout: 3600000 }
      );

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(taskId).toMatch(/^task_\d+_[a-f0-9]{8}$/);
    });

    it('should emit task_delegated event', () => {
      const eventSpy = jest.fn();
      
      sessionManager.on('task_delegated', eventSpy);
      sessionManager.delegateTask(
        orchestrator,
        participant.agent_id,
        'code_review',
        { files: ['test.ts'] }
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: expect.any(String),
          delegation: expect.objectContaining({
            taskType: 'code_review'
          })
        })
      );
    });

    it('should update task status', () => {
      const taskId = sessionManager.delegateTask(
        orchestrator,
        participant.agent_id,
        'code_review',
        { files: ['test.ts'] }
      );

      const updated = sessionManager.updateTaskStatus(
        taskId,
        'completed',
        { result: 'Review completed successfully' }
      );

      expect(updated).toBe(true);
    });

    it('should emit task_updated event', () => {
      const taskId = sessionManager.delegateTask(
        orchestrator,
        participant.agent_id,
        'code_review',
        { files: ['test.ts'] }
      );

      const eventSpy = jest.fn();
      
      sessionManager.on('task_updated', eventSpy);
      sessionManager.updateTaskStatus(taskId, 'completed', { result: 'Done' });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          status: 'completed',
          result: { result: 'Done' }
        })
      );
    });
  });

  describe('Session Termination', () => {
    let testSessionId: string;

    beforeEach(() => {
      const orchestrator = 'claude://test-agent';
      testSessionId = sessionManager.createSession(orchestrator);
    });

    it('should terminate session successfully', () => {
      const terminated = sessionManager.terminateSession(
        testSessionId,
        'workflow_completed'
      );

      expect(terminated).toBe(true);
      
      const session = sessionManager.getSession(testSessionId);
      expect(session!.terminated_at).toBeDefined();
      expect(session!.termination_reason).toBe('workflow_completed');
    });

    it('should emit session_terminated event', () => {
      const eventSpy = jest.fn();
      
      sessionManager.on('session_terminated', eventSpy);
      sessionManager.terminateSession(testSessionId, 'test_reason');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: testSessionId,
          reason: 'test_reason'
        })
      );
    });

    it('should return false for non-existent session termination', () => {
      const result = sessionManager.terminateSession('non-existent', 'test');
      expect(result).toBe(false);
    });
  });

  describe('Session Cleanup', () => {
    it('should handle automatic cleanup setup', () => {
      const managerWithCleanup = new SessionManager({ autoCleanup: true, timeout: 1000 });
      expect(managerWithCleanup).toBeDefined();
    });

    it('should not auto cleanup when disabled', () => {
      const managerWithoutCleanup = new SessionManager({ autoCleanup: false });
      expect(managerWithoutCleanup).toBeDefined();
    });
  });

  describe('Workflow Progress', () => {
    let testSessionId: string;

    beforeEach(() => {
      const workflow = MockDataGenerator.createWorkflowState().steps || [];
      testSessionId = sessionManager.createSession('claude://test-agent', [], workflow);
    });

    it('should get workflow progress', () => {
      const progress = sessionManager.getWorkflowProgress(testSessionId);
      
      expect(progress).toBeDefined();
      expect(progress!.current).toBe('initialization');
      expect(progress!.completed).toEqual([]);
      expect(progress!.pending).toHaveLength(workflow.length);
      expect(progress!.progress).toBe(0);
    });

    it('should return null for non-existent session progress', () => {
      const progress = sessionManager.getWorkflowProgress('non-existent');
      expect(progress).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session IDs gracefully', () => {
      const result = sessionManager.getSession('');
      expect(result).toBeNull();
    });

    it('should handle participant addition to non-existent session', () => {
      const participant = MockDataGenerator.createAgentParticipant();
      const result = sessionManager.addParticipant('non-existent', participant);
      expect(result).toBe(false);
    });

    it('should handle workflow advancement for non-existent session', () => {
      const result = sessionManager.advanceWorkflow('non-existent');
      expect(result).toBe(false);
    });

    it('should handle task delegation properly', () => {
      const taskId = sessionManager.delegateTask(
        'non-existent-orchestrator',
        'non-existent-participant',
        'test_task',
        {}
      );
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should handle max participants constraint', () => {
      const smallConfig = { maxParticipants: 2 };
      const smallManager = new SessionManager(smallConfig);
      const sessionId = smallManager.createSession('claude://orchestrator');
      
      // Add max participants
      smallManager.addParticipant(sessionId, MockDataGenerator.createAgentParticipant({ agent_id: 'agent1' }));
      
      // Should throw when trying to add more
      expect(() => {
        smallManager.addParticipant(sessionId, MockDataGenerator.createAgentParticipant({ agent_id: 'agent2' }));
        smallManager.addParticipant(sessionId, MockDataGenerator.createAgentParticipant({ agent_id: 'agent3' }));
      }).toThrow('Maximum participants');
    });
  });

  describe('Task Management', () => {
    let testSessionId: string;

    beforeEach(() => {
      testSessionId = sessionManager.createSession('claude://test-agent');
    });

    it('should get task delegation', () => {
      const taskId = sessionManager.delegateTask(
        'claude://delegator',
        'opencode://delegatee',
        'test_task',
        {}
      );

      const delegation = sessionManager.getTaskDelegation(taskId);
      expect(delegation).toBeDefined();
      expect(delegation!.taskId).toBe(taskId);
      expect(delegation!.taskType).toBe('test_task');
    });

    it('should get tasks for agent', () => {
      sessionManager.delegateTask('agent1', 'target-agent', 'task1', {});
      sessionManager.delegateTask('agent2', 'target-agent', 'task2', {});
      sessionManager.delegateTask('agent3', 'other-agent', 'task3', {});

      const tasksForTarget = sessionManager.getTasksForAgent('target-agent');
      expect(tasksForTarget).toHaveLength(2);
    });

    it('should return null for non-existent task delegation', () => {
      const delegation = sessionManager.getTaskDelegation('non-existent-task');
      expect(delegation).toBeNull();
    });
  });
});
  });

  describe('Event Emission', () => {
    it('should emit events for all major operations', async () => {
      const eventSpy = jest.fn();
      const events = [
        'session_created',
        'participant_added',
        'participant_removed',
        'workflow_updated',
        'task_delegated',
        'task_status_updated',
        'session_terminated'
      ];

      events.forEach(event => {
        sessionManager.on(event, eventSpy);
      });

      // Create session
      const sessionData = MockDataGenerator.createSessionContext();
      const session = await sessionManager.createSession(sessionData);

      // Add participant
      const participant = MockDataGenerator.createAgentParticipant();
      await sessionManager.addParticipant(session.sessionId, participant);

      // Update workflow
      const workflow = MockDataGenerator.createWorkflowState();
      await sessionManager.updateWorkflow(session.sessionId, workflow);

      // Delegate task
      await sessionManager.delegateTask(
        session.orchestrator,
        participant.agent_id,
        'test_task',
        {}
      );

      // Update task status
      await sessionManager.updateTaskStatus('task-1', 'completed', {});

      // Terminate session
      await sessionManager.terminateSession(session.sessionId, 'test');

      expect(eventSpy).toHaveBeenCalledTimes(events.length);
    });
  });
});