import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, SessionContext, AgentParticipant, WorkflowStep } from '../types/protocol';

export interface SessionConfig {
  timeout?: number;
  maxParticipants?: number;
  autoCleanup?: boolean;
  persistenceEnabled?: boolean;
}

export interface TaskDelegation {
  taskId: string;
  sessionId: string;
  delegator: string;
  delegatee: string;
  taskType: string;
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  createdAt: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'timeout';
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionContext> = new Map();
  private taskDelegations: Map<string, TaskDelegation> = new Map();
  private config: SessionConfig;

  constructor(config: SessionConfig = {}) {
    super();
    this.config = {
      timeout: 3600000, // 1 hour default
      maxParticipants: 10,
      autoCleanup: true,
      persistenceEnabled: false,
      ...config
    };

    // Setup cleanup interval
    if (this.config.autoCleanup) {
      setInterval(() => this.cleanupExpiredSessions(), 300000); // 5 minutes
    }
  }

  /**
   * Create a new session with initial participants
   */
  createSession(
    orchestrator: string,
    participants: AgentParticipant[] = [],
    workflow: WorkflowStep[] = []
  ): string {
    const sessionId = `sess_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    const session: SessionContext = {
      sessionId,
      orchestrator,
      participants: [
        {
          agent_id: orchestrator,
          framework: this.extractFramework(orchestrator),
          role: 'orchestrator',
          status: 'active',
          join_time: new Date().toISOString()
        },
        ...participants
      ],
      workflow: {
        current_step: workflow[0]?.name || 'initialization',
        completed_steps: [],
        pending_steps: workflow.map(step => step.name),
        steps: workflow
      },
      shared_context: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);
    this.emit('session_created', { sessionId, session });
    
    return sessionId;
  }

  /**
   * Add participant to existing session
   */
  addParticipant(sessionId: string, participant: AgentParticipant): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.participants.length >= this.config.maxParticipants!) {
      throw new Error(`Maximum participants (${this.config.maxParticipants}) reached`);
    }

    participant.join_time = new Date().toISOString();
    participant.status = 'active';
    
    session.participants.push(participant);
    session.updated_at = new Date().toISOString();
    
    this.sessions.set(sessionId, session);
    this.emit('participant_added', { sessionId, participant });
    
    return true;
  }

  /**
   * Remove participant from session
   */
  removeParticipant(sessionId: string, agentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const participantIndex = session.participants.findIndex(p => p.agent_id === agentId);
    if (participantIndex === -1) {
      return false;
    }

    const participant = session.participants[participantIndex];
    participant.status = 'left';
    participant.leave_time = new Date().toISOString();
    
    session.updated_at = new Date().toISOString();
    
    this.sessions.set(sessionId, session);
    this.emit('participant_removed', { sessionId, agentId, participant });
    
    return true;
  }

  /**
   * Delegate task from one agent to another
   */
  delegateTask(
    delegator: string,
    delegatee: string,
    taskType: string,
    payload: any,
    options: {
      priority?: TaskDelegation['priority'];
      timeout?: number;
      sessionId?: string;
    } = {}
  ): string {
    const taskId = `task_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    const delegation: TaskDelegation = {
      taskId,
      sessionId: options.sessionId || 'ad-hoc',
      delegator,
      delegatee,
      taskType,
      payload,
      priority: options.priority || 'medium',
      timeout: options.timeout || 300000, // 5 minutes default
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxDelay: 30000 // 30 seconds
      },
      createdAt: new Date(),
      status: 'pending'
    };

    this.taskDelegations.set(taskId, delegation);
    this.emit('task_delegated', { taskId, delegation });
    
    // Start task execution timeout
    this.startTaskTimeout(taskId, delegation.timeout);
    
