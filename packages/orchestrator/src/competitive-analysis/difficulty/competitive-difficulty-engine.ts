/**
 * Competitive Difficulty Engine
 * Analyzes market difficulty and barriers to entry for new business ideas
 */

import { 
  CompetitorProfile, 
  CompetitiveDifficulty,
  BarrierToEntry,
  DataSource 
} from '../schemas/competitive-analysis-types.js';

export interface CompetitiveDifficultyResult {
  difficultyScore: CompetitiveDifficulty;
  barriers: BarrierToEntry;
  difficultyMetrics: {
    competitorsAnalyzed: number;
    barriersAssessed: number;
    confidenceLevel: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high';
  };
  dataSources: DataSource[];
}

export class CompetitiveDifficultyEngine {
  private readonly analysisTimeout = 2000;
  private readonly difficultyWeights = {
    marketSaturation: 0.25,
    competitorStrength: 0.20,
    barrierHeight: 0.20,
    priceCompetition: 0.15,
    brandRecognition: 0.10,
    resourceRequirements: 0.10
  };

  async analyzeDifficulty(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<CompetitiveDifficultyResult> {
    const startTime = Date.now();
    console.log(`[CompetitiveDifficultyEngine] Analyzing market difficulty for ${competitors.length} competitors`);

    try {
      // Analyze barriers to entry
      const barriers = await this.analyzeBarriersToEntry(competitors, businessIdea);

      // Calculate competitive difficulty components
      const components = await this.calculateDifficultyComponents(competitors, barriers, businessIdea);

      // Calculate overall difficulty score
      const overall = this.calculateOverallDifficulty(components);

      // Generate explanation and strategies
      const { explanation, riskFactors, mitigationStrategies } = this.generateDifficultyAnalysis(
        overall, 
        components, 
        barriers, 
        businessIdea
      );

      const difficultyScore: CompetitiveDifficulty = {
        overall,
        components,
        explanation,
        riskFactors,
        mitigationStrategies
      };

      const difficultyMetrics = {
        competitorsAnalyzed: competitors.length,
        barriersAssessed: 6, // Number of barrier types we assess
        confidenceLevel: this.calculateDifficultyConfidence(competitors, barriers),
        riskLevel: this.categorizeRiskLevel(overall)
      };

      const dataSources = this.generateDifficultyDataSources();

      console.log(`[CompetitiveDifficultyEngine] Difficulty analysis completed in ${Date.now() - startTime}ms`);

      return {
        difficultyScore,
        barriers,
        difficultyMetrics,
        dataSources
      };

    } catch (error) {
      console.error('[CompetitiveDifficultyEngine] Difficulty analysis failed:', error);
      throw new Error(`Difficulty analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeBarriersToEntry(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): Promise<BarrierToEntry> {
    // Analyze financial barriers
    const financial = this.analyzeFinancialBarriers(competitors, businessIdea);
    
    // Analyze regulatory barriers
    const regulatory = this.analyzeRegulatoryBarriers(businessIdea);
    
    // Analyze technological barriers
    const technological = this.analyzeTechnologicalBarriers(competitors, businessIdea);
    
    // Analyze brand barriers
    const brand = this.analyzeBrandBarriers(competitors);
    
    // Analyze distribution barriers
    const distribution = this.analyzeDistributionBarriers(competitors, businessIdea);
    
    // Analyze network effect barriers
    const network = this.analyzeNetworkBarriers(competitors, businessIdea);

    // Calculate overall barrier level
    const averageScore = (financial.score + regulatory.score + technological.score + 
                         brand.score + distribution.score + network.score) / 6;
    
    const overall: BarrierToEntry['overall'] = averageScore > 70 ? 'high' : 
                                              averageScore > 40 ? 'medium' : 'low';

    return {
      overall,
      financial,
      regulatory,
      technological,
      brand,
      distribution,
      network
    };
  }

  private analyzeFinancialBarriers(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): BarrierToEntry['financial'] {
    let score = 30; // Base financial barrier score
    let description = 'Moderate financial requirements for market entry';
    let requiredCapital: number | undefined;

    // Analyze competitor pricing to estimate capital requirements
    const avgPrice = this.calculateAverageMarketPrice(competitors);
    
    if (avgPrice > 100) {
      score += 25;
      description = 'High customer acquisition costs due to premium market positioning';
      requiredCapital = 500000; // Estimate for premium market
    } else if (avgPrice === 0) {
      score += 30;
      description = 'Freemium model requires significant upfront investment and user acquisition';
      requiredCapital = 250000; // Estimate for freemium model
    }

    // Industry-specific adjustments
    const ideaText = businessIdea.description.toLowerCase();
    if (ideaText.includes('enterprise') || ideaText.includes('b2b')) {
      score += 20;
      description += '. Enterprise sales require substantial investment in sales teams and long sales cycles';
      requiredCapital = (requiredCapital || 300000) * 1.5;
    }

    if (ideaText.includes('hardware') || ideaText.includes('manufacturing')) {
      score += 35;
      description += '. Hardware development requires significant R&D and manufacturing investment';
      requiredCapital = (requiredCapital || 300000) * 3;
    }

    // Market competition impact
    const highThreatCompetitors = competitors.filter(c => c.threatLevel === 'high').length;
    if (highThreatCompetitors > 2) {
      score += 15;
      description += '. Strong existing competitors require higher marketing spend to gain market share';
    }

    return {
      score: Math.min(100, score),
      description,
      requiredCapital
    };
  }

  private analyzeRegulatoryBarriers(
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): BarrierToEntry['regulatory'] {
    let score = 20; // Base regulatory barrier score
    const requirements: string[] = [];
    let description = 'Standard business registration and compliance requirements';

    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase();

    // Industry-specific regulatory analysis
    if (ideaText.includes('fintech') || ideaText.includes('financial') || ideaText.includes('payment')) {
      score += 40;
      requirements.push('Financial services licensing', 'Anti-money laundering compliance', 'Data protection compliance');
      description = 'High regulatory barriers due to financial services regulations';
    }

    if (ideaText.includes('healthcare') || ideaText.includes('medical')) {
      score += 45;
      requirements.push('HIPAA compliance', 'FDA approval', 'Medical device certification');
      description = 'Very high regulatory barriers in healthcare sector';
    }

    if (ideaText.includes('education') || ideaText.includes('children')) {
      score += 25;
      requirements.push('COPPA compliance', 'Educational standards compliance', 'Child safety regulations');
      description = 'Moderate to high regulatory requirements for educational services';
    }

    if (ideaText.includes('data') || ideaText.includes('privacy') || ideaText.includes('ai')) {
      score += 20;
      requirements.push('GDPR compliance', 'Data privacy regulations', 'AI governance requirements');
      description += '. Data handling and AI regulations add compliance complexity';
    }

    if (ideaText.includes('crypto') || ideaText.includes('blockchain')) {
      score += 35;
      requirements.push('Cryptocurrency regulations', 'Securities compliance', 'Banking regulations');
      description = 'High regulatory uncertainty and compliance requirements for blockchain/crypto';
    }

    // Geographic considerations
    if (businessIdea.targetMarket?.toLowerCase().includes('international')) {
      score += 15;
      requirements.push('International compliance', 'Cross-border regulations');
      description += '. International operations require multi-jurisdictional compliance';
    }

    return {
      score: Math.min(100, score),
      description,
      requirements: requirements.length > 0 ? requirements : ['Standard business registration', 'Tax compliance', 'General data protection']
    };
  }

  private analyzeTechnologicalBarriers(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): BarrierToEntry['technological'] {
    let score = 25; // Base technological barrier score
    const complexityFactors: string[] = [];
    let description = 'Moderate technological requirements for implementation';

    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase();

    // Analyze competitor technology sophistication
    const avgFeatureComplexity = this.calculateAvgFeatureComplexity(competitors);
    if (avgFeatureComplexity > 80) {
      score += 25;
      complexityFactors.push('High-complexity feature requirements');
      description = 'High technological barriers due to sophisticated competitor features';
    }

    // Technology-specific analysis
    if (ideaText.includes('ai') || ideaText.includes('machine learning')) {
      score += 30;
      complexityFactors.push('AI/ML expertise required', 'Large datasets needed', 'Computational infrastructure');
      description = 'High technological barriers requiring AI/ML expertise and infrastructure';
    }

    if (ideaText.includes('blockchain') || ideaText.includes('crypto')) {
      score += 35;
      complexityFactors.push('Blockchain development expertise', 'Security protocols', 'Distributed systems knowledge');
      description = 'Very high technological barriers for blockchain implementation';
    }

    if (ideaText.includes('platform') || ideaText.includes('marketplace')) {
      score += 20;
      complexityFactors.push('Scalable architecture', 'Multi-sided platform complexity', 'Network effects engineering');
      description += '. Platform development requires sophisticated technical architecture';
    }

    if (ideaText.includes('mobile') || ideaText.includes('app')) {
      score += 10;
      complexityFactors.push('Cross-platform development', 'App store compliance', 'Mobile optimization');
    }

    if (ideaText.includes('enterprise') || ideaText.includes('b2b')) {
      score += 15;
      complexityFactors.push('Enterprise integration', 'Security requirements', 'Scalability needs');
      description += '. Enterprise solutions require robust integration and security capabilities';
    }

    // Real-time or high-performance requirements
    if (ideaText.includes('real-time') || ideaText.includes('trading') || ideaText.includes('gaming')) {
      score += 20;
      complexityFactors.push('Low-latency architecture', 'High-performance computing', 'Real-time data processing');
    }

    return {
      score: Math.min(100, score),
      description,
      complexityFactors: complexityFactors.length > 0 ? complexityFactors : ['Standard web development', 'Database management', 'Basic security implementation']
    };
  }

  private analyzeBrandBarriers(competitors: CompetitorProfile[]): BarrierToEntry['brand'] {
    let score = 30; // Base brand barrier score
    const establishedBrands: string[] = [];
    let description = 'Moderate brand recognition challenges';

    // Analyze competitor brand strength
    const strongBrandCompetitors = competitors.filter(c => 
      c.marketShare && c.marketShare > 15 || c.threatLevel === 'high'
    );

    if (strongBrandCompetitors.length > 0) {
      score += strongBrandCompetitors.length * 15;
      establishedBrands.push(...strongBrandCompetitors.map(c => c.name));
      description = `High brand barriers due to ${strongBrandCompetitors.length} established market leaders`;
    }

    // Market concentration analysis
    const totalMarketShare = competitors.reduce((sum, c) => sum + (c.marketShare || 0), 0);
    if (totalMarketShare > 80) {
      score += 20;
      description += '. Market dominated by established players with strong brand recognition';
    }

    // Network effects and community
    const networkEffectCompetitors = competitors.filter(c => 
      c.features.some(f => f.name.toLowerCase().includes('community') || 
                          f.name.toLowerCase().includes('network') ||
                          f.name.toLowerCase().includes('social'))
    );

    if (networkEffectCompetitors.length > 0) {
      score += 15;
      description += '. Network effects create additional brand loyalty barriers';
    }

    return {
      score: Math.min(100, score),
      description,
      establishedBrands: establishedBrands.length > 0 ? establishedBrands : ['Market incumbents with established presence']
    };
  }

  private analyzeDistributionBarriers(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): BarrierToEntry['distribution'] {
    let score = 25; // Base distribution barrier score
    const channels: string[] = [];
    let description = 'Standard distribution channel requirements';

    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase();

    // B2B vs B2C distribution complexity
    if (ideaText.includes('enterprise') || ideaText.includes('b2b')) {
      score += 25;
      channels.push('Direct sales', 'Partner channels', 'Enterprise procurement');
      description = 'High distribution barriers requiring enterprise sales infrastructure';
    } else {
      channels.push('Digital marketing', 'App stores', 'Web-based distribution');
    }

    // Industry-specific distribution analysis
    if (ideaText.includes('mobile') || ideaText.includes('app')) {
      score += 15;
      channels.push('App Store', 'Google Play', 'Mobile marketing');
      description += '. App store dependencies and mobile user acquisition challenges';
    }

    if (ideaText.includes('marketplace') || ideaText.includes('platform')) {
      score += 20;
      channels.push('Multi-sided customer acquisition', 'Network growth strategies');
      description += '. Marketplace requires simultaneous multi-sided customer acquisition';
    }

    // Geographic distribution complexity
    if (businessIdea.targetMarket?.toLowerCase().includes('international')) {
      score += 15;
      channels.push('International distribution', 'Localization', 'Regional partnerships');
      description += '. International distribution requires localized channel strategies';
    }

    // Analyze competitor distribution strength
    const establishedCompetitors = competitors.filter(c => c.marketShare && c.marketShare > 10);
    if (establishedCompetitors.length > 2) {
      score += 10;
      description += '. Established competitors have strong distribution advantages';
    }

    return {
      score: Math.min(100, score),
      description,
      channels: channels.length > 0 ? channels : ['Online marketing', 'Direct sales', 'Digital channels']
    };
  }

  private analyzeNetworkBarriers(
    competitors: CompetitorProfile[],
    businessIdea: { title: string; description: string; targetMarket?: string; category?: string }
  ): BarrierToEntry['network'] {
    let score = 20; // Base network barrier score
    const networkEffects: string[] = [];
    let description = 'Limited network effect barriers';

    const ideaText = `${businessIdea.title} ${businessIdea.description}`.toLowerCase();

    // Network effect analysis
    if (ideaText.includes('social') || ideaText.includes('community')) {
      score += 35;
      networkEffects.push('Social network effects', 'Community value', 'User-generated content');
      description = 'Very high network barriers due to social/community dynamics';
    }

    if (ideaText.includes('marketplace') || ideaText.includes('platform')) {
      score += 30;
      networkEffects.push('Two-sided network effects', 'Platform value creation', 'Marketplace liquidity');
      description = 'High network barriers from multi-sided platform effects';
    }

    if (ideaText.includes('data') || ideaText.includes('ai')) {
      score += 25;
      networkEffects.push('Data network effects', 'Learning algorithms', 'Model improvement from usage');
      description = 'High network barriers from data-driven improvement cycles';
    }

    if (ideaText.includes('communication') || ideaText.includes('messaging')) {
      score += 30;
      networkEffects.push('Communication network effects', 'User adoption momentum', 'Critical mass requirements');
      description = 'High network barriers requiring critical mass for communication utility';
    }

    // Analyze competitor network strength
    const networkCompetitors = competitors.filter(c => 
      c.features.some(f => 
        f.name.toLowerCase().includes('network') ||
        f.name.toLowerCase().includes('community') ||
        f.name.toLowerCase().includes('social') ||
        f.name.toLowerCase().includes('platform')
      )
    );

    if (networkCompetitors.length > 0) {
      score += 15;
      description += '. Existing competitors have established network advantages';
    }

    return {
      score: Math.min(100, score),
      description,
      networkEffects: networkEffects.length > 0 ? networkEffects : ['Standard customer retention', 'Basic user engagement']
    };
  }

  private async calculateDifficultyComponents(
    competitors: CompetitorProfile[],
    barriers: BarrierToEntry,
    businessIdea: { title: string; description: string; targetMarket?: string }
  ): Promise<CompetitiveDifficulty['components']> {
    // Market saturation analysis
    const marketSaturation = this.calculateMarketSaturation(competitors);
    
    // Competitor strength analysis
    const competitorStrength = this.calculateCompetitorStrength(competitors);
    
    // Barrier height (average of all barriers)
    const barrierHeight = (barriers.financial.score + barriers.regulatory.score + 
                          barriers.technological.score + barriers.brand.score + 
                          barriers.distribution.score + barriers.network.score) / 6;
    
    // Price competition intensity
    const priceCompetition = this.calculatePriceCompetition(competitors);
    
    // Brand recognition requirements
    const brandRecognition = barriers.brand.score;
    
    // Resource requirements (combination of financial and technological barriers)
    const resourceRequirements = (barriers.financial.score + barriers.technological.score) / 2;

    return {
      marketSaturation,
      competitorStrength,
      barrierHeight,
      priceCompetition,
      brandRecognition,
      resourceRequirements
    };
  }

  private calculateOverallDifficulty(components: CompetitiveDifficulty['components']): number {
    const weighted = 
      components.marketSaturation * this.difficultyWeights.marketSaturation +
      components.competitorStrength * this.difficultyWeights.competitorStrength +
      components.barrierHeight * this.difficultyWeights.barrierHeight +
      components.priceCompetition * this.difficultyWeights.priceCompetition +
      components.brandRecognition * this.difficultyWeights.brandRecognition +
      components.resourceRequirements * this.difficultyWeights.resourceRequirements;

    return Math.round(weighted);
  }

  private generateDifficultyAnalysis(
    overall: number, 
    components: CompetitiveDifficulty['components'],
    barriers: BarrierToEntry,
    businessIdea: { title: string; description: string; targetMarket?: string }
  ): { explanation: string; riskFactors: string[]; mitigationStrategies: string[] } {
    
    let explanation = '';
    const riskFactors: string[] = [];
    const mitigationStrategies: string[] = [];

    // Generate explanation based on overall difficulty
    if (overall >= 75) {
      explanation = 'Very high competitive difficulty. Market entry will be extremely challenging due to strong competitors, high barriers, and saturated conditions.';
      riskFactors.push('Extremely well-funded competitors', 'High customer acquisition costs', 'Regulatory challenges');
      mitigationStrategies.push('Focus on specific niche initially', 'Build strategic partnerships', 'Differentiate through innovation');
    } else if (overall >= 50) {
      explanation = 'High competitive difficulty. Success will require significant resources, strong differentiation, and strategic execution.';
      riskFactors.push('Strong incumbent competitors', 'Capital requirements', 'Market saturation');
      mitigationStrategies.push('Target underserved segments', 'Build unique value proposition', 'Leverage partnerships');
    } else if (overall >= 25) {
      explanation = 'Moderate competitive difficulty. Market entry is feasible with proper planning and execution, though challenges exist.';
      riskFactors.push('Competitive response', 'Resource requirements', 'Market education needs');
      mitigationStrategies.push('Focus on differentiation', 'Build customer relationships', 'Iterate based on feedback');
    } else {
      explanation = 'Low competitive difficulty. Market conditions are favorable for new entrants with lower barriers to entry.';
      riskFactors.push('Market validation', 'Scaling challenges', 'Future competition');
      mitigationStrategies.push('Move quickly to establish position', 'Build defensible moats', 'Focus on customer satisfaction');
    }

    // Add component-specific risk factors and strategies
    if (components.marketSaturation > 70) {
      riskFactors.push('Highly saturated market with limited growth opportunities');
      mitigationStrategies.push('Find underserved niches or create new market categories');
    }

    if (components.competitorStrength > 70) {
      riskFactors.push('Very strong competitors with established market positions');
      mitigationStrategies.push('Avoid direct competition; focus on differentiated positioning');
    }

    if (barriers.financial.score > 70) {
      riskFactors.push('High capital requirements for competitive market entry');
      mitigationStrategies.push('Seek strategic investors or consider phased market entry');
    }

    if (barriers.regulatory.score > 70) {
      riskFactors.push('Complex regulatory requirements creating compliance burden');
      mitigationStrategies.push('Build regulatory expertise early and factor compliance into timeline');
    }

    return { explanation, riskFactors, mitigationStrategies };
  }

  // Helper methods for calculations
  private calculateAverageMarketPrice(competitors: CompetitorProfile[]): number {
    const allPrices = competitors.flatMap(c => c.pricing.tiers.map(t => t.price));
    if (allPrices.length === 0) return 50; // Default if no pricing data
    return allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
  }

  private calculateAvgFeatureComplexity(competitors: CompetitorProfile[]): number {
    const allFeatures = competitors.flatMap(c => c.features);
    if (allFeatures.length === 0) return 50;
    return allFeatures.reduce((sum, f) => sum + f.quality, 0) / allFeatures.length;
  }

  private calculateMarketSaturation(competitors: CompetitorProfile[]): number {
    // Base saturation on competitor count and market share concentration
    let saturation = Math.min(competitors.length * 10, 80); // More competitors = higher saturation
    
    const totalMarketShare = competitors.reduce((sum, c) => sum + (c.marketShare || 0), 0);
    if (totalMarketShare > 80) saturation += 20; // High market share concentration
    
    return Math.min(100, saturation);
  }

  private calculateCompetitorStrength(competitors: CompetitorProfile[]): number {
    const avgThreatLevel = competitors.reduce((sum, c) => {
      const threatScore = c.threatLevel === 'high' ? 100 : c.threatLevel === 'medium' ? 60 : 30;
      return sum + threatScore;
    }, 0) / competitors.length;

    const avgMarketShare = competitors.reduce((sum, c) => sum + (c.marketShare || 5), 0) / competitors.length;
    
    return Math.min(100, (avgThreatLevel + avgMarketShare * 2) / 3);
  }

  private calculatePriceCompetition(competitors: CompetitorProfile[]): number {
    const freemiumCount = competitors.filter(c => c.pricing.model === 'freemium').length;
    const budgetCount = competitors.filter(c => c.positioning.pricePositioning === 'budget').length;
    
    let priceCompetition = 40; // Base level
    
    if (freemiumCount > 0) priceCompetition += freemiumCount * 15;
    if (budgetCount > 0) priceCompetition += budgetCount * 10;
    
    return Math.min(100, priceCompetition);
  }

  private calculateDifficultyConfidence(competitors: CompetitorProfile[], barriers: BarrierToEntry): number {
    let confidence = 70; // Base confidence
    
    // More competitors = better analysis
    if (competitors.length >= 5) confidence += 15;
    else if (competitors.length >= 3) confidence += 10;
    else if (competitors.length < 2) confidence -= 20;
    
    // Quality of competitor data
    const avgCompetitorConfidence = competitors.reduce((sum, c) => sum + c.confidence, 0) / competitors.length;
    confidence += (avgCompetitorConfidence - 70) * 0.2;
    
    return Math.max(30, Math.min(100, confidence));
  }

  private categorizeRiskLevel(difficulty: number): 'low' | 'medium' | 'high' {
    if (difficulty >= 70) return 'high';
    if (difficulty >= 40) return 'medium';
    return 'low';
  }

  private generateDifficultyDataSources(): DataSource[] {
    return [
      {
        name: 'Market Difficulty Assessment',
        type: 'industry-report',
        credibility: 85,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['barrier analysis', 'competition assessment', 'market saturation']
      },
      {
        name: 'Competitive Intelligence Analysis',
        type: 'company-website',
        credibility: 80,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['competitor strength', 'market positioning', 'resource requirements']
      }
    ];
  }
}