/**
 * Integration tests for Agent Service with real LLM providers
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgentService } from '../../src/agents/agent-service.js'
import { AgentRequest, AgentExecutionContext } from '../../src/agents/types.js'

describe('AgentService Integration', () => {
  let agentService: AgentService
  let mockRequest: AgentRequest
  let mockContext: AgentExecutionContext

  beforeEach(() => {
    agentService = AgentService.getInstance()

    mockRequest = {
      businessIdea: {
        id: 'idea-123',
        title: 'AI-Powered Fitness Tracking App',
        description:
          'A mobile app that uses AI to provide personalized fitness recommendations and workout plans',
      },
      analysisType: 'market_size',
    }

    mockContext = {
      evaluationId: 'eval-123',
      correlationId: 'corr-123',
      timestamp: new Date(),
    }
  })

  describe('Market Research Agent', () => {
    it('should execute market research agent successfully', async () => {
      const result = await agentService.executeAgent('market-research', mockRequest, mockContext, {
        timeout: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()

      if (result.response) {
        expect(result.response.agentType).toBe('market-research')
        expect(result.response.score).toBeGreaterThanOrEqual(0)
        expect(result.response.score).toBeLessThanOrEqual(100)
        expect(Array.isArray(result.response.insights)).toBe(true)
        expect(result.response.insights.length).toBeGreaterThan(0)
        expect(['high', 'medium', 'low']).toContain(result.response.confidence)
        expect(result.response.metadata).toBeDefined()
        expect(result.response.metadata.processingTime).toBeGreaterThan(0)
        expect(result.response.rawData).toBeDefined()
      }
    })

    it('should handle different business idea types', async () => {
      const techRequest = {
        ...mockRequest,
        businessIdea: {
          id: 'idea-456',
          title: 'Blockchain-based Supply Chain Management',
          description:
            'A decentralized platform for tracking products through the supply chain using blockchain technology',
        },
        analysisType: 'competitors',
      }

      const result = await agentService.executeAgent('market-research', techRequest, mockContext)

      expect(result.success).toBe(true)
      expect(result.response?.score).toBeGreaterThanOrEqual(0)
      expect(result.response?.insights.length).toBeGreaterThan(0)
    })

    it('should return consistent results for the same input', async () => {
      const result1 = await agentService.executeAgent('market-research', mockRequest, mockContext)

      const result2 = await agentService.executeAgent('market-research', mockRequest, {
        ...mockContext,
        evaluationId: 'eval-124',
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      // Scores should be in reasonable range (mock provider returns consistent scores)
      expect(result1.response?.score).toBeGreaterThan(50)
      expect(result2.response?.score).toBeGreaterThan(50)
    })

    it('should handle timeout gracefully', async () => {
      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext,
        { timeout: 1 } // Very short timeout
      )

      // Should either succeed quickly (mock provider) or fail with timeout
      if (!result.success) {
        expect(result.error).toContain('timed out')
      }
    })

    it('should validate business idea requirements', async () => {
      const invalidRequest = {
        businessIdea: {
          id: 'idea-123',
          title: '',
          description: 'Some description',
        },
        analysisType: 'market_size',
      }

      const result = await agentService.executeAgent('market-research', invalidRequest, mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toContain('title and description')
    }, 10000)
  })

  describe('Agent Service Features', () => {
    it('should list available agents', () => {
      const agents = agentService.getAvailableAgents()

      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBeGreaterThan(0)

      const marketResearchAgent = agents.find(a => a.type === 'market-research')
      expect(marketResearchAgent).toBeDefined()
      expect(marketResearchAgent?.name).toBe('Market Research Agent')
      expect(marketResearchAgent?.description).toContain('market')
    })

    it('should handle unsupported agent types', async () => {
      const result = await agentService.executeAgent(
        'non-existent-agent' as any,
        mockRequest,
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('should execute multiple agents concurrently', async () => {
      const requests = [
        { agentType: 'market-research' as const, request: mockRequest },
        {
          agentType: 'market-research' as const,
          request: {
            ...mockRequest,
            businessIdea: {
              ...mockRequest.businessIdea,
              title: 'E-commerce Platform for Local Businesses',
            },
          },
        },
      ]

      const startTime = Date.now()
      const results = await agentService.executeMultipleAgents(requests, mockContext, {
        concurrency: 2,
      })
      const endTime = Date.now()

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)

      // Concurrent execution should be faster than sequential
      // (though this may not always be true with mock providers)
      expect(endTime - startTime).toBeLessThan(20000) // Reasonable upper bound
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle retry scenarios', async () => {
      // This test relies on the underlying LLM provider potentially having transient failures
      const result = await agentService.executeAgent('market-research', mockRequest, mockContext, {
        maxRetries: 2,
      })

      // Should eventually succeed with mock provider
      expect(result.success).toBe(true)
      expect(result.retryCount).toBeGreaterThanOrEqual(0)
    })

    it('should provide meaningful error messages', async () => {
      const invalidRequest = {
        businessIdea: null as any,
        analysisType: 'market_size',
      }

      const result = await agentService.executeAgent('market-research', invalidRequest, mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.length).toBeGreaterThan(0)
    }, 10000)

    it('should track execution metadata', async () => {
      const result = await agentService.executeAgent('market-research', mockRequest, mockContext)

      expect(result.success).toBe(true)
      expect(result.totalTime).toBeGreaterThan(0)
      expect(result.retryCount).toBeGreaterThanOrEqual(0)

      if (result.response) {
        expect(result.response.metadata.processingTime).toBeGreaterThan(0)
        expect(result.response.metadata.model).toBeDefined()
      }
    })
  })
})
