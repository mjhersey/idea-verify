/**
 * Market Opportunity Scoring Engine
 * Calculates comprehensive 0-100 opportunity scores with component breakdown
 */

import {
  OpportunityScore,
  MarketSizeData,
  MarketTrend,
  CompetitiveLandscape,
  MarketSizingRequest
} from '../schemas/market-research-types.js';

export class OpportunityScoringEngine {
  private readonly weights = {
    marketSize: 0.25,    // 25% - Size of opportunity
    growth: 0.20,        // 20% - Growth potential
    competition: 0.20,   // 20% - Competitive intensity (inverse)
    trends: 0.15,        // 15% - Market trends favorability
    barriers: 0.10,      // 10% - Entry barriers (inverse)
    timing: 0.10         // 10% - Market timing
  };

  /**
   * Calculate comprehensive opportunity score
   */
  async calculateOpportunityScore(
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape,
    request: MarketSizingRequest
  ): Promise<OpportunityScore> {
    const components = {
      marketSize: this.scoreMarketSize(marketSize),
      growth: this.scoreGrowthPotential(marketSize.growthRate),
      competition: this.scoreCompetitiveEnvironment(competitive),
      trends: this.scoreTrends(trends),
      barriers: this.scoreEntryBarriers(competitive.entryBarriers),
      timing: this.scoreMarketTiming(request, trends)
    };

    const overall = this.calculateWeightedScore(components);
    const explanation = this.generateScoreExplanation(components, overall);
    const recommendations = this.generateRecommendations(components, overall);

    return {
      overall,
      components,
      explanation,
      recommendations
    };
  }

  /**
   * Score market size component (0-100)
   */
  private scoreMarketSize(marketSize: MarketSizeData): number {
    const tamValue = marketSize.tam.value;
    const samValue = marketSize.sam.value;
    const somValue = marketSize.som.value;

    // Score based on logarithmic scale for market sizes
    let tamScore = 0;
    if (tamValue >= 100000000000) tamScore = 100; // $100B+
    else if (tamValue >= 10000000000) tamScore = 90; // $10B+
    else if (tamValue >= 1000000000) tamScore = 80; // $1B+
    else if (tamValue >= 100000000) tamScore = 70; // $100M+
    else if (tamValue >= 10000000) tamScore = 60; // $10M+
    else if (tamValue >= 1000000) tamScore = 40; // $1M+
    else tamScore = 20;

    // Adjust based on SAM/SOM ratios
    const samRatio = samValue / tamValue;
    const somRatio = somValue / samValue;

    // Penalize if addressable market is too small relative to total
    if (samRatio < 0.05) tamScore *= 0.8; // Less than 5% addressable
    else if (samRatio < 0.1) tamScore *= 0.9; // Less than 10% addressable

    // Bonus for realistic but significant obtainable market
    if (somRatio >= 0.05 && somRatio <= 0.15) tamScore *= 1.1; // 5-15% obtainable is good

    // Factor in confidence levels
    const avgConfidence = (marketSize.tam.confidence + marketSize.sam.confidence + marketSize.som.confidence) / 3;
    const confidenceFactor = avgConfidence / 100;

    return Math.min(100, Math.round(tamScore * confidenceFactor));
  }

  /**
   * Score growth potential (0-100)
   */
  private scoreGrowthPotential(growthRate: any): number {
    const annualGrowth = growthRate.annual;
    
    let growthScore = 0;
    if (annualGrowth >= 20) growthScore = 100; // 20%+ growth
    else if (annualGrowth >= 15) growthScore = 90; // 15%+ growth
    else if (annualGrowth >= 10) growthScore = 80; // 10%+ growth
    else if (annualGrowth >= 7) growthScore = 70; // 7%+ growth
    else if (annualGrowth >= 5) growthScore = 60; // 5%+ growth
    else if (annualGrowth >= 3) growthScore = 50; // 3%+ growth
    else if (annualGrowth >= 0) growthScore = 30; // Positive growth
    else growthScore = 10; // Negative growth

    // Bonus for consistent historical growth
    if (growthRate.historical && growthRate.historical.length >= 2) {
      const consistentGrowth = growthRate.historical.every((h: any) => h.growthRate > 0);
      if (consistentGrowth) growthScore = Math.min(100, growthScore * 1.1);
    }

    // Factor in confidence
    const confidenceFactor = growthRate.confidence / 100;
    return Math.round(growthScore * confidenceFactor);
  }

