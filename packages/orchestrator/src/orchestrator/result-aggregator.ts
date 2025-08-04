/**
 * Result Aggregator - Combines and analyzes results from multiple agents
 */

import { AgentType } from '@ai-validation/shared';
import { AgentResponse } from '../agents/types.js';
import { EventEmitter } from 'events';

export interface AggregatedResult {
  evaluationId: string;
  overallScore: number;
  confidence: 'high' | 'medium' | 'low';
  consensus: number; // 0-100, how much agents agree
  summary: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    risks: string[];
    recommendations: string[];
  };
  agentContributions: {
    [agentType: string]: {
      weight: number;
      score: number;
      confidence: 'high' | 'medium' | 'low';
      keyInsights: string[];
      dataQuality: number;
    };
  };
  metadata: {
    totalAgents: number;
    successfulAgents: number;
    failedAgents: string[];
    aggregationMethod: string;
    processingTime: number;
    dataReliability: number;
  };
}

export interface AggregationStrategy {
  name: string;
  description: string;
  weightingScheme: Record<AgentType, number>;
  minimumAgents: number;
  confidenceThreshold: number;
  aggregateScores: (results: AgentResponse[]) => number;
  calculateConsensus: (results: AgentResponse[]) => number;
  determineConfidence: (results: AgentResponse[], consensus: number) => 'high' | 'medium' | 'low';
}

export interface ValidationRule {
  name: string;
  validate: (result: AgentResponse) => { valid: boolean; issues: string[] };
  severity: 'error' | 'warning' | 'info';
}

export class ResultAggregator extends EventEmitter {
  private static instance: ResultAggregator;
  private strategies: Map<string, AggregationStrategy> = new Map();
  private validationRules: ValidationRule[] = [];
  
  private constructor() {
    super();
    this.initializeDefaultStrategies();
    this.initializeValidationRules();
  }

  static getInstance(): ResultAggregator {
    if (!ResultAggregator.instance) {
      ResultAggregator.instance = new ResultAggregator();
    }
    return ResultAggregator.instance;
  }

  private initializeDefaultStrategies(): void {
    // Weighted Average Strategy
    const weightedStrategy: AggregationStrategy = {
      name: 'weighted-average',
      description: 'Weighted average based on agent expertise and reliability',
      weightingScheme: {
        'market-research': 1.2,        // High weight - foundation for others
        'competitive-analysis': 1.0,   // Standard weight
        'customer-research': 1.1,      // Slightly higher - customer focus is critical
        'technical-feasibility': 0.9,  // Lower weight - more binary pass/fail
        'financial-analysis': 1.1      // Higher weight - business viability critical
      },
      minimumAgents: 2,
      confidenceThreshold: 0.7,
      aggregateScores: this.weightedAverageScoring.bind(this),
      calculateConsensus: this.calculateVarianceConsensus.bind(this),
      determineConfidence: this.standardConfidenceCalculation.bind(this)
    };

    // Conservative Strategy (emphasizes risks)
    const conservativeStrategy: AggregationStrategy = {
      name: 'conservative',
      description: 'Conservative approach emphasizing risks and challenges',
      weightingScheme: {
        'market-research': 1.0,
        'competitive-analysis': 1.3,   // Higher weight on competition
        'customer-research': 1.0,
        'technical-feasibility': 1.2,  // Higher weight on technical risks
        'financial-analysis': 1.1
      },
      minimumAgents: 3,
      confidenceThreshold: 0.8,
      aggregateScores: this.conservativeScoring.bind(this),
      calculateConsensus: this.calculateRangeConsensus.bind(this),
      determineConfidence: this.conservativeConfidenceCalculation.bind(this)
    };

    // Optimistic Strategy (emphasizes opportunities)
    const optimisticStrategy: AggregationStrategy = {
      name: 'optimistic',
      description: 'Optimistic approach emphasizing opportunities and potential',
      weightingScheme: {
        'market-research': 1.3,        // Higher weight on market opportunity
        'competitive-analysis': 0.8,   // Lower weight on competition
        'customer-research': 1.2,      // Higher weight on customer need
        'technical-feasibility': 0.9,
        'financial-analysis': 1.0
      },
      minimumAgents: 2,
      confidenceThreshold: 0.6,
      aggregateScores: this.optimisticScoring.bind(this),
      calculateConsensus: this.calculateVarianceConsensus.bind(this),
      determineConfidence: this.optimisticConfidenceCalculation.bind(this)
    };

    this.strategies.set(weightedStrategy.name, weightedStrategy);
    this.strategies.set(conservativeStrategy.name, conservativeStrategy);
    this.strategies.set(optimisticStrategy.name, optimisticStrategy);
  }

