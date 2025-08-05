/**
 * Confidence Rating Engine
 * Evaluates data quality and source reliability to generate confidence ratings
 */

import {
  DataSource,
  MarketSizeData,
  MarketTrend,
  CompetitiveLandscape
} from '../schemas/market-research-types.js';

export interface ConfidenceAssessment {
  overall: 'high' | 'medium' | 'low';
  score: number; // 0-100
  components: {
    dataQuality: number;
    sourceReliability: number;
    dataRecency: number;
    methodologyRobustness: number;
    crossValidation: number;
  };
  factors: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

export class ConfidenceEngine {
  private readonly confidenceThresholds = {
    high: 80,
    medium: 60,
    low: 0
  };

  private readonly sourceCredibilityWeights = {
    'government-data': 95,
    'industry-report': 85,
    'research-firm': 80,
    'survey': 75,
    'news': 60,
    'web-scraping': 50
  };

  /**
   * Calculate comprehensive confidence assessment
   */
  calculateConfidence(
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): ConfidenceAssessment {
    const components = {
      dataQuality: this.assessDataQuality(marketSize, trends, competitive),
      sourceReliability: this.assessSourceReliability(marketSize, trends, competitive),
      dataRecency: this.assessDataRecency(marketSize, trends, competitive),
      methodologyRobustness: this.assessMethodologyRobustness(marketSize),
      crossValidation: this.assessCrossValidation(marketSize, trends, competitive)
    };

    const score = this.calculateWeightedConfidenceScore(components);
    const overall = this.determineConfidenceLevel(score);
    const factors = this.analyzeConfidenceFactors(components, marketSize, trends, competitive);

    return {
      overall,
      score,
      components,
      factors
    };
  }

  /**
   * Assess overall data quality
   */
  private assessDataQuality(
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): number {
    let qualityScore = 0;
    let totalComponents = 0;

    // Market size data quality
    totalComponents += 3;
    qualityScore += marketSize.tam.confidence || 0;
    qualityScore += marketSize.sam.confidence || 0;
    qualityScore += marketSize.som.confidence || 0;

    // Growth rate data quality
    if (marketSize.growthRate) {
      totalComponents += 1;
      qualityScore += marketSize.growthRate.confidence || 0;
    }

    // Trends data quality
    if (trends && trends.length > 0) {
      totalComponents += 1;
      const avgTrendConfidence = trends.reduce((sum, trend) => sum + (trend.confidence || 0), 0) / trends.length;
      qualityScore += avgTrendConfidence;
    }

    // Competitive data quality (estimated based on completeness)
    totalComponents += 1;
    let competitiveQuality = 50; // Base score
    if (competitive.keyPlayers && competitive.keyPlayers.length >= 3) competitiveQuality += 20;
    if (competitive.marketShare && competitive.marketShare.length >= 3) competitiveQuality += 20;
    if (competitive.entryBarriers) competitiveQuality += 10;
    qualityScore += Math.min(100, competitiveQuality);

    return totalComponents > 0 ? Math.round(qualityScore / totalComponents) : 50;
  }

  /**
   * Assess source reliability
   */
  private assessSourceReliability(
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): number {
    const allSources: DataSource[] = [];

    // Collect all data sources
    allSources.push(...(marketSize.tam.dataSources || []));
    allSources.push(...(marketSize.sam.dataSources || []));
    allSources.push(...(marketSize.som.dataSources || []));

    trends.forEach(trend => {
      allSources.push(...(trend.sources || []));
    });

    if (allSources.length === 0) return 40; // Low reliability if no sources

    // Calculate weighted average credibility
    let totalCredibility = 0;
    let totalWeight = 0;

    allSources.forEach(source => {
      const baseCredibility = source.credibility || this.sourceCredibilityWeights[source.type] || 50;
      const recencyFactor = this.calculateRecencyFactor(source.recency);
      const adjustedCredibility = baseCredibility * recencyFactor;
      
      totalCredibility += adjustedCredibility;
      totalWeight += 1;
    });

    // Bonus for source diversity
    const uniqueSourceTypes = new Set(allSources.map(s => s.type)).size;
    const diversityBonus = Math.min(15, uniqueSourceTypes * 3);

    const avgCredibility = totalWeight > 0 ? totalCredibility / totalWeight : 50;
    return Math.min(100, Math.round(avgCredibility + diversityBonus));
  }

