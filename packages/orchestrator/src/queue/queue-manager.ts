/**
 * Queue Manager for Orchestrating Job Processing
 */

import { BaseQueue } from './base-queue.js'
import { QueueFactory } from './queue-factory.js'
import {
  JobType,
  JobData,
  JobOptions,
  EvaluationRequestJobData,
  AgentTaskJobData,
  ResultProcessingJobData,
  QueueMetrics,
} from './types.js'

export class QueueManager {
  private static instance: QueueManager
  private evaluationQueue: BaseQueue | null = null
  private agentQueue: BaseQueue | null = null
  private resultQueue: BaseQueue | null = null

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  async initialize(): Promise<void> {
    try {
      this.evaluationQueue = await QueueFactory.createQueue('evaluation-queue')
      this.agentQueue = await QueueFactory.createQueue('agent-queue')
      this.resultQueue = await QueueFactory.createQueue('result-queue')

      console.log('Queue Manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Queue Manager:', error)
      throw error
    }
  }

  async addEvaluationRequest(data: EvaluationRequestJobData, opts?: JobOptions): Promise<string> {
    if (!this.evaluationQueue) {
      throw new Error('Queue Manager not initialized')
    }

    const job = await this.evaluationQueue.add(JobType.EVALUATION_REQUEST, data, opts)
    console.log(`Added evaluation request job: ${job.id}`)
    return job.id
  }

  async addAgentTask(data: AgentTaskJobData, opts?: JobOptions): Promise<string> {
    if (!this.agentQueue) {
      throw new Error('Queue Manager not initialized')
    }

    const job = await this.agentQueue.add(JobType.AGENT_TASK, data, opts)
    console.log(`Added agent task job: ${job.id} for agent: ${data.agentType}`)
    return job.id
  }

  async addResultProcessing(data: ResultProcessingJobData, opts?: JobOptions): Promise<string> {
    if (!this.resultQueue) {
      throw new Error('Queue Manager not initialized')
    }

    const job = await this.resultQueue.add(JobType.RESULT_PROCESSING, data, opts)
    console.log(`Added result processing job: ${job.id}`)
    return job.id
  }

  setupEvaluationProcessor(processor: (data: EvaluationRequestJobData) => Promise<void>): void {
    if (!this.evaluationQueue) {
      throw new Error('Queue Manager not initialized')
    }

    this.evaluationQueue.process(JobType.EVALUATION_REQUEST, async job => {
      console.log(`Processing evaluation request: ${job.id}`)
      await processor(job.data as EvaluationRequestJobData)
    })

    this.evaluationQueue.on('completed', (jobId, result) => {
      console.log(`Evaluation request ${jobId} completed`)
    })

    this.evaluationQueue.on('failed', (jobId, error) => {
      console.error(`Evaluation request ${jobId} failed:`, error)
    })
  }

  setupAgentProcessor(processor: (data: AgentTaskJobData) => Promise<any>): void {
    if (!this.agentQueue) {
      throw new Error('Queue Manager not initialized')
    }

    this.agentQueue.process(JobType.AGENT_TASK, async job => {
      console.log(
        `Processing agent task: ${job.id} for agent: ${(job.data as AgentTaskJobData).agentType}`
      )
      return await processor(job.data as AgentTaskJobData)
    })

    this.agentQueue.on('completed', (jobId, result) => {
      console.log(`Agent task ${jobId} completed with result:`, result)
    })

    this.agentQueue.on('failed', (jobId, error) => {
      console.error(`Agent task ${jobId} failed:`, error)
    })
  }

  setupResultProcessor(processor: (data: ResultProcessingJobData) => Promise<void>): void {
    if (!this.resultQueue) {
      throw new Error('Queue Manager not initialized')
    }

    this.resultQueue.process(JobType.RESULT_PROCESSING, async job => {
      console.log(`Processing results: ${job.id}`)
      await processor(job.data as ResultProcessingJobData)
    })

    this.resultQueue.on('completed', (jobId, result) => {
      console.log(`Result processing ${jobId} completed`)
    })

    this.resultQueue.on('failed', (jobId, error) => {
      console.error(`Result processing ${jobId} failed:`, error)
    })
  }

  async getJobStatus(queueName: string, jobId: string): Promise<any> {
    const queue = QueueFactory.getQueue(queueName)
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`)
    }

    const job = await queue.getJob(jobId)
    if (!job) {
      return null
    }

    return {
      id: job.id,
      name: job.name,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    }
  }

  async getAllMetrics(): Promise<Record<string, QueueMetrics>> {
    const metrics: Record<string, QueueMetrics> = {}

    if (this.evaluationQueue) {
      metrics['evaluation-queue'] = await this.evaluationQueue.getMetrics()
    }
    if (this.agentQueue) {
      metrics['agent-queue'] = await this.agentQueue.getMetrics()
    }
    if (this.resultQueue) {
      metrics['result-queue'] = await this.resultQueue.getMetrics()
    }

    return metrics
  }

  async pauseAll(): Promise<void> {
    const promises = []
    if (this.evaluationQueue) promises.push(this.evaluationQueue.pause())
    if (this.agentQueue) promises.push(this.agentQueue.pause())
    if (this.resultQueue) promises.push(this.resultQueue.pause())

    await Promise.all(promises)
    console.log('All queues paused')
  }

  async resumeAll(): Promise<void> {
    const promises = []
    if (this.evaluationQueue) promises.push(this.evaluationQueue.resume())
    if (this.agentQueue) promises.push(this.agentQueue.resume())
    if (this.resultQueue) promises.push(this.resultQueue.resume())

    await Promise.all(promises)
    console.log('All queues resumed')
  }

  async cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const promises = []
    if (this.evaluationQueue) promises.push(this.evaluationQueue.clean(maxAge, 100))
    if (this.agentQueue) promises.push(this.agentQueue.clean(maxAge, 100))
    if (this.resultQueue) promises.push(this.resultQueue.clean(maxAge, 100))

    const results = await Promise.all(promises)
    const totalCleaned = results.reduce((sum, ids) => sum + ids.length, 0)
    console.log(`Cleaned up ${totalCleaned} old jobs`)
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Queue Manager...')
    await QueueFactory.closeAllQueues()
    this.evaluationQueue = null
    this.agentQueue = null
    this.resultQueue = null
    console.log('Queue Manager shutdown complete')
  }

  // Test utility method to reset state
  resetState(): void {
    // Clear any queued jobs if queues support it
    try {
      ;(this.evaluationQueue as any)?.resetState?.()
      ;(this.agentQueue as any)?.resetState?.()
      ;(this.resultQueue as any)?.resetState?.()
    } catch (e) {
      // Ignore if queues don't have resetState method
    }
  }
}