  private initializeValidationRules(): void {
    this.validationRules = [
      {
        name: 'score-range-validation',
        validate: (result) => {
          const valid = result.score >= 0 && result.score <= 100;
          return {
            valid,
            issues: valid ? [] : [`Score out of range: ${result.score}`]
          };
        },
        severity: 'error'
      },
      {
        name: 'insights-presence-validation',
        validate: (result) => {
          const valid = result.insights && result.insights.length > 0;
          return {
            valid,
            issues: valid ? [] : ['No insights provided']
          };
        },
        severity: 'warning'
      },
      {
        name: 'confidence-consistency-validation',
        validate: (result) => {
          const scoreConfidenceMap = {
            high: result.score >= 70,
            medium: result.score >= 40 && result.score < 70,
            low: result.score < 40
          };
          
          const expectedConfidence = Object.entries(scoreConfidenceMap)
            .find(([_, matches]) => matches)?.[0];
          
          const valid = !expectedConfidence || result.confidence === expectedConfidence;
          return {
            valid,
            issues: valid ? [] : [`Confidence ${result.confidence} inconsistent with score ${result.score}`]
          };
        },
        severity: 'info'
      },
      {
        name: 'metadata-completeness-validation',
        validate: (result) => {
          const requiredFields = ['processingTime', 'model', 'retryCount'];
          const missing = requiredFields.filter(field => 
            !result.metadata || result.metadata[field] === undefined
          );
          
          return {
            valid: missing.length === 0,
            issues: missing.map(field => `Missing metadata field: ${field}`)
          };
        },
        severity: 'warning'
      }
    ];
  }

