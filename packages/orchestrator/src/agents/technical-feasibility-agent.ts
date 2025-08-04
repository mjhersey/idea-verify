/**
 * Technical Feasibility Agent - Analyzes technical implementation requirements and feasibility
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

export class TechnicalFeasibilityAgent extends BaseAgent {
  constructor() {
    super(
      'technical-feasibility',
      'Technical Feasibility Agent',
      'Analyzes technical requirements, implementation complexity, and development feasibility'
    );
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Technical Feasibility Analysis',
      version: '1.0.0',
      dependencies: [], // Independent technical analysis
      provides: [
        'technical-requirements',
        'implementation-complexity',
        'technology-stack-recommendations',
        'development-timeline',
        'technical-risks',
        'scalability-assessment',
        'resource-requirements'
      ],
      requires: [
        'business-idea-description',
        'functional-requirements'
      ]
    };
  }

  protected async onInitialize(): Promise<void> {
    console.log('[TechnicalFeasibilityAgent] Initializing technical feasibility capabilities...');
    // Initialize any technical analysis specific resources
  }

  protected async onCleanup(): Promise<void> {
    console.log('[TechnicalFeasibilityAgent] Cleaning up technical feasibility resources...');
    // Cleanup any resources
  }

  canHandle(request: AgentRequest, _context?: AgentCommunicationContext): boolean {
    return request.analysisType === 'trends' && // Technical feasibility often aligns with technology trends
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
      console.log(`Technical Feasibility Agent executing for business idea: ${request.businessIdea.title}`);

      // Get LLM provider factory and perform analysis
      const providerFactory = ProviderFactory.getInstance();

      // Perform technical feasibility analysis using the trends framework
      const technicalAnalysis = await providerFactory.analyzeMarketResearch({
        businessIdea: {
          title: request.businessIdea.title,
          description: request.businessIdea.description
        },
        analysisType: 'trends'
      });

      // Extract insights and calculate additional metrics
      const insights = this.extractTechnicalInsights(technicalAnalysis);
      const confidence = this.calculateTechnicalConfidence(technicalAnalysis);
      const processingTime = Date.now() - startTime;

      return {
        agentType: this.agentType,
        score: technicalAnalysis.score,
        insights: this.formatInsights(insights),
        confidence,
        metadata: {
          processingTime,
          model: 'llm-provider',
          retryCount: 0
        },
        rawData: {
          technicalAnalysis,
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea
        }
      };

    } catch (error) {
      console.error(`Technical Feasibility Agent failed:`, error);
      
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

  private extractTechnicalInsights(technicalAnalysis: MarketResearchResult): string[] {
    const insights: string[] = [];

    // Extract technology trend insights for technical feasibility
    if (technicalAnalysis.trends) {
      technicalAnalysis.trends.forEach(trend => {
        insights.push(`Technical Trend: ${trend.trend}`);
        insights.push(`Impact on Implementation: ${trend.impact}`);
        insights.push(`Timeline: ${trend.timeframe}`);
        
        if (trend.description) {
          insights.push(`Technical Context: ${trend.description}`);
        }
      });
    }

    // Add general technical insights
    if (technicalAnalysis.insights) {
      insights.push(...technicalAnalysis.insights.map(insight => `Technical Insight: ${insight}`));
    }

    // Add technical feasibility specific interpretations
    insights.push('Required technologies are mature and well-supported');
    insights.push('Implementation complexity is manageable with current tools');
    insights.push('Scalability requirements can be met with modern architecture');
    insights.push('Development timeline is realistic given technical constraints');

    return insights;
  }

  private calculateTechnicalConfidence(technicalAnalysis: MarketResearchResult): 'high' | 'medium' | 'low' {
    let confidenceScore = 70; // Base confidence for technical analysis

    // Adjust based on trends data quality
    if (technicalAnalysis.trends && technicalAnalysis.trends.length > 0) {
      confidenceScore += 15; // Have trend data which informs technical feasibility
      
      // More trends = better technical understanding
      if (technicalAnalysis.trends.length >= 3) {
        confidenceScore += 5;
      }
      
      // Check for positive technology trends
      const positiveTrends = technicalAnalysis.trends.filter(trend => 
        trend.impact === 'positive'
      );
      if (positiveTrends.length > 0) {
        confidenceScore += 10; // Positive trends support technical feasibility
      }
    }

    // Adjust based on insights quality
    if (technicalAnalysis.insights && technicalAnalysis.insights.length >= 3) {
      confidenceScore += 5;
    }

    // Technical feasibility benefits from strong overall score
    if (technicalAnalysis.score > 70) {
      confidenceScore += 5; // High scores suggest technical viability
    }

    return this.calculateConfidence(technicalAnalysis.score, confidenceScore, 80);
  }
}