/**
 * Customer Research Data Schema
 * Defines structured output formats for customer research and validation
 */

export interface CustomerResearchOutput {
  segments: CustomerSegment[]
  painPoints: PainPointAnalysis[]
  validationScore: CustomerValidationScore
  willingnessToPay: WillingnessToPayAnalysis
  personas: CustomerPersona[]
  validationInsights: ValidationInsight[]
  metadata: {
    analysisDate: Date
    processingTime: number
    dataQuality: number // 0-100
    completeness: number // 0-100
    version: string
    segmentsAnalyzed: number
  }
  dataSources: DataSource[]
  limitations: string[]
}

export interface CustomerSegment {
  name: string
  description: string
  demographics: {
    ageRange: string
    income: string
    education: string
    occupation: string
    geography: string[]
  }
  psychographics: {
    values: string[]
    interests: string[]
    lifestyle: string[]
    personality: string[]
  }
  behaviorPatterns: {
    purchaseBehavior: string[]
    mediaConsumption: string[]
    technologyAdoption: string
    decisionFactors: string[]
  }
  sizeEstimation: {
    totalAddressableMarket: number
    methodology: string
    confidence: number // 0-100
    growthRate: number
  }
  accessibility: {
    reachability: number // 0-100
    channels: string[]
    barriers: string[]
  }
  priority: number // 0-100
  confidence: number // 0-100
  lastUpdated: Date
}

export interface PainPointAnalysis {
  problem: string
  description: string
  severity: 'low' | 'medium' | 'high'
  frequency: 'rare' | 'occasional' | 'frequent' | 'constant'
  customerSegments: string[]
  evidenceStrength: number // 0-100
  currentSolutions: {
    solution: string
    satisfaction: number // 0-100
    limitations: string[]
  }[]
  customerQuotes: {
    quote: string
    source: string
    anonymized: boolean
    sentiment: 'negative' | 'neutral' | 'positive'
  }[]
  impact: {
    financial: string
    operational: string
    emotional: string
  }
  opportunity: number // 0-100
  confidence: number // 0-100
}

export interface WillingnessToPayAnalysis {
  priceRange: {
    min: number
    max: number
    currency: string
    confidence: number // 0-100
  }
  priceModel: 'subscription' | 'one-time' | 'freemium' | 'usage-based' | 'hybrid'
  valuePerspective: {
    perceivedValue: number // 0-100
    costOfProblem: number
    competitiveContext: string[]
    priceAnchors: string[]
  }
  priceSensitivity: {
    elasticity: 'high' | 'medium' | 'low'
    segmentVariations: {
      segment: string
      sensitivity: string
      willingnessToPay: number
    }[]
  }
  affordabilityAssessment: {
    canAfford: number // percentage of segment
    paymentPreferences: string[]
    budgetConstraints: string[]
  }
  recommendations: {
    suggestedPrice: number
    pricingStrategy: string
    rationale: string[]
    risks: string[]
  }
  confidence: number // 0-100
}

export interface CustomerValidationScore {
  overall: number // 0-100
  components: {
    problemValidation: number // 0-100
    marketDemand: number // 0-100
    segmentViability: number // 0-100
    solutionFit: number // 0-100
    willingnessToPayScore: number // 0-100
    competitiveAdvantage: number // 0-100
  }
  explanation: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  confidence: number // 0-100
}

export interface CustomerPersona {
  name: string
  title: string
  demographics: {
    age: number
    gender: string
    income: number
    education: string
    location: string
    occupation: string
  }
  background: string
  goals: string[]
  frustrations: string[]
  motivations: string[]
  behaviors: {
    technology: string[]
    communication: string[]
    purchasing: string[]
    research: string[]
  }
  needsAndPainPoints: {
    primaryNeeds: string[]
    painPoints: string[]
    currentSolutions: string[]
    unmetNeeds: string[]
  }
  buyingProcess: {
    trigger: string
    evaluationCriteria: string[]
    decisionFactors: string[]
    influencers: string[]
    timeline: string
  }
  marketingInsights: {
    preferredChannels: string[]
    messaging: string[]
    contentTypes: string[]
    engagementStyle: string
  }
  priority: number // 0-100
  marketSize: number
  confidence: number // 0-100
}

export interface ValidationInsight {
  type:
    | 'problem-validation'
    | 'market-demand'
    | 'segment-opportunity'
    | 'pricing-insight'
    | 'persona-recommendation'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  confidence: number // 0-100
  evidence: string[]
  recommendations: string[]
  risks: string[]
  priority: number // 0-100
}

export interface DataSource {
  name: string
  url?: string
  type:
    | 'forum'
    | 'social-media'
    | 'survey'
    | 'review-site'
    | 'demographic-data'
    | 'industry-report'
    | 'interview'
  credibility: number // 0-100
  recency: Date
  accessDate: Date
  dataPoints: string[]
  sampleSize?: number
  methodology?: string
}

export interface CustomerResearchRequest {
  businessIdea: {
    title: string
    description: string
    category?: string
    targetMarket?: string
    geography?: string[]
  }
  analysisDepth: 'basic' | 'standard' | 'comprehensive'
  focusAreas: ('segmentation' | 'problem-validation' | 'pain-points' | 'pricing' | 'personas')[]
  maxSegments?: number
  maxPersonas?: number
  timeConstraints?: number // minutes
}