  // Main aggregation method
  async aggregateResults(
    evaluationId: string,
    agentResults: AgentResponse[],
    strategyName: string = 'weighted-average'
  ): Promise<AggregatedResult> {
    const startTime = Date.now();
    
    console.log(`[ResultAggregator] Aggregating ${agentResults.length} results for evaluation: ${evaluationId}`);

    // Validate inputs
    this.validateInputs(agentResults);

    // Get aggregation strategy
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown aggregation strategy: ${strategyName}`);
    }

    // Validate individual results
    const validationSummary = this.validateResults(agentResults);
    this.logValidationIssues(validationSummary);

    // Filter out failed results
    const validResults = agentResults.filter(result => 
      this.isResultValid(result, validationSummary)
    );

    if (validResults.length < strategy.minimumAgents) {
      throw new Error(`Insufficient valid results: ${validResults.length}, minimum required: ${strategy.minimumAgents}`);
    }

    // Calculate aggregated score
    const overallScore = strategy.aggregateScores(validResults);
    
    // Calculate consensus
    const consensus = strategy.calculateConsensus(validResults);
    
    // Determine confidence
    const confidence = strategy.determineConfidence(validResults, consensus);

    // Generate summary
    const summary = await this.generateSummary(validResults);

    // Calculate agent contributions
    const agentContributions = this.calculateAgentContributions(validResults, strategy);

    // Calculate data reliability
    const dataReliability = this.calculateDataReliability(validResults, validationSummary);

    const result: AggregatedResult = {
      evaluationId,
      overallScore: Math.round(overallScore),
      confidence,
      consensus: Math.round(consensus),
      summary,
      agentContributions,
      metadata: {
        totalAgents: agentResults.length,
        successfulAgents: validResults.length,
        failedAgents: agentResults
          .filter(r => !validResults.includes(r))
          .map(r => r.agentType),
        aggregationMethod: strategyName,
        processingTime: Date.now() - startTime,
        dataReliability: Math.round(dataReliability)
      }
    };

    this.emit('resultsAggregated', { evaluationId, result, strategy: strategyName });
    console.log(`[ResultAggregator] Aggregation complete: score=${result.overallScore}, confidence=${result.confidence}`);

    return result;
  }

  // Scoring methods for different strategies
  private weightedAverageScoring(results: AgentResponse[]): number {
    const strategy = this.strategies.get('weighted-average')!;
    let totalScore = 0;
    let totalWeight = 0;

    for (const result of results) {
      const weight = strategy.weightingScheme[result.agentType] || 1.0;
      totalScore += result.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private conservativeScoring(results: AgentResponse[]): number {
    const strategy = this.strategies.get('conservative')!;
    let totalScore = 0;
    let totalWeight = 0;

    for (const result of results) {
      const weight = strategy.weightingScheme[result.agentType] || 1.0;
      // Apply conservative bias - reduce scores slightly
      const adjustedScore = result.score * 0.9;
      totalScore += adjustedScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.max(0, totalScore / totalWeight) : 0;
  }

  private optimisticScoring(results: AgentResponse[]): number {
    const strategy = this.strategies.get('optimistic')!;
    let totalScore = 0;
    let totalWeight = 0;

    for (const result of results) {
      const weight = strategy.weightingScheme[result.agentType] || 1.0;
      // Apply optimistic bias - boost scores slightly
      const adjustedScore = Math.min(100, result.score * 1.1);
      totalScore += adjustedScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(100, totalScore / totalWeight) : 0;
  }

  // Consensus calculation methods
  private calculateVarianceConsensus(results: AgentResponse[]): number {
    if (results.length < 2) return 100;

    const scores = results.map(r => r.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Convert standard deviation to consensus (lower stdDev = higher consensus)
    const maxStdDev = 30; // Assume max reasonable standard deviation
    return Math.max(0, Math.min(100, 100 - (stdDev / maxStdDev) * 100));
  }

  private calculateRangeConsensus(results: AgentResponse[]): number {
    if (results.length < 2) return 100;

    const scores = results.map(r => r.score);
    const range = Math.max(...scores) - Math.min(...scores);
    const maxRange = 60; // Assume max reasonable range

    // Convert range to consensus (smaller range = higher consensus)
    return Math.max(0, Math.min(100, 100 - (range / maxRange) * 100));
  }

  // Confidence calculation methods
  private standardConfidenceCalculation(results: AgentResponse[], consensus: number): 'high' | 'medium' | 'low' {
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const highConfidenceAgents = results.filter(r => r.confidence === 'high').length;
    const confidenceRatio = highConfidenceAgents / results.length;

    if (consensus >= 80 && avgScore >= 70 && confidenceRatio >= 0.6) return 'high';
    if (consensus >= 60 && avgScore >= 50 && confidenceRatio >= 0.4) return 'medium';
    return 'low';
  }

  private conservativeConfidenceCalculation(results: AgentResponse[], consensus: number): 'high' | 'medium' | 'low' {
    // More stringent requirements for confidence
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const highConfidenceAgents = results.filter(r => r.confidence === 'high').length;
    const confidenceRatio = highConfidenceAgents / results.length;

    if (consensus >= 90 && avgScore >= 80 && confidenceRatio >= 0.8) return 'high';
    if (consensus >= 75 && avgScore >= 65 && confidenceRatio >= 0.6) return 'medium';
    return 'low';
  }

  private optimisticConfidenceCalculation(results: AgentResponse[], consensus: number): 'high' | 'medium' | 'low' {
    // More lenient requirements for confidence
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const highConfidenceAgents = results.filter(r => r.confidence === 'high').length;
    const confidenceRatio = highConfidenceAgents / results.length;

    if (consensus >= 70 && avgScore >= 60 && confidenceRatio >= 0.4) return 'high';
    if (consensus >= 50 && avgScore >= 40 && confidenceRatio >= 0.2) return 'medium';
    return 'low';
  }

  // Summary generation
  private async generateSummary(results: AgentResponse[]): Promise<AggregatedResult['summary']> {
    const allInsights = results.flatMap(r => r.insights);
    
    // Categorize insights using keyword matching
    const strengthKeywords = ['strong', 'advantage', 'excellent', 'good', 'positive', 'opportunity', 'growth'];
    const weaknessKeywords = ['weak', 'challenge', 'difficult', 'problem', 'issue', 'concern', 'limitation'];
    const opportunityKeywords = ['opportunity', 'potential', 'market', 'expand', 'scale', 'improve'];
    const riskKeywords = ['risk', 'threat', 'competition', 'barrier', 'challenge', 'uncertainty'];
    const recommendationKeywords = ['recommend', 'should', 'consider', 'suggest', 'improve', 'focus'];

    const categorizeInsights = (insights: string[], keywords: string[]) => {
      return insights.filter(insight => 
        keywords.some(keyword => 
          insight.toLowerCase().includes(keyword.toLowerCase())
        )
      ).slice(0, 5); // Limit to top 5
    };

    return {
      strengths: categorizeInsights(allInsights, strengthKeywords),
      weaknesses: categorizeInsights(allInsights, weaknessKeywords),
      opportunities: categorizeInsights(allInsights, opportunityKeywords),
      risks: categorizeInsights(allInsights, riskKeywords),
      recommendations: categorizeInsights(allInsights, recommendationKeywords)
    };
  }

  // Agent contribution calculation
  private calculateAgentContributions(results: AgentResponse[], strategy: AggregationStrategy): AggregatedResult['agentContributions'] {
    const contributions: AggregatedResult['agentContributions'] = {};

    for (const result of results) {
      const weight = strategy.weightingScheme[result.agentType] || 1.0;
      const dataQuality = this.assessDataQuality(result);

      contributions[result.agentType] = {
        weight,
        score: result.score,
        confidence: result.confidence,
        keyInsights: result.insights.slice(0, 3), // Top 3 insights
        dataQuality: Math.round(dataQuality)
      };
    }

    return contributions;
  }

  private assessDataQuality(result: AgentResponse): number {
    let qualityScore = 70; // Base score

    // Adjust based on confidence
    if (result.confidence === 'high') qualityScore += 20;
    else if (result.confidence === 'low') qualityScore -= 20;

    // Adjust based on insights quantity and diversity
    if (result.insights.length >= 5) qualityScore += 10;
    else if (result.insights.length < 2) qualityScore -= 15;

    // Adjust based on metadata completeness
    const metadata = result.metadata;
    if (metadata.processingTime && metadata.model && metadata.retryCount !== undefined) {
      qualityScore += 5;
    }

    // Adjust based on retry count (more retries = lower quality)
    if (metadata.retryCount > 0) {
      qualityScore -= metadata.retryCount * 5;
    }

    return Math.max(0, Math.min(100, qualityScore));
  }

  // Validation methods
  private validateInputs(results: AgentResponse[]): void {
    if (!results || results.length === 0) {
      throw new Error('No agent results provided for aggregation');
    }

    const agentTypes = new Set(results.map(r => r.agentType));
    if (agentTypes.size !== results.length) {
      throw new Error('Duplicate agent types in results');
    }
  }

  private validateResults(results: AgentResponse[]): Map<string, { valid: boolean; issues: string[] }> {
    const validationSummary = new Map<string, { valid: boolean; issues: string[] }>();

    for (const result of results) {
      let allValid = true;
      const allIssues: string[] = [];

      for (const rule of this.validationRules) {
        const validation = rule.validate(result);
        if (!validation.valid) {
          allValid = false;
          allIssues.push(...validation.issues.map(issue => `${rule.name}: ${issue}`));
        }
      }

      validationSummary.set(result.agentType, {
        valid: allValid,
        issues: allIssues
      });
    }

    return validationSummary;
  }

  private isResultValid(result: AgentResponse, validationSummary: Map<string, any>): boolean {
    const validation = validationSummary.get(result.agentType);
    return validation ? validation.valid : false;
  }

  private logValidationIssues(validationSummary: Map<string, { valid: boolean; issues: string[] }>): void {
    validationSummary.forEach((validation, agentType) => {
      if (!validation.valid) {
        console.warn(`[ResultAggregator] Validation issues for ${agentType}:`, validation.issues);
      }
    });
  }

  private calculateDataReliability(results: AgentResponse[], validationSummary: Map<string, any>): number {
    const validResults = results.filter(r => validationSummary.get(r.agentType)?.valid);
    const reliabilityRatio = validResults.length / results.length;
    
    const avgDataQuality = validResults.reduce((sum, result) => 
      sum + this.assessDataQuality(result), 0
    ) / validResults.length;

    return reliabilityRatio * avgDataQuality;
  }

  // Public API
  addStrategy(strategy: AggregationStrategy): void {
    this.strategies.set(strategy.name, strategy);
    console.log(`[ResultAggregator] Added aggregation strategy: ${strategy.name}`);
  }

  getStrategies(): AggregationStrategy[] {
    return Array.from(this.strategies.values());
  }

  addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule);
    console.log(`[ResultAggregator] Added validation rule: ${rule.name}`);
  }

  // Test utilities
  static resetInstance(): void {
    ResultAggregator.instance = null as any;
  }
}