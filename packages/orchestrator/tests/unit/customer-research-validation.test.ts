import { describe, it, expect, beforeEach } from 'vitest';
import { ProblemValidationEngine } from '../../src/customer-research/validation/problem-validation-engine.js';
import { CustomerResearchRequest } from '../../src/customer-research/schemas/customer-research-types.js';

describe('ProblemValidationEngine', () => {
  let engine: ProblemValidationEngine;
  let mockRequest: CustomerResearchRequest;

  beforeEach(() => {
    engine = new ProblemValidationEngine();
    mockRequest = {
      businessIdea: {
        title: 'AI-Powered Fitness App',
        description: 'A fitness app that uses AI to create personalized workout plans for busy professionals',
        category: 'Health & Fitness',
        targetMarket: 'North America',
        geography: ['United States', 'Canada']
      },
      analysisDepth: 'standard',
      focusAreas: ['problem-validation']
    };
  });

  describe('validateProblem', () => {
    it('should successfully validate problem for health & fitness domain', async () => {
      const result = await engine.validateProblem(mockRequest);

      expect(result).toBeDefined();
      expect(result.problemValidation).toBeDefined();
      expect(result.socialProof).toBeDefined();
      expect(result.customerVoice).toBeDefined();
      expect(result.marketDemand).toBeDefined();
      expect(result.validationInsights).toBeInstanceOf(Array);
      expect(result.dataSources).toBeInstanceOf(Array);

      // Verify problem validation structure
      expect(result.problemValidation.problemExists).toBeDefined();
      expect(result.problemValidation.validationScore).toBeGreaterThanOrEqual(0);
      expect(result.problemValidation.validationScore).toBeLessThanOrEqual(100);
      expect(result.problemValidation.evidenceStrength).toBeGreaterThanOrEqual(0);
      expect(result.problemValidation.evidenceStrength).toBeLessThanOrEqual(100);
      expect(['rare', 'occasional', 'frequent', 'constant']).toContain(result.problemValidation.frequency);
      expect(['low', 'medium', 'high', 'critical']).toContain(result.problemValidation.urgency);
    });

    it('should analyze business domain problems correctly', async () => {
      const businessRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Enterprise CRM Software',
          description: 'Advanced CRM software for small to medium businesses to manage customer relationships',
          category: 'B2B Software',
          targetMarket: 'Global',
          geography: ['United States', 'Europe', 'Asia']
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['problem-validation']
      };

      const result = await engine.validateProblem(businessRequest);

      expect(result.socialProof.forumMentions).toBeGreaterThan(0);
      expect(result.socialProof.redditDiscussions).toBeGreaterThan(0);
      expect(result.socialProof.communitySize).toBeGreaterThan(0);
      expect(result.socialProof.engagementLevel).toBeGreaterThanOrEqual(0);
      expect(result.socialProof.engagementLevel).toBeLessThanOrEqual(100);

      // Should include business-specific complaints
      expect(result.customerVoice.commonThemes).toBeInstanceOf(Array);
      expect(result.customerVoice.commonThemes.length).toBeGreaterThan(0);
    });

    it('should handle technology domain validation', async () => {
      const techRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Developer Analytics Tool',
          description: 'A tool for developers to analyze code performance and optimize applications',
          category: 'Developer Tools',
          targetMarket: 'Global Tech Communities'
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['problem-validation']
      };

      const result = await engine.validateProblem(techRequest);

      // Technology domain should have high social media presence
      expect(result.socialProof.socialMediaReferences).toBeGreaterThan(50000);
      expect(result.marketDemand.demandIntensity).toBeGreaterThan(0);
      expect(result.marketDemand.solutionSeeking).toBeGreaterThan(0);
      expect(result.marketDemand.willingnessToChange).toBeGreaterThan(0);
      expect(result.marketDemand.alternativesConsidered).toBeInstanceOf(Array);
    });

    it('should generate meaningful customer voice insights', async () => {
      const result = await engine.validateProblem(mockRequest);

      expect(result.customerVoice.frustrationLevel).toBeGreaterThanOrEqual(0);
      expect(result.customerVoice.frustrationLevel).toBeLessThanOrEqual(100);
      expect(result.customerVoice.quotes).toBeInstanceOf(Array);
      expect(result.customerVoice.quotes.length).toBeGreaterThan(0);

      // Verify quote structure
      result.customerVoice.quotes.forEach(quote => {
        expect(quote.text).toBeTruthy();
        expect(quote.source).toBeTruthy();
        expect(['negative', 'neutral', 'positive']).toContain(quote.sentiment);
        expect(quote.frustrationIndicators).toBeInstanceOf(Array);
      });

      expect(result.customerVoice.commonThemes).toBeInstanceOf(Array);
      expect(result.customerVoice.languagePatterns).toBeInstanceOf(Array);
    });

    it('should assess market demand correctly', async () => {
      const result = await engine.validateProblem(mockRequest);

      expect(result.marketDemand.demandIntensity).toBeGreaterThanOrEqual(0);
      expect(result.marketDemand.demandIntensity).toBeLessThanOrEqual(100);
      expect(result.marketDemand.solutionSeeking).toBeGreaterThanOrEqual(0);
      expect(result.marketDemand.solutionSeeking).toBeLessThanOrEqual(100);
      expect(result.marketDemand.willingnessToChange).toBeGreaterThanOrEqual(0);
      expect(result.marketDemand.willingnessToChange).toBeLessThanOrEqual(100);
      expect(result.marketDemand.alternativesConsidered).toBeInstanceOf(Array);
    });

    it('should generate validation insights with proper structure', async () => {
      const result = await engine.validateProblem(mockRequest);

      expect(result.validationInsights.length).toBeGreaterThan(0);
      
      result.validationInsights.forEach(insight => {
        expect(insight.insight).toBeTruthy();
        expect(insight.evidence).toBeInstanceOf(Array);
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(100);
        expect(['low', 'medium', 'high']).toContain(insight.impact);
      });
    });

    it('should provide comprehensive data sources', async () => {
      const result = await engine.validateProblem(mockRequest);

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
      expect(sourceTypes).toContain('forum');
      expect(sourceTypes).toContain('social-media');
    });

    it('should adjust metrics based on target market scope', async () => {
      const globalRequest: CustomerResearchRequest = {
        ...mockRequest,
        businessIdea: {
          ...mockRequest.businessIdea,
          targetMarket: 'Global'
        }
      };

      const localRequest: CustomerResearchRequest = {
        ...mockRequest,
        businessIdea: {
          ...mockRequest.businessIdea,
          targetMarket: 'Local San Francisco'
        }
      };

      const [globalResult, localResult] = await Promise.all([
        engine.validateProblem(globalRequest),
        engine.validateProblem(localRequest)
      ]);

      // Global market should show higher demand metrics
      expect(globalResult.marketDemand.demandIntensity)
        .toBeGreaterThan(localResult.marketDemand.demandIntensity);
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await engine.validateProblem(mockRequest);
      const executionTime = Date.now() - startTime;

      // Should complete in under 5 seconds for unit tests
      expect(executionTime).toBeLessThan(5000);
    });
  });
});