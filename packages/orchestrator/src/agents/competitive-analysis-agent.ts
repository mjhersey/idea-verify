/**
 * Competitive Analysis Agent - Analyzes competitive landscape and positioning
 */

import { 
  BaseAgent, 
  AgentRequest, 
  AgentResponse, 
  AgentExecutionContext,
  AgentCapability,
  AgentCommunicationContext
} from './types.js';
import { ProviderFactory } from '../llm/provider-factory.js';
import { MarketResearchResult } from '../llm/types.js';

export class CompetitiveAnalysisAgent extends BaseAgent {
  constructor() {
    super(
      'competitive-analysis',
      'Competitive Analysis Agent',
      'Analyzes competitive landscape, identifies key competitors, and determines market positioning opportunities'
    );
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Competitive Analysis',
      version: '1.0.0',
      dependencies: ['market-research'], // Can benefit from market research data
      provides: [
        'competitor-profiles',
        'competitive-advantages',
        'market-positioning',
        'competitive-threats',
        'differentiation-opportunities'
      ],
      requires: [
        'business-idea-description',
        'target-market-definition'
      ]
    };
  }

  protected async onInitialize(): Promise<void> {
    console.log('[CompetitiveAnalysisAgent] Initializing competitive analysis capabilities...');
    // Initialize any competitive analysis specific resources
  }

  protected async onCleanup(): Promise<void> {
    console.log('[CompetitiveAnalysisAgent] Cleaning up competitive analysis resources...');
    // Cleanup any resources
  }

  canHandle(request: AgentRequest, _context?: AgentCommunicationContext): boolean {
    return request.analysisType === 'competitors' && 
           !!request.businessIdea?.title && 
           !!request.businessIdea?.description;
  }

  async execute(
    request: AgentRequest,
    _context: AgentExecutionContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    this.validateRequest(request);

    try {
      console.log(`Competitive Analysis Agent executing for business idea: ${request.businessIdea.title}`);

      // Get LLM provider factory and perform analysis
      const providerFactory = ProviderFactory.getInstance();

      // Perform competitive analysis using the market research framework
      const competitiveAnalysis = await providerFactory.analyzeMarketResearch({
        businessIdea: {
          title: request.businessIdea.title,
          description: request.businessIdea.description
        },
        analysisType: 'competitors'
      });

      // Extract insights and calculate additional metrics
      const insights = this.extractCompetitiveInsights(competitiveAnalysis);
      const confidence = this.calculateCompetitiveConfidence(competitiveAnalysis);
      const processingTime = Date.now() - startTime;

      return {
        agentType: this.agentType,
        score: competitiveAnalysis.score,
        insights: this.formatInsights(insights),
        confidence,
        metadata: {
          processingTime,
          model: 'llm-provider',
          retryCount: 0
        },
        rawData: {
          competitiveAnalysis,
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea
        }
      };

    } catch (error) {
      console.error(`Competitive Analysis Agent failed:`, error);
      
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

  private extractCompetitiveInsights(competitiveAnalysis: MarketResearchResult): string[] {
    const insights: string[] = [];

    // Extract competitor-specific insights
    if (competitiveAnalysis.competitors) {
      competitiveAnalysis.competitors.forEach(competitor => {
        insights.push(`${competitor.name}: ${competitor.description}`);
        if (competitor.marketShare) {
          insights.push(`${competitor.name} holds ${competitor.marketShare} market share`);
        }
        if (competitor.strengths) {
          insights.push(`${competitor.name} strengths: ${competitor.strengths.join(', ')}`);
        }
        if (competitor.weaknesses) {
          insights.push(`${competitor.name} weaknesses: ${competitor.weaknesses.join(', ')}`);
        }
      });
    }

    // Add general competitive insights
    if (competitiveAnalysis.insights) {
      insights.push(...competitiveAnalysis.insights);
    }

    return insights;
  }

  private calculateCompetitiveConfidence(competitiveAnalysis: MarketResearchResult): 'high' | 'medium' | 'low' {
    let confidenceScore = 70; // Base confidence

    // Adjust based on data quality
    if (competitiveAnalysis.competitors && competitiveAnalysis.competitors.length > 0) {
      confidenceScore += 10; // Have competitor data
      
      // More competitors = better analysis
      if (competitiveAnalysis.competitors.length >= 3) {
        confidenceScore += 10;
      }
      
      // Check for detailed competitor data
      const hasDetailedData = competitiveAnalysis.competitors.some(c => 
        c.marketShare && c.strengths && c.weaknesses
      );
      if (hasDetailedData) {
        confidenceScore += 10;
      }
    }

    // Adjust based on insights quality
    if (competitiveAnalysis.insights && competitiveAnalysis.insights.length >= 3) {
      confidenceScore += 5;
    }

    return this.calculateConfidence(competitiveAnalysis.score, confidenceScore, 80);
  }
}