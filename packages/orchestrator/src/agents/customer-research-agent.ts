/**
 * Customer Research Agent
 * Orchestrates comprehensive customer research and validation analysis
 */

import { 
  BaseAgent, 
  AgentRequest, 
  AgentResponse, 
  AgentExecutionContext,
  AgentCapability,
  AgentCommunicationContext
} from './types.js';
import { CustomerSegmentationEngine } from '../customer-research/segmentation/customer-segmentation-engine.js';
import { ProblemValidationEngine } from '../customer-research/validation/problem-validation-engine.js';
import { PainPointAnalysisEngine } from '../customer-research/analysis/pain-point-analysis-engine.js';
import { WillingnessToPayEngine } from '../customer-research/pricing/willingness-to-pay-engine.js';
import { ValidationScoringEngine } from '../customer-research/scoring/validation-scoring-engine.js';
import { PersonaRecommendationEngine } from '../customer-research/personas/persona-recommendation-engine.js';
import { CustomerResearchOutput, CustomerResearchRequest } from '../customer-research/schemas/customer-research-types.js';

export class CustomerResearchAgent extends BaseAgent {
  private segmentationEngine: CustomerSegmentationEngine;
  private problemValidationEngine: ProblemValidationEngine;
  private painPointEngine: PainPointAnalysisEngine;
  private pricingEngine: WillingnessToPayEngine;
  private scoringEngine: ValidationScoringEngine;
  private personaEngine: PersonaRecommendationEngine;

  constructor() {
    super(
      'customer-research',
      'Customer Research Agent',
      'Analyzes target customer segments, personas, pain points, and demand patterns'
    );
    this.segmentationEngine = new CustomerSegmentationEngine();
    this.problemValidationEngine = new ProblemValidationEngine();
    this.painPointEngine = new PainPointAnalysisEngine();
    this.pricingEngine = new WillingnessToPayEngine();
    this.scoringEngine = new ValidationScoringEngine();
    this.personaEngine = new PersonaRecommendationEngine();
  }

  protected defineCapabilities(): AgentCapability {
    return {
      name: 'Customer Research Analysis',
      version: '1.0.0',
      dependencies: ['agent-framework'],
      provides: [
        'customer-segmentation',
        'problem-validation',
        'pain-point-analysis',
        'willingness-to-pay-analysis',
        'validation-scoring',
        'persona-recommendations'
      ],
      requires: [
        'business-idea-description'
      ]
    };
  }

  protected async onInitialize(): Promise<void> {
    console.log('[CustomerResearchAgent] Initializing customer research capabilities...');
    // Initialize any shared resources or configurations
  }

  protected async onCleanup(): Promise<void> {
    console.log('[CustomerResearchAgent] Cleaning up customer research resources...');
    // Clean up any resources if needed
  }

  canHandle(request: AgentRequest, _context?: AgentCommunicationContext): boolean {
    return !!request.businessIdea?.title && 
           !!request.businessIdea?.description;
  }

  async execute(
    request: AgentRequest,
    context: AgentExecutionContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    console.log(`[CustomerResearchAgent] Starting customer research analysis for: ${request.businessIdea.title}`);

    try {
      // Convert AgentRequest to CustomerResearchRequest
      const customerResearchRequest = this.convertToCustomerResearchRequest(request);

      // Determine analysis scope based on request options
      const focusAreas = this.determineFocusAreas(request);
      customerResearchRequest.focusAreas = focusAreas;

      // Execute analysis engines in parallel where possible
      const analysisResults = await this.executeAnalysisEngines(customerResearchRequest);

      // Synthesize comprehensive customer research output
      const customerResearchOutput = this.synthesizeCustomerResearchOutput(
        analysisResults, customerResearchRequest, startTime
      );

      // Generate agent response
      const agentResponse = this.generateAgentResponse(
        customerResearchOutput, request, context, startTime
      );

      console.log(`[CustomerResearchAgent] Customer research analysis completed in ${Date.now() - startTime}ms`);
      return agentResponse;

    } catch (error) {
      console.error('[CustomerResearchAgent] Customer research analysis failed:', error);
      
      // Return error response with fallback analysis
      return this.generateErrorResponse(error, request, context, startTime);
    }
  }

