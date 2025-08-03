/**
 * LLM Provider Types and Interfaces
 */

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  MOCK = 'mock'
}

export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: LLMProvider;
  model: string;
  timestamp: Date;
}

export interface MarketResearchPromptInput {
  businessIdea: {
    title: string;
    description: string;
  };
  analysisType: 'market_size' | 'competitors' | 'trends' | 'opportunities';
}

export interface MarketResearchResult {
  marketSize?: {
    totalAddressableMarket: string;
    serviceableAddressableMarket: string;
    serviceableObtainableMarket: string;
    growthRate: string;
  };
  competitors?: Array<{
    name: string;
    description: string;
    marketShare?: string;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  trends?: Array<{
    trend: string;
    impact: 'positive' | 'negative' | 'neutral';
    timeframe: string;
    description: string;
  }>;
  opportunities?: Array<{
    opportunity: string;
    potential: 'high' | 'medium' | 'low';
    challenges: string[];
    recommendations: string[];
  }>;
  score: number; // 0-100
  insights: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface LLMProviderInterface {
  invoke(prompt: string, context?: Record<string, any>): Promise<LLMResponse>;
  analyzeMarketResearch(input: MarketResearchPromptInput): Promise<MarketResearchResult>;
  isAvailable(): Promise<boolean>;
  getProviderName(): LLMProvider;
}