/**
 * Mock Services Tests
 * Tests for offline development mock implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MockLLMProvider,
  MockQueueManager,
  MockDatabaseManager,
  MockServiceFactory,
} from '../../../src/mock/index.js'
import { MessageType } from '../../../src/communication/message-types.js'

describe('Mock Services', () => {
  describe('MockLLMProvider', () => {
    let provider: MockLLMProvider

    beforeEach(() => {
      provider = new MockLLMProvider({
        simulateLatency: false, // Disable for faster tests
        failureRate: 0,
      })
    })

    it('should provide market research analysis', async () => {
      const result = await provider.analyzeMarketResearch({
        businessIdeaTitle: 'AI Fitness App',
        businessIdeaDescription: 'AI-powered fitness tracking application',
        analysisType: 'comprehensive',
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('marketSize')
      expect(result).toHaveProperty('competitionLevel')
      expect(result).toHaveProperty('marketTrends')
      expect(result).toHaveProperty('opportunities')
      expect(result).toHaveProperty('threats')
      expect(result).toHaveProperty('confidenceScore')
      expect(typeof result.marketSize).toBe('number')
      expect(['low', 'medium', 'high']).toContain(result.competitionLevel)
    })

    it('should use predefined responses when available', async () => {
      const predefinedResponse = {
        content: 'Test market response',
        marketSize: 1000,
        competitionLevel: 'medium' as const,
        score: 85,
      }

      provider.setResponses({
        market_ai_fitness_app: predefinedResponse,
      })

      const result = await provider.analyzeMarketResearch({
        businessIdeaTitle: 'AI Fitness App',
        businessIdeaDescription: 'Test description',
        analysisType: 'comprehensive',
      })

      expect(result.marketSize).toBe(1000)
      expect(result.competitionLevel).toBe('medium')
      expect(result.confidenceScore).toBe(85)
    })

    it('should handle generic LLM queries', async () => {
      const response = await provider.query({
        prompt: 'Analyze the technical feasibility of this solution',
        temperature: 0.7,
        maxTokens: 1000,
      })

      expect(response).toBeDefined()
      expect(response).toHaveProperty('content')
      expect(response).toHaveProperty('usage')
      expect(response).toHaveProperty('model')
      expect(response.content.length).toBeGreaterThan(0)
      expect(response.model).toBe('mock-model')
    })

    it('should simulate failures when configured', async () => {
      provider.setFailureRate(1) // 100% failure rate

      await expect(
        provider.query({
          prompt: 'Test prompt',
          temperature: 0.7,
          maxTokens: 1000,
        })
      ).rejects.toThrow('Simulated LLM provider failure')
    })

    it('should track call counts', async () => {
      expect(provider.getCallCount()).toBe(0)

      await provider.query({ prompt: 'Test 1', temperature: 0.7, maxTokens: 1000 })
      expect(provider.getCallCount()).toBe(1)

      await provider.analyzeMarketResearch({
        businessIdeaTitle: 'Test',
        businessIdeaDescription: 'Test',
        analysisType: 'basic',
      })
      expect(provider.getCallCount()).toBe(2)

      provider.resetCallCount()
      expect(provider.getCallCount()).toBe(0)
    })

    it('should report healthy status', async () => {
      const isHealthy = await provider.isHealthy()
      expect(isHealthy).toBe(true)
    })
  })

  describe('MockQueueManager', () => {
    let queueManager: MockQueueManager

    beforeEach(async () => {
      MockQueueManager.resetInstance()
      queueManager = MockQueueManager.getInstance()
      queueManager.setProcessDelay(10) // Fast processing for tests
      queueManager.setProcessingTimeRange(5, 10) // Very short processing times
      await queueManager.initialize()
    })

    afterEach(async () => {
      await queueManager.shutdown()
      MockQueueManager.resetInstance()
    })

    it('should add and process evaluation jobs', async () => {
      const processor = vi.fn()
      queueManager.setupEvaluationProcessor(processor)

      const jobId = await queueManager.addEvaluationJob({
        businessIdeaId: 'test-idea',
        businessIdeaTitle: 'Test Idea',
        businessIdeaDescription: 'Test Description',
        agentTypes: ['market-research'],
        priority: 'normal',
        userId: 'test-user',
        correlationId: 'test-correlation',
      })

      expect(jobId).toBeDefined()

      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(processor).toHaveBeenCalled()

      const status = await queueManager.getJobStatus(jobId)
      expect(['completed', 'active']).toContain(status)
    })

    it('should handle job retries', async () => {
      const processor = vi.fn().mockRejectedValue(new Error('Test failure'))
      queueManager.setupAgentProcessor(processor)
      queueManager.setFailureRate(0) // Disable random failures

      const jobId = await queueManager.addAgentJob({
        evaluationId: 'test-eval',
        agentType: 'market-research',
        businessIdea: {
          id: 'test-idea',
          title: 'Test',
          description: 'Test',
        },
        analysisType: 'basic',
        correlationId: 'test-correlation',
      })

      // Wait for initial failure and retry
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Should have been called multiple times due to retries
      expect(processor.mock.calls.length).toBeGreaterThan(1)
    })

    it('should provide queue statistics', async () => {
      await queueManager.addEvaluationJob({
        businessIdeaId: 'test-idea',
        businessIdeaTitle: 'Test',
        businessIdeaDescription: 'Test',
        agentTypes: ['market-research'],
        priority: 'normal',
        userId: 'test-user',
        correlationId: 'test-correlation',
      })

      const stats = await queueManager.getQueueStats()

      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('evaluation')
      expect(stats).toHaveProperty('agent')
      expect(stats).toHaveProperty('result')
      expect(stats.evaluation.total).toBeGreaterThan(0)
    })

    it('should support job cancellation', async () => {
      const jobId = await queueManager.addEvaluationJob({
        businessIdeaId: 'test-idea',
        businessIdeaTitle: 'Test',
        businessIdeaDescription: 'Test',
        agentTypes: ['market-research'],
        priority: 'normal',
        userId: 'test-user',
        correlationId: 'test-correlation',
      })

      const cancelled = await queueManager.cancelJob(jobId)
      expect(cancelled).toBe(true)

      const status = await queueManager.getJobStatus(jobId)
      expect(status).toBe('failed')
    })
  })

  describe('MockDatabaseManager', () => {
    let dbManager: MockDatabaseManager

    beforeEach(async () => {
      MockDatabaseManager.resetInstance()
      dbManager = MockDatabaseManager.getInstance({
        simulateLatency: false, // Disable for faster tests
      })
      await dbManager.initialize()
    })

    afterEach(async () => {
      await dbManager.shutdown()
      MockDatabaseManager.resetInstance()
    })

    it('should execute SELECT queries', async () => {
      const result = await dbManager.query('SELECT * FROM users')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('email')
    })

    it('should execute INSERT queries', async () => {
      const result = await dbManager.query(
        'INSERT INTO evaluations (business_idea_id, priority) VALUES ($1, $2) RETURNING *',
        ['test-idea-123', 'high']
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
      expect(result[0]).toHaveProperty('id')
      expect(result[0].business_idea_id).toBe('test-idea-123')
      expect(result[0].priority).toBe('high')
    })

    it('should execute UPDATE queries', async () => {
      // First insert a record
      const insertResult = await dbManager.query(
        'INSERT INTO evaluations (business_idea_id, priority) VALUES ($1, $2) RETURNING *',
        ['test-idea-456', 'normal']
      )

      const evaluationId = insertResult[0].id

      // Then update it
      const updateResult = await dbManager.query(
        'UPDATE evaluations SET status = $1 WHERE id = $2 RETURNING *',
        ['completed', evaluationId]
      )

      expect(updateResult.length).toBe(1)
      expect(updateResult[0].status).toBe('completed')
    })

    it('should handle COUNT queries', async () => {
      const result = await dbManager.query('SELECT COUNT(*) FROM users')

      expect(result.length).toBe(1)
      expect(result[0]).toHaveProperty('count')
      expect(typeof result[0].count).toBe('string')
    })

    it('should provide connection management', async () => {
      const client = await dbManager.getClient()

      expect(client).toBeDefined()
      expect(typeof client.query).toBe('function')
      expect(typeof client.release).toBe('function')

      const queryResult = await client.query('SELECT 1')
      expect(queryResult.rows).toBeDefined()

      client.release()
    })

    it('should track query count', () => {
      const initialCount = dbManager.getQueryCount()
      expect(typeof initialCount).toBe('number')
    })

    it('should provide health check', async () => {
      const isHealthy = await dbManager.healthCheck()
      expect(isHealthy).toBe(true)
    })

    it('should handle table operations', () => {
      // Insert test data
      dbManager.insertTestData('users', [
        { id: 'test-user-1', email: 'test@example.com', name: 'Test User' },
      ])

      const userData = dbManager.getTableData('users')
      const testUser = userData.find(u => u.id === 'test-user-1')
      expect(testUser).toBeDefined()
      expect(testUser.email).toBe('test@example.com')
    })
  })

  describe('MockServiceFactory', () => {
    it('should create complete mock environment', async () => {
      const mockEnv = await MockServiceFactory.createMockEnvironment({
        predefinedResponses: {
          test_response: {
            content: 'Test response',
            score: 90,
          },
        },
      })

      expect(mockEnv).toBeDefined()
      expect(mockEnv).toHaveProperty('llmProvider')
      expect(mockEnv).toHaveProperty('queueManager')
      expect(mockEnv).toHaveProperty('databaseManager')

      // Test that services are working
      const llmResponse = await mockEnv.llmProvider.query({
        prompt: 'Test prompt',
        temperature: 0.7,
        maxTokens: 1000,
      })
      expect(llmResponse.content).toBeDefined()

      const queueStats = await mockEnv.queueManager.getQueueStats()
      expect(queueStats).toBeDefined()

      const dbHealth = await mockEnv.databaseManager.healthCheck()
      expect(dbHealth).toBe(true)

      // Cleanup
      await mockEnv.queueManager.shutdown()
      await mockEnv.databaseManager.shutdown()
    })

    it('should provide test scenarios', () => {
      const scenarios = MockServiceFactory.createTestScenarios()

      expect(scenarios).toBeDefined()
      expect(scenarios).toHaveProperty('market_fitness_app')
      expect(scenarios).toHaveProperty('market_sustainable_packaging')
      expect(scenarios.market_fitness_app).toHaveProperty('marketSize')
      expect(scenarios.market_fitness_app).toHaveProperty('score')
    })

    it('should provide demo data', () => {
      const demoData = MockServiceFactory.createDemoData()

      expect(demoData).toBeDefined()
      expect(demoData).toHaveProperty('users')
      expect(demoData).toHaveProperty('businessIdeas')
      expect(demoData).toHaveProperty('evaluations')
      expect(demoData).toHaveProperty('agentResults')

      expect(Array.isArray(demoData.users)).toBe(true)
      expect(demoData.users.length).toBeGreaterThan(0)
      expect(demoData.businessIdeas.length).toBeGreaterThan(0)
    })
  })
})
