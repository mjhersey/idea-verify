import { describe, it, expect, beforeEach } from 'vitest'
import { PainPointAnalysisEngine } from '../../src/customer-research/analysis/pain-point-analysis-engine.js'
import { CustomerResearchRequest } from '../../src/customer-research/schemas/customer-research-types.js'

describe('PainPointAnalysisEngine', () => {
  let engine: PainPointAnalysisEngine
  let mockRequest: CustomerResearchRequest

  beforeEach(() => {
    engine = new PainPointAnalysisEngine()
    mockRequest = {
      businessIdea: {
        title: 'AI-Powered Fitness App',
        description:
          'A fitness app that uses AI to create personalized workout plans for busy professionals',
        category: 'Health & Fitness',
        targetMarket: 'North America',
        geography: ['United States', 'Canada'],
      },
      analysisDepth: 'standard',
      focusAreas: ['pain-points'],
    }
  })

  describe('analyzePainPoints', () => {
    it('should successfully analyze pain points for health & fitness domain', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      expect(result).toBeDefined()
      expect(result.painPoints).toBeInstanceOf(Array)
      expect(result.painPoints.length).toBeGreaterThan(0)
      expect(result.painPointMetrics).toBeDefined()
      expect(result.customerJourney).toBeDefined()
      expect(result.needsAnalysis).toBeDefined()
      expect(result.solutionFit).toBeDefined()
      expect(result.dataSources).toBeInstanceOf(Array)

      // Verify pain point structure
      result.painPoints.forEach(painPoint => {
        expect(painPoint.problem).toBeTruthy()
        expect(painPoint.description).toBeTruthy()
        expect(['low', 'medium', 'high']).toContain(painPoint.severity)
        expect(['rare', 'occasional', 'frequent', 'constant']).toContain(painPoint.frequency)
        expect(painPoint.customerSegments).toBeInstanceOf(Array)
        expect(painPoint.evidenceStrength).toBeGreaterThanOrEqual(0)
        expect(painPoint.evidenceStrength).toBeLessThanOrEqual(100)
        expect(painPoint.currentSolutions).toBeInstanceOf(Array)
        expect(painPoint.customerQuotes).toBeInstanceOf(Array)
        expect(painPoint.impact).toBeDefined()
        expect(painPoint.opportunity).toBeGreaterThanOrEqual(0)
        expect(painPoint.opportunity).toBeLessThanOrEqual(100)
        expect(painPoint.confidence).toBeGreaterThanOrEqual(0)
        expect(painPoint.confidence).toBeLessThanOrEqual(100)
      })
    })

    it('should analyze business domain pain points correctly', async () => {
      const businessRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Enterprise CRM Software',
          description:
            'Advanced CRM software for small to medium businesses to manage customer relationships',
          category: 'B2B Software',
          targetMarket: 'Global',
          geography: ['United States', 'Europe', 'Asia'],
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['pain-points'],
      }

      const result = await engine.analyzePainPoints(businessRequest)

      expect(result.painPoints.length).toBeGreaterThan(0)

      // Should include business-specific pain points
      const hasBusinessPain = result.painPoints.some(
        pain =>
          pain.problem.toLowerCase().includes('manual') ||
          pain.problem.toLowerCase().includes('integration') ||
          pain.problem.toLowerCase().includes('business')
      )
      expect(hasBusinessPain).toBe(true)

      // Verify impact assessment
      result.painPoints.forEach(painPoint => {
        expect(painPoint.impact.financial).toBeTruthy()
        expect(painPoint.impact.operational).toBeTruthy()
        expect(painPoint.impact.emotional).toBeTruthy()
      })
    })

    it('should generate comprehensive pain point metrics', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      expect(result.painPointMetrics.totalPainPoints).toBe(result.painPoints.length)
      expect(result.painPointMetrics.criticalPainPoints).toBeGreaterThanOrEqual(0)
      expect(result.painPointMetrics.averageSeverityScore).toBeGreaterThanOrEqual(0)
      expect(result.painPointMetrics.averageSeverityScore).toBeLessThanOrEqual(100)
      expect(result.painPointMetrics.mostFrequentPain).toBeTruthy()
      expect(result.painPointMetrics.overallOpportunityScore).toBeGreaterThanOrEqual(0)
      expect(result.painPointMetrics.overallOpportunityScore).toBeLessThanOrEqual(100)
    })

    it('should analyze customer journey touchpoints', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      expect(result.customerJourney.touchpoints).toBeInstanceOf(Array)
      expect(result.customerJourney.touchpoints.length).toBeGreaterThan(0)

      result.customerJourney.touchpoints.forEach(touchpoint => {
        expect(touchpoint.stage).toBeTruthy()
        expect(touchpoint.painPoints).toBeInstanceOf(Array)
        expect(touchpoint.severity).toBeGreaterThanOrEqual(0)
        expect(touchpoint.severity).toBeLessThanOrEqual(100)
        expect(touchpoint.frequency).toBeTruthy()
        expect(touchpoint.customerImpact).toBeTruthy()
      })

      expect(result.customerJourney.criticalMoments).toBeInstanceOf(Array)
      expect(result.customerJourney.opportunityAreas).toBeInstanceOf(Array)
    })

    it('should perform comprehensive needs analysis', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      expect(result.needsAnalysis.primaryNeeds).toBeInstanceOf(Array)
      expect(result.needsAnalysis.primaryNeeds.length).toBeGreaterThan(0)

      result.needsAnalysis.primaryNeeds.forEach(need => {
        expect(need.need).toBeTruthy()
        expect(need.importance).toBeGreaterThanOrEqual(0)
        expect(need.importance).toBeLessThanOrEqual(100)
        expect(need.currentSatisfaction).toBeGreaterThanOrEqual(0)
        expect(need.currentSatisfaction).toBeLessThanOrEqual(100)
        expect(need.gap).toBeDefined()
        expect(need.customerSegments).toBeInstanceOf(Array)
      })

      expect(result.needsAnalysis.unmetNeeds).toBeInstanceOf(Array)
      expect(result.needsAnalysis.emergingNeeds).toBeInstanceOf(Array)
    })

    it('should assess solution fit accurately', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      expect(result.solutionFit.problemSolutionAlignment).toBeGreaterThanOrEqual(0)
      expect(result.solutionFit.problemSolutionAlignment).toBeLessThanOrEqual(100)
      expect(result.solutionFit.addressableProblems).toBeInstanceOf(Array)
      expect(result.solutionFit.solutionGaps).toBeInstanceOf(Array)
      expect(result.solutionFit.competitorWeaknesses).toBeInstanceOf(Array)
    })

    it('should handle technology domain pain points', async () => {
      const techRequest: CustomerResearchRequest = {
        businessIdea: {
          title: 'Developer Analytics Tool',
          description:
            'A tool for developers to analyze code performance and optimize applications',
          category: 'Developer Tools',
          targetMarket: 'Global Tech Communities',
        },
        analysisDepth: 'comprehensive',
        focusAreas: ['pain-points'],
      }

      const result = await engine.analyzePainPoints(techRequest)

      // Should include tech-specific pain points
      const hasTechPain = result.painPoints.some(
        pain =>
          pain.problem.toLowerCase().includes('setup') ||
          pain.problem.toLowerCase().includes('configuration') ||
          pain.problem.toLowerCase().includes('documentation')
      )
      expect(hasTechPain).toBe(true)

      // Technology domain should have high opportunity scores
      const avgOpportunity =
        result.painPoints.reduce((sum, p) => sum + p.opportunity, 0) / result.painPoints.length
      expect(avgOpportunity).toBeGreaterThan(50)
    })

    it('should generate customer quotes with proper structure', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      const painPointsWithQuotes = result.painPoints.filter(p => p.customerQuotes.length > 0)
      expect(painPointsWithQuotes.length).toBeGreaterThan(0)

      painPointsWithQuotes.forEach(painPoint => {
        painPoint.customerQuotes.forEach(quote => {
          expect(quote.quote).toBeTruthy()
          expect(quote.source).toBeTruthy()
          expect(typeof quote.anonymized).toBe('boolean')
          expect(['negative', 'neutral', 'positive']).toContain(quote.sentiment)
        })
      })
    })

    it('should identify critical pain points correctly', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      const criticalPains = result.painPoints.filter(
        p => p.severity === 'high' && (p.frequency === 'frequent' || p.frequency === 'constant')
      )

      expect(result.painPointMetrics.criticalPainPoints).toBe(criticalPains.length)

      if (criticalPains.length > 0) {
        criticalPains.forEach(pain => {
          expect(pain.opportunity).toBeGreaterThan(60) // Critical pains should have high opportunity scores
        })
      }
    })

    it('should provide comprehensive data sources', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      expect(result.dataSources.length).toBeGreaterThan(2)

      result.dataSources.forEach(source => {
        expect(source.name).toBeTruthy()
        expect(source.type).toBeTruthy()
        expect(source.credibility).toBeGreaterThanOrEqual(0)
        expect(source.credibility).toBeLessThanOrEqual(100)
        expect(source.recency).toBeInstanceOf(Date)
        expect(source.accessDate).toBeInstanceOf(Date)
        expect(source.dataPoints).toBeInstanceOf(Array)
        expect(source.dataPoints.length).toBeGreaterThan(0)
      })

      // Should include different source types
      const sourceTypes = result.dataSources.map(s => s.type)
      expect(sourceTypes).toContain('forum')
      expect(sourceTypes).toContain('survey')
      expect(sourceTypes).toContain('industry-report')
    })

    it('should calculate opportunity scores appropriately', async () => {
      const result = await engine.analyzePainPoints(mockRequest)

      // High severity + frequent occurrence should yield high opportunity scores
      const highSeverityFrequentPains = result.painPoints.filter(
        p => p.severity === 'high' && (p.frequency === 'frequent' || p.frequency === 'constant')
      )

      if (highSeverityFrequentPains.length > 0) {
        highSeverityFrequentPains.forEach(pain => {
          expect(pain.opportunity).toBeGreaterThan(60)
        })
      }

      // Overall opportunity score should reflect individual scores
      const avgOpportunity =
        result.painPoints.reduce((sum, p) => sum + p.opportunity, 0) / result.painPoints.length
      expect(
        Math.abs(result.painPointMetrics.overallOpportunityScore - avgOpportunity)
      ).toBeLessThan(5)
    })

    it('should complete within reasonable time', async () => {
      const startTime = Date.now()
      await engine.analyzePainPoints(mockRequest)
      const executionTime = Date.now() - startTime

      // Should complete in under 5 seconds for unit tests
      expect(executionTime).toBeLessThan(5000)
    })
  })
})
