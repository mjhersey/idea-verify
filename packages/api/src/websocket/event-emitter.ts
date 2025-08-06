import { Server as SocketIOServer, Socket } from 'socket.io'
import { OrchestratorService } from '@ai-validation/orchestrator'
import { ProgressCalculator } from './progress-calculator.js'
import {
  WebSocketEvent,
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent,
} from '@ai-validation/shared'

export class EventEmitter {
  private io: SocketIOServer
  private orchestrator: OrchestratorService
  private progressCalculator: ProgressCalculator

  constructor(io: SocketIOServer) {
    this.io = io
    this.orchestrator = OrchestratorService.getInstance()
    this.progressCalculator = ProgressCalculator.getInstance()
  }

  // Emit agent progress update
  emitAgentProgress(evaluationId: string, event: AgentProgressEvent): void {
    // Update progress calculator
    this.progressCalculator.updateAgentProgress(
      evaluationId,
      event.agentType,
      event.status,
      event.progressPercentage
    )

    // Emit agent progress event
    this.io
      .of('/evaluation-progress')
      .to(`evaluation:${evaluationId}`)
      .emit('agent:progress', event)

    // Also emit updated evaluation status
    const progressSnapshot = this.progressCalculator.getEvaluationProgress(evaluationId)
    if (progressSnapshot) {
      const statusEvent: EvaluationStatusEvent = {
        evaluationId,
        overallProgress: progressSnapshot.overallProgress,
        activeAgents: progressSnapshot.activeAgents,
        completedAgents: progressSnapshot.completedAgents,
        failedAgents: progressSnapshot.failedAgents,
        estimatedCompletionTime: progressSnapshot.estimatedCompletionTime,
        timestamp: new Date(),
      }

      this.io
        .of('/evaluation-progress')
        .to(`evaluation:${evaluationId}`)
        .emit('evaluation:status', statusEvent)
    }
  }

  // Emit insight discovered
  emitInsightDiscovered(evaluationId: string, event: InsightDiscoveredEvent): void {
    this.io
      .of('/evaluation-progress')
      .to(`evaluation:${evaluationId}`)
      .emit('insight:discovered', event)
  }

  // Emit evaluation status update
  emitEvaluationStatus(evaluationId: string, event: EvaluationStatusEvent): void {
    this.io
      .of('/evaluation-progress')
      .to(`evaluation:${evaluationId}`)
      .emit('evaluation:status', event)
  }

  // Emit agent completed
  emitAgentCompleted(evaluationId: string, event: AgentCompletedEvent): void {
    this.io
      .of('/evaluation-progress')
      .to(`evaluation:${evaluationId}`)
      .emit('agent:completed', event)
  }

  // Emit error
  emitError(evaluationId: string, event: ErrorEvent): void {
    this.io
      .of('/evaluation-progress')
      .to(`evaluation:${evaluationId}`)
      .emit('evaluation:error', event)
  }

  // Emit evaluation completed
  emitEvaluationCompleted(evaluationId: string, event: EvaluationCompletedEvent): void {
    this.io
      .of('/evaluation-progress')
      .to(`evaluation:${evaluationId}`)
      .emit('evaluation:completed', event)
  }

  // Send current evaluation snapshot to a specific socket
  async sendEvaluationSnapshot(socket: Socket, evaluationId: string): Promise<void> {
    try {
      const progress = this.orchestrator.getEvaluationProgress(evaluationId)
      if (progress) {
        const statusEvent: EvaluationStatusEvent = {
          evaluationId,
          overallProgress: progress.progress,
          activeAgents: progress.activeAgents || [],
          completedAgents: progress.completedAgents || [],
          timestamp: new Date(),
        }
        socket.emit('evaluation:status', statusEvent)
      }
    } catch (error) {
      console.error(`[EventEmitter] Failed to send evaluation snapshot: ${error}`)
    }
  }

  // Batch emit multiple events
  emitBatch(evaluationId: string, events: WebSocketEvent[]): void {
    const room = `evaluation:${evaluationId}`
    const namespace = this.io.of('/evaluation-progress')

    events.forEach(event => {
      const eventType = this.getEventType(event)
      if (eventType) {
        namespace.to(room).emit(eventType, event)
      }
    })
  }

  private getEventType(event: WebSocketEvent): string | null {
    if ('progressPercentage' in event && 'agentType' in event) {
      return 'agent:progress'
    } else if ('insight' in event && 'confidence' in event) {
      return 'insight:discovered'
    } else if ('overallProgress' in event && 'activeAgents' in event) {
      return 'evaluation:status'
    } else if ('finalScore' in event && 'executionTime' in event) {
      return 'agent:completed'
    } else if ('error' in event && 'severity' in event) {
      return 'evaluation:error'
    } else if ('totalTime' in event && 'agentSummaries' in event) {
      return 'evaluation:completed'
    }
    return null
  }

  // Get room members count
  async getRoomMemberCount(evaluationId: string): Promise<number> {
    const room = `evaluation:${evaluationId}`
    const sockets = await this.io.of('/evaluation-progress').in(room).fetchSockets()
    return sockets.length
  }

  // Emit to all connected clients (admin broadcasts)
  broadcastToAll(event: string, data: any): void {
    this.io.of('/evaluation-progress').emit(event, data)
  }

  // Initialize evaluation progress tracking
  initializeEvaluationProgress(evaluationId: string, agentTypes: string[]): void {
    this.progressCalculator.initializeEvaluation(evaluationId, agentTypes)
    console.log(`[EventEmitter] Initialized progress tracking for evaluation ${evaluationId}`)
  }

  // Get progress snapshot for client reconnection
  getProgressSnapshot(evaluationId: string): any {
    return this.progressCalculator.getEvaluationProgress(evaluationId)
  }

  // Cleanup evaluation when completed
  cleanupEvaluation(evaluationId: string): void {
    this.progressCalculator.cleanupEvaluation(evaluationId)
  }

  // Emit to specific user's connections
  // eslint-disable-next-line no-unused-vars
  emitToUser(_userId: string, _event: string, _data: any): void {
    // This would require ConnectionManager integration
    // Implementation depends on how we track user->socket mappings
  }
}
