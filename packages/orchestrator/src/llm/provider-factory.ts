/**
 * LLM Provider Factory with Failover Support
 */

import { getEnvironmentConfig } from '@ai-validation/shared';
import { LLMProvider, LLMProviderConfig, LLMProviderInterface, LLMResponse, MarketResearchPromptInput, MarketResearchResult } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { MockProvider } from './mock-provider.js';

export class ProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<LLMProvider, LLMProviderInterface> = new Map();
  private primaryProvider: LLMProvider;
  private fallbackProviders: LLMProvider[] = [];
  private useMockServices: boolean;

  private constructor() {
    const config = getEnvironmentConfig();
    this.useMockServices = config.development.useMockServices;
    this.primaryProvider = this.getPrimaryProvider();
    this.initializeProviders();
  }

  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  private getPrimaryProvider(): LLMProvider {
    const primaryProviderEnv = process.env.PRIMARY_LLM_PROVIDER;
    
    if (this.useMockServices) {
      return LLMProvider.MOCK;
    }
    
    switch (primaryProviderEnv) {
      case 'anthropic':
        return LLMProvider.ANTHROPIC;
      case 'openai':
        return LLMProvider.OPENAI;
      default:
        // Default to OpenAI if not specified
        return LLMProvider.OPENAI;
    }
  }

  private initializeProviders(): void {
    // Always initialize mock provider
    this.providers.set(LLMProvider.MOCK, new MockProvider());

    if (!this.useMockServices) {
      // Initialize OpenAI provider
      const openAIKey = process.env.OPENAI_API_KEY;
      if (openAIKey) {
        const openAIConfig: LLMProviderConfig = {
          provider: LLMProvider.OPENAI,
          apiKey: openAIKey,
          model: process.env.OPENAI_MODEL,
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
          maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3'),
          timeout: parseInt(process.env.LLM_TIMEOUT || '30000')
        };
        this.providers.set(LLMProvider.OPENAI, new OpenAIProvider(openAIConfig));
        this.fallbackProviders.push(LLMProvider.OPENAI);
      }

      // Initialize Anthropic provider
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        const anthropicConfig: LLMProviderConfig = {
          provider: LLMProvider.ANTHROPIC,
          apiKey: anthropicKey,
          model: process.env.ANTHROPIC_MODEL,
          temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
          maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3'),
          timeout: parseInt(process.env.LLM_TIMEOUT || '30000')
        };
        this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider(anthropicConfig));
        this.fallbackProviders.push(LLMProvider.ANTHROPIC);
      }
    }

    // Always add mock as final fallback
    if (!this.fallbackProviders.includes(LLMProvider.MOCK)) {
      this.fallbackProviders.push(LLMProvider.MOCK);
    }
  }

  async getAvailableProvider(): Promise<LLMProviderInterface> {
    // Try primary provider first
    const primary = this.providers.get(this.primaryProvider);
    if (primary && await primary.isAvailable()) {
      return primary;
    }

    // Try fallback providers
    for (const providerType of this.fallbackProviders) {
      if (providerType === this.primaryProvider) continue; // Skip primary, already tried
      
      const provider = this.providers.get(providerType);
      if (provider && await provider.isAvailable()) {
        console.warn(`Primary provider ${this.primaryProvider} unavailable, falling back to ${providerType}`);
        return provider;
      }
    }

    // If nothing else works, return mock provider
    console.warn('All LLM providers unavailable, using mock provider');
    return this.providers.get(LLMProvider.MOCK)!;
  }

  async invoke(prompt: string, context?: Record<string, any>): Promise<LLMResponse> {
    const provider = await this.getAvailableProvider();
    
    try {
      return await provider.invoke(prompt, context);
    } catch (error) {
      console.error(`Provider ${provider.getProviderName()} failed:`, error);
      
      // Try next available provider
      for (const fallbackType of this.fallbackProviders) {
        const fallback = this.providers.get(fallbackType);
        if (fallback && fallback !== provider && await fallback.isAvailable()) {
          console.warn(`Retrying with fallback provider ${fallbackType}`);
          return await fallback.invoke(prompt, context);
        }
      }
      
      throw error;
    }
  }

  async analyzeMarketResearch(input: MarketResearchPromptInput): Promise<MarketResearchResult> {
    const provider = await this.getAvailableProvider();
    
    try {
      return await provider.analyzeMarketResearch(input);
    } catch (error) {
      console.error(`Market research analysis failed with ${provider.getProviderName()}:`, error);
      
      // Try fallback providers
      for (const fallbackType of this.fallbackProviders) {
        const fallback = this.providers.get(fallbackType);
        if (fallback && fallback !== provider && await fallback.isAvailable()) {
          console.warn(`Retrying market research with fallback provider ${fallbackType}`);
          return await fallback.analyzeMarketResearch(input);
        }
      }
      
      throw error;
    }
  }

  getConfiguredProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  static getProvider(): ProviderFactory {
    return ProviderFactory.getInstance();
  }

  async getProviderStatus(): Promise<Record<LLMProvider, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const [providerType, provider] of this.providers) {
      status[providerType] = await provider.isAvailable();
    }
    
    return status as Record<LLMProvider, boolean>;
  }
}