  /**
   * Score competitive environment (0-100, where 100 = least competitive)
   */
  private scoreCompetitiveEnvironment(competitive: CompetitiveLandscape): number {
    let competitiveScore = 100; // Start with perfect score, reduce based on competition

    // Adjust based on market concentration
    switch (competitive.marketConcentration) {
      case 'monopolistic':
        competitiveScore = 20; // Very hard to compete
        break;
      case 'concentrated':
        competitiveScore = 50; // Moderate competition
        break;
      case 'fragmented':
        competitiveScore = 80; // Easier to find niche
        break;
    }

    // Adjust based on number of competitors
    if (competitive.competitorCount > 50) competitiveScore *= 0.6;
    else if (competitive.competitorCount > 20) competitiveScore *= 0.7;
    else if (competitive.competitorCount > 10) competitiveScore *= 0.8;
    else if (competitive.competitorCount > 5) competitiveScore *= 0.9;
    // 0-5 competitors is good, no penalty

    // Adjust based on competitive intensity
    const intensityFactor = 1 - (competitive.competitiveIntensity / 100) * 0.5;
    competitiveScore *= intensityFactor;

    // Consider key player market share concentration
    if (competitive.keyPlayers && competitive.keyPlayers.length > 0) {
      const dominantPlayers = competitive.keyPlayers.filter(p => p.marketShare > 20);
      if (dominantPlayers.length >= 2) competitiveScore *= 0.8; // Multiple dominant players
      else if (dominantPlayers.length === 1) competitiveScore *= 0.9; // One dominant player
    }

    return Math.round(Math.max(10, competitiveScore)); // Minimum score of 10
  }

  /**
   * Score market trends favorability (0-100)
   */
  private scoreTrends(trends: MarketTrend[]): number {
    if (!trends || trends.length === 0) return 50; // Neutral if no trend data

    let totalImpact = 0;
    let weightedSum = 0;

    trends.forEach(trend => {
      let trendScore = 50; // Neutral baseline
      
      // Adjust based on impact direction
      if (trend.impact === 'positive') trendScore = 80;
      else if (trend.impact === 'negative') trendScore = 20;
      else trendScore = 50; // neutral

      // Adjust based on magnitude
      const magnitudeMultiplier = {
        'high': 1.2,
        'medium': 1.0,
        'low': 0.8
      };
      trendScore *= magnitudeMultiplier[trend.magnitude];

      // Weight by confidence
      const weight = trend.confidence / 100;
      weightedSum += trendScore * weight;
      totalImpact += weight;
    });

    const averageScore = totalImpact > 0 ? weightedSum / totalImpact : 50;
    return Math.round(Math.min(100, Math.max(0, averageScore)));
  }

  /**
   * Score entry barriers (0-100, where 100 = lowest barriers)
   */
  private scoreEntryBarriers(barriers: any): number {
    // Convert barrier levels to scores (inverse - low barriers = high score)
    const barrierScores: Record<string, number> = {
      'low': 90,
      'medium': 60,
      'high': 30
    };

    let overallBarrierScore = barrierScores[barriers.overall] || 60;

    // Adjust based on specific barrier components
    const componentWeights = {
      financial: 0.3,
      regulatory: 0.25,
      technological: 0.2,
      brand: 0.15,
      distribution: 0.1
    };

    let weightedBarrierScore = 0;
    Object.entries(componentWeights).forEach(([component, weight]) => {
      const barrierLevel = barriers[component] || 50; // 0-100 where 100 = highest barrier
      const componentScore = 100 - barrierLevel; // Invert so low barriers = high score
      weightedBarrierScore += componentScore * weight;
    });

    // Combine overall assessment with component analysis
    const finalScore = (overallBarrierScore * 0.4) + (weightedBarrierScore * 0.6);
    return Math.round(finalScore);
  }

