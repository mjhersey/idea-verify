/**
 * Opportunity Identification Engine
 * Identifies market gaps, positioning opportunities, and competitive advantages
 */

import {
  CompetitorProfile,
  OpportunityInsight,
  FeatureComparisonMatrix,
  PricingLandscapeData,
  DataSource,
} from '../schemas/competitive-analysis-types.js'

export interface OpportunityIdentificationResult {
  opportunities: OpportunityInsight[]
  opportunityMetrics: {
    totalOpportunities: number
    highImpactOpportunities: number
    feasibleOpportunities: number
    avgPriority: number
    confidenceLevel: number // 0-100
  }
  dataSources: DataSource[]
}

export class OpportunityIdentificationEngine {
  private readonly analysisTimeout = 2000
  private readonly opportunityTypes = {
    'feature-gap': { weight: 0.25, timeMultiplier: 1.0 },
    'market-gap': { weight: 0.3, timeMultiplier: 1.5 },
    'pricing-gap': { weight: 0.2, timeMultiplier: 0.8 },
    'positioning-gap': { weight: 0.15, timeMultiplier: 1.2 },
    'service-gap': { weight: 0.1, timeMultiplier: 1.0 },
  }

  async identifyOpportunities(
    competitors: CompetitorProfile[],
    featureMatrix: FeatureComparisonMatrix,
    pricingLandscape: PricingLandscapeData,
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<OpportunityIdentificationResult> {
    const startTime = Date.now()
    console.log(
      `[OpportunityIdentificationEngine] Identifying opportunities for ${competitors.length} competitors`
    )

    try {
      // Identify different types of opportunities in parallel
      const [featureGaps, marketGaps, pricingGaps, positioningGaps, serviceGaps] =
        await Promise.all([
          this.identifyFeatureGaps(featureMatrix, competitors, businessIdea),
          this.identifyMarketGaps(competitors, businessIdea),
          this.identifyPricingGaps(pricingLandscape, competitors, businessIdea),
          this.identifyPositioningGaps(competitors, businessIdea),
          this.identifyServiceGaps(competitors, businessIdea),
        ])

      // Combine all opportunities
      const allOpportunities = [
        ...featureGaps,
        ...marketGaps,
        ...pricingGaps,
        ...positioningGaps,
        ...serviceGaps,
      ]

      // Prioritize and score opportunities
      const prioritizedOpportunities = this.prioritizeOpportunities(allOpportunities, businessIdea)

      // Calculate metrics
      const opportunityMetrics = {
        totalOpportunities: prioritizedOpportunities.length,
        highImpactOpportunities: prioritizedOpportunities.filter(o => o.impact === 'high').length,
        feasibleOpportunities: prioritizedOpportunities.filter(o => o.feasibility === 'high')
          .length,
        avgPriority:
          prioritizedOpportunities.reduce((sum, o) => sum + o.priority, 0) /
            prioritizedOpportunities.length || 0,
        confidenceLevel: this.calculateOpportunityConfidence(
          competitors,
          featureMatrix,
          pricingLandscape
        ),
      }

      const dataSources = this.generateOpportunityDataSources()

      console.log(
        `[OpportunityIdentificationEngine] Identified ${prioritizedOpportunities.length} opportunities in ${Date.now() - startTime}ms`
      )

      return {
        opportunities: prioritizedOpportunities,
        opportunityMetrics,
        dataSources,
      }
    } catch (error) {
      console.error('[OpportunityIdentificationEngine] Opportunity identification failed:', error)
      throw new Error(
        `Opportunity identification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async identifyFeatureGaps(
    featureMatrix: FeatureComparisonMatrix,
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<OpportunityInsight[]> {
    const opportunities: OpportunityInsight[] = []

    // Analyze existing feature gaps
    featureMatrix.gaps.forEach(gap => {
      if (gap.opportunity > 40) {
        // Significant opportunity threshold
        opportunities.push({
          type: 'feature-gap',
          title: `Feature Gap: ${gap.feature}`,
          description: gap.description,
          impact: gap.opportunity > 70 ? 'high' : gap.opportunity > 50 ? 'medium' : 'low',
          feasibility: this.assessFeatureFeasibility(gap.feature, businessIdea),
          timeToMarket: this.estimateFeatureTimeToMarket(gap.feature),
          resourceRequirement: this.estimateFeatureResources(gap.feature),
          competitiveAdvantage: `First-mover advantage in ${gap.feature} functionality`,
          risks: this.identifyFeatureRisks(gap.feature, competitors),
          priority: Math.round(gap.opportunity * 0.8), // Slightly lower than raw opportunity
          actionableSteps: this.generateFeatureActionSteps(gap.feature),
        })
      }
    })

    // Identify missing core features based on business idea
    const businessFeatures = this.extractBusinessIdeaFeatures(businessIdea)
    businessFeatures.forEach(feature => {
      const existingFeature = featureMatrix.features.find(
        f =>
          f.toLowerCase().includes(feature.toLowerCase()) ||
          feature.toLowerCase().includes(f.toLowerCase())
      )

      if (!existingFeature) {
        opportunities.push({
          type: 'feature-gap',
          title: `Missing Core Feature: ${feature}`,
          description: `Key feature identified from business idea not present in competitive landscape`,
          impact: 'high',
          feasibility: 'high',
          timeToMarket: 'medium',
          resourceRequirement: 'medium',
          competitiveAdvantage: `Unique feature addressing core business need`,
          risks: ['Feature may not resonate with market', 'Competitors may copy quickly'],
          priority: 85,
          actionableSteps: [
            `Design ${feature} functionality`,
            'Validate feature with target users',
            'Build MVP version',
            'Test and iterate based on feedback',
          ],
        })
      }
    })

    return opportunities
  }

  private async identifyMarketGaps(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<OpportunityInsight[]> {
    const opportunities: OpportunityInsight[] = []

    // Analyze market segment coverage
    const segmentMap = new Map<string, CompetitorProfile[]>()
    competitors.forEach(competitor => {
      const segment = competitor.positioning.marketSegment
      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, [])
      }
      segmentMap.get(segment)!.push(competitor)
    })

    // Identify underserved segments
    const potentialSegments = ['startup', 'smb', 'enterprise', 'consumer', 'niche', 'international']
    potentialSegments.forEach(segment => {
      const segmentCompetitors = segmentMap.get(segment) || []
      const competitorCount = segmentCompetitors.length

      if (competitorCount < 2) {
        // Underserved segment
        const impact = segment === 'enterprise' ? 'high' : segment === 'startup' ? 'medium' : 'low'
        opportunities.push({
          type: 'market-gap',
          title: `Underserved Market Segment: ${segment}`,
          description: `Limited competition in ${segment} market segment with only ${competitorCount} competitors`,
          impact,
          feasibility: this.assessSegmentFeasibility(segment, businessIdea),
          timeToMarket: segment === 'enterprise' ? 'long' : 'medium',
          resourceRequirement: segment === 'enterprise' ? 'high' : 'medium',
          competitiveAdvantage: `Market leadership opportunity in ${segment} segment`,
          risks: this.identifySegmentRisks(segment),
          priority: this.calculateSegmentPriority(segment, competitorCount),
          actionableSteps: this.generateSegmentActionSteps(segment),
        })
      }
    })

    // Geographic market gaps
    const targetGeography = businessIdea.targetMarket
    if (targetGeography && targetGeography.toLowerCase().includes('international')) {
      const internationalCompetitors = competitors.filter(
        c =>
          c.positioning.targetMarket.toLowerCase().includes('international') ||
          c.positioning.targetMarket.toLowerCase().includes('global')
      )

      if (internationalCompetitors.length < competitors.length * 0.3) {
        opportunities.push({
          type: 'market-gap',
          title: 'International Market Opportunity',
          description:
            'Limited international presence among competitors creates expansion opportunity',
          impact: 'high',
          feasibility: 'medium',
          timeToMarket: 'long',
          resourceRequirement: 'high',
          competitiveAdvantage: 'First-mover advantage in international markets',
          risks: ['Regulatory complexity', 'Cultural adaptation needs', 'Local competition'],
          priority: 75,
          actionableSteps: [
            'Research target international markets',
            'Assess regulatory requirements',
            'Develop localization strategy',
            'Build international partnerships',
          ],
        })
      }
    }

    return opportunities
  }

  private async identifyPricingGaps(
    pricingLandscape: PricingLandscapeData,
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<OpportunityInsight[]> {
    const opportunities: OpportunityInsight[] = []

    // Analyze pricing opportunities from landscape
    pricingLandscape.priceOpportunities.forEach(priceOpp => {
      opportunities.push({
        type: 'pricing-gap',
        title: `Pricing Opportunity: ${priceOpp.description}`,
        description: `${priceOpp.rationale} at $${priceOpp.pricePoint} price point`,
        impact: 'medium',
        feasibility: 'high',
        timeToMarket: 'short',
        resourceRequirement: 'low',
        competitiveAdvantage: 'Optimal pricing position in underserved price segment',
        risks: ['Price competition', 'Value perception challenges'],
        priority: 70,
        actionableSteps: [
          'Validate pricing with target customers',
          'Design value proposition for price point',
          'Test pricing sensitivity',
          'Monitor competitor responses',
        ],
      })
    })

    // Freemium model opportunity
    const freemiumCompetitors = competitors.filter(c => c.pricing.model === 'freemium')
    if (freemiumCompetitors.length === 0) {
      opportunities.push({
        type: 'pricing-gap',
        title: 'Freemium Model Opportunity',
        description:
          'No competitors offering freemium model - potential for customer acquisition advantage',
        impact: 'high',
        feasibility: 'medium',
        timeToMarket: 'medium',
        resourceRequirement: 'high',
        competitiveAdvantage: 'Lower barrier to entry drives customer acquisition',
        risks: [
          'High customer acquisition costs',
          'Low conversion rates',
          'Feature cannibalization',
        ],
        priority: 80,
        actionableSteps: [
          'Design free tier feature limitations',
          'Model freemium economics',
          'Build conversion funnel',
          'Test free-to-paid conversion strategies',
        ],
      })
    }

    return opportunities
  }

  private async identifyPositioningGaps(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<OpportunityInsight[]> {
    const opportunities: OpportunityInsight[] = []

    // Analyze value proposition clustering
    const valueProps = competitors.map(c => c.positioning.valueProposition.toLowerCase())
    const commonThemes = this.extractCommonThemes(valueProps)

    // Look for differentiation opportunities
    const underrepresentedThemes = [
      'sustainability',
      'privacy',
      'simplicity',
      'speed',
      'customization',
      'integration',
      'security',
      'innovation',
      'cost-effectiveness',
    ]

    underrepresentedThemes.forEach(theme => {
      const themeCount = commonThemes.filter(t => t.includes(theme)).length
      if (themeCount === 0) {
        opportunities.push({
          type: 'positioning-gap',
          title: `Positioning Gap: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`,
          description: `No competitors emphasizing ${theme} as core value proposition`,
          impact: this.assessThemeImpact(theme, businessIdea),
          feasibility: this.assessThemeFeasibility(theme, businessIdea),
          timeToMarket: 'short',
          resourceRequirement: 'low',
          competitiveAdvantage: `Unique positioning around ${theme}`,
          risks: [
            'Market may not value this positioning',
            'Competitors may adopt similar messaging',
          ],
          priority: this.calculateThemePriority(theme, businessIdea),
          actionableSteps: [
            `Research market demand for ${theme}`,
            'Develop messaging strategy',
            'Test positioning with target audience',
            'Build brand around theme',
          ],
        })
      }
    })

    return opportunities
  }

  private async identifyServiceGaps(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<OpportunityInsight[]> {
    const opportunities: OpportunityInsight[] = []

    // Analyze common service gaps
    const serviceGaps = [
      { service: 'Customer Support', metric: 'response time' },
      { service: 'Onboarding', metric: 'time to value' },
      { service: 'Training', metric: 'user education' },
      { service: 'Integration Support', metric: 'setup complexity' },
      { service: 'Customization', metric: 'flexibility' },
    ]

    serviceGaps.forEach(gap => {
      // Check if competitors mention this service in their weaknesses
      const weaknessCount = competitors.filter(c =>
        c.weaknesses.some(w => w.toLowerCase().includes(gap.service.toLowerCase()))
      ).length

      if (weaknessCount > competitors.length * 0.3) {
        // 30% or more have this weakness
        opportunities.push({
          type: 'service-gap',
          title: `Service Excellence: ${gap.service}`,
          description: `${weaknessCount} of ${competitors.length} competitors have ${gap.service} weaknesses`,
          impact: 'medium',
          feasibility: 'high',
          timeToMarket: 'short',
          resourceRequirement: 'medium',
          competitiveAdvantage: `Superior ${gap.service} creates customer satisfaction advantage`,
          risks: ['Resource intensive to maintain', 'Competitors may improve'],
          priority: 65,
          actionableSteps: [
            `Design superior ${gap.service} process`,
            'Hire skilled support team',
            'Create self-service resources',
            'Measure and optimize continuously',
          ],
        })
      }
    })

    return opportunities
  }

  private prioritizeOpportunities(
    opportunities: OpportunityInsight[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): OpportunityInsight[] {
    // Sort by priority score and adjust based on business alignment
    return opportunities
      .map(opp => ({
        ...opp,
        priority: this.adjustPriorityForBusinessAlignment(opp, businessIdea),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10) // Top 10 opportunities
  }

  private adjustPriorityForBusinessAlignment(
    opportunity: OpportunityInsight,
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): number {
    let adjustedPriority = opportunity.priority
    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase()

    // Boost priority if opportunity aligns with business idea
    if (opportunity.title.toLowerCase().includes('ai') && ideaText.includes('ai')) {
      adjustedPriority += 10
    }
    if (opportunity.title.toLowerCase().includes('enterprise') && ideaText.includes('enterprise')) {
      adjustedPriority += 15
    }
    if (opportunity.title.toLowerCase().includes('mobile') && ideaText.includes('mobile')) {
      adjustedPriority += 10
    }

    // Adjust for business model alignment
    if (opportunity.type === 'pricing-gap' && ideaText.includes('affordable')) {
      adjustedPriority += 10
    }

    return Math.min(100, adjustedPriority)
  }

  // Helper methods
  private extractBusinessIdeaFeatures(businessIdea: {
    title: string
    description: string
  }): string[] {
    const text = `${businessIdea.title} ${businessIdea.description}`.toLowerCase()
    const features: string[] = []

    if (text.includes('ai') || text.includes('artificial intelligence'))
      features.push('AI Integration')
    if (text.includes('mobile') || text.includes('app')) features.push('Mobile App')
    if (text.includes('web') || text.includes('browser')) features.push('Web Platform')
    if (text.includes('analytics') || text.includes('reporting'))
      features.push('Analytics & Reporting')
    if (text.includes('integration') || text.includes('api'))
      features.push('Third-party Integrations')
    if (text.includes('automation') || text.includes('workflow'))
      features.push('Workflow Automation')
    if (text.includes('collaboration') || text.includes('team')) features.push('Team Collaboration')
    if (text.includes('security') || text.includes('privacy')) features.push('Security & Privacy')

    return features
  }

  private assessFeatureFeasibility(
    feature: string,
    businessIdea: any
  ): OpportunityInsight['feasibility'] {
    const featureLower = feature.toLowerCase()
    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase()

    // High feasibility if feature aligns with business idea
    if (
      ideaText.includes(featureLower) ||
      featureLower.includes('basic') ||
      featureLower.includes('standard')
    ) {
      return 'high'
    }

    // Medium feasibility for common features
    if (
      featureLower.includes('integration') ||
      featureLower.includes('mobile') ||
      featureLower.includes('web')
    ) {
      return 'medium'
    }

    // Low feasibility for complex features
    if (
      featureLower.includes('ai') ||
      featureLower.includes('blockchain') ||
      featureLower.includes('enterprise')
    ) {
      return 'low'
    }

    return 'medium'
  }

  private estimateFeatureTimeToMarket(feature: string): OpportunityInsight['timeToMarket'] {
    const featureLower = feature.toLowerCase()

    if (
      featureLower.includes('ai') ||
      featureLower.includes('blockchain') ||
      featureLower.includes('enterprise')
    ) {
      return 'long'
    }

    if (
      featureLower.includes('integration') ||
      featureLower.includes('platform') ||
      featureLower.includes('advanced')
    ) {
      return 'medium'
    }

    return 'short'
  }

  private estimateFeatureResources(feature: string): OpportunityInsight['resourceRequirement'] {
    const featureLower = feature.toLowerCase()

    if (
      featureLower.includes('ai') ||
      featureLower.includes('enterprise') ||
      featureLower.includes('platform')
    ) {
      return 'high'
    }

    if (
      featureLower.includes('integration') ||
      featureLower.includes('mobile') ||
      featureLower.includes('advanced')
    ) {
      return 'medium'
    }

    return 'low'
  }

  private identifyFeatureRisks(feature: string, competitors: CompetitorProfile[]): string[] {
    const risks = ['Feature may be technically challenging', 'User adoption uncertainty']

    const strongCompetitors = competitors.filter(c => c.threatLevel === 'high')
    if (strongCompetitors.length > 0) {
      risks.push('Strong competitors may quickly copy feature')
    }

    return risks
  }

  private generateFeatureActionSteps(feature: string): string[] {
    return [
      `Research ${feature} requirements and best practices`,
      'Design user experience and interface',
      'Build MVP version of feature',
      'Test with target users and iterate',
      'Launch and monitor adoption metrics',
    ]
  }

  private assessSegmentFeasibility(
    segment: string,
    businessIdea: any
  ): OpportunityInsight['feasibility'] {
    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase()

    if (segment === 'enterprise' && !ideaText.includes('enterprise')) return 'low'
    if (segment === 'consumer' && ideaText.includes('b2b')) return 'low'

    return 'medium'
  }

  private identifySegmentRisks(segment: string): string[] {
    const riskMap: { [key: string]: string[] } = {
      enterprise: ['Long sales cycles', 'High customer acquisition costs', 'Complex requirements'],
      startup: ['Limited budgets', 'High churn risk', 'Evolving needs'],
      smb: ['Price sensitivity', 'Limited technical resources', 'Growth variability'],
      consumer: ['High marketing costs', 'Low switching costs', 'Seasonal demand'],
      international: ['Regulatory complexity', 'Cultural barriers', 'Currency risks'],
    }

    return riskMap[segment] || ['Market validation needed', 'Competition uncertainty']
  }

  private calculateSegmentPriority(segment: string, competitorCount: number): number {
    const basePriority = Math.max(20, 90 - competitorCount * 20)

    const segmentMultipliers: { [key: string]: number } = {
      enterprise: 1.2,
      smb: 1.1,
      startup: 1.0,
      consumer: 0.9,
      niche: 1.3,
    }

    return Math.round(basePriority * (segmentMultipliers[segment] || 1.0))
  }

  private generateSegmentActionSteps(segment: string): string[] {
    return [
      `Research ${segment} market needs and pain points`,
      'Develop segment-specific value proposition',
      'Design targeted marketing strategy',
      'Build segment-focused features',
      'Test with target customers in segment',
    ]
  }

  private extractCommonThemes(valueProps: string[]): string[] {
    return valueProps.map(vp => vp.split(' ').filter(word => word.length > 4)).flat()
  }

  private assessThemeImpact(theme: string, businessIdea: any): OpportunityInsight['impact'] {
    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase()

    if (ideaText.includes(theme)) return 'high'
    if (['security', 'privacy', 'simplicity'].includes(theme)) return 'high'

    return 'medium'
  }

  private assessThemeFeasibility(
    theme: string,
    businessIdea: any
  ): OpportunityInsight['feasibility'] {
    if (['simplicity', 'speed', 'cost-effectiveness'].includes(theme)) return 'high'
    return 'medium'
  }

  private calculateThemePriority(theme: string, businessIdea: any): number {
    const basePriority = 60
    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase()

    if (ideaText.includes(theme)) return basePriority + 20
    if (['security', 'privacy'].includes(theme)) return basePriority + 15

    return basePriority
  }

  private calculateOpportunityConfidence(
    competitors: CompetitorProfile[],
    featureMatrix: FeatureComparisonMatrix,
    pricingLandscape: PricingLandscapeData
  ): number {
    let confidence = 70 // Base confidence

    // More competitors = better opportunity analysis
    if (competitors.length >= 5) confidence += 15
    else if (competitors.length >= 3) confidence += 10
    else if (competitors.length < 2) confidence -= 20

    // More features = better gap analysis
    if (featureMatrix.features.length >= 8) confidence += 10
    else if (featureMatrix.features.length >= 4) confidence += 5

    // Pricing data quality
    if (pricingLandscape.priceRanges.length >= 3) confidence += 5

    return Math.max(30, Math.min(100, confidence))
  }

  private generateOpportunityDataSources(): DataSource[] {
    return [
      {
        name: 'Competitive Gap Analysis',
        type: 'industry-report',
        credibility: 85,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['feature gaps', 'market opportunities', 'positioning analysis'],
      },
      {
        name: 'Market Opportunity Research',
        type: 'company-website',
        credibility: 80,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['customer needs', 'competitor weaknesses', 'market trends'],
      },
    ]
  }
}
