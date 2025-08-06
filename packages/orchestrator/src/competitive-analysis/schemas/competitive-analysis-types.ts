/**
 * Competitive Analysis Data Schema
 * Defines structured output formats for competitive analysis
 */

export interface CompetitiveAnalysisOutput {
  competitors: CompetitorProfile[]
  competitiveLandscape: CompetitiveLandscapeAnalysis
  difficultyScore: CompetitiveDifficulty
  opportunities: OpportunityInsight[]
  visualizationData: LandscapeVisualizationData
  metadata: {
    analysisDate: Date
    processingTime: number
    dataQuality: number // 0-100
    completeness: number // 0-100
    version: string
    competitorsAnalyzed: number
  }
  dataSources: DataSource[]
  limitations: string[]
}

export interface CompetitorProfile {
  name: string
  category: 'direct' | 'indirect'
  description: string
  website?: string
  features: CompetitorFeature[]
  positioning: CompetitorPositioning
  pricing: PricingInformation
  marketShare?: number
  strengths: string[]
  weaknesses: string[]
  threatLevel: 'low' | 'medium' | 'high'
  confidence: number // 0-100
  lastUpdated: Date
}

export interface CompetitorFeature {
  name: string
  description: string
  category: string
  availability: 'available' | 'planned' | 'rumored' | 'discontinued'
  quality: number // 0-100
  uniqueness: number // 0-100
}

export interface CompetitorPositioning {
  targetMarket: string
  valueProposition: string
  brandMessaging: string[]
  differentiators: string[]
  marketSegment: string
  pricePositioning: 'premium' | 'mid-market' | 'budget' | 'freemium'
}

export interface PricingInformation {
  model:
    | 'subscription'
    | 'one-time'
    | 'freemium'
    | 'transaction-based'
    | 'usage-based'
    | 'hybrid'
    | 'unknown'
  tiers: PricingTier[]
  currency: string
  lastUpdated: Date
  source: string
  confidence: number // 0-100
}

export interface PricingTier {
  name: string
  price: number
  billing: 'monthly' | 'yearly' | 'one-time' | 'per-usage'
  features: string[]
  limitations?: string[]
  targetCustomer: string
}

export interface CompetitiveLandscapeAnalysis {
  marketStructure: {
    competitorCount: number
    directCompetitors: number
    indirectCompetitors: number
    concentration: 'fragmented' | 'moderately-concentrated' | 'highly-concentrated' | 'monopolistic'
    dominantPlayers: string[]
  }
  competitiveIntensity: {
    overall: number // 0-100
    priceCompetition: number // 0-100
    featureCompetition: number // 0-100
    brandCompetition: number // 0-100
    innovationRate: number // 0-100
  }
  marketDynamics: {
    growthStage: 'emerging' | 'growth' | 'mature' | 'declining'
    consolidationTrend: 'fragmenting' | 'stable' | 'consolidating'
    newEntrantRate: 'high' | 'medium' | 'low'
    exitRate: 'high' | 'medium' | 'low'
  }
  barriers: BarrierToEntry
}

export interface BarrierToEntry {
  overall: 'low' | 'medium' | 'high'
  financial: {
    score: number // 0-100
    description: string
    requiredCapital?: number
  }
  regulatory: {
    score: number // 0-100
    description: string
    requirements: string[]
  }
  technological: {
    score: number // 0-100
    description: string
    complexityFactors: string[]
  }
  brand: {
    score: number // 0-100
    description: string
    establishedBrands: string[]
  }
  distribution: {
    score: number // 0-100
    description: string
    channels: string[]
  }
  network: {
    score: number // 0-100
    description: string
    networkEffects: string[]
  }
}

export interface CompetitiveDifficulty {
  overall: number // 0-100
  components: {
    marketSaturation: number // 0-100
    competitorStrength: number // 0-100
    barrierHeight: number // 0-100
    priceCompetition: number // 0-100
    brandRecognition: number // 0-100
    resourceRequirements: number // 0-100
  }
  explanation: string
  riskFactors: string[]
  mitigationStrategies: string[]
}

export interface OpportunityInsight {
  type: 'feature-gap' | 'market-gap' | 'pricing-gap' | 'positioning-gap' | 'service-gap'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  feasibility: 'low' | 'medium' | 'high'
  timeToMarket: 'short' | 'medium' | 'long' // < 6 months, 6-18 months, > 18 months
  resourceRequirement: 'low' | 'medium' | 'high'
  competitiveAdvantage: string
  risks: string[]
  priority: number // 0-100
  actionableSteps: string[]
}

export interface LandscapeVisualizationData {
  competitorMatrix: CompetitorMatrixData
  marketMap: MarketMapData
  featureComparison: FeatureComparisonMatrix
  pricingLandscape: PricingLandscapeData
}

export interface CompetitorMatrixData {
  axes: {
    x: { label: string; min: number; max: number }
    y: { label: string; min: number; max: number }
  }
  competitors: {
    name: string
    x: number
    y: number
    size: number // represents market share or company size
    category: 'direct' | 'indirect'
  }[]
  opportunityAreas: {
    x: number
    y: number
    radius: number
    description: string
  }[]
}

export interface MarketMapData {
  segments: {
    name: string
    size: number
    growth: number
    competitors: string[]
    saturation: number // 0-100
  }[]
  connections: {
    from: string
    to: string
    strength: number // 0-100
    type: 'substitution' | 'complement' | 'migration'
  }[]
}

export interface FeatureComparisonMatrix {
  features: string[]
  competitors: {
    name: string
    features: {
      [featureName: string]: {
        available: boolean
        quality: number // 0-100
        notes?: string
      }
    }
  }[]
  gaps: {
    feature: string
    description: string
    opportunity: number // 0-100
  }[]
}

export interface PricingLandscapeData {
  priceRanges: {
    segment: string
    min: number
    max: number
    median: number
    competitors: string[]
  }[]
  pricingModels: {
    model: string
    competitors: string[]
    marketShare: number
  }[]
  priceOpportunities: {
    description: string
    pricePoint: number
    rationale: string
  }[]
}

export interface DataSource {
  name: string
  url?: string
  type:
    | 'company-website'
    | 'review-site'
    | 'industry-report'
    | 'news'
    | 'social-media'
    | 'search-engine'
  credibility: number // 0-100
  recency: Date
  accessDate: Date
  dataPoints: string[]
}

export interface CompetitiveAnalysisRequest {
  businessIdea: {
    title: string
    description: string
    category?: string
    targetMarket?: string
    geography?: string[]
  }
  analysisDepth: 'basic' | 'standard' | 'comprehensive'
  maxCompetitors?: number
  focusAreas: ('features' | 'pricing' | 'positioning' | 'market-share' | 'opportunities')[]
  timeConstraints?: number // minutes
}