  /**
   * Score market timing (0-100)
   */
  private scoreMarketTiming(request: MarketSizingRequest, trends: MarketTrend[]): number {
    let timingScore = 70; // Default good timing score

    // Analyze trend timing signals
    if (trends && trends.length > 0) {
      const emergingTrends = trends.filter(t => 
        t.impact === 'positive' && 
        t.magnitude === 'high' && 
        t.timeframe.includes('2024') || t.timeframe.includes('2025')
      );

      if (emergingTrends.length >= 2) timingScore = 90; // Multiple positive trends emerging
      else if (emergingTrends.length === 1) timingScore = 80; // One strong trend

      // Check for declining trends that might affect timing
      const decliningTrends = trends.filter(t => 
        t.impact === 'negative' && 
        t.magnitude === 'high'
      );
      
      if (decliningTrends.length >= 2) timingScore = 40; // Multiple negative trends
      else if (decliningTrends.length === 1) timingScore = 55; // One negative trend
    }

    // Consider business idea category for timing
    const categoryTimingAdjustments: Record<string, number> = {
      'technology': 85, // Generally good timing for tech
      'healthcare': 80, // Strong post-pandemic focus
      'sustainability': 90, // High current relevance
      'remote-work': 75, // Still relevant but maturing
      'e-commerce': 70, // Mature but stable
      'travel': 60 // Still recovering
    };

    const categoryTiming = categoryTimingAdjustments[request.businessIdea.category || 'technology'] || 70;
    
    // Weighted combination
    const finalTiming = (timingScore * 0.7) + (categoryTiming * 0.3);
    return Math.round(finalTiming);
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(components: any): number {
    const weightedSum = 
      components.marketSize * this.weights.marketSize +
      components.growth * this.weights.growth +
      components.competition * this.weights.competition +
      components.trends * this.weights.trends +
      components.barriers * this.weights.barriers +
      components.timing * this.weights.timing;

    return Math.round(weightedSum);
  }

  /**
   * Generate explanation for the score
   */
  private generateScoreExplanation(components: any, overall: number): string {
    const scoreCategories = {
      90: 'Exceptional opportunity with strong fundamentals across all dimensions',
      80: 'Strong opportunity with favorable market conditions and manageable risks',
      70: 'Good opportunity with solid potential, though some challenges exist',
      60: 'Moderate opportunity requiring careful strategy and execution',
      50: 'Mixed opportunity with balanced pros and cons',
      40: 'Challenging opportunity with significant obstacles to overcome',
      30: 'Difficult opportunity requiring substantial resources and risk tolerance',
      20: 'High-risk opportunity with limited success probability',
      10: 'Very challenging opportunity with major structural impediments'
    };

    let category = 'Mixed opportunity with balanced pros and cons';
    for (const [threshold, description] of Object.entries(scoreCategories)) {
      if (overall >= parseInt(threshold)) {
        category = description;
        break;
      }
    }

    // Identify strongest and weakest components
    const componentEntries = Object.entries(components) as [string, number][];
    const strongest = componentEntries.reduce((a, b) => a[1] > b[1] ? a : b);
    const weakest = componentEntries.reduce((a, b) => a[1] < b[1] ? a : b);

    return `${category}. Key strengths: ${strongest[0]} (${strongest[1]}/100). Primary concerns: ${weakest[0]} (${weakest[1]}/100).`;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(components: any, overall: number): string[] {
    const recommendations: string[] = [];

    // Overall strategy recommendations
    if (overall >= 80) {
      recommendations.push('Strong market opportunity - consider aggressive market entry strategy');
      recommendations.push('Focus on rapid scaling and market share capture');
    } else if (overall >= 60) {
      recommendations.push('Solid opportunity - develop focused go-to-market strategy');
      recommendations.push('Consider strategic partnerships to strengthen market position');
    } else if (overall >= 40) {
      recommendations.push('Proceed with caution - validate assumptions with pilot programs');
      recommendations.push('Focus on differentiation and niche market penetration');
    } else {
      recommendations.push('High-risk opportunity - consider alternative approaches or markets');
      recommendations.push('Extensive market validation and risk mitigation required');
    }

    // Component-specific recommendations
    if (components.marketSize < 60) {
      recommendations.push('Consider expanding target market definition or geographic scope');
    }

    if (components.growth < 50) {
      recommendations.push('Explore strategies to accelerate market growth or find faster-growing segments');
    }

    if (components.competition < 40) {
      recommendations.push('Develop strong differentiation strategy and consider blue ocean opportunities');
    }

    if (components.trends < 50) {
      recommendations.push('Monitor market trends closely and adapt strategy to align with positive trends');
    }

    if (components.barriers > 80) {
      recommendations.push('Leverage low entry barriers for rapid market entry before competition increases');
    } else if (components.barriers < 40) {
      recommendations.push('Develop sustainable competitive advantages to overcome high entry barriers');
    }

    if (components.timing > 80) {
      recommendations.push('Excellent timing - prioritize speed to market to capitalize on current conditions');
    } else if (components.timing < 50) {
      recommendations.push('Consider timing strategy - may benefit from delayed entry or market education');
    }

    return recommendations;
  }
}