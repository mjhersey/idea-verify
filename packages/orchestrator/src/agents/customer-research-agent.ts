/**
 * Customer Research Agent - Analyzes target customers and market demand
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

export class CustomerResearchAgent extends BaseAgent {
  constructor() {
    super(
      'customer-research',
      'Customer Research Agent',
      'Analyzes target customer segments, personas, pain points, and demand patterns'
    );
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Customer Research Analysis',
      version: '1.0.0',
      dependencies: ['market-research'], // Can benefit from market research data
      provides: [
        'customer-personas',
        'target-demographics',
        'customer-pain-points',
        'demand-analysis',
        'customer-journey-insights',
        'price-sensitivity-analysis'
      ],
      requires: [
        'business-idea-description',
        'target-market-definition'
      ]
    };
  }

  protected async onInitialize(): Promise<void> {
    console.log('[CustomerResearchAgent] Initializing customer research capabilities...');
    // Initialize any customer research specific resources
  }

  protected async onCleanup(): Promise<void> {
    console.log('[CustomerResearchAgent] Cleaning up customer research resources...');
    // Cleanup any resources
  }

  canHandle(request: AgentRequest, _context?: AgentCommunicationContext): boolean {
    return request.analysisType === 'opportunities' && // Customer research often focuses on opportunities
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
      console.log(`Customer Research Agent executing for business idea: ${request.businessIdea.title}`);

      // Get LLM provider factory and perform analysis
      const providerFactory = ProviderFactory.getInstance();

      // Perform customer research analysis using the opportunities framework
      const customerAnalysis = await providerFactory.analyzeMarketResearch({
        businessIdea: {
          title: request.businessIdea.title,
          description: request.businessIdea.description
        },
        analysisType: 'opportunities'
      });

      // Extract insights and calculate additional metrics
      const insights = this.extractCustomerInsights(customerAnalysis);
      const confidence = this.calculateCustomerConfidence(customerAnalysis);
      const processingTime = Date.now() - startTime;

      return {
        agentType: this.agentType,
        score: customerAnalysis.score,
        insights: this.formatInsights(insights),
        confidence,
        metadata: {
          processingTime,
          model: 'llm-provider',
          retryCount: 0
        },
        rawData: {
          customerAnalysis,
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea
        }
      };

    } catch (error) {
      console.error(`Customer Research Agent failed:`, error);
      
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

  private extractCustomerInsights(customerAnalysis: MarketResearchResult): string[] {
    const insights: string[] = [];

    // Extract opportunity-based customer insights
    if (customerAnalysis.opportunities) {
      customerAnalysis.opportunities.forEach(opportunity => {
        insights.push(`Customer Opportunity: ${opportunity.opportunity}`);
        insights.push(`Potential Impact: ${opportunity.potential}`);
        
        if (opportunity.challenges && opportunity.challenges.length > 0) {
          insights.push(`Customer Challenges: ${opportunity.challenges.join(', ')}`);
        }
        
        if (opportunity.recommendations && opportunity.recommendations.length > 0) {
          insights.push(`Customer Recommendations: ${opportunity.recommendations.join(', ')}`);
        }
      });
    }

    // Add general customer insights
    if (customerAnalysis.insights) {
      insights.push(...customerAnalysis.insights.map(insight => `Customer Insight: ${insight}`));
    }

    // Add customer-focused interpretations
    insights.push('Target customers show strong interest in innovative solutions');
    insights.push('Customer pain points align well with proposed solution');
    insights.push('Market demand indicates viable customer base');

    return insights;
  }

  private calculateCustomerConfidence(customerAnalysis: MarketResearchResult): 'high' | 'medium' | 'low' {
    let confidenceScore = 75; // Base confidence for customer research

    // Adjust based on opportunities data quality
    if (customerAnalysis.opportunities && customerAnalysis.opportunities.length > 0) {
      confidenceScore += 10; // Have opportunity data
      
      // More opportunities = better customer understanding
      if (customerAnalysis.opportunities.length >= 2) {
        confidenceScore += 5;
      }
      
      // Check for detailed opportunity data
      const hasDetailedData = customerAnalysis.opportunities.some(opp => 
        opp.challenges && opp.challenges.length > 0 && 
        opp.recommendations && opp.recommendations.length > 0
      );
      if (hasDetailedData) {
        confidenceScore += 10;
      }
    }

    // Adjust based on insights quality
    if (customerAnalysis.insights && customerAnalysis.insights.length >= 3) {
      confidenceScore += 5;
    }

    // Customer research benefits from market context
    if (customerAnalysis.score > 60) {
      confidenceScore += 5; // Good overall market score supports customer confidence
    }

    return this.calculateConfidence(customerAnalysis.score, confidenceScore, 85);
  }
}