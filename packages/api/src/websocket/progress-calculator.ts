interface AgentWeight {
  agentType: string
  weight: number
  estimatedDurationMs: number
}

interface AgentProgress {
  agentType: string
  status: 'pending' | 'initializing' | 'running' | 'completed' | 'failed' | 'retrying'
  progressPercentage: number
  startTime?: Date
  completedTime?: Date
  estimatedCompletionTime?: Date
}

interface EvaluationProgress {
  evaluationId: string
  overallProgress: number
  estimatedCompletionTime?: Date
  agentProgresses: Map<string, AgentProgress>
  startTime: Date
}

export class ProgressCalculator {
  private static instance: ProgressCalculator

  // Default agent weights based on typical execution complexity and time
  private readonly defaultWeights: Map<string, AgentWeight> = new Map([
    ['market-research', { agentType: 'market-research', weight: 0.25, estimatedDurationMs: 45000 }],
    [
      'technical-feasibility',
      { agentType: 'technical-feasibility', weight: 0.3, estimatedDurationMs: 50000 },
    ],
    [
      'competitive-analysis',
      { agentType: 'competitive-analysis', weight: 0.25, estimatedDurationMs: 40000 },
    ],
    [
      'customer-research',
      { agentType: 'customer-research', weight: 0.2, estimatedDurationMs: 35000 },
    ],
  ])

  private evaluationProgresses: Map<string, EvaluationProgress> = new Map()

  private constructor() {}

  static getInstance(): ProgressCalculator {
    if (!ProgressCalculator.instance) {
      ProgressCalculator.instance = new ProgressCalculator()
    }
    return ProgressCalculator.instance
  }

  // Initialize evaluation progress tracking
  initializeEvaluation(
    evaluationId: string,
    agentTypes: string[],
    customWeights?: Map<string, AgentWeight>
  ): void {
    const weights = customWeights || this.defaultWeights
    const agentProgresses = new Map<string, AgentProgress>()

    // Initialize agent progress entries
    agentTypes.forEach(agentType => {
      agentProgresses.set(agentType, {
        agentType,
        status: 'pending',
        progressPercentage: 0,
      })
    })

    // Calculate total estimated duration
    const totalEstimatedDuration = agentTypes.reduce((total, agentType) => {
      const weight = weights.get(agentType)
      return total + (weight?.estimatedDurationMs || 30000)
    }, 0)

    const evaluationProgress: EvaluationProgress = {
      evaluationId,
      overallProgress: 0,
      agentProgresses,
      startTime: new Date(),
      estimatedCompletionTime: new Date(Date.now() + totalEstimatedDuration),
    }

    this.evaluationProgresses.set(evaluationId, evaluationProgress)
    console.log(
      `[ProgressCalculator] Initialized evaluation ${evaluationId} with ${agentTypes.length} agents`
    )
  }

  // Update agent progress and recalculate overall progress
  updateAgentProgress(
    evaluationId: string,
    agentType: string,
    status: 'pending' | 'initializing' | 'running' | 'completed' | 'failed' | 'retrying',
    progressPercentage: number
  ): number {
    const evaluation = this.evaluationProgresses.get(evaluationId)
    if (!evaluation) {
      console.warn(`[ProgressCalculator] Evaluation ${evaluationId} not found`)
      return 0
    }

    const agentProgress = evaluation.agentProgresses.get(agentType)
    if (!agentProgress) {
      console.warn(
        `[ProgressCalculator] Agent ${agentType} not found in evaluation ${evaluationId}`
      )
      return evaluation.overallProgress
    }

    // Update agent status and progress
    const previousStatus = agentProgress.status
    agentProgress.status = status
    agentProgress.progressPercentage = Math.max(0, Math.min(100, progressPercentage))

    // Track timing
    if (previousStatus === 'pending' && status !== 'pending') {
      agentProgress.startTime = new Date()
    }
    if (status === 'completed' || status === 'failed') {
      agentProgress.completedTime = new Date()
    }

    // Recalculate overall progress
    evaluation.overallProgress = this.calculateOverallProgress(evaluationId)

    // Update estimated completion time
    evaluation.estimatedCompletionTime = this.estimateCompletionTime(evaluationId)

    console.log(
      `[ProgressCalculator] Updated ${agentType} to ${status} (${progressPercentage}%), overall: ${evaluation.overallProgress}%`
    )

    return evaluation.overallProgress
  }

  // Calculate weighted overall progress
  private calculateOverallProgress(evaluationId: string): number {
    const evaluation = this.evaluationProgresses.get(evaluationId)
    if (!evaluation) return 0

    let totalWeightedProgress = 0
    let totalWeight = 0

    evaluation.agentProgresses.forEach((progress, agentType) => {
      const weight = this.defaultWeights.get(agentType)?.weight || 0.25
      totalWeightedProgress += (progress.progressPercentage / 100) * weight
      totalWeight += weight
    })

    // Prevent division by zero and handle edge cases
    if (totalWeight === 0) {
      console.warn(`[ProgressCalculator] No agent weights found for evaluation ${evaluationId}`)
      return 0
    }

    const overallProgress = (totalWeightedProgress / totalWeight) * 100

    // Ensure progress is within valid bounds
    return Math.max(0, Math.min(100, Math.round(overallProgress)))
  }

