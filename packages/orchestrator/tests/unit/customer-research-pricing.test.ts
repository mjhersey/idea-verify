import { describe, it, expect, beforeEach } from 'vitest';
import { WillingnessToPayEngine } from '../../src/customer-research/pricing/willingness-to-pay-engine.js';
import { CustomerResearchRequest } from '../../src/customer-research/schemas/customer-research-types.js';

describe('WillingnessToPayEngine', () => {
  let engine: WillingnessToPayEngine;
  let mockRequest: CustomerResearchRequest;

  beforeEach(() => {
    engine = new WillingnessToPayEngine();
    mockRequest = {
      businessIdea: {
        title: 'AI-Powered Fitness App',
        description: 'A fitness app that uses AI to create personalized workout plans for busy professionals',
        category: 'Health & Fitness',
        targetMarket: 'North America',
        geography: ['United States', 'Canada']
      },
      analysisDepth: 'standard',
      focusAreas: ['pricing']
    };
  });

  describe('analyzeWillingnessToPay', () => {
    it('should successfully analyze willingness to pay for health & fitness domain', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result).toBeDefined();
      expect(result.willingnessToPay).toBeDefined();
      expect(result.pricingInsights).toBeDefined();
      expect(result.valuePerception).toBeDefined();
      expect(result.pricingRecommendations).toBeDefined();
      expect(result.dataSources).toBeInstanceOf(Array);

      // Verify willingness to pay structure
      expect(result.willingnessToPay.priceRange).toBeDefined();
      expect(result.willingnessToPay.priceRange.min).toBeGreaterThan(0);
      expect(result.willingnessToPay.priceRange.max).toBeGreaterThan(result.willingnessToPay.priceRange.min);
      expect(result.willingnessToPay.priceRange.currency).toBe('USD');
      expect(result.willingnessToPay.priceRange.confidence).toBeGreaterThanOrEqual(0);
      expect(result.willingnessToPay.priceRange.confidence).toBeLessThanOrEqual(100);

      expect(['subscription', 'one-time', 'freemium', 'usage-based', 'hybrid']).toContain(result.willingnessToPay.priceModel);
      expect(result.willingnessToPay.confidence).toBeGreaterThanOrEqual(0);
      expect(result.willingnessToPay.confidence).toBeLessThanOrEqual(100);
    });

    it('should analyze business domain pricing correctly', async () => {
      const businessRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Enterprise CRM Software',
          description: 'Advanced CRM software for small to medium businesses to manage customer relationships',
          category: 'B2B Software',
          targetMarket: 'Global',
          geography: ['United States', 'Europe', 'Asia']
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['pricing']
      };

      const result = await engine.analyzeWillingnessToPay(businessRequest);

      // Business domain should have higher pricing
      expect(result.willingnessToPay.priceRange.min).toBeGreaterThan(20);
      expect(result.willingnessToPay.priceRange.max).toBeGreaterThan(100);

      // Should have business-appropriate pricing model
      expect(['subscription', 'usage-based']).toContain(result.willingnessToPay.priceModel);

      // Verify value perspective
      expect(result.willingnessToPay.valuePerspective.costOfProblem).toBeGreaterThan(1000);
      expect(result.willingnessToPay.valuePerspective.competitiveContext).toBeInstanceOf(Array);
      expect(result.willingnessToPay.valuePerspective.priceAnchors).toBeInstanceOf(Array);
    });

    it('should generate comprehensive pricing insights', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.pricingInsights.optimalPriceRange).toBeDefined();
      expect(result.pricingInsights.optimalPriceRange.min).toBeGreaterThan(0);
      expect(result.pricingInsights.optimalPriceRange.max).toBeGreaterThan(result.pricingInsights.optimalPriceRange.min);
      expect(result.pricingInsights.optimalPriceRange.confidence).toBeGreaterThanOrEqual(0);
      expect(result.pricingInsights.optimalPriceRange.confidence).toBeLessThanOrEqual(100);

      // Verify price elasticity
      expect(['high', 'medium', 'low']).toContain(result.pricingInsights.priceElasticity.elasticity);
      expect(result.pricingInsights.priceElasticity.demandCurve).toBeInstanceOf(Array);
      expect(result.pricingInsights.priceElasticity.demandCurve.length).toBeGreaterThan(0);
      expect(result.pricingInsights.priceElasticity.priceBreakpoints).toBeInstanceOf(Array);

      // Verify competitive pricing
      expect(result.pricingInsights.competitivePricing.averageMarketPrice).toBeGreaterThan(0);
      expect(result.pricingInsights.competitivePricing.pricingGaps).toBeInstanceOf(Array);
      expect(result.pricingInsights.competitivePricing.competitorPrices).toBeInstanceOf(Array);
    });

    it('should analyze value perception accurately', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.valuePerception.perceivedValueScore).toBeGreaterThanOrEqual(0);
      expect(result.valuePerception.perceivedValueScore).toBeLessThanOrEqual(100);
      
      expect(result.valuePerception.valueBenefitAnalysis).toBeInstanceOf(Array);
      expect(result.valuePerception.valueBenefitAnalysis.length).toBeGreaterThan(0);

      result.valuePerception.valueBenefitAnalysis.forEach(benefit => {
        expect(benefit.benefit).toBeTruthy();
        expect(benefit.perceivedValue).toBeGreaterThanOrEqual(0);
        expect(benefit.perceivedValue).toBeLessThanOrEqual(100);
        expect(benefit.importance).toBeGreaterThanOrEqual(0);
        expect(benefit.importance).toBeLessThanOrEqual(100);
        expect(benefit.currentSatisfaction).toBeGreaterThanOrEqual(0);
        expect(benefit.currentSatisfaction).toBeLessThanOrEqual(100);
        expect(benefit.valuePremium).toBeGreaterThanOrEqual(0);
        expect(benefit.valuePremium).toBeLessThanOrEqual(100);
      });

      expect(result.valuePerception.costJustification).toBeInstanceOf(Array);
      result.valuePerception.costJustification.forEach(justification => {
        expect(justification.costFactor).toBeTruthy();
        expect(justification.customerConcern).toBeTruthy();
        expect(justification.justification).toBeTruthy();
        expect(justification.acceptanceRate).toBeGreaterThanOrEqual(0);
        expect(justification.acceptanceRate).toBeLessThanOrEqual(100);
      });
    });

    it('should provide actionable pricing recommendations', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.pricingRecommendations.recommendedStrategy).toBeTruthy();
      expect(['subscription', 'one-time', 'freemium', 'usage-based', 'hybrid']).toContain(result.pricingRecommendations.pricingModel);
      
      expect(result.pricingRecommendations.pricingTiers).toBeInstanceOf(Array);
      expect(result.pricingRecommendations.pricingTiers.length).toBeGreaterThan(0);

      result.pricingRecommendations.pricingTiers.forEach(tier => {
        expect(tier.tier).toBeTruthy();
        expect(tier.price).toBeGreaterThan(0);
        expect(tier.features).toBeInstanceOf(Array);
        expect(tier.features.length).toBeGreaterThan(0);
        expect(tier.targetSegment).toBeTruthy();
        expect(tier.conversionProbability).toBeGreaterThanOrEqual(0);
        expect(tier.conversionProbability).toBeLessThanOrEqual(100);
      });

      // Verify rollout strategy
      expect(result.pricingRecommendations.rolloutStrategy.launchPrice).toBeGreaterThan(0);
      expect(result.pricingRecommendations.rolloutStrategy.pricingEvolution).toBeInstanceOf(Array);
      
      result.pricingRecommendations.rolloutStrategy.pricingEvolution.forEach(phase => {
        expect(phase.phase).toBeTruthy();
        expect(phase.timeframe).toBeTruthy();
        expect(phase.price).toBeGreaterThan(0);
        expect(phase.rationale).toBeTruthy();
      });
    });

    it('should handle technology domain pricing appropriately', async () => {
      const techRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Developer Analytics Tool',
          description: 'A tool for developers to analyze code performance and optimize applications',
          category: 'Developer Tools',
          targetMarket: 'Global Tech Communities'
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['pricing']
      };

      const result = await engine.analyzeWillingnessToPay(techRequest);

      // Technology domain should have moderate pricing
      expect(result.willingnessToPay.priceRange.min).toBeGreaterThan(10);
      expect(result.willingnessToPay.priceRange.max).toBeLessThan(500);

      // Should have tech-appropriate features in tiers
      const tierFeatures = result.pricingRecommendations.pricingTiers.flatMap(tier => tier.features);
      const hasTechFeatures = tierFeatures.some(feature => 
        feature.toLowerCase().includes('api') || 
        feature.toLowerCase().includes('integration') ||
        feature.toLowerCase().includes('development')
      );
      expect(hasTechFeatures).toBe(true);
    });

    it('should analyze price sensitivity correctly', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.willingnessToPay.priceSensitivity).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.willingnessToPay.priceSensitivity.elasticity);
      
      expect(result.willingnessToPay.priceSensitivity.segmentVariations).toBeInstanceOf(Array);
      expect(result.willingnessToPay.priceSensitivity.segmentVariations.length).toBe(3); // Budget, Value, Premium

      result.willingnessToPay.priceSensitivity.segmentVariations.forEach(segment => {
        expect(segment.segment).toBeTruthy();
        expect(['high', 'medium', 'low']).toContain(segment.sensitivity);
        expect(segment.willingnessToPay).toBeGreaterThan(0);
      });

      // Budget segment should have lowest willingness to pay
      const segments = result.willingnessToPay.priceSensitivity.segmentVariations;
      const budgetSegment = segments.find(s => s.segment.includes('Budget'));
      const premiumSegment = segments.find(s => s.segment.includes('Premium'));
      
      if (budgetSegment && premiumSegment) {
        expect(budgetSegment.willingnessToPay).toBeLessThan(premiumSegment.willingnessToPay);
      }
    });

    it('should assess affordability comprehensively', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.willingnessToPay.affordabilityAssessment).toBeDefined();
      expect(result.willingnessToPay.affordabilityAssessment.canAfford).toBeGreaterThanOrEqual(0);
      expect(result.willingnessToPay.affordabilityAssessment.canAfford).toBeLessThanOrEqual(100);
      
      expect(result.willingnessToPay.affordabilityAssessment.paymentPreferences).toBeInstanceOf(Array);
      expect(result.willingnessToPay.affordabilityAssessment.paymentPreferences.length).toBeGreaterThan(0);
      
      expect(result.willingnessToPay.affordabilityAssessment.budgetConstraints).toBeInstanceOf(Array);
      expect(result.willingnessToPay.affordabilityAssessment.budgetConstraints.length).toBeGreaterThan(0);
    });

    it('should generate demand curve with realistic data points', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      const demandCurve = result.pricingInsights.priceElasticity.demandCurve;
      expect(demandCurve.length).toBeGreaterThan(3);

      // Demand curve should show decreasing demand with increasing price
      for (let i = 1; i < demandCurve.length; i++) {
        expect(demandCurve[i].price).toBeGreaterThan(demandCurve[i-1].price);
        expect(demandCurve[i].demandPercentage).toBeLessThanOrEqual(demandCurve[i-1].demandPercentage);
      }

      // All demand percentages should be valid
      demandCurve.forEach(point => {
        expect(point.price).toBeGreaterThan(0);
        expect(point.demandPercentage).toBeGreaterThanOrEqual(0);
        expect(point.demandPercentage).toBeLessThanOrEqual(100);
      });
    });

    it('should provide comprehensive data sources', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.dataSources.length).toBeGreaterThan(2);
      
      result.dataSources.forEach(source => {
        expect(source.name).toBeTruthy();
        expect(source.type).toBeTruthy();
        expect(source.credibility).toBeGreaterThanOrEqual(0);
        expect(source.credibility).toBeLessThanOrEqual(100);
        expect(source.recency).toBeInstanceOf(Date);
        expect(source.accessDate).toBeInstanceOf(Date);
        expect(source.dataPoints).toBeInstanceOf(Array);
        expect(source.dataPoints.length).toBeGreaterThan(0);
      });

      // Should include different source types
      const sourceTypes = result.dataSources.map(s => s.type);
      expect(sourceTypes).toContain('industry-report');
      expect(sourceTypes).toContain('survey');
      expect(sourceTypes).toContain('demographic-data');
    });

    it('should validate pricing recommendations rationale', async () => {
      const result = await engine.analyzeWillingnessToPay(mockRequest);

      expect(result.willingnessToPay.recommendations.suggestedPrice).toBeGreaterThan(0);
      expect(result.willingnessToPay.recommendations.pricingStrategy).toBeTruthy();
      expect(result.willingnessToPay.recommendations.rationale).toBeInstanceOf(Array);
      expect(result.willingnessToPay.recommendations.rationale.length).toBeGreaterThan(0);
      expect(result.willingnessToPay.recommendations.risks).toBeInstanceOf(Array);
      expect(result.willingnessToPay.recommendations.risks.length).toBeGreaterThan(0);

      // Rationale should include market analysis
      const rationaleText = result.willingnessToPay.recommendations.rationale.join(' ');
      expect(rationaleText.toLowerCase()).toContain('market');
      expect(rationaleText.toLowerCase()).toContain('cost');
    });

    it('should handle pricing for different target markets', async () => {
      const globalRequest: CustomerResearchRequest = {
        ...mockRequest,
        businessIdea: {
          ...mockRequest.businessIdea,
          targetMarket: 'Global Enterprise'
        }
      };

      const localRequest: CustomerResearchRequest = {
        ...mockRequest,
        businessIdea: {
          ...mockRequest.businessIdea,
          targetMarket: 'Local Consumer'
        }
      };

      const [globalResult, localResult] = await Promise.all([
        engine.analyzeWillingnessToPay(globalRequest),
        engine.analyzeWillingnessToPay(localRequest)
      ]);

      // Global enterprise should generally command higher pricing
      expect(globalResult.willingnessToPay.priceRange.max)
        .toBeGreaterThanOrEqual(localResult.willingnessToPay.priceRange.max);
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await engine.analyzeWillingnessToPay(mockRequest);
      const executionTime = Date.now() - startTime;

      // Should complete in under 5 seconds for unit tests
      expect(executionTime).toBeLessThan(5000);
    });
  });
});