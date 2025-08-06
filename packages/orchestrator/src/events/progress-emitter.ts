import {
  WebSocketEvent,
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent,
} from '@ai-validation/shared'
import { EventEmitter } from 'events'

export class ProgressEmitter extends EventEmitter {
  private static instance: ProgressEmitter

  private constructor() {
    super()
  }

  public static getInstance(): ProgressEmitter {
    if (!ProgressEmitter.instance) {
      ProgressEmitter.instance = new ProgressEmitter()
    }
    return ProgressEmitter.instance
  }

  // Emit agent progress update
  emitAgentProgress(
    evaluationId: string,
    agentType: string,
    status: string,
    progressPercentage: number
  ): void {
    const event: AgentProgressEvent = {
      agentType,
      status: status as any,
      progressPercentage,
      timestamp: new Date(),
    }

    console.log(`[ProgressEmitter] Agent progress: ${agentType} ${status} ${progressPercentage}%`)
    this.emit('agent:progress', evaluationId, event)
  }

  // Emit insight discovered
  emitInsightDiscovered(
    evaluationId: string,
    agentType: string,
    insight: {
      type: string
      content: string
      importance: 'low' | 'medium' | 'high' | 'critical'
    },
    confidence: number,
    metadata?: Record<string, any>
  ): void {
    const event: InsightDiscoveredEvent = {
      agentType,
      insight,
      confidence,
      metadata,
      timestamp: new Date(),
    }

    console.log(`[ProgressEmitter] Insight discovered: ${agentType} - ${insight.type}`)
    this.emit('insight:discovered', evaluationId, event)
  }

  // Emit evaluation status update
  emitEvaluationStatus(
    evaluationId: string,
    overallProgress: number,
    activeAgents: string[],
    completedAgents: string[],
    failedAgents?: string[],
    estimatedCompletionTime?: Date
  ): void {
    const event: EvaluationStatusEvent = {
      evaluationId,
      overallProgress,
      activeAgents,
      completedAgents,
      failedAgents,
      estimatedCompletionTime,
      timestamp: new Date(),
    }

    console.log(`[ProgressEmitter] Evaluation status: ${evaluationId} ${overallProgress}%`)
    this.emit('evaluation:status', evaluationId, event)
  }

  // Emit agent completed
  emitAgentCompleted(
    evaluationId: string,
    agentType: string,
    resultSummary: {
      score: number
      keyFindings: string[]
      recommendation: string
    },
    executionTime: number,
    finalScore: number
  ): void {
    const event: AgentCompletedEvent = {
      agentType,
      evaluationId,
      resultSummary,
      executionTime,
      finalScore,
      timestamp: new Date(),
    }

    console.log(`[ProgressEmitter] Agent completed: ${agentType} score: ${finalScore}`)
    this.emit('agent:completed', evaluationId, event)
  }

  // Emit error
  emitError(
    evaluationId: string,
    error: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    agentType?: string,
    recoveryActions?: string[]
  ): void {
    const event: ErrorEvent = {
      evaluationId,
      error,
      severity,
      agentType,
      recoveryActions,
      timestamp: new Date(),
    }

    console.log(`[ProgressEmitter] Error: ${severity} - ${error}`)
    this.emit('evaluation:error', evaluationId, event)
  }

  // Emit evaluation completed
  emitEvaluationCompleted(
    evaluationId: string,
    finalResults: {
      overallScore: number
      recommendation: 'highly-recommended' | 'recommended' | 'neutral' | 'not-recommended'
      summary: string
    },
    totalTime: number,
    agentSummaries: Array<{
      agentType: string
      score: number
      executionTime: number
    }>
  ): void {
    const event: EvaluationCompletedEvent = {
      evaluationId,
      finalResults,
      totalTime,
      agentSummaries,
      timestamp: new Date(),
    }

    console.log(
      `[ProgressEmitter] Evaluation completed: ${evaluationId} score: ${finalResults.overallScore}`
    )
    this.emit('evaluation:completed', evaluationId, event)
  }

  // Helper method to emit batch events
  emitBatch(evaluationId: string, events: WebSocketEvent[]): void {
    events.forEach(event => {
      if ('progressPercentage' in event && 'agentType' in event) {
        this.emit('agent:progress', evaluationId, event)
      } else if ('insight' in event && 'confidence' in event) {
        this.emit('insight:discovered', evaluationId, event)
      } else if ('overallProgress' in event && 'activeAgents' in event) {
        this.emit('evaluation:status', evaluationId, event)
      } else if ('finalScore' in event && 'executionTime' in event) {
        this.emit('agent:completed', evaluationId, event)
      } else if ('error' in event && 'severity' in event) {
        this.emit('evaluation:error', evaluationId, event)
      } else if ('totalTime' in event && 'agentSummaries' in event) {
        this.emit('evaluation:completed', evaluationId, event)
      }
    })
  }
}