  /**
   * Assess data recency
   */
  private assessDataRecency(
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): number {
    const currentDate = new Date();
    const allDates: Date[] = [];

    // Collect all relevant dates
    allDates.push(marketSize.tam.calculationDate);
    allDates.push(marketSize.sam.calculationDate);
    allDates.push(marketSize.som.calculationDate);

    // Add data source dates
    const allSources: DataSource[] = [];
    allSources.push(...(marketSize.tam.dataSources || []));
    allSources.push(...(marketSize.sam.dataSources || []));
    allSources.push(...(marketSize.som.dataSources || []));

    trends.forEach(trend => {
      allSources.push(...(trend.sources || []));
    });

    allSources.forEach(source => {
      if (source.recency) allDates.push(source.recency);
      if (source.accessDate) allDates.push(source.accessDate);
    });

    if (allDates.length === 0) return 50; // Default if no dates

    // Calculate average age and convert to recency score
    const avgAge = allDates.reduce((sum, date) => {
      const ageInDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return sum + ageInDays;
    }, 0) / allDates.length;

    // Convert age to recency score (0-100)
    let recencyScore = 100;
    if (avgAge > 365) recencyScore = 30; // Over 1 year old
    else if (avgAge > 180) recencyScore = 50; // Over 6 months old
    else if (avgAge > 90) recencyScore = 70; // Over 3 months old
    else if (avgAge > 30) recencyScore = 85; // Over 1 month old
    else recencyScore = 100; // Recent data

    return recencyScore;
  }

  /**
   * Assess methodology robustness
   */
  private assessMethodologyRobustness(marketSize: MarketSizeData): number {
    let robustnessScore = 50; // Base score

    // Count different methodologies used
    const methodologies = new Set([
      marketSize.tam.methodology,
      marketSize.sam.methodology,
      marketSize.som.methodology
    ]);

    // Bonus for using multiple methodologies
    if (methodologies.size >= 3) robustnessScore += 30;
    else if (methodologies.size >= 2) robustnessScore += 20;
    else if (methodologies.size >= 1) robustnessScore += 10;

    // Bonus for detailed assumptions
    const totalAssumptions = [
      ...(marketSize.tam.assumptions || []),
      ...(marketSize.sam.assumptions || []),
      ...(marketSize.som.assumptions || [])
    ].length;

    if (totalAssumptions >= 10) robustnessScore += 20;
    else if (totalAssumptions >= 5) robustnessScore += 15;
    else if (totalAssumptions >= 3) robustnessScore += 10;

    // Bonus for projections and scenarios
    if (marketSize.projections) {
      robustnessScore += 15;
      
      // Additional bonus for multiple scenarios
      const scenarios = marketSize.projections.scenarios;
      if (scenarios && Object.keys(scenarios).length >= 3) {
        robustnessScore += 10;
      }
    }

    return Math.min(100, robustnessScore);
  }

  /**
   * Assess cross-validation between different data points
   */
  private assessCrossValidation(
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): number {
    let validationScore = 50; // Base score

    // Check consistency between TAM/SAM/SOM ratios
    const tamValue = marketSize.tam.value;
    const samValue = marketSize.sam.value;
    const somValue = marketSize.som.value;

    if (tamValue > 0 && samValue > 0 && somValue > 0) {
      const samRatio = samValue / tamValue;
      const somRatio = somValue / samValue;

      // Reasonable ratios indicate good validation
      if (samRatio >= 0.05 && samRatio <= 0.5) validationScore += 15; // SAM is 5-50% of TAM
      if (somRatio >= 0.02 && somRatio <= 0.3) validationScore += 15; // SOM is 2-30% of SAM
    }

    // Check consistency between growth rates and trends
    if (marketSize.growthRate && trends && trends.length > 0) {
      const positiveGrowthTrends = trends.filter(t => t.impact === 'positive').length;
      const negativeGrowthTrends = trends.filter(t => t.impact === 'negative').length;
      
      const growthRate = marketSize.growthRate.annual;
      
      // High growth should correlate with positive trends
      if (growthRate > 10 && positiveGrowthTrends > negativeGrowthTrends) {
        validationScore += 10;
      }
      // Low/negative growth should correlate with negative trends
      else if (growthRate < 5 && negativeGrowthTrends >= positiveGrowthTrends) {
        validationScore += 10;
      }
    }

    // Check for multiple data source validation
    const allSources: DataSource[] = [];
    allSources.push(...(marketSize.tam.dataSources || []));
    allSources.push(...(marketSize.sam.dataSources || []));
    allSources.push(...(marketSize.som.dataSources || []));

    const uniqueSourceTypes = new Set(allSources.map(s => s.type));
    if (uniqueSourceTypes.size >= 3) validationScore += 15; // Multiple source types
    else if (uniqueSourceTypes.size >= 2) validationScore += 10;

    return Math.min(100, validationScore);
  }

