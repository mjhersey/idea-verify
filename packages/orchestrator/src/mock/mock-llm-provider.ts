/**
 * Mock LLM Provider for Offline Development
 * Provides deterministic responses for testing and development
 */

import { LLMProvider, LLMProviderConfig, LLMResponse, LLMRequest } from '../llm/types.js';

export interface MockResponse {
  content: string;
  marketSize?: number;
  competitionLevel?: 'low' | 'medium' | 'high';
  marketTrends?: string[];
  opportunities?: string[];
  threats?: string[];
  score?: number;
}

export interface MockLLMProviderConfig extends LLMProviderConfig {
  responses?: Record<string, MockResponse>;
  defaultScore?: number;
  simulateLatency?: boolean;
  latencyRange?: [number, number]; // [min, max] in milliseconds
  failureRate?: number; // 0-1, probability of failure
}

export class MockLLMProvider implements LLMProvider {
  private config: MockLLMProviderConfig;
  private callCount: number = 0;

  constructor(config: MockLLMProviderConfig) {
    this.config = {
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
      retries: 3,
      defaultScore: 75,
      simulateLatency: true,
      latencyRange: [500, 2000],
      failureRate: 0,
      responses: {},
      ...config
    };
  }

  async analyzeMarketResearch(request: {
    businessIdeaTitle: string;
    businessIdeaDescription: string;
    analysisType: string;
  }): Promise<any> {
    await this.simulateDelay();
    this.maybeSimulateFailure();

    this.callCount++;

    // Check for predefined response
    const key = `market_${request.businessIdeaTitle.toLowerCase().replace(/\s+/g, '_')}`;
    const predefinedResponse = this.config.responses?.[key];

    if (predefinedResponse) {
      return this.formatMarketResponse(predefinedResponse, request);
    }

    // Generate mock market research response
    const mockResponse = this.generateMockMarketResponse(request);
    return this.formatMarketResponse(mockResponse, request);
  }

  async query(request: LLMRequest): Promise<LLMResponse> {
    await this.simulateDelay();
    this.maybeSimulateFailure();

    this.callCount++;

    // Check for predefined response based on prompt
    const key = this.extractKeyFromPrompt(request.prompt);
    const predefinedResponse = this.config.responses?.[key];

    if (predefinedResponse) {
      return {
        content: predefinedResponse.content,
        usage: {
          promptTokens: request.prompt.length / 4, // Rough estimation
          completionTokens: predefinedResponse.content.length / 4,
          totalTokens: (request.prompt.length + predefinedResponse.content.length) / 4
        },
        model: 'mock-model',
        finishReason: 'stop'
      };
    }

    // Generate generic mock response
    const mockContent = this.generateMockContent(request.prompt);
    return {
      content: mockContent,
      usage: {
        promptTokens: request.prompt.length / 4,
        completionTokens: mockContent.length / 4,
        totalTokens: (request.prompt.length + mockContent.length) / 4
      },
      model: 'mock-model',
      finishReason: 'stop'
    };
  }

