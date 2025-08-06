/**
 * Mock Queue Implementation for Development
 */

import { BaseQueue, Job } from './base-queue.js'
import { JobType, JobData, JobOptions, QueueMetrics, JobStatus } from './types.js'

export class MockQueue extends BaseQueue {
  private jobs: Map<string, Job> = new Map()
  private processors: Map<JobType, (job: Job) => Promise<any>> = new Map()
  private isProcessing = true
  private processingTimer: NodeJS.Timeout | null = null

  constructor(name: string) {
    super(name)
    this.startProcessing()
  }

  private startProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }

    this.processingTimer = setInterval(() => {
      this.processNextJob()
    }, 100) // Process jobs every 100ms
  }

  private async processNextJob(): Promise<void> {
    if (!this.isProcessing) return

    // Find next waiting job
    const waitingJobs = Array.from(this.jobs.values())
      .filter(job => this.getJobStatus(job) === JobStatus.WAITING)
      .sort((a, b) => a.timestamp - b.timestamp)

    if (waitingJobs.length === 0) return

    const job = waitingJobs[0]
    const processor = this.processors.get(job.name as JobType)

    if (!processor) return

    try {
      // Mark as active
      job.processedOn = Date.now()
      this.updateMetrics(job, JobStatus.ACTIVE)
      this.emit('active', job.id)

      // Process job with simulated async delay
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800))
      job.returnvalue = await processor(job)

      // Mark as completed
      job.finishedOn = Date.now()
      this.updateMetrics(job, JobStatus.COMPLETED)
      this.emit('completed', job.id, job.returnvalue)
    } catch (error: any) {
      // Mark as failed
      job.failedReason = error.message
      job.attemptsMade++

      if (job.attemptsMade < (job.opts.attempts || 3)) {
        // Retry - reset processed state and reschedule
        job.processedOn = undefined
        job.progress = 0
        setTimeout(
          () => {
            this.emit('waiting', job.id)
          },
          this.calculateBackoffDelay(job.attemptsMade, job.opts.backoff)
        )
      } else {
        // Max attempts reached, mark as failed
        job.finishedOn = Date.now()
        this.updateMetrics(job, JobStatus.FAILED)
        this.emit('failed', job.id, error)
      }
    }
  }

  private calculateBackoffDelay(attempt: number, backoff?: JobOptions['backoff']): number {
    if (!backoff) return 1000

    if (backoff.type === 'exponential') {
      return backoff.delay * Math.pow(2, attempt - 1)
    } else {
      return backoff.delay
    }
  }

  private getJobStatus(job: Job): JobStatus {
    if (job.finishedOn && job.failedReason) {
      return JobStatus.FAILED
    }
    if (job.finishedOn) {
      return JobStatus.COMPLETED
    }
    if (job.processedOn && !job.finishedOn) {
      return JobStatus.ACTIVE
    }
    if (job.opts.delay && Date.now() < job.timestamp + job.opts.delay) {
      return JobStatus.DELAYED
    }
    return JobStatus.WAITING
  }

  async add(jobType: JobType, data: JobData, opts?: JobOptions): Promise<Job> {
    const job: Job = {
      id: this.generateJobId(),
      name: jobType,
      data,
      opts: opts || {},
      progress: 0,
      timestamp: Date.now(),
      attemptsMade: 0,
    }

    this.jobs.set(job.id, job)

    // Apply delay if specified
    if (opts?.delay) {
      setTimeout(() => {
        this.updateMetrics(job, JobStatus.WAITING)
        this.emit('waiting', job.id)
      }, opts.delay)
    } else {
      this.updateMetrics(job, JobStatus.WAITING)
      this.emit('waiting', job.id)
    }

    return job
  }

  process(jobType: JobType, processor: (job: Job) => Promise<any>): void {
    this.processors.set(jobType, processor)
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    return this.jobs.get(jobId)
  }

  async getJobs(status: JobStatus[], start = 0, end = -1): Promise<Job[]> {
    const allJobs = Array.from(this.jobs.values())
    const filteredJobs = allJobs.filter(job => status.includes(this.getJobStatus(job)))

    if (end === -1) {
      return filteredJobs.slice(start)
    }
    return filteredJobs.slice(start, end + 1)
  }

  async pause(): Promise<void> {
    this.isProcessing = false
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }
  }

  async resume(): Promise<void> {
    this.isProcessing = true
    this.startProcessing()
  }

  async clean(grace: number, limit = 0, type?: JobStatus): Promise<string[]> {
    const now = Date.now()
    const cleanedIds: string[] = []

    for (const [id, job] of this.jobs) {
      const jobStatus = this.getJobStatus(job)

      if (type && jobStatus !== type) continue

      // Check if job is older than grace period
      const jobAge = now - job.timestamp
      if (jobAge > grace) {
        this.jobs.delete(id)
        cleanedIds.push(id)

        if (limit > 0 && cleanedIds.length >= limit) {
          break
        }
      }
    }

    return cleanedIds
  }

  async obliterate(opts?: { force?: boolean }): Promise<void> {
    this.jobs.clear()
    this.processors.clear()

    // Reset metrics
    this.metrics = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      jobCounts: {
        [JobType.EVALUATION_REQUEST]: 0,
        [JobType.AGENT_TASK]: 0,
        [JobType.RESULT_PROCESSING]: 0,
      },
      processingTimes: {
        average: 0,
        min: Infinity,
        max: 0,
      },
      errorRate: 0,
      throughput: 0,
    }
  }

  async close(): Promise<void> {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }
    this.isProcessing = false
    this.removeAllListeners()
  }

  async getMetrics(): Promise<QueueMetrics> {
    // Count current job statuses
    const statusCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 }

    for (const job of this.jobs.values()) {
      const status = this.getJobStatus(job)
      statusCounts[status]++
    }

    return {
      ...this.metrics,
      ...statusCounts,
    }
  }

  // Test utility method to reset state
  resetState(): void {
    this.jobs.clear()
    this.isProcessing = false
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }
    // Restart processing for new test
    this.isProcessing = true
    this.startProcessing()
  }
}
