/**
 * Multi-Agent Queue Manager - Enhanced queue system for parallel agent processing
 */

import { AgentType } from '@ai-validation/shared'
import { BaseQueue } from './base-queue.js'
import { QueueFactory } from './queue-factory.js'
import { JobType, JobData, JobOptions, QueueMetrics, AgentTaskJobData } from './types.js'
import { EventEmitter } from 'events'

export interface AgentQueueConfig {
  agentType: AgentType
  concurrency: number
  priority: number
  retryPolicy: {
    attempts: number
    backoff: 'exponential' | 'linear'
    delay: number
  }
  rateLimiting: {
    max: number
    duration: number
  }
}

export interface QueueTopology {
  coordination: string
  agents: Record<AgentType, string>
  results: string
  health: string
  deadLetter: string
}

export interface MultiAgentJobData {
  evaluationId: string
  agentTypes: AgentType[]
  parallelGroups: AgentType[][]
  dependencies: Record<AgentType, AgentType[]>
  priority: 'high' | 'medium' | 'low'
  timeout: number
  businessIdea?: any
  context?: Record<string, any>
}

export interface AgentExecutionJob {
  evaluationId: string
  agentType: AgentType
  businessIdea: any
  context: Record<string, any>
  dependencies: Record<AgentType, any>
  executionGroup: number
  isParallel: boolean
}

export class MultiAgentQueueManager extends EventEmitter {
  private static instance: MultiAgentQueueManager
  private agentQueues: Map<AgentType, BaseQueue> = new Map()
  private coordinationQueue: BaseQueue | null = null
  private resultsQueue: BaseQueue | null = null
  private healthQueue: BaseQueue | null = null
  private deadLetterQueue: BaseQueue | null = null

  private topology: QueueTopology
  private agentConfigs: Map<AgentType, AgentQueueConfig> = new Map()
  private isInitialized: boolean = false

  private constructor() {
    super()
    this.topology = {
      coordination: 'agent-coordination-queue',
      agents: {
        'market-research': 'market-research-queue',
        'competitive-analysis': 'competitive-analysis-queue',
        'customer-research': 'customer-research-queue',
        'technical-feasibility': 'technical-feasibility-queue',
        'financial-analysis': 'financial-analysis-queue',
      },
      results: 'agent-results-queue',
      health: 'agent-health-queue',
      deadLetter: 'agent-dead-letter-queue',
    }
  }