  private convertToCustomerResearchRequest(request: AgentRequest): CustomerResearchRequest {
    // Extract analysis depth from request options
    const analysisDepth = request.options?.analysisDepth || 'standard';
    
    // Validate analysis depth
    const validDepths = ['basic', 'standard', 'comprehensive'];
    const depth = validDepths.includes(analysisDepth) ? analysisDepth as 'basic' | 'standard' | 'comprehensive' : 'standard';

    return {
      businessIdea: {
        title: request.businessIdea.title || 'Untitled Business Idea',
        description: request.businessIdea.description || '',
        category: request.businessIdea.category,
        targetMarket: request.businessIdea.targetMarket,
        geography: request.businessIdea.geography
      },
      analysisDepth: depth,
      focusAreas: [], // Will be set by determineFocusAreas
      maxSegments: request.options?.maxSegments,
      maxPersonas: request.options?.maxPersonas,
      timeConstraints: request.options?.timeConstraints
    };
  }

  private determineFocusAreas(request: AgentRequest): ('segmentation' | 'problem-validation' | 'pain-points' | 'pricing' | 'personas')[] {
    // Default to all focus areas for comprehensive analysis
    const allFocusAreas: ('segmentation' | 'problem-validation' | 'pain-points' | 'pricing' | 'personas')[] = [
      'segmentation',
      'problem-validation', 
      'pain-points',
      'pricing',
      'personas'
    ];

    // Check if specific focus areas are requested
    if (request.options?.focusAreas && Array.isArray(request.options.focusAreas)) {
      const requestedAreas = request.options.focusAreas.filter(area => 
        allFocusAreas.includes(area as any)
      ) as ('segmentation' | 'problem-validation' | 'pain-points' | 'pricing' | 'personas')[];
      
      return requestedAreas.length > 0 ? requestedAreas : allFocusAreas;
    }

    // For basic analysis, focus on core areas
    if (request.options?.analysisDepth === 'basic') {
      return ['segmentation', 'problem-validation'];
    }

    return allFocusAreas;
  }

  private async executeAnalysisEngines(request: CustomerResearchRequest) {
    const results: any = {};

    // Create array of analysis promises based on focus areas
    const analysisPromises: Promise<any>[] = [];
    const analysisNames: string[] = [];

    if (request.focusAreas.includes('segmentation')) {
      analysisPromises.push(this.segmentationEngine.analyzeCustomerSegments(request));
      analysisNames.push('segmentation');
    }

    if (request.focusAreas.includes('problem-validation')) {
      analysisPromises.push(this.problemValidationEngine.validateProblem(request));
      analysisNames.push('problemValidation');
    }

    if (request.focusAreas.includes('pain-points')) {
      analysisPromises.push(this.painPointEngine.analyzePainPoints(request));
      analysisNames.push('painPoints');
    }

    if (request.focusAreas.includes('pricing')) {
      analysisPromises.push(this.pricingEngine.analyzeWillingnessToPay(request));
      analysisNames.push('pricing');
    }

    if (request.focusAreas.includes('personas')) {
      analysisPromises.push(this.personaEngine.generatePersonaRecommendations(request));
      analysisNames.push('personas');
    }

    // Always include validation scoring as it synthesizes other results
    analysisPromises.push(this.scoringEngine.calculateValidationScore(request));
    analysisNames.push('scoring');

    // Execute all analyses in parallel
    const analysisResults = await Promise.all(analysisPromises);

    // Map results to named properties
    analysisNames.forEach((name, index) => {
      results[name] = analysisResults[index];
    });

    return results;
  }

