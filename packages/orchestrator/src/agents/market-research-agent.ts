/**
 * Market Research Agent - Analyzes market size, trends, and opportunities
 */

import { BaseAgent, AgentRequest, AgentResponse, AgentExecutionContext } from './types.js';
import { LLMProviderFactory } from '../llm/index.js';
import { MarketResearchResult } from '../llm/types.js';

export class MarketResearchAgent extends BaseAgent {
  constructor() {
    super(
      'market-research',
      'Market Research Agent',
      'Analyzes market size, trends, competition, and opportunities for business ideas'
    );
  }

  async execute(
    request: AgentRequest,
    _context: AgentExecutionContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    this.validateRequest(request);

    try {
      console.log(`Market Research Agent executing for business idea: ${request.businessIdea.title}`);

      // Get LLM provider factory and perform analysis
      const providerFactory = LLMProviderFactory.getProvider();

      // Perform market research analysis using the factory method
      const marketResearch = await providerFactory.analyzeMarketResearch({
        businessIdeaTitle: request.businessIdea.title,
        businessIdeaDescription: request.businessIdea.description,
        analysisType: request.analysisType,
        additionalContext: request.context
      });

      // Extract insights and calculate additional metrics
      const insights = this.extractInsights(marketResearch);
      const confidence = this.calculateMarketConfidence(marketResearch);
      const processingTime = Date.now() - startTime;

      return {
        agentType: this.agentType,
        score: marketResearch.score,
        insights: this.formatInsights(insights),
        confidence,
        metadata: {
          processingTime,
          model: 'llm-provider',
          retryCount: 0
        },
        rawData: {
          marketResearch,
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea
        }
      };

    } catch (error) {
      console.error(`Market Research Agent failed:`, error);
      
      return {
        agentType: this.agentType,
        score: 0,
        insights: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        confidence: 'low',
        metadata: {
          processingTime: Date.now() - startTime,
          model: 'unknown',
          retryCount: 0
        },
        rawData: {
          error: error instanceof Error ? error.message : 'Unknown error',
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea
        }
      };
    }
  }

  private extractInsights(marketResearch: MarketResearchResult): string[] {
    const insights: string[] = [];

    // Handle case where marketResearch is undefined or null
    if (!marketResearch) {
      insights.push('Market analysis data not available');
      return insights;
    }

    // Market size insights - handle both object and number formats
    const marketSizeData = marketResearch.marketSize;
    if (marketSizeData) {
      // Handle object format (structured marketSize)
      if (typeof marketSizeData === 'object' && marketSizeData !== null) {
        const { totalMarketSize, targetMarketSize, growthRate } = marketSizeData as any;
        
        if (totalMarketSize) {
          insights.push(`Total addressable market (TAM) estimated at ${this.formatCurrency(totalMarketSize)}`);
        }
        
        if (targetMarketSize) {
          insights.push(`Target market size estimated at ${this.formatCurrency(targetMarketSize)}`);
        }
        
        if (growthRate !== undefined) {
          const growthDescription = growthRate > 5 ? 'rapidly growing' : 
                                   growthRate > 2 ? 'steadily growing' : 'stable';
          insights.push(`Market showing ${growthDescription} trend at ${growthRate}% annually`);
        }
      } else if (typeof marketSizeData === 'number') {
        // Handle simple number format (mock provider compatibility)
        insights.push(`Market size estimated at ${this.formatCurrency(marketSizeData)}`);
        
        // Use growth rate from separate field if available
        const growthRate = (marketResearch as any).marketGrowthRate;
        if (growthRate !== undefined) {
          const growthDescription = growthRate > 5 ? 'rapidly growing' : 
                                   growthRate > 2 ? 'steadily growing' : 'stable';
          insights.push(`Market showing ${growthDescription} trend at ${growthRate.toFixed(1)}% annually`);
        }
      }
    }

    // Competitor insights
    if (marketResearch.competitors && Array.isArray(marketResearch.competitors) && marketResearch.competitors.length > 0) {
      const competitorCount = marketResearch.competitors.length;
      insights.push(`Identified ${competitorCount} key competitors in the market`);
      
      const strongCompetitors = marketResearch.competitors.filter(c => c && c.marketShare && c.marketShare > 10);
      if (strongCompetitors.length > 0) {
        insights.push(`${strongCompetitors.length} competitors hold significant market share (>10%)`);
      }
    }

    // Trend insights
    if (marketResearch.trends && Array.isArray(marketResearch.trends) && marketResearch.trends.length > 0) {
      const emergingTrends = marketResearch.trends.filter(t => t && t.impact === 'high');
      if (emergingTrends.length > 0) {
        insights.push(`${emergingTrends.length} high-impact trends identified affecting the market`);
      }
      
      // Add specific trend insights
      marketResearch.trends.slice(0, 3).forEach(trend => {
        if (trend && trend.description) {
          insights.push(`Market trend: ${trend.description}`);
        }
      });
    }

    // Opportunity insights
    if (marketResearch.opportunities && Array.isArray(marketResearch.opportunities) && marketResearch.opportunities.length > 0) {
      marketResearch.opportunities.slice(0, 3).forEach(opportunity => {
        if (opportunity && opportunity.description) {
          insights.push(`Opportunity: ${opportunity.description}`);
        }
      });
    }

    // Add score-based insights
    if (marketResearch.score >= 80) {
      insights.push('Strong market opportunity with high potential for success');
    } else if (marketResearch.score >= 60) {
      insights.push('Moderate market opportunity with decent potential');
    } else if (marketResearch.score >= 40) {
      insights.push('Limited market opportunity requiring careful strategy');
    } else {
      insights.push('Challenging market conditions with significant barriers');
    }

    return insights;
  }

  private calculateMarketConfidence(marketResearch: MarketResearchResult): 'high' | 'medium' | 'low' {
    // Handle null/undefined market research
    if (!marketResearch) {
      return 'low';
    }

    let confidenceFactors = 0;
    let totalFactors = 0;

    // Market size data availability
    totalFactors++;
    if (marketResearch.marketSize?.totalMarketSize && 
        marketResearch.marketSize?.targetMarketSize) {
      confidenceFactors++;
    }

    // Competitor data quality
    totalFactors++;
    if (marketResearch.competitors && marketResearch.competitors.length >= 3) {
      confidenceFactors++;
    }

    // Trend analysis depth
    totalFactors++;
    if (marketResearch.trends && marketResearch.trends.length >= 2) {
      confidenceFactors++;
    }

    // Opportunity identification
    totalFactors++;
    if (marketResearch.opportunities && marketResearch.opportunities.length >= 2) {
      confidenceFactors++;
    }

    // Overall score reliability
    totalFactors++;
    if (marketResearch.score > 0 && marketResearch.insights.length >= 3) {
      confidenceFactors++;
    }

    const confidenceRatio = confidenceFactors / totalFactors;
    
    if (confidenceRatio >= 0.8) return 'high';
    if (confidenceRatio >= 0.6) return 'medium';
    return 'low';
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`;
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    } else {
      return `$${amount.toFixed(0)}`;
    }
  }
}