/**
 * Agent Types and Interfaces
 */

import { AgentType } from '@ai-validation/shared';

export interface AgentRequest {
  businessIdea: {
    id: string;
    title: string;
    description: string;
  };
  analysisType: string;
  context?: Record<string, any>;
  options?: AgentOptions;
}

export interface AgentOptions {
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  model?: string;
  useCache?: boolean;
}

export interface AgentResponse {
  agentType: AgentType;
  score: number; // 0-100
  insights: string[];
  confidence: 'high' | 'medium' | 'low';
  metadata: {
    processingTime: number;
    model: string;
    tokens?: number;
    retryCount: number;
    tokensUsed?: number;
    apiCalls?: number;
    cacheHits?: number;
  };
  rawData: Record<string, any>;
}

export interface AgentExecutionContext {
  evaluationId: string;
  correlationId: string;
  userId?: string;
  timestamp: Date;
  requestId?: string;
}

export abstract class BaseAgent {
  protected agentType: AgentType;
  protected name: string;
  protected description: string;

  constructor(agentType: AgentType, name: string, description: string) {
    this.agentType = agentType;
    this.name = name;
    this.description = description;
  }

  abstract execute(
    request: AgentRequest,
    context: AgentExecutionContext
  ): Promise<AgentResponse>;

  getAgentType(): AgentType {
    return this.agentType;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  protected validateRequest(request: AgentRequest): void {
    if (!request.businessIdea) {
      throw new Error('Business idea is required');
    }
    if (!request.businessIdea.title || !request.businessIdea.description) {
      throw new Error('Business idea must have title and description');
    }
    if (!request.analysisType) {
      throw new Error('Analysis type is required');
    }
  }

  protected calculateConfidence(
    score: number,
    dataQuality: number,
    sourceReliability: number
  ): 'high' | 'medium' | 'low' {
    const confidenceScore = (score + dataQuality + sourceReliability) / 3;
    
    if (confidenceScore >= 80) return 'high';
    if (confidenceScore >= 60) return 'medium';
    return 'low';
  }

  protected formatInsights(rawInsights: string[]): string[] {
    return rawInsights
      .filter(insight => insight && insight.trim().length > 0)
      .map(insight => insight.trim())
      .slice(0, 10); // Limit to 10 insights
  }
}