  private synthesizeCustomerResearchOutput(
    analysisResults: any,
    request: CustomerResearchRequest,
    startTime: number
  ): CustomerResearchOutput {
    // Extract results from engines
    const segmentationResult = analysisResults.segmentation;
    const problemValidationResult = analysisResults.problemValidation;
    const painPointsResult = analysisResults.painPoints;
    const pricingResult = analysisResults.pricing;
    const personasResult = analysisResults.personas;
    const scoringResult = analysisResults.scoring;

    // Aggregate all data sources
    const allDataSources = [];
    if (segmentationResult?.dataSources) allDataSources.push(...segmentationResult.dataSources);
    if (problemValidationResult?.dataSources) allDataSources.push(...problemValidationResult.dataSources);
    if (painPointsResult?.dataSources) allDataSources.push(...painPointsResult.dataSources);
    if (pricingResult?.dataSources) allDataSources.push(...pricingResult.dataSources);
    if (personasResult?.dataSources) allDataSources.push(...personasResult.dataSources);
    if (scoringResult?.dataSources) allDataSources.push(...scoringResult.dataSources);

    // Remove duplicate data sources
    const uniqueDataSources = this.deduplicateDataSources(allDataSources);

    // Calculate processing time and quality metrics
    const processingTime = Date.now() - startTime;
    const dataQuality = this.calculateDataQuality(analysisResults);
    const completeness = this.calculateCompleteness(analysisResults, request);

    // Generate validation insights
    const validationInsights = this.generateValidationInsights(analysisResults, request);

    // Identify limitations
    const limitations = this.identifyLimitations(analysisResults, request);

    return {
      segments: segmentationResult?.segments || [],
      painPoints: painPointsResult?.painPoints || [],
      validationScore: scoringResult?.validationScore || {
        overall: 0,
        components: {
          problemValidation: 0,
          marketDemand: 0,
          segmentViability: 0,
          solutionFit: 0,
          willingnessToPayScore: 0,
          competitiveAdvantage: 0
        },
        explanation: 'Unable to calculate validation score',
        strengths: [],
        weaknesses: [],
        recommendations: [],
        confidence: 0
      },
      willingnessToPay: pricingResult?.willingnessToPay || {
        priceRange: { min: 0, max: 0, currency: 'USD', confidence: 0 },
        priceModel: 'subscription',
        valuePerspective: { perceivedValue: 0, costOfProblem: 0, competitiveContext: [], priceAnchors: [] },
        priceSensitivity: { elasticity: 'medium', segmentVariations: [] },
        affordabilityAssessment: { canAfford: 0, paymentPreferences: [], budgetConstraints: [] },
        recommendations: { suggestedPrice: 0, pricingStrategy: '', rationale: [], risks: [] },
        confidence: 0
      },
      personas: personasResult?.personas || [],
      validationInsights,
      metadata: {
        analysisDate: new Date(),
        processingTime,
        dataQuality,
        completeness,
        version: '1.0.0',
        segmentsAnalyzed: segmentationResult?.segments?.length || 0
      },
      dataSources: uniqueDataSources,
      limitations
    };
  }

  private deduplicateDataSources(dataSources: any[]): any[] {
    const uniqueSources = new Map();
    
    dataSources.forEach(source => {
      const key = `${source.name}-${source.type}`;
      if (!uniqueSources.has(key) || uniqueSources.get(key).credibility < source.credibility) {
        uniqueSources.set(key, source);
      }
    });

    return Array.from(uniqueSources.values());
  }

  private calculateDataQuality(analysisResults: any): number {
    let totalQuality = 0;
    let qualityFactors = 0;

    // Assess quality based on available results
    if (analysisResults.segmentation) {
      const segmentCount = analysisResults.segmentation.segments?.length || 0;
      totalQuality += Math.min(100, segmentCount * 20); // Max 100 for 5+ segments
      qualityFactors++;
    }

    if (analysisResults.problemValidation) {
      const validationScore = analysisResults.problemValidation.problemValidation?.validationScore || 0;
      totalQuality += validationScore;
      qualityFactors++;
    }

    if (analysisResults.painPoints) {
      const painPointCount = analysisResults.painPoints.painPoints?.length || 0;
      totalQuality += Math.min(100, painPointCount * 15); // Max 100 for 7+ pain points
      qualityFactors++;
    }

    if (analysisResults.scoring) {
      const confidence = analysisResults.scoring.validationScore?.confidence || 0;
      totalQuality += confidence;
      qualityFactors++;
    }

    return qualityFactors > 0 ? Math.round(totalQuality / qualityFactors) : 70;
  }