  static getInstance(): MultiAgentQueueManager {
    if (!MultiAgentQueueManager.instance) {
      MultiAgentQueueManager.instance = new MultiAgentQueueManager()
    }
    return MultiAgentQueueManager.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('[MultiAgentQueueManager] Initializing enhanced queue system...')

      // Initialize coordination queue
      this.coordinationQueue = await QueueFactory.createQueue(this.topology.coordination)

      // Initialize agent-specific queues
      for (const [agentType, queueName] of Object.entries(this.topology.agents)) {
        const queue = await QueueFactory.createQueue(queueName)
        this.agentQueues.set(agentType as AgentType, queue)

        // Setup default configuration
        this.setupDefaultAgentConfig(agentType as AgentType)
      }

      // Initialize support queues
      this.resultsQueue = await QueueFactory.createQueue(this.topology.results)
      this.healthQueue = await QueueFactory.createQueue(this.topology.health)
      this.deadLetterQueue = await QueueFactory.createQueue(this.topology.deadLetter)

      // Setup queue processing
      this.setupQueueProcessors()

      this.isInitialized = true
      console.log('[MultiAgentQueueManager] Initialization complete')
      this.emit('initialized')
    } catch (error) {
      console.error('[MultiAgentQueueManager] Initialization failed:', error)
      throw error
    }
  }

  private setupDefaultAgentConfig(agentType: AgentType): void {
    const defaultConfig: AgentQueueConfig = {
      agentType,
      concurrency: this.getDefaultConcurrency(agentType),
      priority: this.getDefaultPriority(agentType),
      retryPolicy: {
        attempts: 3,
        backoff: 'exponential' as const,
        delay: 1000,
      },
      rateLimiting: {
        max: 10,
        duration: 60000, // per minute
      },
    }

    this.agentConfigs.set(agentType, defaultConfig)
  }

  private getDefaultConcurrency(agentType: AgentType): number {
    // Different agents may have different optimal concurrency levels
    switch (agentType) {
      case 'market-research':
      case 'competitive-analysis':
        return 2 // Lower concurrency for research-heavy agents
      case 'technical-feasibility':
        return 1 // Sequential processing for technical analysis
      case 'customer-research':
      case 'financial-analysis':
        return 3 // Higher concurrency for data analysis
      default:
        return 2
    }
  }

  private getDefaultPriority(agentType: AgentType): number {
    // Execution order priority (lower number = higher priority)
    switch (agentType) {
      case 'market-research':
        return 1 // Run first
      case 'competitive-analysis':
      case 'customer-research':
      case 'technical-feasibility':
        return 2 // Can run in parallel after market research
      case 'financial-analysis':
        return 3 // Run last, depends on other agents
      default:
        return 2
    }
  }

  async configureAgent(agentType: AgentType, config: Partial<AgentQueueConfig>): Promise<void> {
    const existingConfig = this.agentConfigs.get(agentType)
    if (!existingConfig) {
      throw new Error(`Agent ${agentType} not found`)
    }

    const updatedConfig = { ...existingConfig, ...config }
    this.agentConfigs.set(agentType, updatedConfig)

    // Reconfigure queue if it exists
    const queue = this.agentQueues.get(agentType)
    if (queue) {
      // Update queue configuration
      await this.applyQueueConfiguration(queue, updatedConfig)
    }

    console.log(`[MultiAgentQueueManager] Updated configuration for ${agentType}`)
  }

  private async applyQueueConfiguration(queue: BaseQueue, config: AgentQueueConfig): Promise<void> {
    // Apply configuration to the queue
    // This would depend on the specific queue implementation
    // For now, we'll just log the configuration
    console.log(`[MultiAgentQueueManager] Applying config:`, {
      agentType: config.agentType,
      concurrency: config.concurrency,
      priority: config.priority,
    })
  }

  async addMultiAgentEvaluation(data: MultiAgentJobData, options?: JobOptions): Promise<string> {
    if (!this.coordinationQueue) {
      throw new Error('Queue Manager not initialized')
    }

    const job = await this.coordinationQueue.add('multi-agent-evaluation' as any, data, {
      priority: this.getPriorityValue(data.priority),
      delay: options?.delay,
      attempts: options?.attempts || 3,
      ...options,
    })

    console.log(`[MultiAgentQueueManager] Added multi-agent evaluation: ${job.id}`)
    this.emit('evaluationQueued', { jobId: job.id, evaluationId: data.evaluationId })

    return job.id
  }

  async addAgentExecution(
    agentType: AgentType,
    data: AgentExecutionJob,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.agentQueues.get(agentType)
    if (!queue) {
      throw new Error(`Agent queue for ${agentType} not found`)
    }

    const config = this.agentConfigs.get(agentType)!
    const job = await queue.add('agent-execution' as any, data, {
      priority: config.priority,
      attempts: config.retryPolicy.attempts,
      backoff: {
        type: config.retryPolicy.backoff === 'linear' ? 'fixed' : config.retryPolicy.backoff,
        delay: config.retryPolicy.delay,
      },
      ...options,
    })

    console.log(`[MultiAgentQueueManager] Added ${agentType} execution: ${job.id}`)
    this.emit('agentExecutionQueued', {
      jobId: job.id,
      agentType,
      evaluationId: data.evaluationId,
    })

    return job.id
  }

  async addResultAggregation(data: any, options?: JobOptions): Promise<string> {
    if (!this.resultsQueue) {
      throw new Error('Results queue not initialized')
    }

    const job = await this.resultsQueue.add('result-aggregation' as any, data, options)
    console.log(`[MultiAgentQueueManager] Added result aggregation: ${job.id}`)

    return job.id
  }

  private setupQueueProcessors(): void {
    // Setup coordination queue processor
    if (this.coordinationQueue) {
      this.coordinationQueue.process('multi-agent-evaluation' as any, async job => {
        await this.processMultiAgentEvaluation(job.data as MultiAgentJobData)
      })

      this.coordinationQueue.on('completed', jobId => {
        this.emit('evaluationCompleted', { jobId })
      })

      this.coordinationQueue.on('failed', (jobId, error) => {
        this.emit('evaluationFailed', { jobId, error })
      })
    }

    // Setup agent-specific processors
    this.agentQueues.forEach((queue, agentType) => {
      const config = this.agentConfigs.get(agentType)!

      queue.process('agent-execution' as any, async job => {
        return await this.processAgentExecution(agentType, job.data as AgentExecutionJob)
      })

      queue.on('completed', (jobId, result) => {
        this.emit('agentExecutionCompleted', { jobId, agentType, result })
      })

      queue.on('failed', (jobId, error) => {
        this.emit('agentExecutionFailed', { jobId, agentType, error })
        // Move to dead letter queue if max retries exceeded
        this.handleFailedJob(agentType, jobId, error)
      })
    })

    // Setup results processor
    if (this.resultsQueue) {
      this.resultsQueue.process('result-aggregation' as any, async job => {
        await this.processResultAggregation(job.data)
      })
    }
  }

  private async processMultiAgentEvaluation(data: MultiAgentJobData): Promise<void> {
    console.log(`[MultiAgentQueueManager] Processing multi-agent evaluation: ${data.evaluationId}`)

    // Process agents in parallel groups based on dependencies
    for (let groupIndex = 0; groupIndex < data.parallelGroups.length; groupIndex++) {
      const group = data.parallelGroups[groupIndex]

      console.log(`[MultiAgentQueueManager] Processing group ${groupIndex}: [${group.join(', ')}]`)

      // Add all agents in the group to their respective queues
      const groupPromises = group.map(agentType => {
        const agentJob: AgentExecutionJob = {
          evaluationId: data.evaluationId,
          agentType,
          businessIdea: (data as any).businessIdea,
          context: (data as any).context || {},
          dependencies: this.extractDependenciesForAgent(agentType, data.dependencies),
          executionGroup: groupIndex,
          isParallel: group.length > 1,
        }

        return this.addAgentExecution(agentType, agentJob)
      })

      // Wait for all agents in the group to be queued
      await Promise.all(groupPromises)
    }
  }

  private async processAgentExecution(agentType: AgentType, data: AgentExecutionJob): Promise<any> {
    console.log(
      `[MultiAgentQueueManager] Executing ${agentType} for evaluation: ${data.evaluationId}`
    )

    // This would integrate with the AgentService
    // For now, we'll simulate the execution
    const startTime = Date.now()

    try {
      // Simulate agent execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 1000))

      const result = {
        agentType,
        evaluationId: data.evaluationId,
        score: Math.floor(Math.random() * 100),
        insights: [`Insight from ${agentType}`, `Analysis complete`],
        executionTime: Date.now() - startTime,
        success: true,
      }

      console.log(
        `[MultiAgentQueueManager] ${agentType} execution completed with score: ${result.score}`
      )
      return result
    } catch (error) {
      console.error(`[MultiAgentQueueManager] ${agentType} execution failed:`, error)
      throw error
    }
  }

  private async processResultAggregation(data: any): Promise<void> {
    console.log(`[MultiAgentQueueManager] Aggregating results for evaluation: ${data.evaluationId}`)
    // Result aggregation logic would be implemented here
  }

  private extractDependenciesForAgent(
    agentType: AgentType,
    allDependencies: Record<AgentType, AgentType[]>
  ): Record<string, any> {
    const agentDependencies = allDependencies[agentType] || []
    const dependencies: Record<string, any> = {}

    agentDependencies.forEach(depType => {
      // In a real implementation, this would fetch the actual dependency results
      dependencies[depType] = { available: true }
    })

    return dependencies
  }

  private async handleFailedJob(agentType: AgentType, jobId: string, error: any): Promise<void> {
    if (!this.deadLetterQueue) return

    try {
      await this.deadLetterQueue.add(
        'failed-agent-job' as any,
        {
          originalJobId: jobId,
          agentType,
          error: error.message,
          timestamp: new Date(),
          retryable: this.isRetryableError(error),
          correlationId: `dlq-${Date.now()}`,
          analysisType: 'failed-job',
        } as any
      )

      console.log(`[MultiAgentQueueManager] Moved failed job ${jobId} to dead letter queue`)
    } catch (dlqError) {
      console.error(`[MultiAgentQueueManager] Failed to add job to dead letter queue:`, dlqError)
    }
  }

  private isRetryableError(error: any): boolean {
    // Determine if an error is retryable based on error type/message
    const retryablePatterns = [/timeout/i, /network/i, /connection/i, /temporary/i]

    const errorMessage = error.message || error.toString()
    return retryablePatterns.some(pattern => pattern.test(errorMessage))
  }

  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high':
        return 1
      case 'medium':
        return 5
      case 'low':
        return 10
      default:
        return 5
    }
  }

  async getQueueMetrics(): Promise<Record<string, QueueMetrics & { agentType?: AgentType }>> {
    const metrics: Record<string, QueueMetrics & { agentType?: AgentType }> = {}

    // Coordination queue metrics
    if (this.coordinationQueue) {
      metrics[this.topology.coordination] = await this.coordinationQueue.getMetrics()
    }

    // Agent-specific queue metrics
    for (const [agentType, queue] of this.agentQueues.entries()) {
      const queueMetrics = await queue.getMetrics()
      metrics[this.topology.agents[agentType]] = {
        ...queueMetrics,
        agentType,
      }
    }

    // Support queue metrics
    if (this.resultsQueue) {
      metrics[this.topology.results] = await this.resultsQueue.getMetrics()
    }

    if (this.healthQueue) {
      metrics[this.topology.health] = await this.healthQueue.getMetrics()
    }

    if (this.deadLetterQueue) {
      metrics[this.topology.deadLetter] = await this.deadLetterQueue.getMetrics()
    }

    return metrics
  }

  async pauseAgent(agentType: AgentType): Promise<void> {
    const queue = this.agentQueues.get(agentType)
    if (queue) {
      await queue.pause()
      console.log(`[MultiAgentQueueManager] Paused ${agentType} queue`)
    }
  }

  async resumeAgent(agentType: AgentType): Promise<void> {
    const queue = this.agentQueues.get(agentType)
    if (queue) {
      await queue.resume()
      console.log(`[MultiAgentQueueManager] Resumed ${agentType} queue`)
    }
  }

  async pauseAll(): Promise<void> {
    const pausePromises: Promise<void>[] = []

    if (this.coordinationQueue) pausePromises.push(this.coordinationQueue.pause())
    this.agentQueues.forEach(queue => pausePromises.push(queue.pause()))
    if (this.resultsQueue) pausePromises.push(this.resultsQueue.pause())
    if (this.healthQueue) pausePromises.push(this.healthQueue.pause())
    if (this.deadLetterQueue) pausePromises.push(this.deadLetterQueue.pause())

    await Promise.all(pausePromises)
    console.log('[MultiAgentQueueManager] All queues paused')
  }

  async resumeAll(): Promise<void> {
    const resumePromises: Promise<void>[] = []

    if (this.coordinationQueue) resumePromises.push(this.coordinationQueue.resume())
    this.agentQueues.forEach(queue => resumePromises.push(queue.resume()))
    if (this.resultsQueue) resumePromises.push(this.resultsQueue.resume())
    if (this.healthQueue) resumePromises.push(this.healthQueue.resume())
    if (this.deadLetterQueue) resumePromises.push(this.deadLetterQueue.resume())

    await Promise.all(resumePromises)
    console.log('[MultiAgentQueueManager] All queues resumed')
  }

  async shutdown(): Promise<void> {
    console.log('[MultiAgentQueueManager] Shutting down...')

    // Close all queues
    const closePromises: Promise<void>[] = []

    if (this.coordinationQueue) closePromises.push(this.coordinationQueue.close())
    this.agentQueues.forEach(queue => closePromises.push(queue.close()))
    if (this.resultsQueue) closePromises.push(this.resultsQueue.close())
    if (this.healthQueue) closePromises.push(this.healthQueue.close())
    if (this.deadLetterQueue) closePromises.push(this.deadLetterQueue.close())

    await Promise.all(closePromises)

    // Clear maps
    this.agentQueues.clear()
    this.agentConfigs.clear()
    this.isInitialized = false

    this.removeAllListeners()
    console.log('[MultiAgentQueueManager] Shutdown complete')
  }

  // Test utilities
  static resetInstance(): void {
    if (MultiAgentQueueManager.instance) {
      MultiAgentQueueManager.instance.shutdown()
    }
    MultiAgentQueueManager.instance = null as any
  }

  getTopology(): QueueTopology {
    return { ...this.topology }
  }

  getAgentConfigs(): Map<AgentType, AgentQueueConfig> {
    return new Map(this.agentConfigs)
  }

  // Test utility to access internal queues for testing
  getInternalQueues(): {
    agentQueues: Map<AgentType, BaseQueue>
    coordinationQueue: BaseQueue | null
    resultsQueue: BaseQueue | null
    healthQueue: BaseQueue | null
    deadLetterQueue: BaseQueue | null
  } {
    return {
      agentQueues: this.agentQueues,
      coordinationQueue: this.coordinationQueue,
      resultsQueue: this.resultsQueue,
      healthQueue: this.healthQueue,
      deadLetterQueue: this.deadLetterQueue,
    }
  }
}
