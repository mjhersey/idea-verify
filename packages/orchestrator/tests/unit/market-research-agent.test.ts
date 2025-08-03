/**
 * Unit tests for Market Research Agent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketResearchAgent } from '../../src/agents/market-research-agent.js';
import { AgentRequest, AgentExecutionContext } from '../../src/agents/types.js';

// Mock LLM Provider
const mockAnalyzeMarketResearch = vi.fn();
vi.mock('../../src/llm/index.js', () => ({
  LLMProviderFactory: {
    getProvider: () => ({
      analyzeMarketResearch: mockAnalyzeMarketResearch
    })
  }
}));

describe('MarketResearchAgent', () => {
  let agent: MarketResearchAgent;
  let mockRequest: AgentRequest;
  let mockContext: AgentExecutionContext;

  beforeEach(() => {
    agent = new MarketResearchAgent();
    mockAnalyzeMarketResearch.mockClear();
    
    mockRequest = {
      businessIdea: {
        id: 'idea-123',
        title: 'AI-Powered Fitness Tracking App',
        description: 'A mobile app that uses AI to provide personalized fitness recommendations'
      },
      analysisType: 'market_size'
    };

    mockContext = {
      evaluationId: 'eval-123',
      correlationId: 'corr-123',
      timestamp: new Date()
    };
  });

  describe('basic functionality', () => {
    it('should have correct agent properties', () => {
      expect(agent.getAgentType()).toBe('market-research');
      expect(agent.getName()).toBe('Market Research Agent');
      expect(agent.getDescription()).toContain('market size');
    });

    it('should validate required request fields', async () => {
      const invalidRequest = {
        businessIdea: null as any,
        analysisType: 'market_size'
      };

      await expect(agent.execute(invalidRequest, mockContext))
        .rejects.toThrow('Business idea is required');
    });

    it('should validate business idea structure', async () => {
      const invalidRequest = {
        businessIdea: {
          id: 'idea-123',
          title: '',
          description: 'Some description'
        },
        analysisType: 'market_size'
      };

      await expect(agent.execute(invalidRequest, mockContext))
        .rejects.toThrow('Business idea must have title and description');
    });

    it('should validate analysis type', async () => {
      const invalidRequest = {
        businessIdea: mockRequest.businessIdea,
        analysisType: ''
      };

      await expect(agent.execute(invalidRequest, mockContext))
        .rejects.toThrow('Analysis type is required');
    });
  });

  describe('successful execution', () => {
    it('should execute successfully with comprehensive market data', async () => {
      const mockResult = {
        marketSize: {
          totalMarketSize: 50000000000, // $50B
          targetMarketSize: 5000000000,  // $5B
          growthRate: 8.5
        },
        competitors: [
          {
            name: 'MyFitnessPal',
            marketShare: 25,
            strengths: ['Large user base', 'Comprehensive food database'],
            weaknesses: ['Limited AI features']
          },
          {
            name: 'Fitbit',
            marketShare: 15,
            strengths: ['Hardware integration', 'Brand recognition'],
            weaknesses: ['Subscription model']
          }
        ],
        trends: [
          {
            description: 'Increasing adoption of AI in fitness apps',
            impact: 'high' as const,
            timeframe: '2024-2026'
          },
          {
            description: 'Growing focus on personalized health',
            impact: 'high' as const,
            timeframe: '2024-2025'
          }
        ],
        opportunities: [
          {
            description: 'AI-powered personalization gap in current market',
            impact: 'high' as const,
            marketSize: 1000000000
          },
          {
            description: 'Integration with wearable devices',
            impact: 'medium' as const,
            marketSize: 500000000
          }
        ],
        score: 85,
        insights: [
          'Large and growing market opportunity',
          'Strong competitive landscape but room for innovation',
          'AI differentiation provides competitive advantage'
        ],
        confidence: 'high' as const
      };
      
      mockAnalyzeMarketResearch.mockResolvedValue(mockResult);

      const result = await agent.execute(mockRequest, mockContext);

      expect(result).toBeDefined();
      expect(result.agentType).toBe('market-research');
      expect(result.score).toBe(85);
      expect(result.confidence).toBe('high');
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThan(0);
      
      // Check for specific market insights
      expect(result.insights.some(insight => 
        insight.includes('$50.0B')
      )).toBe(true);
      
      expect(result.insights.some(insight => 
        insight.includes('2 key competitors')
      )).toBe(true);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.model).toBe('llm-provider');
      expect(result.metadata.retryCount).toBe(0);

      expect(result.rawData).toBeDefined();
      expect(result.rawData.marketResearch).toBeDefined();
      expect(result.rawData.analysisType).toBe('market_size');
    });

    it('should handle moderate confidence results', async () => {
      mockAnalyzeMarketResearch.mockResolvedValue({
        marketSize: {
          totalMarketSize: 1000000000, // $1B
          targetMarketSize: 100000000, // $100M
          growthRate: 3.2
        },
        competitors: [
          {
            name: 'Competitor A',
            marketShare: 15,
            strengths: ['Some strength'],
            weaknesses: ['Some weakness']
          },
          {
            name: 'Competitor B',
            marketShare: 8,
            strengths: ['Another strength'],
            weaknesses: ['Another weakness']
          }
        ],
        trends: [
          { description: 'Growing market trend', impact: 'medium' as const, timeframe: '2024' },
          { description: 'Technology adoption', impact: 'low' as const, timeframe: '2025' }
        ],
        opportunities: [],
        score: 65,
        insights: [
          'Moderate market opportunity',
          'Limited competitive intelligence available',
          'Decent growth potential'
        ],
        confidence: 'medium' as const
      });

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.score).toBe(65);
      expect(result.confidence).toBe('medium');
      expect(result.insights).toContain('Moderate market opportunity with decent potential');
    });

    it('should handle low confidence results', async () => {
      mockAnalyzeMarketResearch.mockResolvedValue({
        marketSize: undefined,
        competitors: undefined,
        trends: undefined,
        opportunities: undefined,
        score: 25,
        insights: ['Limited market data available'],
        confidence: 'low' as const
      });

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.score).toBe(25);
      expect(result.confidence).toBe('low');
      expect(result.insights).toContain('Challenging market conditions with significant barriers');
    });
  });

  describe('error handling', () => {
    it('should handle LLM provider errors gracefully', async () => {
      mockAnalyzeMarketResearch.mockRejectedValue(
        new Error('LLM service unavailable')
      );

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.score).toBe(0);
      expect(result.confidence).toBe('low');
      expect(result.insights).toEqual(['Analysis failed: LLM service unavailable']);
      expect(result.rawData.error).toBe('LLM service unavailable');
    });

    it('should handle non-Error exceptions', async () => {
      mockAnalyzeMarketResearch.mockRejectedValue('String error');

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.score).toBe(0);
      expect(result.confidence).toBe('low');
      expect(result.insights).toEqual(['Analysis failed: Unknown error']);
      expect(result.rawData.error).toBe('Unknown error');
    });
  });

  describe('insights extraction', () => {
    it('should extract currency-formatted market size insights', async () => {
      mockAnalyzeMarketResearch.mockResolvedValue({
        marketSize: {
          totalMarketSize: 1500000000, // $1.5B
          targetMarketSize: 150000000,  // $150M
          growthRate: 12.5
        },
        competitors: [],
        trends: [],
        opportunities: [],
        score: 75,
        insights: [],
        confidence: 'medium' as const
      });

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.insights.some(insight => 
        insight.includes('$1.5B')
      )).toBe(true);
      
      expect(result.insights.some(insight => 
        insight.includes('$150.0M')
      )).toBe(true);

      expect(result.insights.some(insight => 
        insight.includes('rapidly growing')
      )).toBe(true);
    });

    it('should extract competitor insights', async () => {
      mockAnalyzeMarketResearch.mockResolvedValue({
        marketSize: undefined,
        competitors: [
          { name: 'Comp1', marketShare: 15, strengths: [], weaknesses: [] },
          { name: 'Comp2', marketShare: 8, strengths: [], weaknesses: [] },
          { name: 'Comp3', marketShare: 5, strengths: [], weaknesses: [] }
        ],
        trends: [],
        opportunities: [],
        score: 70,
        insights: [],
        confidence: 'medium' as const
      });

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.insights.some(insight => 
        insight.includes('3 key competitors')
      )).toBe(true);
      
      expect(result.insights.some(insight => 
        insight.includes('1 competitors hold significant market share')
      )).toBe(true);
    });

    it('should extract trend and opportunity insights', async () => {
      mockAnalyzeMarketResearch.mockResolvedValue({
        marketSize: undefined,
        competitors: [],
        trends: [
          { description: 'AI automation trend', impact: 'high' as const, timeframe: '2024' },
          { description: 'Mobile-first approach', impact: 'medium' as const, timeframe: '2024' }
        ],
        opportunities: [
          { description: 'Underserved market segment', impact: 'high' as const, marketSize: 100000000 }
        ],
        score: 60,
        insights: [],
        confidence: 'medium' as const
      });

      const result = await agent.execute(mockRequest, mockContext);

      expect(result.insights.some(insight => 
        insight.includes('1 high-impact trends')
      )).toBe(true);
      
      expect(result.insights.some(insight => 
        insight.includes('Market trend: AI automation trend')
      )).toBe(true);

      expect(result.insights.some(insight => 
        insight.includes('Opportunity: Underserved market segment')
      )).toBe(true);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate high confidence with complete data', async () => {
      mockAnalyzeMarketResearch.mockResolvedValue({
        marketSize: {
          totalMarketSize: 1000000000,
          targetMarketSize: 100000000,
          growthRate: 5
        },
        competitors: [
          { name: 'C1', marketShare: 10, strengths: [], weaknesses: [] },
          { name: 'C2', marketShare: 8, strengths: [], weaknesses: [] },
          { name: 'C3', marketShare: 5, strengths: [], weaknesses: [] }
        ],
        trends: [
          { description: 'T1', impact: 'high' as const, timeframe: '2024' },
          { description: 'T2', impact: 'medium' as const, timeframe: '2024' }
        ],
        opportunities: [
          { description: 'O1', impact: 'high' as const, marketSize: 100000000 },
          { description: 'O2', impact: 'medium' as const, marketSize: 50000000 }
        ],
        score: 80,
        insights: ['I1', 'I2', 'I3'],
        confidence: 'high' as const
      });

      const result = await agent.execute(mockRequest, mockContext);
      expect(result.confidence).toBe('high');
    });
  });
});