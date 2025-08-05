/**
 * Comprehensive Market Research Data Schema
 * Defines structured output formats for market analysis
 */

export interface MarketSizeData {
  tam: MarketSizeCalculation;
  sam: MarketSizeCalculation;
  som: MarketSizeCalculation;
  growthRate: GrowthRateAnalysis;
  projections: MarketProjections;
}

export interface MarketSizeCalculation {
  value: number;
  currency: string;
  methodology: 'top-down' | 'bottom-up' | 'value-theory';
  confidence: number; // 0-100
  assumptions: string[];
  dataSources: DataSource[];
  calculationDate: Date;
  validUntil: Date;
}

export interface GrowthRateAnalysis {
  annual: number;
  quarterly: number[];
  historical: HistoricalGrowthData[];
  projected: ProjectedGrowthData[];
  source: string;
  timeframe: string;
  confidence: number;
}

export interface HistoricalGrowthData {
  period: string;
  growthRate: number;
  marketValue: number;
  source: string;
}

export interface ProjectedGrowthData {
  year: number;
  growthRate: number;
  projectedValue: number;
  scenario: 'conservative' | 'moderate' | 'optimistic';
  confidence: number;
}

export interface MarketProjections {
  timeHorizon: number; // years
  scenarios: {
    conservative: MarketScenario;
    moderate: MarketScenario;
    optimistic: MarketScenario;
  };
  keyAssumptions: string[];
  riskFactors: string[];
}

export interface MarketScenario {
  description: string;
  probability: number; // 0-100
  yearlyProjections: {
    year: number;
    tam: number;
    sam: number;
    som: number;
    confidence: number;
  }[];
}

export interface MarketTrend {
  trend: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: 'low' | 'medium' | 'high';
  confidence: number;
  sources: DataSource[];
  timeframe: string;
  relatedTrends: string[];
}

export interface CompetitiveLandscape {
  competitorCount: number;
  marketConcentration: 'fragmented' | 'concentrated' | 'monopolistic';
  entryBarriers: BarrierAnalysis;
  keyPlayers: Competitor[];
  marketShare: MarketShareData[];
  competitiveIntensity: number; // 0-100
}

export interface BarrierAnalysis {
  overall: 'low' | 'medium' | 'high';
  financial: number; // 0-100
  regulatory: number; // 0-100
  technological: number; // 0-100
  brand: number; // 0-100
  distribution: number; // 0-100
}

export interface Competitor {
  name: string;
  marketShare: number;
  revenue: number;
  strengths: string[];
  weaknesses: string[];
  positioning: string;
  threatLevel: 'low' | 'medium' | 'high';
}

export interface MarketShareData {
  company: string;
  share: number;
  revenue: number;
  growth: number;
  source: string;
}

export interface OpportunityScore {
  overall: number; // 0-100
  components: {
    marketSize: number;
    growth: number;
    competition: number;
    trends: number;
    barriers: number;
    timing: number;
  };
  explanation: string;
  recommendations: string[];
}

export interface DataSource {
  name: string;
  url?: string;
  type: 'industry-report' | 'government-data' | 'research-firm' | 'news' | 'survey' | 'web-scraping';
  credibility: number; // 0-100
  recency: Date;
  accessDate: Date;
  methodology?: string;
  sampleSize?: number;
  geography?: string[];
}

export interface MarketResearchOutput {
  marketSize: MarketSizeData;
  trends: MarketTrend[];
  competitiveLandscape: CompetitiveLandscape;
  opportunityScore: OpportunityScore;
  metadata: {
    analysisDate: Date;
    processingTime: number;
    dataQuality: number; // 0-100
    completeness: number; // 0-100
    version: string;
    methodology: string[];
  };
  assumptions: {
    key: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    confidence: number;
  }[];
  limitations: string[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: 'market-entry' | 'positioning' | 'timing' | 'sizing';
    description: string;
    rationale: string;
  }[];
}

export interface CalculationMethodology {
  name: string;
  type: 'top-down' | 'bottom-up' | 'value-theory';
  description: string;
  steps: string[];
  dataSources: DataSource[];
  assumptions: string[];
  confidence: number;
  applicability: string[];
}

export interface MarketSizingRequest {
  businessIdea: {
    title: string;
    description: string;
    category?: string;
    targetMarket?: string;
    geography?: string[];
  };
  analysisType: string;
  timeHorizon?: number;
  preferredMethodologies?: ('top-down' | 'bottom-up' | 'value-theory')[];
  dataSourcePreferences?: string[];
  confidenceThreshold?: number;
}