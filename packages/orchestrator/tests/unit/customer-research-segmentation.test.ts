import { describe, it, expect, beforeEach } from 'vitest';
import { CustomerSegmentationEngine } from '../../src/customer-research/segmentation/customer-segmentation-engine.js';
import { CustomerResearchRequest } from '../../src/customer-research/schemas/customer-research-types.js';

describe('CustomerSegmentationEngine', () => {
  let engine: CustomerSegmentationEngine;
  let mockRequest: CustomerResearchRequest;

  beforeEach(() => {
    engine = new CustomerSegmentationEngine();
    mockRequest = {
      businessIdea: {
        title: 'AI-Powered Fitness App',
        description: 'A fitness app that uses AI to create personalized workout plans for busy professionals',
        category: 'Health & Fitness',
        targetMarket: 'North America',
        geography: ['United States', 'Canada']
      },
      analysisDepth: 'standard',
      focusAreas: ['segmentation']
    };
  });

  describe('analyzeCustomerSegments', () => {
    it('should successfully analyze customer segments for B2C health app', async () => {
      const result = await engine.analyzeCustomerSegments(mockRequest);

      expect(result).toBeDefined();
      expect(result.segments).toBeInstanceOf(Array);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.segmentationMetrics).toBeDefined();
      expect(result.dataSources).toBeInstanceOf(Array);
      
      // Verify segmentation metrics
      expect(result.segmentationMetrics.totalSegments).toBe(result.segments.length);
      expect(result.segmentationMetrics.confidence).toBeGreaterThanOrEqual(0);
      expect(result.segmentationMetrics.confidence).toBeLessThanOrEqual(100);
      expect(result.segmentationMetrics.totalMarketSize).toBeGreaterThan(0);
    });

    it('should analyze B2B business segments correctly', async () => {
      const b2bRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Enterprise CRM Software',
          description: 'Advanced CRM software for small to medium businesses to manage customer relationships',
          category: 'B2B Software',
          targetMarket: 'Global',
          geography: ['United States', 'Europe', 'Asia']
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['segmentation']
      };

      const result = await engine.analyzeCustomerSegments(b2bRequest);

      expect(result.segments).toBeInstanceOf(Array);
      expect(result.segments.length).toBeGreaterThan(0);
      
      // Should include B2B segments
      const hasB2BSegment = result.segments.some(segment => 
        segment.name.toLowerCase().includes('business') || 
        segment.name.toLowerCase().includes('b2b')
      );
      expect(hasB2BSegment).toBe(true);

      // Verify segment structure
      result.segments.forEach(segment => {
        expect(segment.name).toBeTruthy();
        expect(segment.description).toBeTruthy();
        expect(segment.demographics).toBeDefined();
        expect(segment.psychographics).toBeDefined();
        expect(segment.behaviorPatterns).toBeDefined();
        expect(segment.sizeEstimation).toBeDefined();
        expect(segment.accessibility).toBeDefined();
        expect(segment.priority).toBeGreaterThanOrEqual(0);
        expect(segment.priority).toBeLessThanOrEqual(100);
        expect(segment.confidence).toBeGreaterThanOrEqual(0);
        expect(segment.confidence).toBeLessThanOrEqual(100);
      });
    });

    it('should handle technology-focused business segments', async () => {
      const techRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Developer Analytics Tool',
          description: 'A tool for developers to analyze code performance and optimize applications',
          category: 'Developer Tools',
          targetMarket: 'Global Tech Communities'
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['segmentation'],
        maxSegments: 5
      };

      const result = await engine.analyzeCustomerSegments(techRequest);

      expect(result.segments.length).toBeLessThanOrEqual(5);
      
      // Should include tech-focused segments
      const hasTechSegment = result.segments.some(segment => 
        segment.name.toLowerCase().includes('tech') || 
        segment.name.toLowerCase().includes('developer') ||
        segment.behaviorPatterns.technologyAdoption === 'high' ||
        segment.behaviorPatterns.technologyAdoption === 'very high'
      );
      expect(hasTechSegment).toBe(true);

      // Verify high priority segments
      expect(result.segmentationMetrics.highPrioritySegments).toBeGreaterThan(0);
    });

    it('should apply market sizing adjustments based on target market', async () => {
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
          targetMarket: 'Local San Francisco Bay Area'
        }
      };

      const [globalResult, localResult] = await Promise.all([
        engine.analyzeCustomerSegments(globalRequest),
        engine.analyzeCustomerSegments(localRequest)
      ]);

      // Global market should have larger TAM than local
      expect(globalResult.segmentationMetrics.totalMarketSize)
        .toBeGreaterThan(localResult.segmentationMetrics.totalMarketSize);
    });

    it('should handle empty inputs gracefully', async () => {
      const emptyRequest = {
        businessIdea: {
          title: '',
          description: ''
        },
        analysisDepth: 'standard' as const,
        focusAreas: ['segmentation' as const]
      };

      // Engine should handle empty inputs gracefully, not throw
      const result = await engine.analyzeCustomerSegments(emptyRequest);
      expect(result).toBeDefined();
      expect(result.segments).toBeInstanceOf(Array);
    });

    it('should generate appropriate data sources', async () => {
      const result = await engine.analyzeCustomerSegments(mockRequest);

      expect(result.dataSources.length).toBeGreaterThan(0);
      
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
    });

    it('should have segments with valid priority scores', async () => {
      const result = await engine.analyzeCustomerSegments(mockRequest);

      // All segments should have valid priority scores
      result.segments.forEach(segment => {
        expect(segment.priority).toBeGreaterThanOrEqual(0);
        expect(segment.priority).toBeLessThanOrEqual(100);
      });

      // At least one segment should have high priority (>70)
      const hasHighPrioritySegment = result.segments.some(s => s.priority > 70);
      expect(hasHighPrioritySegment).toBe(true);
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await engine.analyzeCustomerSegments(mockRequest);
      const executionTime = Date.now() - startTime;

      // Should complete in under 5 seconds for unit tests
      expect(executionTime).toBeLessThan(5000);
    });
  });
});