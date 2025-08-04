/**
 * Mock Agent Implementations - Comprehensive mocks for testing multi-agent workflows
 */

import { BaseAgent } from '../../src/agents/types.js';
import { AgentType } from '@ai-validation/shared';

export interface MockAgentConfig {
  executionTime?: number;
  failureRate?: number;
  score?: number;
  confidence?: 'high' | 'medium' | 'low';
  customInsights?: string[];
  customRecommendations?: string[];
  resourceUsage?: {
    cpu?: number;
    memory?: number;
    responseTime?: number;
  };
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Base Mock Agent - Configurable mock agent with realistic behavior simulation
 */
export class MockAgent extends BaseAgent {
  protected agentType: AgentType;
  protected dependencies: AgentType[];
  protected config: MockAgentConfig;
  protected initialized: boolean = false;
  protected executionCount: number = 0;
  protected lastExecution?: Date;

  constructor(
    type: AgentType,
    dependencies: AgentType[] = [],
    config: MockAgentConfig = {}
  ) {
    super();
    this.agentType = type;
    this.dependencies = dependencies;
    this.config = {
      executionTime: 1000,
      failureRate: 0,
      score: 75,
      confidence: 'medium',
      resourceUsage: {
        cpu: 0.3,
        memory: 0.4,
        responseTime: 1000
      },
      healthStatus: 'healthy',
      ...config
    };
  }

  getName(): string {
    return `Mock ${this.agentType} Agent`;
  }

  getDescription(): string {
    return `Mock implementation of ${this.agentType} agent for testing purposes`;
  }

  getCapabilities() {
    return {
      name: this.agentType,
      version: '1.0.0-mock',
      dependencies: this.dependencies,
      provides: [`${this.agentType}-analysis`, `${this.agentType}-insights`],
      requires: this.dependencies.map(dep => `${dep}-data`)
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Simulate initialization time
    await new Promise(resolve => setTimeout(resolve, 100));
    this.initialized = true;
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Simulate cleanup time
    await new Promise(resolve => setTimeout(resolve, 50));
    this.initialized = false;
  }

  async healthCheck() {
    const currentTime = new Date();
    const resourceUsage = this.config.resourceUsage!;
    
    // Add some variability to resource usage
    const cpuVariance = (Math.random() - 0.5) * 0.1;
    const memoryVariance = (Math.random() - 0.5) * 0.1;
    const responseTimeVariance = (Math.random() - 0.5) * 200;

    return {
      agentType: this.agentType,
      version: '1.0.0-mock',
      status: this.config.healthStatus || 'healthy',
      lastActivity: this.lastExecution || currentTime,
      resourceUsage: {
        cpu: Math.max(0, Math.min(1, resourceUsage.cpu! + cpuVariance)),
        memory: Math.max(0, Math.min(1, resourceUsage.memory! + memoryVariance)),
        responseTime: Math.max(100, resourceUsage.responseTime! + responseTimeVariance)
      },
      healthStatus: this.config.healthStatus || 'healthy',
      capabilities: this.getCapabilities()
    };
  }

  async execute(request: any, context: any) {
    if (!this.initialized) {
      throw new Error(`${this.agentType} agent not initialized`);
    }

    this.executionCount++;
    this.lastExecution = new Date();

    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, this.config.executionTime));

    // Simulate failures based on failure rate
    if (Math.random() < this.config.failureRate!) {
      throw new Error(`Simulated failure in ${this.agentType} agent (execution #${this.executionCount})`);
    }

