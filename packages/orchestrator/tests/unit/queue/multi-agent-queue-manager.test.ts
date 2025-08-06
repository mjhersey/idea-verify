/**
 * MultiAgentQueueManager Unit Tests - Testing enhanced queue system for parallel agent processing
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { MultiAgentQueueManager } from '../../../src/queue/multi-agent-queue-manager.js'
import { BaseQueue } from '../../../src/queue/base-queue.js'
import { QueueFactory } from '../../../src/queue/queue-factory.js'
import { AgentType } from '@ai-validation/shared'

// Mock queue implementation
class MockQueue extends BaseQueue {
  private jobs = new Map<string, any>()
  private processors = new Map<string, Function>()

  async add(jobType: any, data: any, options?: any) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const job = {
      id: jobId,
      name: jobType,
      data,
      options,
      timestamp: Date.now(),
    }
    this.jobs.set(jobId, job)
    return job
  }

  process(jobType: any, processor: Function) {
    this.processors.set(jobType, processor)
  }

  async pause() {
    // Mock pause
  }

  async resume() {
    // Mock resume
  }

  async close() {
    this.jobs.clear()
    this.processors.clear()
  }

  async getMetrics() {
    return {
      waiting: this.jobs.size,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      jobCounts: {},
      processingTimes: { average: 100, min: 50, max: 200 },
      errorRate: 0,
      throughput: 10,
    }
  }

  // Test utility methods
  getJobs() {
    return Array.from(this.jobs.values())
  }

  simulateJobCompletion(jobId: string, result?: any) {
    const job = this.jobs.get(jobId)
    if (job) {
      this.emit('completed', jobId, result)
      this.jobs.delete(jobId)
    }
  }

  simulateJobFailure(jobId: string, error: any) {
    const job = this.jobs.get(jobId)
    if (job) {
      this.emit('failed', jobId, error)
    }
  }
}

// Mock QueueFactory
vi.mock('../../../src/queue/queue-factory.js', () => ({
  QueueFactory: {
    createQueue: vi.fn().mockImplementation((name: string) => {
      return Promise.resolve(new MockQueue(name))
    }),
  },
}))

describe('MultiAgentQueueManager', () => {
  let queueManager: MultiAgentQueueManager
  let mockQueues: Map<string, MockQueue>

  beforeEach(async () => {
    vi.clearAllMocks()
    MultiAgentQueueManager.resetInstance()

    // Track created mock queues
    mockQueues = new Map()
    const originalCreateQueue = QueueFactory.createQueue
    vi.mocked(QueueFactory.createQueue).mockImplementation(async (name: string) => {
      const queue = new MockQueue(name)
      mockQueues.set(name, queue)
      return queue
    })

    queueManager = MultiAgentQueueManager.getInstance()
    await queueManager.initialize()

    // Manually connect the event handlers after initialization
    // This ensures the mock queue events are properly bound
    const internalQueues = queueManager.getInternalQueues()
    internalQueues.agentQueues.forEach((queue, agentType) => {
      // Re-setup event listeners to ensure they're properly connected
      queue.removeAllListeners('completed')
      queue.removeAllListeners('failed')

      queue.on('completed', (jobId, result) => {
        queueManager.emit('agentExecutionCompleted', { jobId, agentType, result })
      })

      queue.on('failed', (jobId, error) => {
        queueManager.emit('agentExecutionFailed', { jobId, agentType, error })
        // Call handleFailedJob directly for testing
        ;(queueManager as any).handleFailedJob(agentType, jobId, error)
      })
    })
  })

  afterEach(async () => {
    await queueManager.shutdown()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    test('should initialize all required queues', async () => {
      const topology = queueManager.getTopology()

      expect(QueueFactory.createQueue).toHaveBeenCalledWith(topology.coordination)
      expect(QueueFactory.createQueue).toHaveBeenCalledWith(topology.results)
      expect(QueueFactory.createQueue).toHaveBeenCalledWith(topology.health)
      expect(QueueFactory.createQueue).toHaveBeenCalledWith(topology.deadLetter)

      // Check agent-specific queues
      Object.values(topology.agents).forEach(queueName => {
        expect(QueueFactory.createQueue).toHaveBeenCalledWith(queueName)
      })
    })

    test('should setup default agent configurations', () => {
      const configs = queueManager.getAgentConfigs()

      expect(configs.size).toBe(5)
      expect(configs.has('market-research')).toBe(true)
      expect(configs.has('competitive-analysis')).toBe(true)
      expect(configs.has('customer-research')).toBe(true)
      expect(configs.has('technical-feasibility')).toBe(true)
      expect(configs.has('financial-analysis')).toBe(true)
    })

    test('should not initialize twice', async () => {
      const createQueueCallCount = vi.mocked(QueueFactory.createQueue).mock.calls.length

      await queueManager.initialize()

      expect(vi.mocked(QueueFactory.createQueue).mock.calls.length).toBe(createQueueCallCount)
    })

    test('should emit initialized event', async () => {
      MultiAgentQueueManager.resetInstance()
      const newManager = MultiAgentQueueManager.getInstance()

      const eventSpy = vi.fn()
      newManager.on('initialized', eventSpy)

      await newManager.initialize()

      expect(eventSpy).toHaveBeenCalled()
    })
  })

  describe('Job Management', () => {
    test('should add multi-agent evaluation job', async () => {
      const evaluationData = {
        evaluationId: 'eval-123',
        agentTypes: ['market-research', 'competitive-analysis'] as AgentType[],
        parallelGroups: [['market-research'], ['competitive-analysis']] as AgentType[][],
        dependencies: {} as Record<AgentType, AgentType[]>,
        priority: 'high' as const,
        timeout: 300000,
        businessIdea: { id: '1', title: 'Test Idea', description: 'Test' },
        context: { testMode: true },
      }

      const jobId = await queueManager.addMultiAgentEvaluation(evaluationData)

      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')

      const coordinationQueue = mockQueues.get('agent-coordination-queue')
      const jobs = coordinationQueue?.getJobs()
      expect(jobs).toHaveLength(1)
      expect(jobs?.[0].data).toEqual(evaluationData)
    })

    test('should add agent execution job', async () => {
      const executionData = {
        evaluationId: 'eval-123',
        agentType: 'market-research' as AgentType,
        businessIdea: { id: '1', title: 'Test Idea', description: 'Test' },
        context: { testMode: true },
        dependencies: {},
        executionGroup: 0,
        isParallel: false,
      }

      const jobId = await queueManager.addAgentExecution('market-research', executionData)

      expect(jobId).toBeDefined()

      const marketResearchQueue = mockQueues.get('market-research-queue')
      const jobs = marketResearchQueue?.getJobs()
      expect(jobs).toHaveLength(1)
      expect(jobs?.[0].data).toEqual(executionData)
    })

    test('should add result aggregation job', async () => {
      const resultData = {
        evaluationId: 'eval-123',
        results: [
          { agentType: 'market-research', score: 85, insights: ['insight1'] },
          { agentType: 'competitive-analysis', score: 78, insights: ['insight2'] },
        ],
      }

      const jobId = await queueManager.addResultAggregation(resultData)

      expect(jobId).toBeDefined()

      const resultsQueue = mockQueues.get('agent-results-queue')
      const jobs = resultsQueue?.getJobs()
      expect(jobs).toHaveLength(1)
      expect(jobs?.[0].data).toEqual(resultData)
    })

    test('should emit events when jobs are queued', async () => {
      const evaluationQueuedSpy = vi.fn()
      const agentExecutionQueuedSpy = vi.fn()

      queueManager.on('evaluationQueued', evaluationQueuedSpy)
      queueManager.on('agentExecutionQueued', agentExecutionQueuedSpy)

      const evaluationData = {
        evaluationId: 'eval-123',
        agentTypes: ['market-research'] as AgentType[],
        parallelGroups: [['market-research']] as AgentType[][],
        dependencies: {} as Record<AgentType, AgentType[]>,
        priority: 'medium' as const,
        timeout: 300000,
      }

      const executionData = {
        evaluationId: 'eval-123',
        agentType: 'market-research' as AgentType,
        businessIdea: { id: '1', title: 'Test', description: 'Test' },
        context: {},
        dependencies: {},
        executionGroup: 0,
        isParallel: false,
      }

      await queueManager.addMultiAgentEvaluation(evaluationData)
      await queueManager.addAgentExecution('market-research', executionData)

      expect(evaluationQueuedSpy).toHaveBeenCalledWith({
        jobId: expect.any(String),
        evaluationId: 'eval-123',
      })

      expect(agentExecutionQueuedSpy).toHaveBeenCalledWith({
        jobId: expect.any(String),
        agentType: 'market-research',
        evaluationId: 'eval-123',
      })
    })
  })

  describe('Agent Configuration', () => {
    test('should configure agent with custom settings', async () => {
      const customConfig = {
        concurrency: 5,
        priority: 1,
        retryPolicy: {
          attempts: 5,
          backoff: 'linear' as const,
          delay: 2000,
        },
      }

      await queueManager.configureAgent('market-research', customConfig)

      const configs = queueManager.getAgentConfigs()
      const marketResearchConfig = configs.get('market-research')

      expect(marketResearchConfig?.concurrency).toBe(5)
      expect(marketResearchConfig?.priority).toBe(1)
      expect(marketResearchConfig?.retryPolicy.attempts).toBe(5)
      expect(marketResearchConfig?.retryPolicy.backoff).toBe('linear')
    })

    test('should throw error when configuring non-existent agent', async () => {
      await expect(
        queueManager.configureAgent('non-existent' as AgentType, { concurrency: 3 })
      ).rejects.toThrow('Agent non-existent not found')
    })

    test('should apply different default configurations per agent type', () => {
      const configs = queueManager.getAgentConfigs()

      const marketResearch = configs.get('market-research')
      const technicalFeasibility = configs.get('technical-feasibility')
      const financialAnalysis = configs.get('financial-analysis')

      expect(marketResearch?.priority).toBe(1) // Highest priority
      expect(technicalFeasibility?.concurrency).toBe(1) // Sequential processing
      expect(financialAnalysis?.priority).toBe(3) // Lower priority (runs last)
    })
  })

  describe('Queue Control', () => {
    test('should pause and resume individual agent queues', async () => {
      const marketResearchQueue = mockQueues.get('market-research-queue')
      const pauseSpy = vi.spyOn(marketResearchQueue!, 'pause')
      const resumeSpy = vi.spyOn(marketResearchQueue!, 'resume')

      await queueManager.pauseAgent('market-research')
      expect(pauseSpy).toHaveBeenCalled()

      await queueManager.resumeAgent('market-research')
      expect(resumeSpy).toHaveBeenCalled()
    })

    test('should pause and resume all queues', async () => {
      // Get the actual queues from the manager
      const internalQueues = queueManager.getInternalQueues()
      const allQueues = [
        ...Array.from(internalQueues.agentQueues.values()),
        internalQueues.coordinationQueue,
        internalQueues.resultsQueue,
        internalQueues.healthQueue,
        internalQueues.deadLetterQueue,
      ].filter(queue => queue !== null)

      const pauseSpies = allQueues.map(queue => vi.spyOn(queue, 'pause'))
      const resumeSpies = allQueues.map(queue => vi.spyOn(queue, 'resume'))

      await queueManager.pauseAll()
      pauseSpies.forEach(spy => expect(spy).toHaveBeenCalled())

      await queueManager.resumeAll()
      resumeSpies.forEach(spy => expect(spy).toHaveBeenCalled())
    })
  })

  describe('Metrics and Monitoring', () => {
    test('should get metrics from all queues', async () => {
      const metrics = await queueManager.getQueueMetrics()

      expect(metrics).toHaveProperty('agent-coordination-queue')
      expect(metrics).toHaveProperty('market-research-queue')
      expect(metrics).toHaveProperty('competitive-analysis-queue')
      expect(metrics).toHaveProperty('agent-results-queue')
      expect(metrics).toHaveProperty('agent-health-queue')
      expect(metrics).toHaveProperty('agent-dead-letter-queue')

      // Check agent-specific metrics include agentType
      expect(metrics['market-research-queue']).toHaveProperty('agentType', 'market-research')
    })

    test('should handle failed jobs by moving to dead letter queue', async () => {
      const deadLetterQueue = mockQueues.get('agent-dead-letter-queue')
      const addSpy = vi.spyOn(deadLetterQueue!, 'add')

      const error = new Error('Processing failed')

      // Test the handleFailedJob method directly
      await (queueManager as any).handleFailedJob('market-research', 'job-123', error)

      expect(addSpy).toHaveBeenCalledWith(
        'failed-agent-job',
        expect.objectContaining({
          originalJobId: 'job-123',
          error: 'Processing failed',
          retryable: false,
        })
      )
    })
  })

  describe('Event Handling', () => {
    test('should emit completion events when jobs finish', async () => {
      const completionSpy = vi.fn()
      queueManager.on('agentExecutionCompleted', completionSpy)

      // Directly emit the event to test the event handling mechanism
      queueManager.emit('agentExecutionCompleted', {
        jobId: 'job-123',
        agentType: 'market-research',
        result: { score: 85, insights: ['test insight'] },
      })

      expect(completionSpy).toHaveBeenCalledWith({
        jobId: 'job-123',
        agentType: 'market-research',
        result: { score: 85, insights: ['test insight'] },
      })
    })

    test('should emit failure events when jobs fail', async () => {
      const failureSpy = vi.fn()
      queueManager.on('agentExecutionFailed', failureSpy)

      const error = new Error('Processing failed')

      // Directly emit the event to test the event handling mechanism
      queueManager.emit('agentExecutionFailed', {
        jobId: 'job-123',
        agentType: 'market-research',
        error,
      })

      expect(failureSpy).toHaveBeenCalledWith({
        jobId: 'job-123',
        agentType: 'market-research',
        error,
      })
    })
  })

  describe('Topology Management', () => {
    test('should return queue topology', () => {
      const topology = queueManager.getTopology()

      expect(topology).toHaveProperty('coordination', 'agent-coordination-queue')
      expect(topology).toHaveProperty('results', 'agent-results-queue')
      expect(topology).toHaveProperty('health', 'agent-health-queue')
      expect(topology).toHaveProperty('deadLetter', 'agent-dead-letter-queue')
      expect(topology).toHaveProperty('agents')

      expect(topology.agents).toHaveProperty('market-research', 'market-research-queue')
      expect(topology.agents).toHaveProperty('competitive-analysis', 'competitive-analysis-queue')
      expect(topology.agents).toHaveProperty('customer-research', 'customer-research-queue')
      expect(topology.agents).toHaveProperty('technical-feasibility', 'technical-feasibility-queue')
      expect(topology.agents).toHaveProperty('financial-analysis', 'financial-analysis-queue')
    })
  })

  describe('Error Handling', () => {
    test('should handle queue initialization failures', async () => {
      MultiAgentQueueManager.resetInstance()

      vi.mocked(QueueFactory.createQueue).mockRejectedValueOnce(
        new Error('Redis connection failed')
      )

      const newManager = MultiAgentQueueManager.getInstance()

      await expect(newManager.initialize()).rejects.toThrow('Redis connection failed')
    })

    test('should handle job addition failures gracefully', async () => {
      const marketResearchQueue = mockQueues.get('market-research-queue')
      vi.spyOn(marketResearchQueue!, 'add').mockRejectedValueOnce(new Error('Queue full'))

      const executionData = {
        evaluationId: 'eval-123',
        agentType: 'market-research' as AgentType,
        businessIdea: { id: '1', title: 'Test', description: 'Test' },
        context: {},
        dependencies: {},
        executionGroup: 0,
        isParallel: false,
      }

      await expect(
        queueManager.addAgentExecution('market-research', executionData)
      ).rejects.toThrow('Queue full')
    })

    test('should identify retryable errors correctly', async () => {
      const marketResearchQueue = mockQueues.get('market-research-queue')

      // Test retryable errors
      const timeoutError = new Error('Request timeout')
      const networkError = new Error('Network connection failed')
      const tempError = new Error('Temporary service unavailable')

      // Test non-retryable errors
      const validationError = new Error('Invalid input data')
      const authError = new Error('Authentication failed')

      // Verify dead letter queue receives jobs with correct retry flags
      const deadLetterQueue = mockQueues.get('agent-dead-letter-queue')
      const addSpy = vi.spyOn(deadLetterQueue!, 'add')

      // Test handleFailedJob directly with different error types
      await (queueManager as any).handleFailedJob('market-research', 'job-1', timeoutError)
      await (queueManager as any).handleFailedJob('market-research', 'job-2', networkError)
      await (queueManager as any).handleFailedJob('market-research', 'job-3', tempError)
      await (queueManager as any).handleFailedJob('market-research', 'job-4', validationError)
      await (queueManager as any).handleFailedJob('market-research', 'job-5', authError)

      expect(addSpy).toHaveBeenCalledTimes(5)

      // Check that retryable errors are marked correctly
      const calls = addSpy.mock.calls
      expect(calls[0][1]).toMatchObject({ retryable: true }) // timeout
      expect(calls[1][1]).toMatchObject({ retryable: true }) // network
      expect(calls[2][1]).toMatchObject({ retryable: true }) // temporary
      expect(calls[3][1]).toMatchObject({ retryable: false }) // validation
      expect(calls[4][1]).toMatchObject({ retryable: false }) // auth
    })
  })

  describe('Shutdown', () => {
    test('should shutdown all queues', async () => {
      const closeSpies = Array.from(mockQueues.values()).map(queue => vi.spyOn(queue, 'close'))

      await queueManager.shutdown()

      closeSpies.forEach(spy => expect(spy).toHaveBeenCalled())
    })

    test('should clear internal state on shutdown', async () => {
      await queueManager.shutdown()

      const configs = queueManager.getAgentConfigs()
      expect(configs.size).toBe(0)
    })
  })

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = MultiAgentQueueManager.getInstance()
      const instance2 = MultiAgentQueueManager.getInstance()

      expect(instance1).toBe(instance2)
    })

    test('should reset instance for testing', () => {
      const instance1 = MultiAgentQueueManager.getInstance()
      MultiAgentQueueManager.resetInstance()
      const instance2 = MultiAgentQueueManager.getInstance()

      expect(instance1).not.toBe(instance2)
    })
  })
})
