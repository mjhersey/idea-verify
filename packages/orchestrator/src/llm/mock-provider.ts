/**
 * Mock LLM Provider for Offline Development
 */

import { BaseProvider } from './provider-base.js'
import {
  LLMProvider,
  LLMResponse,
  MarketResearchPromptInput,
  MarketResearchResult,
} from './types.js'

export class MockProvider extends BaseProvider {
  private mockResponses: Map<string, any>

  constructor() {
    super(LLMProvider.MOCK, {})
    this.mockResponses = this.initializeMockResponses()
  }

  protected getDefaultModel(): string {
    return 'mock-model-v1'
  }

  private initializeMockResponses(): Map<string, any> {
    const responses = new Map()

    // Market size analysis mock
    responses.set('market_size', {
      marketSize: {
        totalAddressableMarket: '$45B',
        serviceableAddressableMarket: '$12B',
        serviceableObtainableMarket: '$1.2B',
        growthRate: '22% annually',
      },
      score: 75,
      insights: [
        'The market shows strong growth potential with increasing demand',
        'Digital transformation is driving market expansion',
        'Early-stage market with room for innovation',
      ],
      confidence: 'high',
    })

    // Competitors analysis mock
    responses.set('competitors', {
      competitors: [
        {
          name: 'Established Corp',
          description: 'Large enterprise solution with comprehensive features',
          marketShare: '35%',
          strengths: ['Brand recognition', 'Large customer base', 'Extensive features'],
          weaknesses: ['High cost', 'Complex implementation', 'Slow innovation'],
        },
        {
          name: 'Startup Innovator',
          description: 'Agile startup focusing on modern tech stack',
          marketShare: '8%',
          strengths: ['Modern technology', 'User-friendly', 'Competitive pricing'],
          weaknesses: ['Limited features', 'Small team', 'Less established'],
        },
      ],
      score: 68,
      insights: [
        'Market has both established players and innovative startups',
        'Opportunity exists for differentiation through unique features',
        'Customer dissatisfaction with current solutions creates openings',
      ],
      confidence: 'medium',
    })

    // Trends analysis mock
    responses.set('trends', {
      trends: [
        {
          trend: 'AI Integration',
          impact: 'positive',
          timeframe: '1-2 years',
          description: 'Increasing adoption of AI for automation and insights',
        },
        {
          trend: 'Remote Work Normalization',
          impact: 'positive',
          timeframe: 'Ongoing',
          description: 'Permanent shift to remote/hybrid work models',
        },
        {
          trend: 'Data Privacy Regulations',
          impact: 'neutral',
          timeframe: '2-3 years',
          description: 'Stricter compliance requirements but also opportunities',
        },
      ],
      score: 82,
      insights: [
        'Technology trends favor innovative solutions',
        'Market dynamics are shifting rapidly',
        'Early movers can capture significant market share',
      ],
      confidence: 'high',
    })

    // Opportunities analysis mock
    responses.set('opportunities', {
      opportunities: [
        {
          opportunity: 'Underserved SMB Market',
          potential: 'high',
          challenges: ['Price sensitivity', 'Education needed', 'Support scalability'],
          recommendations: ['Freemium model', 'Self-service onboarding', 'Community support'],
        },
        {
          opportunity: 'Platform Integrations',
          potential: 'medium',
          challenges: ['Technical complexity', 'Partnership negotiations'],
          recommendations: ['Start with popular platforms', 'Open API strategy'],
        },
      ],
      score: 78,
      insights: [
        'Multiple market entry points available',
        'Strategic partnerships could accelerate growth',
        'Focus on specific niches initially',
      ],
      confidence: 'medium',
    })

    return responses
  }

  async invoke(prompt: string, context?: Record<string, any>): Promise<LLMResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    let content = 'Mock response for: ' + prompt.substring(0, 100)

    // If this is a market research analysis, return appropriate mock data
    if (context?.analysisType && this.mockResponses.has(context.analysisType)) {
      content = JSON.stringify(this.mockResponses.get(context.analysisType))
    }

    return {
      content,
      provider: this.provider,
      model: this.model,
      timestamp: new Date(),
      usage: {
        promptTokens: Math.floor(prompt.length / 4),
        completionTokens: Math.floor(content.length / 4),
        totalTokens: Math.floor((prompt.length + content.length) / 4),
      },
    }
  }

  async analyzeMarketResearch(input: MarketResearchPromptInput): Promise<MarketResearchResult> {
    // Use the mock responses directly
    const mockData = this.mockResponses.get(input.analysisType)
    if (mockData) {
      return this.validateMarketResearchResult(mockData)
    }

    // Fallback to base implementation
    return super.analyzeMarketResearch(input)
  }

  async isAvailable(): Promise<boolean> {
    // Mock provider is always available
    return true
  }

  async isHealthy(): Promise<boolean> {
    // Mock provider is always healthy
    return true
  }
}