    // Generate response based on agent type and configuration
    const baseScore = this.config.score || 75;
    const scoreVariance = (Math.random() - 0.5) * 10;
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore + scoreVariance)));

    const confidence = this.config.confidence || (
      finalScore > 85 ? 'high' : finalScore > 65 ? 'medium' : 'low'
    );

    const insights = this.config.customInsights || this.generateInsights();
    const recommendations = this.config.customRecommendations || this.generateRecommendations();

    return {
      score: finalScore,
      confidence,
      insights,
      recommendations,
      metadata: {
        processingTime: this.config.executionTime,
        model: `mock-${this.agentType}-model`,
        retryCount: 0,
        executionCount: this.executionCount,
        dependencies: this.dependencies,
        tokensUsed: Math.floor(Math.random() * 1000) + 500,
        apiCalls: Math.floor(Math.random() * 5) + 1,
        cacheHits: Math.floor(Math.random() * 3)
      },
      rawData: this.generateRawData(request, context)
    };
  }

  protected generateInsights(): string[] {
    const baseInsights = [
      `${this.agentType} analysis completed successfully`,
      `Key finding from ${this.agentType} evaluation`,
      `${this.agentType} data shows positive indicators`,
      `Analysis reveals important ${this.agentType} considerations`
    ];

    return baseInsights.slice(0, Math.floor(Math.random() * 3) + 2);
  }

  protected generateRecommendations(): string[] {
    const baseRecommendations = [
      `Primary recommendation from ${this.agentType} analysis`,
      `Consider ${this.agentType} optimization strategies`,
      `Focus on ${this.agentType} improvements`,
      `Implement ${this.agentType} best practices`
    ];

    return baseRecommendations.slice(0, Math.floor(Math.random() * 2) + 1);
  }

  protected generateRawData(request: any, context: any): any {
    return {
      agentType: this.agentType,
      processingTime: this.config.executionTime,
      businessIdeaId: request?.businessIdea?.id,
      evaluationId: context?.evaluationId,
      timestamp: new Date().toISOString(),
      executionCount: this.executionCount,
      dependencyData: this.dependencies.reduce((acc, dep) => {
        acc[dep] = {
          available: true,
          score: Math.random() * 100,
          processed: true
        };
        return acc;
      }, {} as Record<string, any>),
      mockData: {
        version: '1.0.0-mock',
        simulatedResults: true,
        randomSeed: Math.random()
      }
    };
  }

  // Test utilities
  getExecutionCount(): number {
    return this.executionCount;
  }

  getLastExecution(): Date | undefined {
    return this.lastExecution;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  updateConfig(newConfig: Partial<MockAgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  reset(): void {
    this.initialized = false;
    this.executionCount = 0;
    this.lastExecution = undefined;
  }
}

/**
 * Specialized Mock Agents with domain-specific behavior
 */

export class MockMarketResearchAgent extends MockAgent {
  constructor(config: MockAgentConfig = {}) {
    super('market-research', [], {
      executionTime: 1200,
      score: 82,
      confidence: 'high',
      ...config
    });
  }

  protected generateInsights(): string[] {
    return [
      'Market opportunity identified in target segment',
      'Competitive landscape analysis shows favorable positioning',
      'Market trends indicate growing demand',
      'Target customer base shows strong interest signals'
    ];
  }

  protected generateRecommendations(): string[] {
    return [
      'Focus on primary target market segment',
      'Leverage market timing advantages',
      'Develop competitive differentiation strategy'
    ];
  }

  protected generateRawData(request: any, context: any): any {
    return {
      ...super.generateRawData(request, context),
      marketData: {
        marketSize: Math.floor(Math.random() * 1000000000) + 100000000,
        growthRate: Math.random() * 0.3 + 0.05,
        competitorCount: Math.floor(Math.random() * 20) + 5,
        marketSegments: ['enterprise', 'smb', 'consumer'],
        trends: ['digitalization', 'automation', 'sustainability']
      }
    };
  }
}

export class MockCompetitiveAnalysisAgent extends MockAgent {
  constructor(config: MockAgentConfig = {}) {
    super('competitive-analysis', ['market-research'], {
      executionTime: 1500,
      score: 78,
      confidence: 'medium',
      ...config
    });
  }

  protected generateInsights(): string[] {
    return [
      'Competitive analysis reveals market gaps',
      'Key competitors identified with strategic positioning',
      'Differentiation opportunities discovered',
      'Competitive advantages clearly defined'
    ];
  }

  protected generateRawData(request: any, context: any): any {
    return {
      ...super.generateRawData(request, context),
      competitiveData: {
        directCompetitors: Math.floor(Math.random() * 8) + 3,
        indirectCompetitors: Math.floor(Math.random() * 15) + 10,
        competitorStrengths: ['brand recognition', 'market share', 'technology'],
        competitorWeaknesses: ['pricing', 'customer service', 'innovation'],
        competitiveAdvantages: ['unique features', 'better pricing', 'superior technology']
      }
    };
  }
}

export class MockCustomerResearchAgent extends MockAgent {
  constructor(config: MockAgentConfig = {}) {
    super('customer-research', ['market-research'], {
      executionTime: 1300,
      score: 85,
      confidence: 'high',
      ...config
    });
  }

  protected generateInsights(): string[] {
    return [
      'Customer validation shows strong product-market fit',
      'Target customer personas clearly defined',
      'Customer pain points thoroughly analyzed',
      'Customer acquisition channels identified'
    ];
  }

  protected generateRawData(request: any, context: any): any {
    return {
      ...super.generateRawData(request, context),
      customerData: {
        surveyResponses: Math.floor(Math.random() * 500) + 100,
        customerSegments: ['early adopters', 'mainstream', 'laggards'],
        painPoints: ['time consuming', 'expensive', 'complex'],
        preferredChannels: ['online', 'mobile', 'in-person'],
        willingnessToPayScale: Math.random() * 5 + 3
      }
    };
  }
}

export class MockTechnicalFeasibilityAgent extends MockAgent {
  constructor(config: MockAgentConfig = {}) {
    super('technical-feasibility', [], {
      executionTime: 1800,
      score: 88,
      confidence: 'high',
      ...config
    });
  }

  protected generateInsights(): string[] {
    return [
      'Technical implementation is feasible with current technology',
      'Architecture design supports scalability requirements',
      'Technology stack evaluation shows optimal choices',
      'Development timeline and resource requirements defined'
    ];
  }

  protected generateRawData(request: any, context: any): any {
    return {
      ...super.generateRawData(request, context),
      technicalData: {
        technologyStack: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
        developmentTime: Math.floor(Math.random() * 12) + 6,
        scalabilityScore: Math.random() * 40 + 60,
        complexityLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        riskFactors: ['technology maturity', 'team expertise', 'third-party dependencies']
      }
    };
  }
}

export class MockFinancialAnalysisAgent extends MockAgent {
  constructor(config: MockAgentConfig = {}) {
    super('financial-analysis', ['competitive-analysis', 'customer-research'], {
      executionTime: 2000,
      score: 79,
      confidence: 'medium',
      ...config
    });
  }

  protected generateInsights(): string[] {
    return [
      'Financial projections show positive ROI potential',
      'Revenue model analysis indicates strong viability',
      'Cost structure optimization opportunities identified',
      'Funding requirements and timeline established'
    ];
  }

  protected generateRawData(request: any, context: any): any {
    return {
      ...super.generateRawData(request, context),
      financialData: {
        projectedRevenue: Math.floor(Math.random() * 10000000) + 1000000,
        initialInvestment: Math.floor(Math.random() * 1000000) + 100000,
        breakEvenPoint: Math.floor(Math.random() * 24) + 12,
        profitMargin: Math.random() * 0.3 + 0.1,
        revenueStreams: ['subscription', 'one-time', 'freemium'],
        keyMetrics: {
          ltv: Math.floor(Math.random() * 5000) + 1000,
          cac: Math.floor(Math.random() * 500) + 100,
          churnRate: Math.random() * 0.1 + 0.02
        }
      }
    };
  }
}

/**
 * Specialized Mock Agents for Testing Edge Cases
 */

export class MockSlowAgent extends MockAgent {
  constructor(agentType: AgentType, executionTime: number = 30000) {
    super(agentType, [], {
      executionTime,
      score: 60,
      confidence: 'low'
    });
  }
}

export class MockFailingAgent extends MockAgent {
  constructor(agentType: AgentType, failureRate: number = 0.5) {
    super(agentType, [], {
      executionTime: 500,
      failureRate,
      score: 30,
      confidence: 'low'
    });
  }
}

export class MockUnhealthyAgent extends MockAgent {
  constructor(agentType: AgentType) {
    super(agentType, [], {
      healthStatus: 'unhealthy',
      resourceUsage: {
        cpu: 0.95,
        memory: 0.90,
        responseTime: 10000
      }
    });
  }
}

export class MockHighPerformanceAgent extends MockAgent {
  constructor(agentType: AgentType) {
    super(agentType, [], {
      executionTime: 300,
      score: 95,
      confidence: 'high',
      resourceUsage: {
        cpu: 0.15,
        memory: 0.20,
        responseTime: 300
      }
    });
  }
}

/**
 * Mock Agent Factory - Creates configured mock agents for testing
 */
export class MockAgentFactory {
  static createStandardMockAgents(): Record<AgentType, MockAgent> {
    return {
      'market-research': new MockMarketResearchAgent(),
      'competitive-analysis': new MockCompetitiveAnalysisAgent(),
      'customer-research': new MockCustomerResearchAgent(),
      'technical-feasibility': new MockTechnicalFeasibilityAgent(),
      'financial-analysis': new MockFinancialAnalysisAgent()
    };
  }

  static createHighPerformanceMockAgents(): Record<AgentType, MockAgent> {
    const agentTypes: AgentType[] = [
      'market-research',
      'competitive-analysis',
      'customer-research',
      'technical-feasibility',
      'financial-analysis'
    ];

    return agentTypes.reduce((agents, type) => {
      agents[type] = new MockHighPerformanceAgent(type);
      return agents;
    }, {} as Record<AgentType, MockAgent>);
  }

  static createUnreliableMockAgents(failureRate: number = 0.3): Record<AgentType, MockAgent> {
    const agentTypes: AgentType[] = [
      'market-research',
      'competitive-analysis',
      'customer-research',
      'technical-feasibility',
      'financial-analysis'
    ];

    return agentTypes.reduce((agents, type) => {
      agents[type] = new MockFailingAgent(type, failureRate);
      return agents;
    }, {} as Record<AgentType, MockAgent>);
  }

  static createMixedPerformanceMockAgents(): Record<AgentType, MockAgent> {
    return {
      'market-research': new MockHighPerformanceAgent('market-research'),
      'competitive-analysis': new MockFailingAgent('competitive-analysis', 0.2),
      'customer-research': new MockAgent('customer-research', ['market-research']),
      'technical-feasibility': new MockSlowAgent('technical-feasibility', 5000),
      'financial-analysis': new MockUnhealthyAgent('financial-analysis')
    };
  }

  static createCustomMockAgent(
    agentType: AgentType,
    dependencies: AgentType[] = [],
    config: MockAgentConfig = {}
  ): MockAgent {
    return new MockAgent(agentType, dependencies, config);
  }
}