    return taskId;
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskDelegation['status'], result?: any): boolean {
    const delegation = this.taskDelegations.get(taskId);
    if (!delegation) {
      return false;
    }

    delegation.status = status;
    if (result) {
      (delegation as any).result = result;
    }

    this.taskDelegations.set(taskId, delegation);
    this.emit('task_updated', { taskId, delegation, status, result });
    
    // Update session if applicable
    if (delegation.sessionId !== 'ad-hoc') {
      this.updateSessionProgress(delegation.sessionId, taskId, status);
    }
    
    return true;
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): SessionContext | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionContext[] {
    return Array.from(this.sessions.values())
      .filter(session => this.isSessionActive(session));
  }

  /**
   * Get task delegation information
   */
  getTaskDelegation(taskId: string): TaskDelegation | null {
    return this.taskDelegations.get(taskId) || null;
  }

  /**
   * Get tasks for a specific agent
   */
  getTasksForAgent(agentId: string): TaskDelegation[] {
    return Array.from(this.taskDelegations.values())
      .filter(task => task.delegatee === agentId && task.status === 'pending');
  }

  /**
   * Get session workflow progress
   */
  getWorkflowProgress(sessionId: string): {
    current: string;
    completed: string[];
    pending: string[];
    progress: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const { workflow } = session;
    const totalSteps = workflow.steps?.length || 1;
    const completedSteps = workflow.completed_steps.length;
    const progress = (completedSteps / totalSteps) * 100;

    return {
      current: workflow.current_step,
      completed: workflow.completed_steps,
      pending: workflow.pending_steps,
      progress
    };
  }

  /**
   * Advance workflow to next step
   */
  advanceWorkflow(sessionId: string, stepName?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.workflow.steps) {
      return false;
    }

    const currentStepIndex = session.workflow.steps.findIndex(
      step => step.name === session.workflow.current_step
    );
    
    if (currentStepIndex === -1) {
      return false;
    }

    // Mark current step as completed
    if (!session.workflow.completed_steps.includes(session.workflow.current_step)) {
      session.workflow.completed_steps.push(session.workflow.current_step);
    }

    // Remove from pending
    const pendingIndex = session.workflow.pending_steps.indexOf(session.workflow.current_step);
    if (pendingIndex > -1) {
      session.workflow.pending_steps.splice(pendingIndex, 1);
    }

    // Move to next step
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < session.workflow.steps.length) {
      session.workflow.current_step = stepName || session.workflow.steps[nextStepIndex].name;
    } else {
      session.workflow.current_step = 'completed';
    }

    session.updated_at = new Date().toISOString();
    this.sessions.set(sessionId, session);
    
    this.emit('workflow_advanced', { sessionId, currentStep: session.workflow.current_step });
    
    return true;
  }

  /**
   * Terminate session
   */
  terminateSession(sessionId: string, reason?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Mark all participants as left
    session.participants.forEach(participant => {
      participant.status = 'session_terminated';
      participant.leave_time = new Date().toISOString();
    });

    session.terminated_at = new Date().toISOString();
    session.termination_reason = reason || 'manual_termination';
    session.updated_at = new Date().toISOString();

    this.sessions.set(sessionId, session);
    this.emit('session_terminated', { sessionId, reason });
    
    return true;
  }

  /**
   * Private helper methods
   */
  private extractFramework(agentId: string): string {
    const match = agentId.match(/^(\w+):\/\//);
    return match ? match[1] : 'unknown';
  }

  private isSessionActive(session: SessionContext): boolean {
    if (session.terminated_at) {
      return false;
    }

    const sessionAge = Date.now() - new Date(session.created_at).getTime();
    return sessionAge < this.config.timeout!;
  }

  private startTaskTimeout(taskId: string, timeout: number): void {
    setTimeout(() => {
      const delegation = this.taskDelegations.get(taskId);
      if (delegation && delegation.status === 'pending') {
        this.updateTaskStatus(taskId, 'timeout');
      }
    }, timeout);
  }

  private updateSessionProgress(sessionId: string, taskId: string, status: TaskDelegation['status']): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Update session with task completion status
    if (!session.shared_context.task_progress) {
      session.shared_context.task_progress = {};
    }

    session.shared_context.task_progress[taskId] = {
      status,
      updated_at: new Date().toISOString()
    };

    session.updated_at = new Date().toISOString();
    this.sessions.set(sessionId, session);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - new Date(session.created_at).getTime();
      if (sessionAge > this.config.timeout!) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.terminateSession(sessionId, 'timeout');
    });

    if (expiredSessions.length > 0) {
      this.emit('sessions_cleaned', { count: expiredSessions.length, sessions: expiredSessions });
    }
  }
}