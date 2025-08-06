/**
 * Market Sizing Engine - TAM/SAM/SOM Calculation Framework
 * Implements multiple methodologies for comprehensive market analysis
 */

import {
  MarketSizeData,
  MarketSizeCalculation,
  MarketSizingRequest,
  CalculationMethodology,
  DataSource,
  GrowthRateAnalysis,
  MarketProjections,
  MarketScenario,
} from '../schemas/market-research-types.js'

export class MarketSizingEngine {
  private readonly methodologies: Map<string, CalculationMethodology> = new Map()
  private readonly dataQualityThreshold: number = 0.6

  constructor() {
    this.initializeMethodologies()
  }

  /**
   * Calculate comprehensive market size using multiple methodologies
   */
  async calculateMarketSize(request: MarketSizingRequest): Promise<MarketSizeData> {
    const startTime = Date.now()

    // Execute multiple methodologies in parallel
    const methodologyPromises = (
      request.preferredMethodologies || ['top-down', 'bottom-up', 'value-theory']
    ).map(methodology => this.executeMethodology(methodology, request))

    const results = await Promise.allSettled(methodologyPromises)

    // Aggregate results and select best methodology for each market size component
    const tam = this.selectBestCalculation(results, 'tam')
    const sam = this.selectBestCalculation(results, 'sam')
    const som = this.selectBestCalculation(results, 'som')

    // Calculate growth rate analysis
    const growthRate = await this.calculateGrowthRate(request, tam)

    // Generate market projections
    const projections = await this.generateProjections(tam, sam, som, growthRate)

    console.log(`[MarketSizingEngine] Completed analysis in ${Date.now() - startTime}ms`)

    return {
      tam,
      sam,
      som,
      growthRate,
      projections,
    }
  }

  /**
   * Execute specific methodology for market sizing
   */
  private async executeMethodology(
    methodologyType: 'top-down' | 'bottom-up' | 'value-theory',
    request: MarketSizingRequest
  ): Promise<{
    tam: MarketSizeCalculation
    sam: MarketSizeCalculation
    som: MarketSizeCalculation
  }> {
    switch (methodologyType) {
      case 'top-down':
        return this.calculateTopDown(request)
      case 'bottom-up':
        return this.calculateBottomUp(request)
      case 'value-theory':
        return this.calculateValueTheory(request)
      default:
        throw new Error(`Unknown methodology: ${methodologyType}`)
    }
  }