  private calculateCompleteness(analysisResults: any, request: CustomerResearchRequest): number {
    const requestedAreas = request.focusAreas.length;
    let completedAreas = 0;

    if (request.focusAreas.includes('segmentation') && analysisResults.segmentation) {
      completedAreas++;
    }
    if (request.focusAreas.includes('problem-validation') && analysisResults.problemValidation) {
      completedAreas++;
    }
    if (request.focusAreas.includes('pain-points') && analysisResults.painPoints) {
      completedAreas++;
    }
    if (request.focusAreas.includes('pricing') && analysisResults.pricing) {
      completedAreas++;
    }
    if (request.focusAreas.includes('personas') && analysisResults.personas) {
      completedAreas++;
    }

    return requestedAreas > 0 ? Math.round((completedAreas / requestedAreas) * 100) : 100;
  }

  private generateValidationInsights(analysisResults: any, request: CustomerResearchRequest): any[] {
    const insights = [];

    // Generate insights from scoring results
    if (analysisResults.scoring?.validationScore) {
      const score = analysisResults.scoring.validationScore.overall;
      
      if (score >= 80) {
        insights.push({
          type: 'market-demand',
          title: 'Strong Customer Validation',
          description: `Excellent validation score of ${score}/100 indicates strong product-market fit potential`,
          impact: 'high',
          confidence: 90,
          evidence: ['High validation score', 'Strong component scores'],
          recommendations: ['Proceed with confidence to development phase'],
          risks: [],
          priority: 95
        });
      } else if (score >= 70) {
        insights.push({
          type: 'market-demand',
          title: 'Good Customer Validation',
          description: `Good validation score of ${score}/100 suggests solid market opportunity`,
          impact: 'medium',
          confidence: 80,
          evidence: ['Above-average validation score'],
          recommendations: ['Address weaker validation areas before launch'],
          risks: ['Some validation concerns remain'],
          priority: 80
        });
      } else {
        insights.push({
          type: 'problem-validation',
          title: 'Validation Concerns',
          description: `Lower validation score of ${score}/100 indicates validation challenges`,
          impact: 'high',
          confidence: 85,
          evidence: ['Below-average validation metrics'],
          recommendations: ['Conduct additional customer research', 'Refine value proposition'],
          risks: ['Product-market fit uncertainty', 'Market entry challenges'],
          priority: 90
        });
      }
    }

    // Add segmentation insights
    if (analysisResults.segmentation?.segments) {
      const segmentCount = analysisResults.segmentation.segments.length;
      const highPrioritySegments = analysisResults.segmentation.segments.filter((s: any) => s.priority > 80).length;

      if (highPrioritySegments > 0) {
        insights.push({
          type: 'segment-opportunity',
          title: 'High-Value Customer Segments Identified',
          description: `Identified ${highPrioritySegments} high-priority customer segments out of ${segmentCount} total`,
          impact: 'high',
          confidence: 85,
          evidence: [`${highPrioritySegments} segments with >80 priority score`],
          recommendations: ['Focus initial marketing on high-priority segments'],
          risks: [],
          priority: 85
        });
      }
    }

    // Add pricing insights
    if (analysisResults.pricing?.willingnessToPay) {
      const priceRange = analysisResults.pricing.willingnessToPay.priceRange;
      const confidence = priceRange.confidence;

      if (confidence > 75) {
        insights.push({
          type: 'pricing-insight',
          title: 'Strong Pricing Confidence',
          description: `High confidence (${confidence}%) in price range $${priceRange.min}-$${priceRange.max}`,
          impact: 'medium',
          confidence,
          evidence: [`${confidence}% pricing confidence`, 'Market pricing analysis'],
          recommendations: ['Proceed with suggested pricing strategy'],
          risks: [],
          priority: 75
        });
      }
    }

    return insights;
  }

