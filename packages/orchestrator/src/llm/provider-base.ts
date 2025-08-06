/**
 * Base LLM Provider Implementation
 */

import {
  LLMProviderInterface,
  LLMProvider,
  LLMResponse,
  MarketResearchPromptInput,
  MarketResearchResult,
} from './types.js'

export abstract class BaseProvider implements LLMProviderInterface {
  protected provider: LLMProvider
  protected apiKey?: string
  protected model: string
  protected temperature: number
  protected maxTokens: number
  protected maxRetries: number
  protected timeout: number

  constructor(
    provider: LLMProvider,
    options: {
      apiKey?: string
      model?: string
      temperature?: number
      maxTokens?: number
      maxRetries?: number
      timeout?: number
    }
  ) {
    this.provider = provider
    this.apiKey = options.apiKey
    this.model = options.model || this.getDefaultModel()
    this.temperature = options.temperature ?? 0.7
    this.maxTokens = options.maxTokens ?? 2000
    this.maxRetries = options.maxRetries ?? 3
    this.timeout = options.timeout ?? 30000
  }

  abstract invoke(prompt: string, context?: Record<string, any>): Promise<LLMResponse>
  abstract isAvailable(): Promise<boolean>
  abstract isHealthy(): Promise<boolean>
  protected abstract getDefaultModel(): string

  getProviderName(): LLMProvider {
    return this.provider
  }

  async analyzeMarketResearch(input: MarketResearchPromptInput): Promise<MarketResearchResult> {
    const prompt = this.buildMarketResearchPrompt(input)
    const response = await this.invoke(prompt, { analysisType: input.analysisType })

    try {
      const parsed = JSON.parse(response.content)
      return this.validateMarketResearchResult(parsed)
    } catch (error) {
      console.error('Failed to parse market research response:', error)
      // Return a minimal valid result on parse error
      return {
        score: 50,
        insights: ['Analysis completed but results could not be fully parsed'],
        confidence: 'low',
      }
    }
  }

  protected buildMarketResearchPrompt(input: MarketResearchPromptInput): string {
    const { businessIdea, analysisType } = input

    const basePrompt = `You are a market research analyst evaluating a business idea. 
Analyze the following business idea and provide a detailed ${analysisType.replace('_', ' ')} analysis.

Business Idea: ${businessIdea.title}
Description: ${businessIdea.description}

Provide your analysis in JSON format with the following structure:`

    switch (analysisType) {
      case 'market_size':
        return `${basePrompt}
{
  "marketSize": {
    "totalAddressableMarket": "string (e.g., '$10B')",
    "serviceableAddressableMarket": "string (e.g., '$2B')",
    "serviceableObtainableMarket": "string (e.g., '$200M')",
    "growthRate": "string (e.g., '15% annually')"
  },
  "score": number (0-100),
  "insights": ["string array of key insights"],
  "confidence": "high" | "medium" | "low"
}`

      case 'competitors':
        return `${basePrompt}
{
  "competitors": [
    {
      "name": "string",
      "description": "string",
      "marketShare": "string (optional)",
      "strengths": ["string array"],
      "weaknesses": ["string array"]
    }
  ],
  "score": number (0-100),
  "insights": ["string array of key insights"],
  "confidence": "high" | "medium" | "low"
}`

      case 'trends':
        return `${basePrompt}
{
  "trends": [
    {
      "trend": "string",
      "impact": "positive" | "negative" | "neutral",
      "timeframe": "string",
      "description": "string"
    }
  ],
  "score": number (0-100),
  "insights": ["string array of key insights"],
  "confidence": "high" | "medium" | "low"
}`

      case 'opportunities':
        return `${basePrompt}
{
  "opportunities": [
    {
      "opportunity": "string",
      "potential": "high" | "medium" | "low",
      "challenges": ["string array"],
      "recommendations": ["string array"]
    }
  ],
  "score": number (0-100),
  "insights": ["string array of key insights"],
  "confidence": "high" | "medium" | "low"
}`

      default:
        throw new Error(`Unknown analysis type: ${analysisType}`)
    }
  }

  protected validateMarketResearchResult(data: any): MarketResearchResult {
    // Ensure required fields exist
    const result: MarketResearchResult = {
      score: Math.max(0, Math.min(100, Number(data.score) || 50)),
      insights: Array.isArray(data.insights) ? data.insights : [],
      confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
    }

    // Copy optional fields if they exist and are valid
    if (data.marketSize && typeof data.marketSize === 'object') {
      result.marketSize = data.marketSize
    }
    if (Array.isArray(data.competitors)) {
      result.competitors = data.competitors
    }
    if (Array.isArray(data.trends)) {
      result.trends = data.trends
    }
    if (Array.isArray(data.opportunities)) {
      result.opportunities = data.opportunities
    }

    return result
  }

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (retries <= 0) {
        throw error
      }

      console.warn(`Operation failed, retrying in ${delay}ms... (${retries} retries left)`)
      await new Promise(resolve => setTimeout(resolve, delay))

      // Exponential backoff with jitter
      const nextDelay = delay * 2 + Math.random() * 1000
      return this.retryWithBackoff(operation, retries - 1, nextDelay)
    }
  }
}