  /**
   * Top-Down Methodology: Start with total industry size and narrow down
   */
  private async calculateTopDown(request: MarketSizingRequest): Promise<{
    tam: MarketSizeCalculation
    sam: MarketSizeCalculation
    som: MarketSizeCalculation
  }> {
    // Mock implementation with realistic calculations
    const industrySize = await this.getIndustrySize(request.businessIdea.category || 'technology')
    const geographicFactor = this.calculateGeographicFactor(
      request.businessIdea.geography || ['US']
    )
    const targetMarketFactor = 0.15 // Assume 15% of total industry is addressable
    const penetrationRate = 0.05 // Assume 5% market penetration achievable

    const tamValue = industrySize * geographicFactor
    const samValue = tamValue * targetMarketFactor
    const somValue = samValue * penetrationRate

    const dataSources: DataSource[] = [
      {
        name: 'Industry Research Report',
        type: 'industry-report',
        credibility: 85,
        recency: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        accessDate: new Date(),
        geography: request.businessIdea.geography || ['US'],
      },
    ]

    const assumptions = [
      `Industry size estimated at $${this.formatCurrency(industrySize)}`,
      `Geographic coverage factor: ${(geographicFactor * 100).toFixed(1)}%`,
      `Target market represents ${(targetMarketFactor * 100).toFixed(1)}% of total industry`,
      `Achievable market penetration: ${(penetrationRate * 100).toFixed(1)}%`,
    ]

    return {
      tam: {
        value: tamValue,
        currency: 'USD',
        methodology: 'top-down',
        confidence: 75,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
      },
      sam: {
        value: samValue,
        currency: 'USD',
        methodology: 'top-down',
        confidence: 70,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      som: {
        value: somValue,
        currency: 'USD',
        methodology: 'top-down',
        confidence: 65,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    }
  }

  /**
   * Bottom-Up Methodology: Build up from customer segments and unit economics
   */
  private async calculateBottomUp(request: MarketSizingRequest): Promise<{
    tam: MarketSizeCalculation
    sam: MarketSizeCalculation
    som: MarketSizeCalculation
  }> {
    // Customer-based calculations
    const totalCustomers = await this.estimateCustomerBase(request.businessIdea)
    const avgRevenuePerCustomer = await this.estimateARPU(request.businessIdea)
    const addressableCustomers = totalCustomers * 0.4 // 40% addressable
    const obtainableCustomers = addressableCustomers * 0.1 // 10% obtainable

    const tamValue = totalCustomers * avgRevenuePerCustomer
    const samValue = addressableCustomers * avgRevenuePerCustomer
    const somValue = obtainableCustomers * avgRevenuePerCustomer

    const dataSources: DataSource[] = [
      {
        name: 'Census Data & Surveys',
        type: 'government-data',
        credibility: 90,
        recency: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        accessDate: new Date(),
        sampleSize: 10000,
      },
    ]

    const assumptions = [
      `Total potential customers: ${this.formatNumber(totalCustomers)}`,
      `Average revenue per customer: $${this.formatCurrency(avgRevenuePerCustomer)}`,
      `Addressable customer percentage: 40%`,
      `Obtainable customer percentage: 10% of addressable`,
    ]

    return {
      tam: {
        value: tamValue,
        currency: 'USD',
        methodology: 'bottom-up',
        confidence: 80,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      sam: {
        value: samValue,
        currency: 'USD',
        methodology: 'bottom-up',
        confidence: 75,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      som: {
        value: somValue,
        currency: 'USD',
        methodology: 'bottom-up',
        confidence: 70,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    }
  }

  /**
   * Value Theory Methodology: Calculate based on value delivered vs alternatives
   */
  private async calculateValueTheory(request: MarketSizingRequest): Promise<{
    tam: MarketSizeCalculation
    sam: MarketSizeCalculation
    som: MarketSizeCalculation
  }> {
    // Value-based calculations
    const currentSolutionCost = await this.estimateCurrentSolutionCost(request.businessIdea)
    const valueDelivered = currentSolutionCost * 1.3 // 30% improvement
    const willingnessToPay = valueDelivered * 0.3 // Customers keep 70% of value
    const totalMarketSpend = await this.estimateTotalMarketSpend(request.businessIdea)

    const tamValue = totalMarketSpend
    const samValue = tamValue * 0.25 // 25% of market willing to switch
    const somValue = samValue * 0.08 // 8% market share achievable

    const dataSources: DataSource[] = [
      {
        name: 'Pricing Analysis & Competitive Intelligence',
        type: 'research-firm',
        credibility: 75,
        recency: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        accessDate: new Date(),
      },
    ]

    const assumptions = [
      `Current solution cost: $${this.formatCurrency(currentSolutionCost)}`,
      `Value delivered: $${this.formatCurrency(valueDelivered)} (30% improvement)`,
      `Customer willingness to pay: $${this.formatCurrency(willingnessToPay)}`,
      `Market switching likelihood: 25%`,
      `Achievable market share: 8%`,
    ]

    return {
      tam: {
        value: tamValue,
        currency: 'USD',
        methodology: 'value-theory',
        confidence: 70,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      sam: {
        value: samValue,
        currency: 'USD',
        methodology: 'value-theory',
        confidence: 65,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      som: {
        value: somValue,
        currency: 'USD',
        methodology: 'value-theory',
        confidence: 60,
        assumptions,
        dataSources,
        calculationDate: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    }
  }

  /**
   * Select the best calculation from multiple methodology results
   */
  private selectBestCalculation(
    results: PromiseSettledResult<any>[],
    component: 'tam' | 'sam' | 'som'
  ): MarketSizeCalculation {
    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value[component])
      .filter(calc => calc.confidence >= this.dataQualityThreshold * 100)

    if (successfulResults.length === 0) {
      // Fallback calculation
      return this.createFallbackCalculation(component)
    }

    // Select calculation with highest confidence
    return successfulResults.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    )
  }

  /**
   * Calculate growth rate analysis
   */
  private async calculateGrowthRate(
    request: MarketSizingRequest,
    tam: MarketSizeCalculation
  ): Promise<GrowthRateAnalysis> {
    // Mock growth rate calculation based on industry patterns
    const baseGrowthRate = this.getIndustryGrowthRate(request.businessIdea.category || 'technology')

    return {
      annual: baseGrowthRate,
      quarterly: [
        baseGrowthRate * 0.25,
        baseGrowthRate * 0.25,
        baseGrowthRate * 0.25,
        baseGrowthRate * 0.25,
      ],
      historical: [
        {
          period: '2022',
          growthRate: baseGrowthRate - 1,
          marketValue: tam.value * 0.9,
          source: 'Industry Report',
        },
        {
          period: '2023',
          growthRate: baseGrowthRate,
          marketValue: tam.value,
          source: 'Industry Report',
        },
      ],
      projected: [
        {
          year: 2024,
          growthRate: baseGrowthRate,
          projectedValue: tam.value * (1 + baseGrowthRate / 100),
          scenario: 'moderate',
          confidence: 75,
        },
        {
          year: 2025,
          growthRate: baseGrowthRate * 0.9,
          projectedValue: tam.value * Math.pow(1 + baseGrowthRate / 100, 2) * 0.9,
          scenario: 'moderate',
          confidence: 70,
        },
      ],
      source: 'Industry Analysis',
      timeframe: '2024-2025',
      confidence: 75,
    }
  }

  /**
   * Generate market projections with multiple scenarios
   */
  private async generateProjections(
    tam: MarketSizeCalculation,
    sam: MarketSizeCalculation,
    som: MarketSizeCalculation,
    growthRate: GrowthRateAnalysis
  ): Promise<MarketProjections> {
    const timeHorizon = 5
    const scenarios = {
      conservative: this.createScenario(
        'conservative',
        tam,
        sam,
        som,
        growthRate.annual * 0.7,
        0.3
      ),
      moderate: this.createScenario('moderate', tam, sam, som, growthRate.annual, 0.5),
      optimistic: this.createScenario('optimistic', tam, sam, som, growthRate.annual * 1.3, 0.2),
    }

    return {
      timeHorizon,
      scenarios,
      keyAssumptions: [
        'Market growth follows historical patterns',
        'No major market disruptions',
        'Competitive landscape remains stable',
        'Economic conditions remain favorable',
      ],
      riskFactors: [
        'Economic recession impact',
        'New competitive entrants',
        'Regulatory changes',
        'Technology disruption',
      ],
    }
  }

  private createScenario(
    type: 'conservative' | 'moderate' | 'optimistic',
    tam: MarketSizeCalculation,
    sam: MarketSizeCalculation,
    som: MarketSizeCalculation,
    growthRate: number,
    probability: number
  ): MarketScenario {
    const yearlyProjections = []
    for (let year = 1; year <= 5; year++) {
      const growthFactor = Math.pow(1 + growthRate / 100, year)
      yearlyProjections.push({
        year: new Date().getFullYear() + year,
        tam: tam.value * growthFactor,
        sam: sam.value * growthFactor,
        som: som.value * growthFactor,
        confidence: Math.max(50, tam.confidence - year * 5), // Confidence decreases over time
      })
    }

    return {
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} growth scenario`,
      probability: probability * 100,
      yearlyProjections,
    }
  }

  // Helper methods for calculations
  private async getIndustrySize(category: string): Promise<number> {
    const industrySizes: Record<string, number> = {
      technology: 5000000000000, // $5T
      healthcare: 4000000000000, // $4T
      finance: 3000000000000, // $3T
      retail: 2500000000000, // $2.5T
      education: 1500000000000, // $1.5T
      default: 1000000000000, // $1T
    }
    return industrySizes[category] || industrySizes['default']
  }

  private calculateGeographicFactor(geography: string[]): number {
    const geographicFactors: Record<string, number> = {
      US: 0.25,
      EU: 0.2,
      Global: 1.0,
      'North America': 0.3,
      Asia: 0.35,
    }

    return geography.reduce((factor, geo) => factor + (geographicFactors[geo] || 0.1), 0)
  }

  private async estimateCustomerBase(businessIdea: any): Promise<number> {
    // Mock customer base estimation
    return 50000000 // 50M potential customers
  }

  private async estimateARPU(businessIdea: any): Promise<number> {
    // Mock ARPU estimation
    return 1200 // $1200 per customer per year
  }

  private async estimateCurrentSolutionCost(businessIdea: any): Promise<number> {
    // Mock current solution cost
    return 2000 // $2000 annual cost
  }

  private async estimateTotalMarketSpend(businessIdea: any): Promise<number> {
    // Mock total market spend
    return 100000000000 // $100B total market spend
  }

  private getIndustryGrowthRate(category: string): number {
    const growthRates: Record<string, number> = {
      technology: 12,
      healthcare: 8,
      finance: 6,
      retail: 4,
      education: 5,
      default: 7,
    }
    return growthRates[category] || growthRates['default']
  }

  private createFallbackCalculation(component: 'tam' | 'sam' | 'som'): MarketSizeCalculation {
    const fallbackValues = {
      tam: 1000000000, // $1B
      sam: 150000000, // $150M
      som: 15000000, // $15M
    }

    return {
      value: fallbackValues[component],
      currency: 'USD',
      methodology: 'top-down',
      confidence: 50,
      assumptions: ['Fallback calculation due to insufficient data'],
      dataSources: [],
      calculationDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1000000000000) {
      return `${(amount / 1000000000000).toFixed(1)}T`
    } else if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`
    } else if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toFixed(0)
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat().format(num)
  }

  private initializeMethodologies(): void {
    // Initialize methodology definitions (simplified for now)
    this.methodologies.set('top-down', {
      name: 'Top-Down Analysis',
      type: 'top-down',
      description: 'Start with total industry size and narrow down to addressable segments',
      steps: [
        'Identify total industry size',
        'Apply geographic filters',
        'Calculate addressable market segment',
        'Estimate penetration rates',
      ],
      dataSources: [],
      assumptions: [],
      confidence: 75,
      applicability: ['established-industries', 'large-markets'],
    })
  }
}