  async isHealthy(): Promise<boolean> {
    // Mock provider is always healthy unless configured otherwise
    return true;
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  // Configuration methods for testing

  setResponses(responses: Record<string, MockResponse>): void {
    this.config.responses = { ...this.config.responses, ...responses };
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }

  setLatencyRange(min: number, max: number): void {
    this.config.latencyRange = [Math.max(0, min), Math.max(min, max)];
  }

  private async simulateDelay(): Promise<void> {
    if (!this.config.simulateLatency) return;

    const [min, max] = this.config.latencyRange!;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private maybeSimulateFailure(): void {
    if (Math.random() < this.config.failureRate!) {
      throw new Error('Simulated LLM provider failure');
    }
  }

  private extractKeyFromPrompt(prompt: string): string {
    // Extract key concepts from prompt for response matching
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('market research') || lowerPrompt.includes('market analysis')) {
      return 'market_research';
    }
    if (lowerPrompt.includes('competitive analysis') || lowerPrompt.includes('competition')) {
      return 'competitive_analysis';
    }
    if (lowerPrompt.includes('customer research') || lowerPrompt.includes('customer analysis')) {
      return 'customer_research';
    }
    if (lowerPrompt.includes('technical feasibility') || lowerPrompt.includes('technical analysis')) {
      return 'technical_feasibility';
    }
    if (lowerPrompt.includes('financial analysis') || lowerPrompt.includes('financial')) {
      return 'financial_analysis';
    }

    return 'general';
  }

  private formatMarketResponse(response: MockResponse, request: any): any {
    return {
      marketSize: response.marketSize || this.generateRandomMarketSize(),
      marketSizeUnit: 'USD',
      marketGrowthRate: Math.random() * 20 + 5, // 5-25%
      competitionLevel: response.competitionLevel || this.generateRandomCompetitionLevel(),
      keyCompetitors: this.generateMockCompetitors(),
      marketTrends: response.marketTrends || this.generateMockTrends(),
      opportunities: response.opportunities || this.generateMockOpportunities(),
      threats: response.threats || this.generateMockThreats(),
      targetAudience: this.generateMockAudience(request.businessIdeaTitle),
      marketPenetrationStrategy: this.generateMockStrategy(),
      riskFactors: this.generateMockRisks(),
      recommendations: this.generateMockRecommendations(),
      confidenceScore: response.score || this.config.defaultScore,
      score: response.score || this.config.defaultScore, // Add score field for agent compatibility
      dataQuality: 'simulated',
      lastUpdated: new Date().toISOString()
    };
  }

  private generateMockMarketResponse(request: any): MockResponse {
    const businessType = this.inferBusinessType(request.businessIdeaTitle);
    
    return {
      content: `Market research analysis for ${request.businessIdeaTitle}`,
      marketSize: this.generateRandomMarketSize(),
      competitionLevel: this.generateRandomCompetitionLevel(),
      marketTrends: this.generateMockTrends(),
      opportunities: this.generateMockOpportunities(),
      threats: this.generateMockThreats(),
      score: this.config.defaultScore
    };
  }

  private generateMockContent(prompt: string): string {
    const analysisType = this.extractKeyFromPrompt(prompt);
    
    const templates = {
      market_research: `Based on the market research analysis, the target market shows promising potential with an estimated market size of $${this.generateRandomMarketSize()}M. Key trends include digital transformation, sustainability focus, and changing consumer preferences. The competitive landscape is ${this.generateRandomCompetitionLevel()} with established players but room for innovation.`,
      
      competitive_analysis: `Competitive analysis reveals ${Math.floor(Math.random() * 10) + 3} major competitors in the space. Key differentiators include pricing strategy, technology adoption, customer service, and market positioning. Opportunities exist in underserved segments and emerging markets.`,
      
      customer_research: `Customer research indicates strong demand for the proposed solution. Primary target segments include early adopters, cost-conscious consumers, and tech-savvy professionals. Key pain points include ease of use, affordability, and reliability.`,
      
      technical_feasibility: `Technical feasibility assessment shows the solution is achievable with current technology. Key considerations include scalability, security, integration complexity, and development timeline. Estimated development time: ${Math.floor(Math.random() * 12) + 6} months.`,
      
      financial_analysis: `Financial analysis projects strong revenue potential with break-even expected in ${Math.floor(Math.random() * 3) + 1} years. Key metrics include customer acquisition cost, lifetime value, and market penetration rate. Initial funding requirement: $${Math.floor(Math.random() * 500 + 100)}K.`,
      
      general: `Analysis indicates favorable conditions for the proposed business idea. Multiple factors support viability including market demand, technological readiness, and competitive positioning. Recommended next steps include market validation, prototype development, and strategic partnerships.`
    };

    return templates[analysisType as keyof typeof templates] || templates.general;
  }

  private inferBusinessType(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('app') || lowerTitle.includes('software') || lowerTitle.includes('platform')) {
      return 'technology';
    }
    if (lowerTitle.includes('food') || lowerTitle.includes('restaurant') || lowerTitle.includes('delivery')) {
      return 'food_service';
    }
    if (lowerTitle.includes('health') || lowerTitle.includes('fitness') || lowerTitle.includes('wellness')) {
      return 'health_wellness';
    }
    if (lowerTitle.includes('education') || lowerTitle.includes('learning') || lowerTitle.includes('training')) {
      return 'education';
    }
    if (lowerTitle.includes('finance') || lowerTitle.includes('payment') || lowerTitle.includes('banking')) {
      return 'fintech';
    }
    
    return 'general';
  }