  private identifyLimitations(analysisResults: any, request: CustomerResearchRequest): string[] {
    const limitations = [];

    // Analysis depth limitations
    if (request.analysisDepth === 'basic') {
      limitations.push('Basic analysis depth may not capture all customer nuances');
    }

    // Missing focus areas
    const allAreas = ['segmentation', 'problem-validation', 'pain-points', 'pricing', 'personas'];
    const missingAreas = allAreas.filter(area => !request.focusAreas.includes(area as any));
    
    if (missingAreas.length > 0) {
      limitations.push(`Analysis excludes: ${missingAreas.join(', ')}`);
    }

    // Data source limitations
    limitations.push('Analysis based on simulated market data - validation with real customer data recommended');

    // Time constraints
    if (request.timeConstraints && request.timeConstraints < 60) {
      limitations.push('Time constraints may have limited analysis depth');
    }

    // Sample size assumptions
    limitations.push('Market sizing estimates based on demographic assumptions rather than direct measurement');

    return limitations;
  }

  private generateAgentResponse(
    customerResearchOutput: CustomerResearchOutput,
    request: AgentRequest,
    context: AgentExecutionContext,
    startTime: number
  ): AgentResponse {
    const score = customerResearchOutput.validationScore.overall;
    const confidence = customerResearchOutput.validationScore.confidence;

    // Generate key insights for the response
    const insights = [
      `Identified ${customerResearchOutput.segments.length} customer segments with ${customerResearchOutput.segments.filter(s => s.priority > 80).length} high-priority targets`,
      `Customer validation score: ${score}/100 (${this.getScoreInterpretation(score)})`,
      `${customerResearchOutput.painPoints.length} key pain points identified with actionable solutions`,
      `Pricing analysis suggests ${customerResearchOutput.willingnessToPay.priceModel} model at $${customerResearchOutput.willingnessToPay.recommendations.suggestedPrice}`,
      `${customerResearchOutput.personas.length} detailed customer personas developed for targeting`
    ];

    // Add validation-specific insights
    if (customerResearchOutput.validationInsights.length > 0) {
      const topInsight = customerResearchOutput.validationInsights
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
      insights.push(topInsight.description);
    }

    return {
      agentType: this.agentType,
      score,
      insights,
      confidence: this.mapConfidenceToString(confidence),
      metadata: {
        processingTime: Date.now() - startTime,
        model: 'customer-research-engine-v1.0',
        retryCount: 0,
        analysisDepth: request.options?.analysisDepth || 'standard',
        focusAreas: customerResearchOutput.metadata.segmentsAnalyzed,
        dataQuality: customerResearchOutput.metadata.dataQuality,
        completeness: customerResearchOutput.metadata.completeness,
        version: '1.0.0',
        executionId: context.evaluationId,
        correlationId: context.correlationId
      },
      rawData: customerResearchOutput
    };
  }

  private getScoreInterpretation(score: number): string {
    if (score >= 80) return 'Strong validation';
    if (score >= 70) return 'Good validation';
    if (score >= 60) return 'Moderate validation';
    if (score >= 50) return 'Weak validation';
    return 'Poor validation';
  }

  private mapConfidenceToString(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  }

  private generateErrorResponse(
    error: any,
    request: AgentRequest,
    context: AgentExecutionContext,
    startTime: number
  ): AgentResponse {
    console.error('[CustomerResearchAgent] Generating error response:', error);

    return {
      agentType: this.agentType,
      score: 0,
      insights: [
        'Customer research analysis failed due to technical error',
        'Recommend retrying with simplified parameters',
        'Manual customer research may be required'
      ],
      confidence: 'low',
      metadata: {
        processingTime: Date.now() - startTime,
        model: 'customer-research-engine-v1.0',
        retryCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        analysisDepth: request.options?.analysisDepth || 'standard',
        focusAreas: 0,
        dataQuality: 0,
        completeness: 0,
        version: '1.0.0',
        executionId: context.evaluationId,
        correlationId: context.correlationId
      },
      rawData: {
        error: true,
        message: error instanceof Error ? error.message : 'Customer research analysis failed'
      }
    };
  }
}