/**
 * Unit tests for Queue Infrastructure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockQueue } from '../../src/queue/mock-queue.js'
import { QueueManager } from '../../src/queue/queue-manager.js'
import { QueueFactory } from '../../src/queue/queue-factory.js'
import {
  JobType,
  JobPriority,
  JobStatus,
  EvaluationRequestJobData,
  AgentTaskJobData,
  ResultProcessingJobData,
} from '../../src/queue/types.js'

// Mock environment config
vi.mock('@ai-validation/shared', () => ({
  getEnvironmentConfig: () => ({
    development: {
      useMockServices: true,
    },
  }),
}))

describe('MockQueue', () => {
  let queue: MockQueue

  beforeEach(() => {
    queue = new MockQueue('test-queue')
  })

  afterEach(async () => {
    await queue.close()
  })

  describe('basic functionality', () => {
    it('should add jobs to queue', async () => {
      const jobData: EvaluationRequestJobData = {
        correlationId: 'test-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      }

      const job = await queue.add(JobType.EVALUATION_REQUEST, jobData)

      expect(job.id).toBeDefined()
      expect(job.name).toBe(JobType.EVALUATION_REQUEST)
      expect(job.data).toEqual(jobData)
    })

    it('should process jobs with registered processor', async () => {
      const processorSpy = vi.fn().mockResolvedValue('success')

      queue.process(JobType.EVALUATION_REQUEST, processorSpy)

      const jobData: EvaluationRequestJobData = {
        correlationId: 'test-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      }

      await queue.add(JobType.EVALUATION_REQUEST, jobData)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1500))

      expect(processorSpy).toHaveBeenCalled()
    })

    it('should emit events during job processing', async () => {
      const waitingSpy = vi.fn()
      const activeSpy = vi.fn()
      const completedSpy = vi.fn()

      queue.on('waiting', waitingSpy)
      queue.on('active', activeSpy)
      queue.on('completed', completedSpy)

      queue.process(JobType.EVALUATION_REQUEST, async () => 'success')

      const jobData: EvaluationRequestJobData = {
        correlationId: 'test-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      }

      await queue.add(JobType.EVALUATION_REQUEST, jobData)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1500))

      expect(waitingSpy).toHaveBeenCalled()
      expect(activeSpy).toHaveBeenCalled()
      expect(completedSpy).toHaveBeenCalled()
    })

    it('should handle job failures and retries', async () => {
      let attempts = 0
      const failingProcessor = vi.fn().mockImplementation(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const failedSpy = vi.fn()
      const completedSpy = vi.fn()

      queue.on('failed', failedSpy)
      queue.on('completed', completedSpy)

      queue.process(JobType.EVALUATION_REQUEST, failingProcessor)

      const jobData: EvaluationRequestJobData = {
        correlationId: 'test-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      }

      await queue.add(JobType.EVALUATION_REQUEST, jobData, {
        attempts: 3,
        backoff: { type: 'fixed', delay: 100 },
      })

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 2500))

      // Should have succeeded on the 3rd attempt
      expect(failingProcessor).toHaveBeenCalledTimes(3)
      expect(completedSpy).toHaveBeenCalled()
    })

    it('should get job by ID', async () => {
      const jobData: EvaluationRequestJobData = {
        correlationId: 'test-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      }

      const addedJob = await queue.add(JobType.EVALUATION_REQUEST, jobData)
      const retrievedJob = await queue.getJob(addedJob.id)

      expect(retrievedJob).toBeDefined()
      expect(retrievedJob!.id).toBe(addedJob.id)
      expect(retrievedJob!.data).toEqual(jobData)
    })

    it('should get metrics', async () => {
      const metrics = await queue.getMetrics()

      expect(metrics).toHaveProperty('waiting')
      expect(metrics).toHaveProperty('active')
      expect(metrics).toHaveProperty('completed')
      expect(metrics).toHaveProperty('failed')
      expect(metrics).toHaveProperty('jobCounts')
      expect(metrics).toHaveProperty('processingTimes')
      expect(metrics).toHaveProperty('errorRate')
      expect(metrics).toHaveProperty('throughput')
    })

    it('should pause and resume processing', async () => {
      const processorSpy = vi.fn().mockResolvedValue('success')
      queue.process(JobType.EVALUATION_REQUEST, processorSpy)

      await queue.pause()

      const jobData: EvaluationRequestJobData = {
        correlationId: 'test-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      }

      await queue.add(JobType.EVALUATION_REQUEST, jobData)

      // Wait a bit to ensure no processing
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(processorSpy).not.toHaveBeenCalled()

      await queue.resume()

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1500))
      expect(processorSpy).toHaveBeenCalled()
    })
  })
})

describe('QueueManager', () => {
  let queueManager: QueueManager

  beforeEach(async () => {
    queueManager = QueueManager.getInstance()
    await queueManager.initialize()
  })

  afterEach(async () => {
    await queueManager.shutdown()
  })

  describe('job management', () => {
    it('should add evaluation request job', async () => {
      const jobData: EvaluationRequestJobData = {
        correlationId: 'eval-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.HIGH,
      }

      const jobId = await queueManager.addEvaluationRequest(jobData)
      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')
    })

    it('should add agent task job', async () => {
      const jobData: AgentTaskJobData = {
        correlationId: 'agent-123',
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentType: 'market-research',
        businessIdea: {
          id: 'idea-123',
          title: 'Test Idea',
          description: 'Test description',
        },
        analysisType: 'market_size',
      }

      const jobId = await queueManager.addAgentTask(jobData)
      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')
    })

    it('should add result processing job', async () => {
      const jobData: ResultProcessingJobData = {
        correlationId: 'result-123',
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentResults: [
          {
            agentType: 'market-research',
            score: 75,
            insights: ['Good market potential'],
            rawData: { marketSize: '$1B' },
          },
        ],
      }

      const jobId = await queueManager.addResultProcessing(jobData)
      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')
    })

    it('should setup and execute processors', async () => {
      const evaluationProcessorSpy = vi.fn().mockResolvedValue(undefined)
      const agentProcessorSpy = vi.fn().mockResolvedValue({ score: 80 })
      const resultProcessorSpy = vi.fn().mockResolvedValue(undefined)

      queueManager.setupEvaluationProcessor(evaluationProcessorSpy)
      queueManager.setupAgentProcessor(agentProcessorSpy)
      queueManager.setupResultProcessor(resultProcessorSpy)

      // Add jobs
      await queueManager.addEvaluationRequest({
        correlationId: 'eval-123',
        timestamp: new Date(),
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: JobPriority.NORMAL,
      })

      await queueManager.addAgentTask({
        correlationId: 'agent-123',
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentType: 'market-research',
        businessIdea: {
          id: 'idea-123',
          title: 'Test Idea',
          description: 'Test description',
        },
        analysisType: 'market_size',
      })

      await queueManager.addResultProcessing({
        correlationId: 'result-123',
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentResults: [],
      })

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      expect(evaluationProcessorSpy).toHaveBeenCalled()
      expect(agentProcessorSpy).toHaveBeenCalled()
      expect(resultProcessorSpy).toHaveBeenCalled()
    })

    it('should get queue metrics', async () => {
      const metrics = await queueManager.getAllMetrics()

      expect(metrics).toHaveProperty('evaluation-queue')
      expect(metrics).toHaveProperty('agent-queue')
      expect(metrics).toHaveProperty('result-queue')

      expect(metrics['evaluation-queue']).toHaveProperty('waiting')
      expect(metrics['evaluation-queue']).toHaveProperty('completed')
    })
  })
})

describe('QueueFactory', () => {
  afterEach(async () => {
    await QueueFactory.closeAllQueues()
  })

  it('should create mock queue by default', async () => {
    const queue = await QueueFactory.createQueue('test-queue')
    expect(queue).toBeInstanceOf(MockQueue)
  })

  it('should return same instance for same queue name', async () => {
    const queue1 = await QueueFactory.createQueue('test-queue')
    const queue2 = await QueueFactory.createQueue('test-queue')
    expect(queue1).toBe(queue2)
  })

  it('should get queue by name', async () => {
    await QueueFactory.createQueue('test-queue')
    const queue = QueueFactory.getQueue('test-queue')
    expect(queue).toBeDefined()
  })

  it('should list queue names', async () => {
    await QueueFactory.createQueue('queue1')
    await QueueFactory.createQueue('queue2')

    const names = QueueFactory.getQueueNames()
    expect(names).toContain('queue1')
    expect(names).toContain('queue2')
  })
})
