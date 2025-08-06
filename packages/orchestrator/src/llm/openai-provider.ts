/**
 * OpenAI Provider Implementation
 */

import { ChatOpenAI } from '@langchain/openai'
import { BaseProvider } from './provider-base.js'
import { LLMProvider, LLMResponse, LLMProviderConfig } from './types.js'

export class OpenAIProvider extends BaseProvider {
  private client: ChatOpenAI | null = null

  constructor(config: Omit<LLMProviderConfig, 'provider'>) {
    super(LLMProvider.OPENAI, config)

    if (this.apiKey) {
      this.initializeClient()
    }
  }

  private initializeClient(): void {
    this.client = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
    })
  }

  protected getDefaultModel(): string {
    return 'gpt-4-turbo-preview'
  }

  async invoke(prompt: string, context?: Record<string, any>): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Please provide an API key.')
    }

    return this.retryWithBackoff(async () => {
      const startTime = Date.now()

      try {
        const response = await this.client!.invoke(prompt)
        const content = response.content.toString()

        return {
          content,
          provider: this.provider,
          model: this.model,
          timestamp: new Date(),
          usage: {
            promptTokens: 0, // Would need to parse from response
            completionTokens: 0,
            totalTokens: 0,
          },
        }
      } catch (error: any) {
        // Handle rate limiting
        if (error.status === 429) {
          throw new Error('OpenAI rate limit exceeded. Retrying...')
        }
        throw error
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false
    }

    try {
      // Try a minimal request to check availability
      await this.invoke('Hello', { test: true })
      return true
    } catch (error) {
      console.error('OpenAI provider not available:', error)
      return false
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isAvailable()
  }
}