  private generateRandomMarketSize(): number {
    // Generate realistic market size in millions
    const ranges = [
      [10, 50],    // Small niche markets
      [50, 200],   // Medium markets
      [200, 1000], // Large markets
      [1000, 5000] // Very large markets
    ];
    
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    return Math.floor(Math.random() * (range[1] - range[0]) + range[0]);
  }

  private generateRandomCompetitionLevel(): 'low' | 'medium' | 'high' {
    const levels: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private generateMockCompetitors(): string[] {
    const adjectives = ['Global', 'Smart', 'Digital', 'Advanced', 'Premier', 'Elite', 'Pro', 'Next'];
    const nouns = ['Solutions', 'Systems', 'Technologies', 'Innovations', 'Services', 'Platform', 'Labs', 'Corp'];
    
    const count = Math.floor(Math.random() * 5) + 3;
    const competitors: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      competitors.push(`${adj} ${noun}`);
    }
    
    return competitors;
  }

  private generateMockTrends(): string[] {
    const trends = [
      'Digital transformation acceleration',
      'Sustainability and environmental consciousness',
      'Remote work adoption',
      'AI and automation integration',
      'Personalization and customization',
      'Mobile-first experiences',
      'Data privacy and security focus',
      'Subscription-based models',
      'Social commerce growth',
      'Voice interface adoption'
    ];
    
    const count = Math.floor(Math.random() * 4) + 3;
    return trends.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private generateMockOpportunities(): string[] {
    const opportunities = [
      'Underserved market segments',
      'Emerging geographic markets',
      'Technology integration gaps',
      'Changing regulatory landscape',
      'Supply chain optimization',
      'Customer experience enhancement',
      'Strategic partnerships',
      'Product line extension',
      'Market consolidation potential',
      'Cost reduction initiatives'
    ];
    
    const count = Math.floor(Math.random() * 3) + 2;
    return opportunities.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private generateMockThreats(): string[] {
    const threats = [
      'Increased competition',
      'Economic uncertainty',
      'Regulatory changes',
      'Technology disruption',
      'Changing consumer preferences',
      'Supply chain vulnerabilities',
      'Cybersecurity risks',
      'Market saturation',
      'Resource constraints',
      'External dependencies'
    ];
    
    const count = Math.floor(Math.random() * 3) + 2;
    return threats.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private generateMockAudience(businessTitle: string): any {
    return {
      primarySegment: 'Tech-savvy professionals',
      demographics: {
        ageRange: '25-45',
        income: '$50K-$150K',
        education: 'College educated',
        location: 'Urban/Suburban'
      },
      psychographics: {
        values: ['Innovation', 'Efficiency', 'Quality'],
        interests: ['Technology', 'Productivity', 'Lifestyle'],
        behaviors: ['Early adopters', 'Online shoppers', 'Social media users']
      },
      painPoints: [
        'Time constraints',
        'Cost concerns',
        'Complexity issues',
        'Reliability needs'
      ]
    };
  }

  private generateMockStrategy(): any {
    return {
      approach: 'Multi-channel market entry',
      phases: [
        'Initial market validation',
        'Limited regional rollout',
        'Scaled national expansion',
        'International markets'
      ],
      channels: ['Digital marketing', 'Strategic partnerships', 'Direct sales', 'Referral programs'],
      timeline: '18-24 months'
    };
  }

  private generateMockRisks(): string[] {
    const risks = [
      'Market adoption slower than expected',
      'Competitive response',
      'Technical implementation challenges',
      'Funding requirements higher than projected',
      'Regulatory compliance complexity'
    ];
    
    const count = Math.floor(Math.random() * 3) + 2;
    return risks.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private generateMockRecommendations(): string[] {
    return [
      'Conduct additional market validation',
      'Develop minimum viable product',
      'Establish strategic partnerships',
      'Secure initial funding round',
      'Build core team capabilities'
    ];
  }
}