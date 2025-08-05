/**
 * Competitor Discovery Engine
 * Identifies direct and indirect competitors using multiple discovery methods
 */

import { CompetitorProfile, DataSource, CompetitiveAnalysisRequest } from '../schemas/competitive-analysis-types.js';

export interface CompetitorDiscoveryResult {
  competitors: CompetitorProfile[];
  discoveryMetrics: {
    totalFound: number;
    directCompetitors: number;
    indirectCompetitors: number;
    confidence: number; // 0-100
    searchMethods: string[];
  };
  dataSources: DataSource[];
}

export class CompetitorDiscoveryEngine {
  private readonly maxRetries = 3;
  private readonly timeoutMs = 2000;

  async discoverCompetitors(request: CompetitiveAnalysisRequest): Promise<CompetitorDiscoveryResult> {
    const startTime = Date.now();
    console.log(`[CompetitorDiscoveryEngine] Starting competitor discovery for: ${request.businessIdea.title}`);

    try {
      // Parallel discovery using multiple methods
      const [
        directCompetitors,
        indirectCompetitors,
        categoryCompetitors
      ] = await Promise.all([
        this.findDirectCompetitors(request),
        this.findIndirectCompetitors(request),
        this.findCategoryCompetitors(request)
      ]);

      // Merge and deduplicate competitors
      const allCompetitors = this.mergeAndDeduplicateCompetitors([
        ...directCompetitors.competitors,
        ...indirectCompetitors.competitors,
        ...categoryCompetitors.competitors
      ]);

      // Apply limits if specified
      const limitedCompetitors = request.maxCompetitors 
        ? this.prioritizeCompetitors(allCompetitors, request.maxCompetitors)
        : allCompetitors;

      // Calculate discovery metrics
      const discoveryMetrics = {
        totalFound: limitedCompetitors.length,
        directCompetitors: limitedCompetitors.filter(c => c.category === 'direct').length,
        indirectCompetitors: limitedCompetitors.filter(c => c.category === 'indirect').length,
        confidence: this.calculateDiscoveryConfidence(limitedCompetitors),
        searchMethods: ['keyword-search', 'category-analysis', 'feature-matching']
      };

      // Combine data sources
      const dataSources = [
        ...directCompetitors.dataSources,
        ...indirectCompetitors.dataSources,
        ...categoryCompetitors.dataSources
      ];

      console.log(`[CompetitorDiscoveryEngine] Discovered ${limitedCompetitors.length} competitors in ${Date.now() - startTime}ms`);

      return {
        competitors: limitedCompetitors,
        discoveryMetrics,
        dataSources: this.deduplicateDataSources(dataSources)
      };

    } catch (error) {
      console.error('[CompetitorDiscoveryEngine] Discovery failed:', error);
      throw new Error(`Competitor discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async findDirectCompetitors(request: CompetitiveAnalysisRequest): Promise<{ competitors: CompetitorProfile[], dataSources: DataSource[] }> {
    // Simulate direct competitor discovery using keyword matching
    const keywords = this.extractKeywords(request.businessIdea.title, request.businessIdea.description);
    
    // Mock direct competitors based on business idea analysis
    const mockCompetitors: CompetitorProfile[] = [
      {
        name: `${keywords[0]} Pro`,
        category: 'direct',
        description: `Direct competitor offering similar ${keywords[0]} solutions`,
        features: [
          {
            name: 'Core Feature',
            description: 'Primary functionality',
            category: 'core',
            availability: 'available',
            quality: 85,
            uniqueness: 60
          }
        ],
        positioning: {
          targetMarket: request.businessIdea.targetMarket || 'General market',
          valueProposition: 'Similar value proposition',
          brandMessaging: ['Quality', 'Reliability'],
          differentiators: ['Established brand', 'Market presence'],
          marketSegment: 'mainstream',
          pricePositioning: 'mid-market'
        },
        pricing: {
          model: 'subscription',
          tiers: [
            {
              name: 'Basic',
              price: 29,
              billing: 'monthly',
              features: ['Basic features'],
              targetCustomer: 'Small businesses'
            }
          ],
          currency: 'USD',
          lastUpdated: new Date(),
          source: 'company-website',
          confidence: 75
        },
        strengths: ['Market presence', 'Brand recognition'],
        weaknesses: ['Limited innovation', 'Higher pricing'],
        threatLevel: 'high',
        confidence: 80,
        lastUpdated: new Date()
      },
      {
        name: `${keywords[1] || 'Alternative'} Solutions`,
        category: 'direct',
        description: `Another direct competitor in the ${keywords[0]} space`,
        features: [
          {
            name: 'Advanced Feature',
            description: 'Enhanced functionality',
            category: 'advanced',
            availability: 'available',
            quality: 78,
            uniqueness: 70
          }
        ],
        positioning: {
          targetMarket: 'Enterprise customers',
          valueProposition: 'Enterprise-focused solution',
          brandMessaging: ['Scale', 'Security'],
          differentiators: ['Enterprise features', 'Security focus'],
          marketSegment: 'enterprise',
          pricePositioning: 'premium'
        },
        pricing: {
          model: 'subscription',
          tiers: [
            {
              name: 'Enterprise',
              price: 99,
              billing: 'monthly',
              features: ['All features', 'Priority support'],
              targetCustomer: 'Large enterprises'
            }
          ],
          currency: 'USD',
          lastUpdated: new Date(),
          source: 'industry-report',
          confidence: 70
        },
        strengths: ['Enterprise features', 'Security'],
        weaknesses: ['Complex setup', 'High price point'],
        threatLevel: 'medium',
        confidence: 75,
        lastUpdated: new Date()
      }
    ];

    const dataSources: DataSource[] = [
      {
        name: 'Industry Search Results',
        type: 'search-engine',
        credibility: 75,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['competitor names', 'basic features', 'market positioning']
      }
    ];

    return { competitors: mockCompetitors, dataSources };
  }

  private async findIndirectCompetitors(request: CompetitiveAnalysisRequest): Promise<{ competitors: CompetitorProfile[], dataSources: DataSource[] }> {
    // Simulate indirect competitor discovery
    const keywords = this.extractKeywords(request.businessIdea.title, request.businessIdea.description);
    
    const mockCompetitors: CompetitorProfile[] = [
      {
        name: `${keywords[0]} Alternative`,
        category: 'indirect',
        description: `Indirect competitor providing alternative approach to ${keywords[0]}`,
        features: [
          {
            name: 'Alternative Approach',
            description: 'Different methodology for similar outcome',
            category: 'alternative',
            availability: 'available',
            quality: 70,
            uniqueness: 85
          }
        ],
        positioning: {
          targetMarket: 'Creative professionals',
          valueProposition: 'Creative and flexible approach',
          brandMessaging: ['Innovation', 'Creativity'],
          differentiators: ['Unique approach', 'Creative focus'],
          marketSegment: 'niche',
          pricePositioning: 'mid-market'
        },
        pricing: {
          model: 'freemium',
          tiers: [
            {
              name: 'Free',
              price: 0,
              billing: 'monthly',
              features: ['Basic features'],
              targetCustomer: 'Individual users'
            },
            {
              name: 'Pro',
              price: 19,
              billing: 'monthly',
              features: ['All features', 'Premium support'],
              targetCustomer: 'Professional users'
            }
          ],
          currency: 'USD',
          lastUpdated: new Date(),
          source: 'company-website',
          confidence: 65
        },
        strengths: ['Innovative approach', 'User-friendly'],
        weaknesses: ['Smaller market share', 'Limited enterprise features'],
        threatLevel: 'medium',
        confidence: 65,
        lastUpdated: new Date()
      }
    ];

    const dataSources: DataSource[] = [
      {
        name: 'Alternative Solutions Database',
        type: 'industry-report',
        credibility: 80,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['alternative solutions', 'market approaches', 'pricing models']
      }
    ];

    return { competitors: mockCompetitors, dataSources };
  }

  private async findCategoryCompetitors(request: CompetitiveAnalysisRequest): Promise<{ competitors: CompetitorProfile[], dataSources: DataSource[] }> {
    // Simulate category-based competitor discovery
    const category = request.businessIdea.category || 'general';
    
    const mockCompetitors: CompetitorProfile[] = [
      {
        name: `Category Leader ${category}`,
        category: 'indirect',
        description: `Market leader in the ${category} category`,
        features: [
          {
            name: 'Market Leading Feature',
            description: 'Industry standard functionality',
            category: 'standard',
            availability: 'available',
            quality: 90,
            uniqueness: 50
          }
        ],
        positioning: {
          targetMarket: 'Broad market',
          valueProposition: 'Market leading solution',
          brandMessaging: ['Leadership', 'Reliability', 'Scale'],
          differentiators: ['Market leader', 'Proven track record'],
          marketSegment: 'mainstream',
          pricePositioning: 'premium'
        },
        pricing: {
          model: 'subscription',
          tiers: [
            {
              name: 'Professional',
              price: 79,
              billing: 'monthly',
              features: ['Professional features', 'Analytics'],
              targetCustomer: 'Professional users'
            }
          ],
          currency: 'USD',
          lastUpdated: new Date(),
          source: 'industry-report',
          confidence: 85
        },
        marketShare: 25,
        strengths: ['Market leadership', 'Brand recognition', 'Feature completeness'],
        weaknesses: ['High pricing', 'Slow innovation'],
        threatLevel: 'high',
        confidence: 85,
        lastUpdated: new Date()
      }
    ];

    const dataSources: DataSource[] = [
      {
        name: 'Category Analysis Report',
        type: 'industry-report',
        credibility: 90,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['market leaders', 'category definitions', 'market share data']
      }
    ];

    return { competitors: mockCompetitors, dataSources };
  }

  private extractKeywords(title: string, description: string): string[] {
    // Simple keyword extraction for mock data generation
    const text = `${title} ${description}`.toLowerCase();
    const words = text.split(/\s+/).filter(word => word.length > 3);
    return words.slice(0, 5); // Return top 5 keywords
  }

  private mergeAndDeduplicateCompetitors(competitors: CompetitorProfile[]): CompetitorProfile[] {
    const seen = new Set<string>();
    const unique: CompetitorProfile[] = [];

    for (const competitor of competitors) {
      const key = competitor.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(competitor);
      }
    }

    return unique;
  }

  private prioritizeCompetitors(competitors: CompetitorProfile[], limit: number): CompetitorProfile[] {
    // Sort by relevance: direct competitors first, then by confidence and threat level
    return competitors
      .sort((a, b) => {
        // Direct competitors first
        if (a.category === 'direct' && b.category === 'indirect') return -1;
        if (a.category === 'indirect' && b.category === 'direct') return 1;
        
        // Then by threat level (high first)
        const threatOrder = { high: 3, medium: 2, low: 1 };
        const threatDiff = threatOrder[b.threatLevel] - threatOrder[a.threatLevel];
        if (threatDiff !== 0) return threatDiff;
        
        // Finally by confidence
        return b.confidence - a.confidence;
      })
      .slice(0, limit);
  }

  private calculateDiscoveryConfidence(competitors: CompetitorProfile[]): number {
    if (competitors.length === 0) return 0;

    const avgConfidence = competitors.reduce((sum, c) => sum + c.confidence, 0) / competitors.length;
    const directCount = competitors.filter(c => c.category === 'direct').length;
    
    // Boost confidence if we have direct competitors
    const directBonus = Math.min(directCount * 5, 20);
    
    // Reduce confidence if we have very few competitors
    const quantityPenalty = competitors.length < 3 ? 10 : 0;
    
    return Math.max(0, Math.min(100, avgConfidence + directBonus - quantityPenalty));
  }

  private deduplicateDataSources(sources: DataSource[]): DataSource[] {
    const seen = new Set<string>();
    const unique: DataSource[] = [];

    for (const source of sources) {
      const key = `${source.name}-${source.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(source);
      }
    }

    return unique;
  }
}