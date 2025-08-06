/**
 * Unit tests for LLM Providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MockProvider } from '../../src/llm/mock-provider.js'
import { ProviderFactory } from '../../src/llm/provider-factory.js'
import { LLMProvider, MarketResearchPromptInput } from '../../src/llm/types.js'

describe('MockProvider', () => {
  let mockProvider: MockProvider

  beforeEach(() => {
    mockProvider = new MockProvider()
  })

  describe('basic functionality', () => {
    it('should be available', async () => {
      const available = await mockProvider.isAvailable()
      expect(available).toBe(true)
    })

    it('should return mock response for generic prompts', async () => {
      const response = await mockProvider.invoke('Test prompt')
      expect(response.content).toContain('Mock response for: Test prompt')
      expect(response.provider).toBe(LLMProvider.MOCK)
      expect(response.model).toBe('mock-model-v1')
    })

    it('should include usage statistics', async () => {
      const response = await mockProvider.invoke('Test prompt for token counting')
      expect(response.usage).toBeDefined()
      expect(response.usage?.promptTokens).toBeGreaterThan(0)
      expect(response.usage?.completionTokens).toBeGreaterThan(0)
      expect(response.usage?.totalTokens).toBeGreaterThan(0)
    })
  })

  describe('market research analysis', () => {
    const testBusinessIdea = {
      title: 'AI-Powered Test App',
      description: 'An innovative application for testing purposes',
    }

    it('should analyze market size', async () => {
      const input: MarketResearchPromptInput = {
        businessIdea: testBusinessIdea,
        analysisType: 'market_size',
      }

      const result = await mockProvider.analyzeMarketResearch(input)

      expect(result.marketSize).toBeDefined()
      expect(result.marketSize?.totalAddressableMarket).toBe('$45B')
      expect(result.marketSize?.growthRate).toBe('22% annually')
      expect(result.score).toBe(75)
      expect(result.confidence).toBe('high')
      expect(result.insights).toHaveLength(3)
    })

    it('should analyze competitors', async () => {
      const input: MarketResearchPromptInput = {
        businessIdea: testBusinessIdea,
        analysisType: 'competitors',
      }

      const result = await mockProvider.analyzeMarketResearch(input)

      expect(result.competitors).toBeDefined()
      expect(result.competitors).toHaveLength(2)
      expect(result.competitors?.[0].name).toBe('Established Corp')
      expect(result.score).toBe(68)
      expect(result.confidence).toBe('medium')
    })

    it('should analyze trends', async () => {
      const input: MarketResearchPromptInput = {
        businessIdea: testBusinessIdea,
        analysisType: 'trends',
      }

      const result = await mockProvider.analyzeMarketResearch(input)

      expect(result.trends).toBeDefined()
      expect(result.trends).toHaveLength(3)
      expect(result.trends?.[0].trend).toBe('AI Integration')
      expect(result.trends?.[0].impact).toBe('positive')
      expect(result.score).toBe(82)
    })

    it('should analyze opportunities', async () => {
      const input: MarketResearchPromptInput = {
        businessIdea: testBusinessIdea,
        analysisType: 'opportunities',
      }

      const result = await mockProvider.analyzeMarketResearch(input)

      expect(result.opportunities).toBeDefined()
      expect(result.opportunities).toHaveLength(2)
      expect(result.opportunities?.[0].opportunity).toBe('Underserved SMB Market')
      expect(result.opportunities?.[0].potential).toBe('high')
      expect(result.score).toBe(78)
    })
  })
})

describe('ProviderFactory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    // Mock environment config
    vi.mock('@ai-validation/shared', () => ({
      getEnvironmentConfig: () => ({
        development: {
          useMockServices: true,
        },
      }),
    }))
  })

  it('should create singleton instance', () => {
    const factory1 = ProviderFactory.getInstance()
    const factory2 = ProviderFactory.getInstance()
    expect(factory1).toBe(factory2)
  })

  it('should use mock provider when in development mode', async () => {
    const factory = ProviderFactory.getInstance()
    const provider = await factory.getAvailableProvider()
    expect(provider.getProviderName()).toBe(LLMProvider.MOCK)
  })

  it('should invoke through available provider', async () => {
    const factory = ProviderFactory.getInstance()
    const response = await factory.invoke('Test prompt')
    expect(response.content).toBeDefined()
    expect(response.provider).toBe(LLMProvider.MOCK)
  })

  it('should analyze market research through provider', async () => {
    const factory = ProviderFactory.getInstance()
    const input: MarketResearchPromptInput = {
      businessIdea: {
        title: 'Test Idea',
        description: 'Test description',
      },
      analysisType: 'market_size',
    }

    const result = await factory.analyzeMarketResearch(input)
    expect(result.score).toBeDefined()
    expect(result.insights).toBeDefined()
  })

  it('should get provider status', async () => {
    const factory = ProviderFactory.getInstance()
    const status = await factory.getProviderStatus()
    expect(status[LLMProvider.MOCK]).toBe(true)
  })

  it('should list configured providers', () => {
    const factory = ProviderFactory.getInstance()
    const providers = factory.getConfiguredProviders()
    expect(providers).toContain(LLMProvider.MOCK)
  })
})