  /**
   * Calculate weighted confidence score
   */
  private calculateWeightedConfidenceScore(components: any): number {
    const weights = {
      dataQuality: 0.30,
      sourceReliability: 0.25,
      dataRecency: 0.20,
      methodologyRobustness: 0.15,
      crossValidation: 0.10
    };

    return Math.round(
      components.dataQuality * weights.dataQuality +
      components.sourceReliability * weights.sourceReliability +
      components.dataRecency * weights.dataRecency +
      components.methodologyRobustness * weights.methodologyRobustness +
      components.crossValidation * weights.crossValidation
    );
  }

  /**
   * Determine confidence level from score
   */
  private determineConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= this.confidenceThresholds.high) return 'high';
    if (score >= this.confidenceThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Analyze confidence factors
   */
  private analyzeConfidenceFactors(
    components: any,
    marketSize: MarketSizeData,
    trends: MarketTrend[],
    competitive: CompetitiveLandscape
  ): { strengths: string[]; weaknesses: string[]; recommendations: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    // Analyze each component
    Object.entries(components).forEach(([component, score]) => {
      const componentScore = score as number;
      
      if (componentScore >= 80) {
        strengths.push(this.getStrengthDescription(component, componentScore));
      } else if (componentScore <= 50) {
        weaknesses.push(this.getWeaknessDescription(component, componentScore));
        recommendations.push(this.getImprovementRecommendation(component));
      }
    });

    // Add general recommendations based on overall assessment
    if (components.dataQuality < 70) {
      recommendations.push('Seek additional high-quality data sources to improve analysis reliability');
    }

    if (components.sourceReliability < 70) {
      recommendations.push('Prioritize authoritative sources such as government data and established research firms');
    }

    if (components.dataRecency < 70) {
      recommendations.push('Update analysis with more recent market data and trends');
    }

    return { strengths, weaknesses, recommendations };
  }

  private getStrengthDescription(component: string, score: number): string {
    const descriptions: Record<string, string> = {
      dataQuality: `High-quality data with ${score}% reliability across all market size components`,
      sourceReliability: `Highly credible sources with ${score}% average reliability rating`,
      dataRecency: `Recent data with ${score}% recency score ensuring current market conditions`,
      methodologyRobustness: `Robust analytical approach with ${score}% methodology strength`,
      crossValidation: `Strong data validation with ${score}% consistency across multiple data points`
    };
    return descriptions[component] || `Strong ${component} performance (${score}%)`;
  }

  private getWeaknessDescription(component: string, score: number): string {
    const descriptions: Record<string, string> = {
      dataQuality: `Data quality concerns with only ${score}% reliability`,
      sourceReliability: `Limited source credibility with ${score}% average reliability`,
      dataRecency: `Outdated information with ${score}% recency score`,
      methodologyRobustness: `Methodology limitations with ${score}% robustness rating`,
      crossValidation: `Insufficient cross-validation with ${score}% consistency`
    };
    return descriptions[component] || `${component} needs improvement (${score}%)`;
  }

  private getImprovementRecommendation(component: string): string {
    const recommendations: Record<string, string> = {
      dataQuality: 'Invest in higher-quality data sources and more comprehensive market research',
      sourceReliability: 'Seek out authoritative industry reports and government statistical sources',
      dataRecency: 'Update market analysis with current year data and real-time trend monitoring',
      methodologyRobustness: 'Employ multiple calculation methodologies and document assumptions thoroughly',
      crossValidation: 'Cross-reference findings across multiple independent data sources'
    };
    return recommendations[component] || `Improve ${component} through additional research and validation`;
  }

  private calculateRecencyFactor(recencyDate: Date): number {
    const currentDate = new Date();
    const ageInDays = (currentDate.getTime() - recencyDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (ageInDays <= 30) return 1.0;      // Perfect recency
    if (ageInDays <= 90) return 0.95;     // Slight reduction
    if (ageInDays <= 180) return 0.85;    // Moderate reduction
    if (ageInDays <= 365) return 0.70;    // Significant reduction
    return 0.50;                          // Old data penalty
  }
}