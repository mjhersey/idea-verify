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

export interface AgentCapability {
  name: string;
  version: string;
  dependencies: AgentType[];
  provides: string[];
  requires: string[];
}

export interface AgentMetadata {
  version: string;
  capabilities: AgentCapability;
  configuration: Record<string, any>;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: Date;
  resourceUsage: {
    cpu: number;
    memory: number;
    responseTime: number;
  };
}

export interface AgentCommunicationContext {
  sharedData: Map<string, any>;
  dependencies: Map<AgentType, AgentResponse>;
  coordination: {
    sequence: number;
    priority: 'high' | 'medium' | 'low';
    parallel: boolean;
  };
}

export abstract class BaseAgent {
  protected agentType: AgentType;
  protected name: string;
  protected description: string;
  protected metadata: AgentMetadata;
  private initialized: boolean = false;

  constructor(agentType: AgentType, name: string, description: string) {
    this.agentType = agentType;
    this.name = name;
    this.description = description;
    this.metadata = this.initializeMetadata();
  }

  abstract execute(
    request: AgentRequest,
    context: AgentExecutionContext
  ): Promise<AgentResponse>;

  // Multi-agent coordination methods
  async initialize(configuration?: Record<string, any>): Promise<void> {
    if (this.initialized) return;
    
    this.metadata.configuration = { ...this.metadata.configuration, ...configuration };
    await this.onInitialize();
    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) return;
    
    await this.onCleanup();
    this.initialized = false;
  }

  async healthCheck(): Promise<AgentMetadata> {
    const startTime = Date.now();
    
    try {
      await this.onHealthCheck();
      this.metadata.healthStatus = 'healthy';
    } catch (error) {
      this.metadata.healthStatus = 'unhealthy';
    }
    
    this.metadata.lastHealthCheck = new Date();
    this.metadata.resourceUsage.responseTime = Date.now() - startTime;
    
    return this.metadata;
  }

  canExecuteWith(dependencies: Map<AgentType, AgentResponse>): boolean {
    const requiredDeps = this.metadata.capabilities.dependencies;
    return requiredDeps.every(dep => dependencies.has(dep));
  }

  async executeWithCoordination(
    request: AgentRequest,
    context: AgentExecutionContext,
    communicationContext: AgentCommunicationContext
  ): Promise<AgentResponse> {
    // Pre-execution coordination
    await this.beforeExecution(request, context, communicationContext);
    
    // Execute main logic
    const response = await this.execute(request, context);
    
    // Post-execution coordination
    await this.afterExecution(response, communicationContext);
    
    return response;
  }

  // Template methods for subclasses to override
  protected async onInitialize(): Promise<void> {
    // Override in subclasses for initialization logic
  }

  protected async onCleanup(): Promise<void> {
    // Override in subclasses for cleanup logic
  }

  protected async onHealthCheck(): Promise<void> {
    // Override in subclasses for health check logic
  }

  protected async beforeExecution(
    request: AgentRequest,
    context: AgentExecutionContext,
    communicationContext: AgentCommunicationContext
  ): Promise<void> {
    // Override in subclasses for pre-execution logic
  }

  protected async afterExecution(
    response: AgentResponse,
    communicationContext: AgentCommunicationContext
  ): Promise<void> {
    // Override in subclasses for post-execution logic
  }

  private initializeMetadata(): AgentMetadata {
    return {
      version: '1.0.0',
      capabilities: this.defineCapabilities(),
      configuration: {},
      healthStatus: 'healthy',
      lastHealthCheck: new Date(),
      resourceUsage: {
        cpu: 0,
        memory: 0,
        responseTime: 0
      }
    };
  }

  protected abstract defineCapabilities(): AgentCapability;

  // Getter methods
  getAgentType(): AgentType {
    return this.agentType;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getCapabilities(): AgentCapability {
    return this.metadata.capabilities;
  }

  getMetadata(): AgentMetadata {
    return { ...this.metadata };
  }

  isInitialized(): boolean {
    return this.initialized;
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