  // Estimate completion time based on current progress and agent speeds
  private estimateCompletionTime(evaluationId: string): Date {
    const evaluation = this.evaluationProgresses.get(evaluationId)
    if (!evaluation) return new Date()

    let totalRemainingTime = 0
    const now = new Date()

    evaluation.agentProgresses.forEach((progress, agentType) => {
      if (progress.status === 'completed' || progress.status === 'failed') {
        return // Skip completed agents
      }

      const weight = this.defaultWeights.get(agentType)
      const estimatedDuration = weight?.estimatedDurationMs || 30000

      if (progress.startTime && progress.progressPercentage > 0) {
        // Calculate based on actual progress rate
        const elapsedTime = now.getTime() - progress.startTime.getTime()
        const progressRate = progress.progressPercentage / 100
        const estimatedTotal = elapsedTime / progressRate
        const remainingTime = estimatedTotal - elapsedTime
        totalRemainingTime += Math.max(0, remainingTime)
      } else {
        // Use default estimate for pending agents
        totalRemainingTime += estimatedDuration
      }
    })

    return new Date(now.getTime() + totalRemainingTime)
  }

  // Get evaluation progress snapshot
  getEvaluationProgress(evaluationId: string): {
    evaluationId: string
    overallProgress: number
    activeAgents: string[]
    completedAgents: string[]
    failedAgents: string[]
    estimatedCompletionTime?: Date
    agentProgresses: Record<
      string,
      {
        status: string
        progressPercentage: number
        startTime?: Date
        completedTime?: Date
      }
    >
  } | null {
    const evaluation = this.evaluationProgresses.get(evaluationId)
    if (!evaluation) return null

    const activeAgents: string[] = []
    const completedAgents: string[] = []
    const failedAgents: string[] = []
    const agentProgresses: Record<string, any> = {}

    evaluation.agentProgresses.forEach((progress, agentType) => {
      agentProgresses[agentType] = {
        status: progress.status,
        progressPercentage: progress.progressPercentage,
        startTime: progress.startTime,
        completedTime: progress.completedTime,
      }

      if (
        progress.status === 'running' ||
        progress.status === 'initializing' ||
        progress.status === 'retrying'
      ) {
        activeAgents.push(agentType)
      } else if (progress.status === 'completed') {
        completedAgents.push(agentType)
      } else if (progress.status === 'failed') {
        failedAgents.push(agentType)
      }
    })

    return {
      evaluationId,
      overallProgress: evaluation.overallProgress,
      activeAgents,
      completedAgents,
      failedAgents,
      estimatedCompletionTime: evaluation.estimatedCompletionTime,
      agentProgresses,
    }
  }

  // Get overall evaluation metrics
  getEvaluationMetrics(evaluationId: string): {
    totalTime: number
    averageAgentTime: number
    efficiency: number
    bottleneckAgent?: string
  } | null {
    const evaluation = this.evaluationProgresses.get(evaluationId)
    if (!evaluation) return null

    const now = new Date()
    const totalTime = now.getTime() - evaluation.startTime.getTime()

    let completedAgentTimes: number[] = []
    let slowestAgent: { agent: string; time: number } | null = null

    evaluation.agentProgresses.forEach((progress, agentType) => {
      if (progress.completedTime && progress.startTime) {
        const agentTime = progress.completedTime.getTime() - progress.startTime.getTime()
        completedAgentTimes.push(agentTime)

        if (!slowestAgent || agentTime > slowestAgent.time) {
          slowestAgent = { agent: agentType, time: agentTime }
        }
      }
    })

    const averageAgentTime =
      completedAgentTimes.length > 0
        ? completedAgentTimes.reduce((sum, time) => sum + time, 0) / completedAgentTimes.length
        : 0

    // Calculate efficiency as completed agents vs total time
    const efficiency =
      completedAgentTimes.length > 0
        ? (completedAgentTimes.length / evaluation.agentProgresses.size) * 100
        : 0

    return {
      totalTime,
      averageAgentTime,
      efficiency: Math.round(efficiency),
      bottleneckAgent: slowestAgent?.agent,
    }
  }

  // Clean up completed evaluations to prevent memory leaks
  cleanupEvaluation(evaluationId: string): void {
    this.evaluationProgresses.delete(evaluationId)
    console.log(`[ProgressCalculator] Cleaned up evaluation ${evaluationId}`)
  }

  // Get all active evaluations (for monitoring)
  getActiveEvaluations(): string[] {
    return Array.from(this.evaluationProgresses.keys())
  }
}
