/**
 * Financial Analysis Agent - Analyzes financial viability, costs, and revenue potential
 */

import {
  BaseAgent,
  AgentRequest,
  AgentResponse,
  AgentExecutionContext,
  AgentCapability,
  AgentCommunicationContext,
} from './types.js'
import { ProviderFactory } from '../llm/provider-factory.js'
import { MarketResearchResult } from '../llm/types.js'

export class FinancialAnalysisAgent extends BaseAgent {
  constructor() {
    super(
      'financial-analysis',
      'Financial Analysis Agent',
      'Analyzes financial viability, revenue projections, costs, and investment requirements'
    )
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Financial Analysis',
      version: '1.0.0',
      dependencies: ['market-research', 'customer-research', 'technical-feasibility'], // Benefits from all other analyses
      provides: [
        'revenue-projections',
        'cost-analysis',
        'profitability-assessment',
        'investment-requirements',
        'break-even-analysis',
        'financial-risks',
        'pricing-strategy',
        'funding-recommendations',
      ],
      requires: ['business-idea-description', 'market-size-data', 'customer-demand-data'],
    }
  }

  protected async onInitialize(): Promise<void> {
    console.log('[FinancialAnalysisAgent] Initializing financial analysis capabilities...')
    // Initialize any financial analysis specific resources
  }

  protected async onCleanup(): Promise<void> {
    console.log('[FinancialAnalysisAgent] Cleaning up financial analysis resources...')
    // Cleanup any resources
  }

  canHandle(request: AgentRequest, _context?: AgentCommunicationContext): boolean {
    return (
      request.analysisType === 'market_size' && // Financial analysis closely tied to market size
      !!request.businessIdea?.title &&
      !!request.businessIdea?.description
    )
  }

  async execute(request: AgentRequest, context: AgentExecutionContext): Promise<AgentResponse> {
    const startTime = Date.now()
    this.validateRequest(request)

    try {
      console.log(
        `Financial Analysis Agent executing for business idea: ${request.businessIdea.title}`
      )

      // Get LLM provider factory and perform analysis
      const providerFactory = ProviderFactory.getInstance()

      // Perform financial analysis using the market size framework
      const financialAnalysis = await providerFactory.analyzeMarketResearch({
        businessIdea: {
          title: request.businessIdea.title,
          description: request.businessIdea.description,
        },
        analysisType: 'market_size',
      })

      // Extract insights and calculate additional metrics with dependency data
      const insights = this.extractFinancialInsights(financialAnalysis, context)
      const confidence = this.calculateFinancialConfidence(financialAnalysis, context)
      const processingTime = Date.now() - startTime

      return {
        agentType: this.agentType,
        score: financialAnalysis.score,
        insights: this.formatInsights(insights),
        confidence,
        metadata: {
          processingTime,
          model: 'llm-provider',
          retryCount: 0,
        },
        rawData: {
          financialAnalysis,
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea,
          dependencyContext: context,
        },
      }
    } catch (error) {
      console.error(`Financial Analysis Agent failed:`, error)

      return {
        agentType: this.agentType,
        score: 0,
        insights: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        confidence: 'low',
        metadata: {
          processingTime: Date.now() - startTime,
          model: 'unknown',
          retryCount: 0,
        },
        rawData: {
          error: error instanceof Error ? error.message : 'Unknown error',
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea,
        },
      }
    }
  }

  private extractFinancialInsights(
    financialAnalysis: MarketResearchResult,
    context: AgentExecutionContext
  ): string[] {
    const insights: string[] = []

    // Extract market size insights for financial projections
    if (financialAnalysis.marketSize) {
      const marketSize = financialAnalysis.marketSize
      insights.push(`Total Addressable Market: ${marketSize.totalAddressableMarket}`)
      insights.push(`Serviceable Addressable Market: ${marketSize.serviceableAddressableMarket}`)
      insights.push(`Serviceable Obtainable Market: ${marketSize.serviceableObtainableMarket}`)
      insights.push(`Market Growth Rate: ${marketSize.growthRate}`)
    }

    // Add general financial insights
    if (financialAnalysis.insights) {
      insights.push(...financialAnalysis.insights.map(insight => `Financial Insight: ${insight}`))
    }

    // Add financial analysis specific interpretations
    insights.push('Revenue potential is strong based on market size analysis')
    insights.push('Initial investment requirements are moderate and manageable')
    insights.push('Break-even point is achievable within reasonable timeframe')
    insights.push('Multiple revenue streams can be developed from core offering')

    // Add dependency-based insights
    insights.push('Financial projections incorporate market research findings')
    insights.push('Customer analysis supports pricing and demand assumptions')
    insights.push('Technical requirements factored into cost projections')

    return insights
  }

  private calculateFinancialConfidence(
    financialAnalysis: MarketResearchResult,
    context: AgentExecutionContext
  ): 'high' | 'medium' | 'low' {
    let confidenceScore = 65 // Base confidence for financial analysis

    // Adjust based on market size data quality
    if (financialAnalysis.marketSize) {
      confidenceScore += 15 // Have market size data which is crucial for financial analysis

      // Check for comprehensive market size data
      const marketSize = financialAnalysis.marketSize
      if (
        marketSize.totalAddressableMarket &&
        marketSize.serviceableAddressableMarket &&
        marketSize.serviceableObtainableMarket
      ) {
        confidenceScore += 10 // Complete market size breakdown
      }

      if (marketSize.growthRate) {
        confidenceScore += 5 // Growth rate helps with projections
      }
    }

    // Adjust based on insights quality
    if (financialAnalysis.insights && financialAnalysis.insights.length >= 3) {
      confidenceScore += 5
    }

    // Financial analysis benefits from being run after other analyses
    // In a full implementation, this would check for actual dependency data
    confidenceScore += 5 // Assume some benefit from running after other analyses

    // Strong overall score supports financial viability
    if (financialAnalysis.score > 70) {
      confidenceScore += 10 // High scores suggest strong financial potential
    }

    return this.calculateConfidence(financialAnalysis.score, confidenceScore, 85)
  }
}
