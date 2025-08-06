/**
 * Competitive Analysis Agent - Analyzes competitive landscape and positioning
 * Enhanced with specialized analysis engines for comprehensive competitive intelligence
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

// Import competitive analysis components
import {
  CompetitiveAnalysisRequest,
  CompetitiveAnalysisOutput,
} from '../competitive-analysis/schemas/competitive-analysis-types.js'
import { CompetitorDiscoveryEngine } from '../competitive-analysis/discovery/competitor-discovery-engine.js'
import { CompetitorAnalysisEngine } from '../competitive-analysis/analysis/competitor-analysis-engine.js'
import { PricingIntelligenceEngine } from '../competitive-analysis/intelligence/pricing-intelligence-engine.js'
import { LandscapeVisualizationEngine } from '../competitive-analysis/visualization/landscape-visualization-engine.js'
import { CompetitiveDifficultyEngine } from '../competitive-analysis/difficulty/competitive-difficulty-engine.js'
import { OpportunityIdentificationEngine } from '../competitive-analysis/opportunities/opportunity-identification-engine.js'

export class CompetitiveAnalysisAgent extends BaseAgent {
  private competitorDiscovery: CompetitorDiscoveryEngine
  private competitorAnalysis: CompetitorAnalysisEngine
  private pricingIntelligence: PricingIntelligenceEngine
  private landscapeVisualization: LandscapeVisualizationEngine
  private competitiveDifficulty: CompetitiveDifficultyEngine
  private opportunityIdentification: OpportunityIdentificationEngine

  constructor() {
    super(
      'competitive-analysis',
      'Competitive Analysis Agent',
      'Analyzes competitive landscape, identifies key competitors, and determines market positioning opportunities using specialized analysis engines'
    )

    // Initialize analysis engines
    this.competitorDiscovery = new CompetitorDiscoveryEngine()
    this.competitorAnalysis = new CompetitorAnalysisEngine()
    this.pricingIntelligence = new PricingIntelligenceEngine()
    this.landscapeVisualization = new LandscapeVisualizationEngine()
    this.competitiveDifficulty = new CompetitiveDifficultyEngine()
    this.opportunityIdentification = new OpportunityIdentificationEngine()
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Competitive Analysis',
      version: '2.0.0',
      dependencies: ['market-research'], // Can benefit from market research data
      provides: [
        'competitor-profiles',
        'competitive-advantages',
        'market-positioning',
        'competitive-threats',
        'differentiation-opportunities',
        'pricing-intelligence',
        'market-difficulty-scoring',
        'competitive-visualization',
        'opportunity-identification',
      ],
      requires: ['business-idea-description', 'target-market-definition'],
    }
  }

  protected async onInitialize(): Promise<void> {
    console.log('[CompetitiveAnalysisAgent] Initializing competitive analysis capabilities...')
    // Initialize any competitive analysis specific resources
  }

  protected async onCleanup(): Promise<void> {
    console.log('[CompetitiveAnalysisAgent] Cleaning up competitive analysis resources...')
    // Cleanup any resources
  }

  canHandle(request: AgentRequest, _context?: AgentCommunicationContext): boolean {
    return (
      request.analysisType === 'competitors' &&
      !!request.businessIdea?.title &&
      !!request.businessIdea?.description
    )
  }

  async execute(request: AgentRequest, _context: AgentExecutionContext): Promise<AgentResponse> {
    const startTime = Date.now()
    this.validateRequest(request)

    try {
      console.log(
        `Competitive Analysis Agent executing for business idea: ${request.businessIdea.title}`
      )

      // Create enhanced competitive analysis request
      const analysisRequest: CompetitiveAnalysisRequest = {
        businessIdea: {
          title: request.businessIdea.title,
          description: request.businessIdea.description,
          targetMarket: request.businessIdea.targetMarket,
          category: request.businessIdea.category,
        },
        analysisDepth: 'standard',
        maxCompetitors: 8,
        focusAreas: ['features', 'pricing', 'positioning', 'opportunities'],
      }

      // Perform comprehensive competitive analysis using specialized engines
      const competitiveOutput = await this.performComprehensiveAnalysis(analysisRequest)

      // Extract insights for backward compatibility
      const insights = this.extractEnhancedInsights(competitiveOutput)
      const confidence = this.calculateEnhancedConfidence(competitiveOutput)
      const score = this.calculateCompetitiveScore(competitiveOutput)
      const processingTime = Date.now() - startTime

      return {
        agentType: this.agentType,
        score,
        insights: this.formatInsights(insights),
        confidence,
        metadata: {
          processingTime,
          model: 'enhanced-competitive-engines',
          retryCount: 0,
        },
        rawData: {
          competitiveAnalysis: competitiveOutput,
          analysisType: request.analysisType,
          timestamp: new Date(),
          businessIdea: request.businessIdea,
          enhancedAnalysis: true,
        },
      }
    } catch (error) {
      console.error(`Competitive Analysis Agent failed:`, error)

      // Fallback to basic LLM analysis if enhanced analysis fails
      try {
        console.log('[CompetitiveAnalysisAgent] Falling back to basic LLM analysis')
        return await this.performBasicAnalysis(request, startTime)
      } catch (fallbackError) {
        console.error('Fallback analysis also failed:', fallbackError)

        return {
          agentType: this.agentType,
          score: 0,
          insights: [
            `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
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
  }

  private async performComprehensiveAnalysis(
    request: CompetitiveAnalysisRequest
  ): Promise<CompetitiveAnalysisOutput> {
    // Phase 1: Competitor Discovery
    const discoveryResult = await this.competitorDiscovery.discoverCompetitors(request)
    console.log(
      `[CompetitiveAnalysisAgent] Discovered ${discoveryResult.competitors.length} competitors`
    )

    if (discoveryResult.competitors.length === 0) {
      throw new Error('No competitors found for analysis')
    }

    // Phase 2: Parallel Analysis of Multiple Aspects
    const [analysisResult, pricingResult, visualizationResult, difficultyResult] =
      await Promise.all([
        this.competitorAnalysis.analyzeCompetitors(
          discoveryResult.competitors,
          request.businessIdea
        ),
        this.pricingIntelligence.analyzePricing(discoveryResult.competitors, request.businessIdea),
        this.landscapeVisualization.generateVisualizationData(
          discoveryResult.competitors,
          request.businessIdea
        ),
        this.competitiveDifficulty.analyzeDifficulty(
          discoveryResult.competitors,
          request.businessIdea
        ),
      ])

    // Phase 3: Opportunity Identification
    const opportunityResult = await this.opportunityIdentification.identifyOpportunities(
      analysisResult.enhancedCompetitors,
      visualizationResult.visualizationData.featureComparison,
      visualizationResult.visualizationData.pricingLandscape,
      request.businessIdea
    )

    // Phase 4: Synthesize Results
    const competitiveLandscape = this.synthesizeCompetitiveLandscape(
      discoveryResult,
      analysisResult,
      difficultyResult
    )

    const processingTime = Date.now() - Date.now()

    return {
      competitors: analysisResult.enhancedCompetitors,
      competitiveLandscape,
      difficultyScore: difficultyResult.difficultyScore,
      opportunities: opportunityResult.opportunities,
      visualizationData: visualizationResult.visualizationData,
      metadata: {
        analysisDate: new Date(),
        processingTime,
        dataQuality: this.calculateOverallConfidence([
          discoveryResult.discoveryMetrics.confidence,
          analysisResult.analysisMetrics.confidence,
          pricingResult.analysisMetrics.confidenceLevel,
          visualizationResult.visualizationMetrics.confidence,
          difficultyResult.difficultyMetrics.confidenceLevel,
          opportunityResult.opportunityMetrics.confidenceLevel,
        ]),
        completeness: this.calculateCompleteness(analysisResult, pricingResult, opportunityResult),
        version: '2.0.0',
        competitorsAnalyzed: analysisResult.enhancedCompetitors.length,
      },
      dataSources: this.combineDataSources([
        discoveryResult.dataSources,
        analysisResult.dataSources,
        pricingResult.dataSources,
        visualizationResult.dataSources,
        difficultyResult.dataSources,
        opportunityResult.dataSources,
      ]),
      limitations: this.generateLimitations(request, discoveryResult),
    }
  }

  private async performBasicAnalysis(
    request: AgentRequest,
    startTime: number
  ): Promise<AgentResponse> {
    const providerFactory = ProviderFactory.getInstance()

    const competitiveAnalysis = await providerFactory.analyzeMarketResearch({
      businessIdea: {
        title: request.businessIdea.title,
        description: request.businessIdea.description,
      },
      analysisType: 'competitors',
    })

    const insights = this.extractCompetitiveInsights(competitiveAnalysis)
    const confidence = this.calculateCompetitiveConfidence(competitiveAnalysis)
    const processingTime = Date.now() - startTime

    return {
      agentType: this.agentType,
      score: competitiveAnalysis.score,
      insights: this.formatInsights(insights),
      confidence,
      metadata: {
        processingTime,
        model: 'llm-provider-fallback',
        retryCount: 1,
      },
      rawData: {
        competitiveAnalysis,
        analysisType: request.analysisType,
        timestamp: new Date(),
        businessIdea: request.businessIdea,
      },
    }
  }

  // Enhanced methods for new analysis system
  private extractEnhancedInsights(competitiveOutput: CompetitiveAnalysisOutput): string[] {
    const insights: string[] = []

    // Competitive landscape insights
    const landscape = competitiveOutput.competitiveLandscape
    insights.push(
      `Market Structure: ${landscape.marketStructure.concentration} with ${landscape.marketStructure.competitorCount} competitors`
    )
    insights.push(
      `Competitive Intensity: ${landscape.competitiveIntensity.overall}/100 overall intensity`
    )
    insights.push(
      `Market Difficulty: ${competitiveOutput.difficultyScore.overall}/100 difficulty score`
    )

    // Top competitors
    competitiveOutput.competitors.slice(0, 3).forEach(competitor => {
      insights.push(`${competitor.name} (${competitor.category}): ${competitor.description}`)
      if (competitor.marketShare) {
        insights.push(`${competitor.name} holds ${competitor.marketShare}% market share`)
      }
      if (competitor.threatLevel === 'high') {
        insights.push(`${competitor.name} poses high competitive threat`)
      }
    })

    // Top opportunities
    const highImpactOpportunities = competitiveOutput.opportunities
      .filter(o => o.impact === 'high')
      .slice(0, 3)

    if (highImpactOpportunities.length > 0) {
      insights.push(`Key Opportunities: ${highImpactOpportunities.map(o => o.title).join(', ')}`)
    }

    // Pricing insights
    const pricingLandscape = competitiveOutput.visualizationData.pricingLandscape
    if (pricingLandscape.priceOpportunities.length > 0) {
      insights.push(`Pricing Opportunities: ${pricingLandscape.priceOpportunities[0].description}`)
    }

    // Barriers to entry
    if (competitiveOutput.difficultyScore.components.barrierHeight > 70) {
      insights.push('High barriers to entry present significant challenges')
    } else if (competitiveOutput.difficultyScore.components.barrierHeight < 40) {
      insights.push('Low barriers to entry create favorable market conditions')
    }

    return insights
  }

  private calculateEnhancedConfidence(
    competitiveOutput: CompetitiveAnalysisOutput
  ): 'high' | 'medium' | 'low' {
    const dataQuality = competitiveOutput.metadata.dataQuality
    const completeness = competitiveOutput.metadata.completeness

    const overallConfidence = (dataQuality + completeness) / 2

    if (overallConfidence >= 80) return 'high'
    if (overallConfidence >= 60) return 'medium'
    return 'low'
  }

  private calculateCompetitiveScore(competitiveOutput: CompetitiveAnalysisOutput): number {
    // Invert difficulty score to create opportunity score (lower difficulty = higher opportunity)
    const opportunityScore = 100 - competitiveOutput.difficultyScore.overall

    // Factor in high-impact opportunities
    const highImpactCount = competitiveOutput.opportunities.filter(o => o.impact === 'high').length
    const opportunityBonus = Math.min(20, highImpactCount * 5)

    return Math.min(100, Math.max(0, opportunityScore + opportunityBonus))
  }

  // Helper methods for comprehensive analysis
  private synthesizeCompetitiveLandscape(
    discoveryResult: any,
    analysisResult: any,
    difficultyResult: any
  ): any {
    const competitors = analysisResult.enhancedCompetitors
    const directCompetitors = competitors.filter((c: any) => c.category === 'direct').length
    const indirectCompetitors = competitors.filter((c: any) => c.category === 'indirect').length

    // Calculate market concentration
    const totalMarketShare = competitors.reduce(
      (sum: number, c: any) => sum + (c.marketShare || 0),
      0
    )
    const dominantPlayers = competitors
      .filter((c: any) => c.marketShare && c.marketShare > 10)
      .map((c: any) => c.name)

    let concentration: string
    if (dominantPlayers.length <= 2 && totalMarketShare > 70) {
      concentration = 'highly-concentrated'
    } else if (dominantPlayers.length <= 5 && totalMarketShare > 50) {
      concentration = 'moderately-concentrated'
    } else if (competitors.length === 1) {
      concentration = 'monopolistic'
    } else {
      concentration = 'fragmented'
    }

    // Calculate competitive intensity
    const avgThreatLevel =
      competitors.reduce((sum: number, c: any) => {
        const threatScore = c.threatLevel === 'high' ? 100 : c.threatLevel === 'medium' ? 60 : 30
        return sum + threatScore
      }, 0) / competitors.length

    return {
      marketStructure: {
        competitorCount: competitors.length,
        directCompetitors,
        indirectCompetitors,
        concentration,
        dominantPlayers,
      },
      competitiveIntensity: {
        overall: Math.round(avgThreatLevel),
        priceCompetition: difficultyResult.difficultyScore.components.priceCompetition,
        featureCompetition: Math.min(100, analysisResult.analysisMetrics.featuresIdentified * 5),
        brandCompetition: difficultyResult.difficultyScore.components.brandRecognition,
        innovationRate: this.calculateInnovationRate(competitors),
      },
      marketDynamics: {
        growthStage: this.estimateGrowthStage(competitors),
        consolidationTrend: concentration === 'fragmented' ? 'fragmenting' : 'consolidating',
        newEntrantRate:
          difficultyResult.difficultyScore.overall > 70
            ? 'low'
            : difficultyResult.difficultyScore.overall > 40
              ? 'medium'
              : 'high',
        exitRate: avgThreatLevel > 80 ? 'high' : 'medium',
      },
      barriers: difficultyResult.barriers,
    }
  }

  private calculateOverallConfidence(confidenceValues: number[]): number {
    const validValues = confidenceValues.filter(v => v > 0)
    if (validValues.length === 0) return 50

    const average = validValues.reduce((sum, val) => sum + val, 0) / validValues.length
    const completenessMultiplier = validValues.length / confidenceValues.length

    return Math.round(average * completenessMultiplier)
  }

  private calculateCompleteness(
    analysisResult: any,
    pricingResult: any,
    opportunityResult: any
  ): number {
    let completeness = 0
    let maxScore = 0

    // Competitor analysis completeness
    if (analysisResult.enhancedCompetitors.length > 0) {
      completeness += 30
      if (analysisResult.enhancedCompetitors.length >= 3) completeness += 10
      if (analysisResult.enhancedCompetitors.length >= 5) completeness += 10
    }
    maxScore += 50

    // Feature analysis completeness
    if (analysisResult.featureMatrix.features.length > 0) {
      completeness += 15
      if (analysisResult.featureMatrix.features.length >= 5) completeness += 10
    }
    maxScore += 25

    // Pricing analysis completeness
    if (pricingResult.enhancedPricing.size > 0) {
      completeness += 15
      if (pricingResult.pricingLandscape.priceRanges.length >= 2) completeness += 5
    }
    maxScore += 20

    // Opportunity identification completeness
    if (opportunityResult.opportunities.length > 0) {
      completeness += 5
    }
    maxScore += 5

    return Math.round((completeness / maxScore) * 100)
  }

  private combineDataSources(sourceArrays: any[][]): any[] {
    const combined: any[] = []
    const seen = new Set<string>()

    sourceArrays.forEach(sources => {
      sources.forEach((source: any) => {
        const key = `${source.name}-${source.type}`
        if (!seen.has(key)) {
          seen.add(key)
          combined.push(source)
        }
      })
    })

    return combined
  }

  private calculateInnovationRate(competitors: any[]): number {
    const uniqueFeatures = competitors.flatMap(c =>
      c.features.filter((f: any) => f.uniqueness > 70)
    )
    const plannedFeatures = competitors.flatMap(c =>
      c.features.filter((f: any) => f.availability === 'planned')
    )

    const innovationScore = uniqueFeatures.length * 10 + plannedFeatures.length * 15
    return Math.min(100, innovationScore)
  }

  private estimateGrowthStage(competitors: any[]): string {
    const avgFeatureCount =
      competitors.reduce((sum, c) => sum + c.features.length, 0) / competitors.length
    const freemiumCount = competitors.filter(c => c.pricing.model === 'freemium').length

    if (competitors.length < 3 && avgFeatureCount < 5) return 'emerging'
    if (freemiumCount > competitors.length * 0.3) return 'growth'
    if (competitors.length > 8) return 'mature'
    return 'growth'
  }

  private generateLimitations(request: any, discoveryResult: any): string[] {
    const limitations: string[] = []

    if (discoveryResult.competitors.length < 3) {
      limitations.push('Limited competitor sample size may affect analysis accuracy')
    }

    if (request.analysisDepth === 'basic') {
      limitations.push('Basic analysis depth may miss nuanced competitive insights')
    }

    if (!request.businessIdea.targetMarket) {
      limitations.push('No target market specified - analysis may be too broad')
    }

    limitations.push(
      'Analysis based on publicly available information and may not reflect private competitive strategies'
    )
    limitations.push('Market conditions and competitive landscape can change rapidly')

    return limitations
  }

  // Legacy methods for backward compatibility
  private extractCompetitiveInsights(competitiveAnalysis: MarketResearchResult): string[] {
    const insights: string[] = []

    // Extract competitor-specific insights
    if (competitiveAnalysis.competitors) {
      competitiveAnalysis.competitors.forEach(competitor => {
        insights.push(`${competitor.name}: ${competitor.description}`)
        if (competitor.marketShare) {
          insights.push(`${competitor.name} holds ${competitor.marketShare} market share`)
        }
        if (competitor.strengths) {
          insights.push(`${competitor.name} strengths: ${competitor.strengths.join(', ')}`)
        }
        if (competitor.weaknesses) {
          insights.push(`${competitor.name} weaknesses: ${competitor.weaknesses.join(', ')}`)
        }
      })
    }

    // Add general competitive insights
    if (competitiveAnalysis.insights) {
      insights.push(...competitiveAnalysis.insights)
    }

    return insights
  }

  private calculateCompetitiveConfidence(
    competitiveAnalysis: MarketResearchResult
  ): 'high' | 'medium' | 'low' {
    let confidenceScore = 70 // Base confidence

    // Adjust based on data quality
    if (competitiveAnalysis.competitors && competitiveAnalysis.competitors.length > 0) {
      confidenceScore += 10 // Have competitor data

      // More competitors = better analysis
      if (competitiveAnalysis.competitors.length >= 3) {
        confidenceScore += 10
      }

      // Check for detailed competitor data
      const hasDetailedData = competitiveAnalysis.competitors.some(
        c => c.marketShare && c.strengths && c.weaknesses
      )
      if (hasDetailedData) {
        confidenceScore += 10
      }
    }

    // Adjust based on insights quality
    if (competitiveAnalysis.insights && competitiveAnalysis.insights.length >= 3) {
      confidenceScore += 5
    }

    return this.calculateConfidence(competitiveAnalysis.score, confidenceScore, 80)
  }
}
