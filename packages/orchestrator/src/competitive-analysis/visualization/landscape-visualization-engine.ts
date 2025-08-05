/**
 * Landscape Visualization Engine
 * Generates visualization data for competitive mapping and market positioning
 */

import { 
  CompetitorProfile, 
  LandscapeVisualizationData,
  CompetitorMatrixData,
  MarketMapData,
  FeatureComparisonMatrix,
  PricingLandscapeData,
  DataSource 
} from '../schemas/competitive-analysis-types.js';

export interface LandscapeVisualizationResult {
  visualizationData: LandscapeVisualizationData;
  visualizationMetrics: {
    competitorsVisualized: number;
    featuresCompared: number;
    marketSegments: number;
    confidence: number; // 0-100
  };
  dataSources: DataSource[];
}

export class LandscapeVisualizationEngine {
  private readonly analysisTimeout = 2000;

  async generateVisualizationData(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string }
  ): Promise<LandscapeVisualizationResult> {
    const startTime = Date.now();
    console.log(`[LandscapeVisualizationEngine] Generating visualization data for ${competitors.length} competitors`);

    try {
      // Generate all visualization components in parallel
      const [
        competitorMatrix,
        marketMap,
        featureComparison,
        pricingLandscape
      ] = await Promise.all([
        this.createCompetitorMatrix(competitors, businessIdea),
        this.createMarketMap(competitors, businessIdea),
        this.createFeatureComparisonMatrix(competitors),
        this.createPricingLandscape(competitors)
      ]);

      const visualizationData: LandscapeVisualizationData = {
        competitorMatrix,
        marketMap,
        featureComparison,
        pricingLandscape
      };

      const visualizationMetrics = {
        competitorsVisualized: competitors.length,
        featuresCompared: featureComparison.features.length,
        marketSegments: marketMap.segments.length,
        confidence: this.calculateVisualizationConfidence(competitors, featureComparison)
      };

      const dataSources = this.generateVisualizationDataSources();

      console.log(`[LandscapeVisualizationEngine] Visualization data generated in ${Date.now() - startTime}ms`);

      return {
        visualizationData,
        visualizationMetrics,
        dataSources
      };

    } catch (error) {
      console.error('[LandscapeVisualizationEngine] Visualization generation failed:', error);
      throw new Error(`Visualization generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createCompetitorMatrix(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string }
  ): Promise<CompetitorMatrixData> {
    // Define matrix axes based on key competitive dimensions
    const axes = {
      x: { 
        label: 'Market Position (Quality vs Price)', 
        min: 0, 
        max: 100 
      },
      y: { 
        label: 'Feature Completeness', 
        min: 0, 
        max: 100 
      }
    };

    // Position competitors on the matrix
    const positionedCompetitors = competitors.map(competitor => {
      const avgFeatureQuality = competitor.features.length > 0 
        ? competitor.features.reduce((sum, f) => sum + f.quality, 0) / competitor.features.length
        : 50;

      // Calculate market position based on pricing and quality
      const priceScore = this.calculatePricePositionScore(competitor);
      const qualityScore = avgFeatureQuality;
      const marketPosition = (priceScore + qualityScore) / 2;

      // Feature completeness based on number and quality of features
      const featureCompleteness = Math.min(100, 
        (competitor.features.length * 10) + (avgFeatureQuality * 0.5)
      );

      return {
        name: competitor.name,
        x: marketPosition,
        y: featureCompleteness,
        size: competitor.marketShare || 5, // Default size if no market share
        category: competitor.category
      };
    });

    // Identify opportunity areas (gaps in the matrix)
    const opportunityAreas = this.identifyOpportunityAreas(positionedCompetitors, businessIdea);

    return {
      axes,
      competitors: positionedCompetitors,
      opportunityAreas
    };
  }

  private async createMarketMap(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string }
  ): Promise<MarketMapData> {
    // Identify market segments from competitor positioning
    const segmentMap = new Map<string, CompetitorProfile[]>();
    
    competitors.forEach(competitor => {
      const segment = competitor.positioning.marketSegment;
      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, []);
      }
      segmentMap.get(segment)!.push(competitor);
    });

    // Create segment data
    const segments = Array.from(segmentMap.entries()).map(([segmentName, segmentCompetitors]) => {
      const totalMarketShare = segmentCompetitors.reduce((sum, c) => sum + (c.marketShare || 0), 0);
      const avgFeatureCount = segmentCompetitors.reduce((sum, c) => sum + c.features.length, 0) / segmentCompetitors.length;
      
      return {
        name: segmentName,
        size: Math.max(totalMarketShare, segmentCompetitors.length * 5), // Estimate if no market share data
        growth: this.estimateSegmentGrowth(segmentName),
        competitors: segmentCompetitors.map(c => c.name),
        saturation: Math.min(100, (segmentCompetitors.length / competitors.length) * 100)
      };
    });

    // Identify connections between segments
    const connections = this.identifySegmentConnections(segments, competitors);

    return {
      segments,
      connections
    };
  }

  private async createFeatureComparisonMatrix(competitors: CompetitorProfile[]): Promise<FeatureComparisonMatrix> {
    // Collect all unique features
    const allFeatures = new Set<string>();
    competitors.forEach(competitor => {
      competitor.features.forEach(feature => {
        allFeatures.add(feature.name);
      });
    });

    const features = Array.from(allFeatures);

    // Create feature matrix for each competitor
    const competitorFeatures = competitors.map(competitor => ({
      name: competitor.name,
      features: features.reduce((acc, featureName) => {
        const feature = competitor.features.find(f => f.name === featureName);
        acc[featureName] = {
          available: !!feature,
          quality: feature?.quality || 0,
          notes: feature?.description
        };
        return acc;
      }, {} as { [key: string]: { available: boolean; quality: number; notes?: string } })
    }));

    // Identify feature gaps (opportunities)
    const gaps = features.map(feature => {
      const availableCount = competitors.filter(comp => 
        comp.features.some(f => f.name === feature)
      ).length;
      
      const avgQuality = competitors
        .map(comp => comp.features.find(f => f.name === feature)?.quality || 0)
        .reduce((sum, quality, _, arr) => sum + quality / arr.length, 0);

      const opportunity = Math.max(0, 100 - (availableCount / competitors.length * 80) - avgQuality * 0.2);

      return {
        feature,
        description: `Feature gap analysis for ${feature}`,
        opportunity
      };
    }).filter(gap => gap.opportunity > 25); // Only significant opportunities

    return {
      features,
      competitors: competitorFeatures,
      gaps
    };
  }

  private async createPricingLandscape(competitors: CompetitorProfile[]): Promise<PricingLandscapeData> {
    // Extract all pricing tiers
    const allTiers = competitors.flatMap(competitor => 
      competitor.pricing.tiers.map(tier => ({
        ...tier,
        competitorName: competitor.name
      }))
    );

    // Analyze price ranges by segments
    const priceRanges = this.analyzePriceSegments(allTiers);

    // Analyze pricing models
    const modelMap = new Map<string, string[]>();
    competitors.forEach(competitor => {
      const model = competitor.pricing.model;
      if (!modelMap.has(model)) {
        modelMap.set(model, []);
      }
      modelMap.get(model)!.push(competitor.name);
    });

    const pricingModels = Array.from(modelMap.entries()).map(([model, competitorNames]) => ({
      model,
      competitors: competitorNames,
      marketShare: (competitorNames.length / competitors.length) * 100
    }));

    // Identify pricing opportunities
    const priceOpportunities = this.identifyPricingOpportunities(priceRanges, allTiers);

    return {
      priceRanges,
      pricingModels,
      priceOpportunities
    };
  }

  private calculatePricePositionScore(competitor: CompetitorProfile): number {
    const positioning = competitor.positioning.pricePositioning;
    const scoreMap = {
      'budget': 25,
      'freemium': 35,
      'mid-market': 65,
      'premium': 85
    };
    return scoreMap[positioning] || 50;
  }

  private identifyOpportunityAreas(
    positionedCompetitors: CompetitorMatrixData['competitors'],
    businessIdea: { title: string; description: string; targetMarket?: string }
  ): CompetitorMatrixData['opportunityAreas'] {
    const opportunities: CompetitorMatrixData['opportunityAreas'] = [];

    // Look for areas with low competitor density
    const gridSize = 20;
    for (let x = 0; x < 100; x += gridSize) {
      for (let y = 0; y < 100; y += gridSize) {
        const nearbyCompetitors = positionedCompetitors.filter(comp => 
          Math.abs(comp.x - (x + gridSize/2)) < gridSize && 
          Math.abs(comp.y - (y + gridSize/2)) < gridSize
        );

        if (nearbyCompetitors.length === 0) {
          opportunities.push({
            x: x + gridSize/2,
            y: y + gridSize/2,
            radius: gridSize/2,
            description: `Opportunity area: ${this.describeOpportunityArea(x + gridSize/2, y + gridSize/2)}`
          });
        }
      }
    }

    // Limit to most promising opportunities
    return opportunities.slice(0, 3);
  }

  private describeOpportunityArea(x: number, y: number): string {
    if (x < 50 && y > 70) return 'High-feature, budget-friendly solution';
    if (x > 70 && y < 50) return 'Premium, focused solution';
    if (x > 70 && y > 70) return 'Premium, comprehensive solution';
    if (x < 50 && y < 50) return 'Basic, affordable solution';
    return 'Balanced market position';
  }

  private estimateSegmentGrowth(segmentName: string): number {
    // Simple heuristic for segment growth estimation
    const growthMap: { [key: string]: number } = {
      'enterprise': 15,
      'startup': 25,
      'smb': 20,
      'consumer': 10,
      'niche': 30,
      'mainstream': 12
    };

    return growthMap[segmentName.toLowerCase()] || 15;
  }

  private identifySegmentConnections(
    segments: MarketMapData['segments'],
    competitors: CompetitorProfile[]
  ): MarketMapData['connections'] {
    const connections: MarketMapData['connections'] = [];

    // Look for competitors that could serve multiple segments
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const segment1 = segments[i];
        const segment2 = segments[j];
        
        // Check if segments have similar competitors or could be substitutes
        const commonCompetitors = segment1.competitors.filter(c => 
          segment2.competitors.includes(c)
        );

        if (commonCompetitors.length > 0) {
          connections.push({
            from: segment1.name,
            to: segment2.name,
            strength: (commonCompetitors.length / Math.min(segment1.competitors.length, segment2.competitors.length)) * 100,
            type: 'substitution'
          });
        }
      }
    }

    return connections;
  }

  private analyzePriceSegments(tiers: any[]): PricingLandscapeData['priceRanges'] {
    if (tiers.length === 0) return [];

    // Group tiers by price ranges
    const segments = {
      'Free': tiers.filter(t => t.price === 0),
      'Budget ($1-30)': tiers.filter(t => t.price > 0 && t.price <= 30),
      'Mid-market ($31-100)': tiers.filter(t => t.price > 30 && t.price <= 100),
      'Premium ($100+)': tiers.filter(t => t.price > 100)
    };

    return Object.entries(segments)
      .filter(([_, segmentTiers]) => segmentTiers.length > 0)
      .map(([segment, segmentTiers]) => {
        const prices = segmentTiers.map(t => t.price);
        const competitors = [...new Set(segmentTiers.map(t => t.competitorName))];

        return {
          segment,
          min: Math.min(...prices),
          max: Math.max(...prices),
          median: this.calculateMedian(prices),
          competitors
        };
      });
  }

  private identifyPricingOpportunities(
    priceRanges: PricingLandscapeData['priceRanges'],
    allTiers: any[]
  ): PricingLandscapeData['priceOpportunities'] {
    const opportunities: PricingLandscapeData['priceOpportunities'] = [];

    // Look for gaps between price segments
    for (let i = 0; i < priceRanges.length - 1; i++) {
      const current = priceRanges[i];
      const next = priceRanges[i + 1];
      
      if (next.min / current.max > 1.5) { // Significant gap
        const gapPrice = Math.round((current.max + next.min) / 2);
        opportunities.push({
          description: `Pricing gap between ${current.segment} and ${next.segment}`,
          pricePoint: gapPrice,
          rationale: `Limited competition in $${current.max}-$${next.min} range`
        });
      }
    }

    // Look for overcrowded segments that might benefit from differentiation
    const overcrowdedSegments = priceRanges.filter(segment => segment.competitors.length > 3);
    overcrowdedSegments.forEach(segment => {
      opportunities.push({
        description: `Differentiation opportunity in ${segment.segment}`,
        pricePoint: segment.median,
        rationale: `${segment.competitors.length} competitors in this range - opportunity for unique positioning`
      });
    });

    return opportunities.slice(0, 4); // Limit to top opportunities
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = numbers.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateVisualizationConfidence(
    competitors: CompetitorProfile[], 
    featureMatrix: FeatureComparisonMatrix
  ): number {
    let confidence = 70; // Base confidence

    // More competitors = better visualization
    if (competitors.length >= 5) confidence += 15;
    else if (competitors.length >= 3) confidence += 10;
    else if (competitors.length < 2) confidence -= 20;

    // More features = better comparison
    if (featureMatrix.features.length >= 8) confidence += 10;
    else if (featureMatrix.features.length >= 4) confidence += 5;

    // Quality of competitor data
    const avgCompetitorConfidence = competitors.reduce((sum, c) => sum + c.confidence, 0) / competitors.length;
    confidence += (avgCompetitorConfidence - 70) * 0.2;

    return Math.max(30, Math.min(100, confidence));
  }

  private generateVisualizationDataSources(): DataSource[] {
    return [
      {
        name: 'Competitive Positioning Analysis',
        type: 'industry-report',
        credibility: 85,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['market positioning', 'feature analysis', 'pricing comparison']
      },
      {
        name: 'Market Segmentation Research',
        type: 'company-website',
        credibility: 80,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['segment definitions', 'competitor mapping', 'opportunity identification']
      }
    ];
  }
}