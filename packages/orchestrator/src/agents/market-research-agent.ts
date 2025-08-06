/**
 * Market Research Agent - Enhanced with comprehensive TAM/SAM/SOM analysis
 * Implements multiple methodologies and provides 0-100 opportunity scoring
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
import { MarketSizingEngine } from '../market-research/analysis/market-sizing-engine.js'
import { OpportunityScoringEngine } from '../market-research/analysis/opportunity-scoring-engine.js'
import { ConfidenceEngine } from '../market-research/analysis/confidence-engine.js'
import { TrendAnalyzer } from '../market-research/intelligence/trend-analyzer.js'
import { MarketIntelligenceEngine } from '../market-research/analysis/intelligence-engine.js'
import {
  MarketResearchOutput,
  MarketSizingRequest,
  MarketTrend,
  CompetitiveLandscape,
  DataSource,
} from '../market-research/schemas/market-research-types.js'

export class MarketResearchAgent extends BaseAgent {
  private marketSizingEngine: MarketSizingEngine
  private scoringEngine: OpportunityScoringEngine
  private confidenceEngine: ConfidenceEngine
  private trendAnalyzer: TrendAnalyzer
  private intelligenceEngine: MarketIntelligenceEngine

  constructor() {
    super(
      'market-research',
      'Enhanced Market Research Agent',
      'Comprehensive market analysis with TAM/SAM/SOM calculations, trend analysis, and 0-100 opportunity scoring'
    )

    this.marketSizingEngine = new MarketSizingEngine()
    this.scoringEngine = new OpportunityScoringEngine()
    this.confidenceEngine = new ConfidenceEngine()
    this.trendAnalyzer = new TrendAnalyzer()
    this.intelligenceEngine = new MarketIntelligenceEngine()
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Enhanced Market Research Analysis',
      version: '2.2.0',
      dependencies: [], // No dependencies - can run independently
      provides: [
        'tam-sam-som-analysis',
        'market-size-data',
        'competitor-analysis',
        'market-trends',
        'growth-projections',
        'opportunity-score',
        'confidence-assessment',
        'market-projections',
        'methodology-documentation',
      ],
      requires: ['business-idea-description', 'target-market-definition'],
    }
  }

  protected async onInitialize(): Promise<void> {
    console.log('[MarketResearchAgent] Initializing enhanced market research capabilities...')
    console.log('[MarketResearchAgent] - TAM/SAM/SOM calculation engine loaded')
    console.log('[MarketResearchAgent] - Opportunity scoring engine loaded')
    console.log('[MarketResearchAgent] - Confidence assessment engine loaded')
    console.log('[MarketResearchAgent] - Trend analyzer with web scraping capabilities loaded')
    console.log('[MarketResearchAgent] - Market intelligence engine with ML analytics loaded')
    // Initialize any market research specific resources
  }

  protected async onCleanup(): Promise<void> {
    console.log('[MarketResearchAgent] Cleaning up market research resources...')
    // Cleanup any resources
  }

  protected async onHealthCheck(): Promise<void> {
    // Test LLM provider availability
    const provider = ProviderFactory.getInstance()
    if (!provider) {
      throw new Error('LLM provider not available')
    }
  }

  protected async beforeExecution(
    request: AgentRequest,
    context: AgentExecutionContext,
    communicationContext: AgentCommunicationContext
  ): Promise<void> {
    // Store any required data in shared context
    communicationContext.sharedData.set('market-research-started', new Date())

    // Log execution start
    console.log(
      `[MarketResearchAgent] Starting market research for evaluation: ${context.evaluationId}`
    )
  }

  protected async afterExecution(
    response: AgentResponse,
    communicationContext: AgentCommunicationContext
  ): Promise<void> {
    // Share market data with other agents
    communicationContext.sharedData.set('market-size-data', {
      marketSize: response.rawData.marketResearch?.marketSize,
      growthRate: response.rawData.marketResearch?.marketGrowthRate,
      competitorCount: response.rawData.marketResearch?.competitors?.length || 0,
    })

    communicationContext.sharedData.set(
      'market-trends',
      response.rawData.marketResearch?.trends || []
    )

    console.log(`[MarketResearchAgent] Market research completed with score: ${response.score}`)
  }

  async execute(request: AgentRequest, _context: AgentExecutionContext): Promise<AgentResponse> {
    const startTime = Date.now()
    this.validateRequest(request)

    try {
      console.log(
        `Enhanced Market Research Agent executing for business idea: ${request.businessIdea.title}`
      )

      // Create comprehensive market sizing request
      const marketSizingRequest: MarketSizingRequest = {
        businessIdea: {
          title: request.businessIdea.title,
          description: request.businessIdea.description,
          category: this.inferCategory(request.businessIdea.description),
          geography: ['US'], // Default to US market
        },
        analysisType: request.analysisType,
        timeHorizon: 5,
        preferredMethodologies: ['top-down', 'bottom-up', 'value-theory'],
        confidenceThreshold: 60,
      }

      // Execute comprehensive market analysis
      console.log('[MarketResearchAgent] Calculating market size using multiple methodologies...')
      const marketSizeData = await this.marketSizingEngine.calculateMarketSize(marketSizingRequest)

      console.log('[MarketResearchAgent] Analyzing market trends and competitive landscape...')
      const [trends, competitive] = await Promise.all([
        this.trendAnalyzer.analyzeMarketTrends(marketSizingRequest),
        this.analyzeCompetitiveLandscape(marketSizingRequest),
      ])

      console.log('[MarketResearchAgent] Calculating opportunity score...')
      const opportunityScore = await this.scoringEngine.calculateOpportunityScore(
        marketSizeData,
        trends,
        competitive,
        marketSizingRequest
      )

      console.log('[MarketResearchAgent] Assessing confidence levels...')
      const confidenceAssessment = this.confidenceEngine.calculateConfidence(
        marketSizeData,
        trends,
        competitive
      )

      // Calculate processing time first
      const processingTime = Date.now() - startTime

      // Create comprehensive market research output
      const marketResearchOutput: MarketResearchOutput = {
        marketSize: marketSizeData,
        trends,
        competitiveLandscape: competitive,
        opportunityScore,
        metadata: {
          analysisDate: new Date(),
          processingTime: processingTime,
          dataQuality: confidenceAssessment.components.dataQuality,
          completeness: this.calculateCompleteness(marketSizeData, trends, competitive),
          version: '2.2.0',
          methodology: ['tam-sam-som', 'opportunity-scoring', 'confidence-assessment'],
        },
        assumptions: this.extractAssumptions(marketSizeData),
        limitations: this.identifyLimitations(confidenceAssessment),
        recommendations: this.generateRecommendations(opportunityScore, confidenceAssessment),
      }

      // Run advanced intelligence analysis
      console.log('[MarketResearchAgent] Running advanced intelligence analysis...')
      const intelligenceAnalysis = await this.intelligenceEngine.analyzeMarketIntelligence(
        marketResearchOutput,
        marketSizingRequest
      )

      // Extract insights from comprehensive analysis
      const insights = this.extractEnhancedInsights(marketResearchOutput, intelligenceAnalysis)

      console.log(
        `[MarketResearchAgent] Analysis completed in ${processingTime}ms with opportunity score: ${opportunityScore.overall}`
      )

      return {
        agentType: this.agentType,
        score: opportunityScore.overall,
        insights: this.formatInsights(insights),
        confidence: confidenceAssessment.overall,
        metadata: {
          processingTime,
          model: 'enhanced-market-research-v2.2',
          retryCount: 0,
        },
        rawData: {
          marketResearchOutput: marketResearchOutput,
          intelligenceAnalysis: intelligenceAnalysis,
          marketResearch: {
            marketSize: marketSizeData.tam.value,
            marketGrowthRate: marketSizeData.growthRate.annual,
            competitors: competitive.keyPlayers,
            trends: trends,
          },
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea,
          confidenceAssessment,
        },
      }
    } catch (error) {
      console.error(`Market Research Agent failed:`, error)

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

  /**
   * Enhanced helper methods for comprehensive market analysis
   */

  private inferCategory(description: string): string {
    const keywords = description.toLowerCase()
    if (
      keywords.includes('technology') ||
      keywords.includes('software') ||
      keywords.includes('app')
    )
      return 'technology'
    if (keywords.includes('health') || keywords.includes('medical')) return 'healthcare'
    if (keywords.includes('finance') || keywords.includes('fintech')) return 'finance'
    if (keywords.includes('retail') || keywords.includes('commerce')) return 'retail'
    if (keywords.includes('education') || keywords.includes('learning')) return 'education'
    return 'technology' // Default category
  }

  private async analyzeCompetitiveLandscape(
    request: MarketSizingRequest
  ): Promise<CompetitiveLandscape> {
    // Mock competitive analysis - in production, this would integrate with real competitive intelligence
    const category = request.businessIdea.category || 'technology'

    const competitorCounts: Record<string, number> = {
      technology: 25,
      healthcare: 15,
      finance: 20,
      retail: 30,
      education: 12,
    }

    const competitorCount = competitorCounts[category] || 20

    return {
      competitorCount,
      marketConcentration:
        competitorCount > 20
          ? 'fragmented'
          : competitorCount > 10
            ? 'concentrated'
            : 'monopolistic',
      entryBarriers: {
        overall: 'medium',
        financial: 60,
        regulatory: category === 'healthcare' ? 80 : category === 'finance' ? 70 : 40,
        technological: category === 'technology' ? 70 : 50,
        brand: 55,
        distribution: 45,
      },
      keyPlayers: [
        {
          name: 'Market Leader A',
          marketShare: 25,
          revenue: 1000000000,
          strengths: ['Brand recognition', 'Distribution network'],
          weaknesses: ['Legacy technology', 'High prices'],
          positioning: 'Premium market leader',
          threatLevel: 'high',
        },
        {
          name: 'Competitor B',
          marketShare: 15,
          revenue: 600000000,
          strengths: ['Innovation', 'Customer service'],
          weaknesses: ['Limited market presence', 'Resource constraints'],
          positioning: 'Innovative challenger',
          threatLevel: 'medium',
        },
      ],
      marketShare: [
        {
          company: 'Market Leader A',
          share: 25,
          revenue: 1000000000,
          growth: 8,
          source: 'Industry Report',
        },
        {
          company: 'Competitor B',
          share: 15,
          revenue: 600000000,
          growth: 12,
          source: 'Industry Report',
        },
        { company: 'Others', share: 60, revenue: 2400000000, growth: 5, source: 'Industry Report' },
      ],
      competitiveIntensity: 65,
    }
  }

  private extractEnhancedInsights(output: MarketResearchOutput, intelligence?: any): string[] {
    const insights: string[] = []

    // TAM/SAM/SOM insights
    const { tam, sam, som } = output.marketSize
    insights.push(
      `Total Addressable Market (TAM): ${this.formatCurrency(tam.value)} using ${tam.methodology} approach (${tam.confidence}% confidence)`
    )
    insights.push(
      `Serviceable Addressable Market (SAM): ${this.formatCurrency(sam.value)} representing addressable segment`
    )
    insights.push(
      `Serviceable Obtainable Market (SOM): ${this.formatCurrency(som.value)} as realistic capture potential`
    )

    // Growth insights
    const growthRate = output.marketSize.growthRate.annual
    const growthDescription =
      growthRate > 15
        ? 'exceptionally high'
        : growthRate > 10
          ? 'high'
          : growthRate > 5
            ? 'moderate'
            : 'low'
    insights.push(
      `Market growing at ${growthDescription} rate of ${growthRate.toFixed(1)}% annually`
    )

    // Opportunity score insights
    const score = output.opportunityScore.overall
    insights.push(`Market opportunity score: ${score}/100 - ${output.opportunityScore.explanation}`)

    // Top component insights
    const components = output.opportunityScore.components
    const topComponent = Object.entries(components).reduce((a, b) => (a[1] > b[1] ? a : b))
    const weakestComponent = Object.entries(components).reduce((a, b) => (a[1] < b[1] ? a : b))

    insights.push(`Strongest factor: ${topComponent[0]} (${topComponent[1]}/100)`)
    insights.push(`Key challenge: ${weakestComponent[0]} (${weakestComponent[1]}/100)`)

    // Competitive insights
    const competitive = output.competitiveLandscape
    insights.push(
      `Market has ${competitive.competitorCount} competitors with ${competitive.marketConcentration} structure`
    )
    insights.push(`Entry barriers are ${competitive.entryBarriers.overall} overall`)

    // Confidence and data quality - moved earlier to ensure it's included in first 10
    insights.push(
      `Analysis confidence: ${output.metadata.dataQuality}/100 data quality, ${output.metadata.completeness}/100 completeness`
    )

    // Intelligence analysis insights
    if (
      intelligence &&
      intelligence.predictiveInsights &&
      intelligence.predictiveInsights.length > 0
    ) {
      const topInsight = intelligence.predictiveInsights[0]
      insights.push(
        `AI Prediction: ${topInsight.prediction} (${topInsight.confidence}% confidence)`
      )
    }

    // Risk insights from intelligence analysis
    if (intelligence && intelligence.riskAnalysis && intelligence.riskAnalysis.length > 0) {
      const topRisk = intelligence.riskAnalysis[0]
      insights.push(
        `Key Risk: ${topRisk.description} (${topRisk.riskScore.toFixed(0)}/100 risk score)`
      )
    }

    // Trend insights
    const positiveTrends = output.trends.filter(t => t.impact === 'positive')
    if (positiveTrends.length > 0) {
      insights.push(`${positiveTrends.length} positive market trends supporting opportunity`)
    }

    return insights
  }

  private calculateCompleteness(
    marketSize: any,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): number {
    let completeness = 0
    let maxScore = 0

    // Market size completeness (40 points max)
    maxScore += 40
    if (marketSize.tam) completeness += 15
    if (marketSize.sam) completeness += 15
    if (marketSize.som) completeness += 10

    // Trends completeness (30 points max)
    maxScore += 30
    if (trends.length >= 3) completeness += 30
    else if (trends.length >= 2) completeness += 20
    else if (trends.length >= 1) completeness += 10

    // Competitive completeness (30 points max)
    maxScore += 30
    if (competitive.keyPlayers && competitive.keyPlayers.length >= 2) completeness += 15
    if (competitive.marketShare && competitive.marketShare.length >= 2) completeness += 10
    if (competitive.entryBarriers) completeness += 5

    return Math.round((completeness / maxScore) * 100)
  }

  private extractAssumptions(marketSize: any): any[] {
    const assumptions = []

    // Extract assumptions from all methodologies
    if (marketSize.tam.assumptions) {
      marketSize.tam.assumptions.forEach((assumption: string, index: number) => {
        assumptions.push({
          key: `tam_assumption_${index + 1}`,
          description: assumption,
          impact: 'medium',
          confidence: marketSize.tam.confidence,
        })
      })
    }

    // Add standard assumptions
    assumptions.push({
      key: 'market_stability',
      description: 'Market conditions remain relatively stable over analysis period',
      impact: 'high',
      confidence: 70,
    })

    assumptions.push({
      key: 'competitive_environment',
      description: 'No major market disruptions or new dominant players emerge',
      impact: 'medium',
      confidence: 60,
    })

    return assumptions
  }

  private identifyLimitations(confidenceAssessment: any): string[] {
    const limitations = []

    if (confidenceAssessment.score < 80) {
      limitations.push('Market analysis based on limited recent data sources')
    }

    if (confidenceAssessment.components.sourceReliability < 70) {
      limitations.push('Some data sources have moderate reliability ratings')
    }

    if (confidenceAssessment.components.dataRecency < 70) {
      limitations.push(
        'Analysis includes some older market data that may not reflect current conditions'
      )
    }

    limitations.push('Projections assume stable market conditions without major disruptions')
    limitations.push('Competitive analysis may not capture all market participants')

    return limitations
  }

  private generateRecommendations(opportunityScore: any, confidenceAssessment: any): any[] {
    const recommendations = []

    // High-level strategic recommendations
    if (opportunityScore.overall >= 80) {
      recommendations.push({
        priority: 'high',
        category: 'market-entry',
        description: 'Strong market opportunity - consider aggressive market entry strategy',
        rationale:
          'High opportunity score indicates favorable market conditions across multiple dimensions',
      })
    } else if (opportunityScore.overall >= 60) {
      recommendations.push({
        priority: 'medium',
        category: 'market-entry',
        description: 'Solid opportunity - develop focused go-to-market strategy',
        rationale: 'Good opportunity score with manageable risks and decent market potential',
      })
    } else {
      recommendations.push({
        priority: 'low',
        category: 'market-entry',
        description: 'Proceed with caution - validate assumptions through pilot programs',
        rationale: 'Lower opportunity score indicates significant challenges that need addressing',
      })
    }

    // Component-specific recommendations
    const components = opportunityScore.components

    if (components.competition < 50) {
      recommendations.push({
        priority: 'high',
        category: 'positioning',
        description: 'Develop strong differentiation strategy to address competitive challenges',
        rationale: 'High competitive intensity requires clear value proposition and positioning',
      })
    }

    if (components.timing > 80) {
      recommendations.push({
        priority: 'high',
        category: 'timing',
        description: 'Excellent market timing - prioritize speed to market',
        rationale: 'Current market conditions are highly favorable for entry',
      })
    }

    return recommendations
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    } else {
      return `$${amount.toFixed(0)}`
    }
  }
}
