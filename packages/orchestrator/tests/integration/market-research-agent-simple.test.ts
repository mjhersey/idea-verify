/**
 * Simple test for Market Research Agent to debug mocking issues
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MarketResearchAgent } from '../../src/agents/market-research-agent.js'
import { AgentRequest, AgentExecutionContext } from '../../src/agents/types.js'

describe('MarketResearchAgent - Simple', () => {
  let agent: MarketResearchAgent
  let mockRequest: AgentRequest
  let mockContext: AgentExecutionContext

  beforeEach(() => {
    agent = new MarketResearchAgent()

    mockRequest = {
      businessIdea: {
        id: 'idea-123',
        title: 'AI-Powered Fitness Tracking App',
        description: 'A mobile app that uses AI to provide personalized fitness recommendations',
      },
      analysisType: 'market_size',
    }

    mockContext = {
      evaluationId: 'eval-123',
      correlationId: 'corr-123',
      timestamp: new Date(),
    }
  })

  it('should have correct agent properties', () => {
    expect(agent.getAgentType()).toBe('market-research')
    expect(agent.getName()).toBe('Market Research Agent')
    expect(agent.getDescription()).toContain('market size')
  })

  it('should validate required request fields', async () => {
    const invalidRequest = {
      businessIdea: null as any,
      analysisType: 'market_size',
    }

    await expect(agent.execute(invalidRequest, mockContext)).rejects.toThrow(
      'Business idea is required'
    )
  })

  it('should validate business idea structure', async () => {
    const invalidRequest = {
      businessIdea: {
        id: 'idea-123',
        title: '',
        description: 'Some description',
      },
      analysisType: 'market_size',
    }

    await expect(agent.execute(invalidRequest, mockContext)).rejects.toThrow(
      'Business idea must have title and description'
    )
  })

  it('should validate analysis type', async () => {
    const invalidRequest = {
      businessIdea: mockRequest.businessIdea,
      analysisType: '',
    }

    await expect(agent.execute(invalidRequest, mockContext)).rejects.toThrow(
      'Analysis type is required'
    )
  })

  it('should handle LLM provider failure gracefully', async () => {
    // This test will use the actual LLM provider factory,
    // which should use the mock provider in test environment
    const result = await agent.execute(mockRequest, mockContext)

    // The result should indicate a successful execution
    // Even if the mock provider returns basic data
    expect(result).toBeDefined()
    expect(result.agentType).toBe('market-research')
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(result.insights)).toBe(true)
    expect(['high', 'medium', 'low']).toContain(result.confidence)
    expect(result.metadata).toBeDefined()
    expect(result.rawData).toBeDefined()
  })
})
