/**
 * Enhanced Market Research Agent Tests
 * Tests for Story 2.2 Task 1 implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MarketResearchAgent } from '../../src/agents/market-research-agent.js'
import { AgentRequest, AgentExecutionContext } from '../../src/agents/types.js'

describe('Enhanced Market Research Agent - Story 2.2 Task 1', () => {
  let agent: MarketResearchAgent
  let mockRequest: AgentRequest
  let mockContext: AgentExecutionContext

  beforeEach(() => {
    agent = new MarketResearchAgent()

    mockRequest = {
      businessIdea: {
        title: 'AI-Powered Educational Platform',
        description:
          'An AI-driven platform that personalizes learning experiences for students across different subjects and skill levels',
      },
      analysisType: 'market_size',
    }

    mockContext = {
      evaluationId: 'test-eval-001',
      requestId: 'test-req-001',
      agentId: 'market-research-agent',
      timestamp: new Date(),
      timeoutMs: 120000,
      retryCount: 0,
    }
  })

  describe('Enhanced Capabilities', () => {
    it('should have enhanced agent name and capabilities', () => {
      expect(agent.getName()).toBe('Enhanced Market Research Agent')
      expect(agent.getDescription()).toContain('TAM/SAM/SOM')
      expect(agent.getDescription()).toContain('0-100 opportunity scoring')

      const capabilities = agent.getCapabilities()
      expect(capabilities.provides).toContain('tam-sam-som-analysis')
      expect(capabilities.provides).toContain('opportunity-score')
      expect(capabilities.provides).toContain('confidence-assessment')
      expect(capabilities.version).toBe('2.2.0')
    })

    it('should execute comprehensive TAM/SAM/SOM analysis', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify basic structure
      expect(result).toBeDefined()
      expect(result.agentType).toBe('market-research')
      expect(result.score).toBeGreaterThan(0)
      expect(result.score).toBeLessThanOrEqual(100)

      // Verify enhanced insights include TAM/SAM/SOM
      expect(
        result.insights.some(insight => insight.includes('Total Addressable Market (TAM)'))
      ).toBe(true)

      expect(
        result.insights.some(insight => insight.includes('Serviceable Addressable Market (SAM)'))
      ).toBe(true)

      expect(
        result.insights.some(insight => insight.includes('Serviceable Obtainable Market (SOM)'))
      ).toBe(true)

      // Verify methodology information
      expect(
        result.insights.some(
          insight =>
            insight.includes('top-down') ||
            insight.includes('bottom-up') ||
            insight.includes('value-theory')
        )
      ).toBe(true)
    })

    it('should provide opportunity scoring (0-100 scale)', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify opportunity score is in proper range
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)

      // Verify opportunity score insights
      expect(
        result.insights.some(
          insight => insight.includes('Market opportunity score:') && insight.includes('/100')
        )
      ).toBe(true)

      // Verify component scores are mentioned
      expect(
        result.insights.some(
          insight => insight.includes('Strongest factor:') || insight.includes('Key challenge:')
        )
      ).toBe(true)
    })

    it('should include confidence assessment', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify confidence level is provided
      expect(['high', 'medium', 'low']).toContain(result.confidence)

      // Verify confidence assessment in insights
      expect(
        result.insights.some(
          insight => insight.includes('Analysis confidence:') && insight.includes('data quality')
        )
      ).toBe(true)
    })

    it('should provide growth rate analysis', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify growth rate analysis
      expect(
        result.insights.some(
          insight => insight.includes('Market growing at') && insight.includes('% annually')
        )
      ).toBe(true)
    })

    it('should include competitive landscape analysis', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify competitive analysis
      expect(
        result.insights.some(
          insight => insight.includes('competitors with') && insight.includes('structure')
        )
      ).toBe(true)

      expect(result.insights.some(insight => insight.includes('Entry barriers are'))).toBe(true)
    })

    it('should track methodology and assumptions', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify enhanced metadata
      expect(result.metadata.model).toBe('enhanced-market-research-v2.2')
      expect(result.metadata.processingTime).toBeGreaterThan(0)

      // Verify raw data includes comprehensive output
      expect(result.rawData.marketResearchOutput).toBeDefined()
      expect(result.rawData.marketResearchOutput.marketSize).toBeDefined()
      expect(result.rawData.marketResearchOutput.opportunityScore).toBeDefined()
      expect(result.rawData.marketResearchOutput.assumptions).toBeDefined()
      expect(result.rawData.marketResearchOutput.recommendations).toBeDefined()
    })

    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now()
      const result = await agent.execute(mockRequest, mockContext)
      const executionTime = Date.now() - startTime

      // Should complete well within 5 minutes (300,000ms) as per story requirements
      expect(executionTime).toBeLessThan(10000) // 10 seconds is reasonable for test
      expect(result.metadata.processingTime).toBeLessThan(10000)
    })

    it('should handle different business categories appropriately', async () => {
      const techRequest = {
        ...mockRequest,
        businessIdea: {
          title: 'SaaS Platform',
          description: 'A cloud-based software solution for small businesses',
        },
      }

      const healthcareRequest = {
        ...mockRequest,
        businessIdea: {
          title: 'Telemedicine App',
          description: 'A mobile app for remote medical consultations',
        },
      }

      const techResult = await agent.execute(techRequest, mockContext)
      const healthcareResult = await agent.execute(healthcareRequest, mockContext)

      // Both should execute successfully but may have different scores
      expect(techResult.score).toBeGreaterThan(0)
      expect(healthcareResult.score).toBeGreaterThan(0)

      // Both should include TAM/SAM/SOM analysis
      expect(techResult.insights.some(i => i.includes('TAM'))).toBe(true)
      expect(healthcareResult.insights.some(i => i.includes('TAM'))).toBe(true)
    })
  })

  describe('Multiple Methodology Framework', () => {
    it('should reference multiple calculation approaches', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify that the analysis mentions methodology approaches
      const rawOutput = result.rawData.marketResearchOutput
      expect(rawOutput.marketSize.tam.methodology).toMatch(/(top-down|bottom-up|value-theory)/)
      expect(rawOutput.marketSize.sam.methodology).toMatch(/(top-down|bottom-up|value-theory)/)
      expect(rawOutput.marketSize.som.methodology).toMatch(/(top-down|bottom-up|value-theory)/)
    })

    it('should provide confidence ratings for each methodology', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      const rawOutput = result.rawData.marketResearchOutput
      expect(rawOutput.marketSize.tam.confidence).toBeGreaterThan(0)
      expect(rawOutput.marketSize.tam.confidence).toBeLessThanOrEqual(100)
      expect(rawOutput.marketSize.sam.confidence).toBeGreaterThan(0)
      expect(rawOutput.marketSize.som.confidence).toBeGreaterThan(0)
    })

    it('should include data sources and assumptions', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      const rawOutput = result.rawData.marketResearchOutput
      expect(rawOutput.marketSize.tam.dataSources).toBeDefined()
      expect(rawOutput.marketSize.tam.assumptions).toBeDefined()
      expect(rawOutput.assumptions).toBeDefined()
      expect(rawOutput.assumptions.length).toBeGreaterThan(0)
    })
  })

  describe('Story 2.2 Task 1 Acceptance Criteria', () => {
    it('should satisfy AC1: Agent analyzes market size (TAM/SAM/SOM calculations)', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      const rawOutput = result.rawData.marketResearchOutput

      // Verify TAM/SAM/SOM are calculated
      expect(rawOutput.marketSize.tam.value).toBeGreaterThan(0)
      expect(rawOutput.marketSize.sam.value).toBeGreaterThan(0)
      expect(rawOutput.marketSize.som.value).toBeGreaterThan(0)

      // Verify hierarchy: TAM >= SAM >= SOM
      expect(rawOutput.marketSize.tam.value).toBeGreaterThanOrEqual(rawOutput.marketSize.sam.value)
      expect(rawOutput.marketSize.sam.value).toBeGreaterThanOrEqual(rawOutput.marketSize.som.value)
    })

    it('should satisfy AC4: Generates market opportunity score (0-100)', async () => {
      const result = await agent.execute(mockRequest, mockContext)

      // Verify score is in 0-100 range
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)

      // Verify detailed opportunity scoring
      const rawOutput = result.rawData.marketResearchOutput
      expect(rawOutput.opportunityScore.overall).toBe(result.score)
      expect(rawOutput.opportunityScore.components).toBeDefined()
      expect(rawOutput.opportunityScore.components.marketSize).toBeDefined()
      expect(rawOutput.opportunityScore.components.growth).toBeDefined()
      expect(rawOutput.opportunityScore.components.competition).toBeDefined()
    })
  })
})
