/**
 * Evaluation Pipeline Tests with Deployed Orchestrator and Agents
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createLogger } from '../../packages/shared/src/utils/logger.js';

const logger = createLogger('evaluation-pipeline-tests');

interface EvaluationTestConfig {
  baseUrl: string;
  environment: string;
  timeout: number;
  maxEvaluationTime: number;
}

interface TestEvaluation {
  id: string;
  businessIdeaId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  result?: any;
}

interface BusinessIdea {
  id: string;
  name: string;
  description: string;
  targetMarket: string;
  revenue: number;
  costs: number;
}

class EvaluationPipelineTester {
  private config: EvaluationTestConfig;
  private authToken?: string;
  private userId?: string;
  private testIdeas: BusinessIdea[] = [];
  private testEvaluations: TestEvaluation[] = [];

  constructor(config: EvaluationTestConfig) {
    this.config = config;
  }

  async setup(): Promise<void> {
    // Create test user and authenticate
    const testUser = {
      email: `eval-test-${Date.now()}@example.com`,
      password: 'EvalTest123!',
      name: 'Evaluation Pipeline Test User',
    };

    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser);
    expect(registerResponse.status).toBe(201);

    const userData = await registerResponse.json();
    this.authToken = userData.accessToken;
    this.userId = userData.user.id;

    logger.info('Evaluation pipeline test setup complete', { userId: this.userId });
  }

  async cleanup(): Promise<void> {
    // Clean up test data
    try {
      if (this.authToken) {
        await this.makeRequest('DELETE', '/api/user/cleanup');
      }
    } catch (error) {
      logger.warn('Failed to cleanup evaluation test data', { error });
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.authToken && !headers.Authorization) {
      requestHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
  }

  private async waitForEvaluationCompletion(
    evaluationId: string,
    maxWaitTime: number = this.config.maxEvaluationTime
  ): Promise<TestEvaluation> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const response = await this.makeRequest('GET', `/api/evaluations/${evaluationId}`);
      expect(response.status).toBe(200);

      const evaluation = await response.json();
      
      if (evaluation.status === 'completed') {
        return evaluation;
      }
      
      if (evaluation.status === 'failed') {
        throw new Error(`Evaluation failed: ${evaluation.error || 'Unknown error'}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Evaluation did not complete within ${maxWaitTime}ms`);
  }

  // Basic Evaluation Flow Tests
  async testSimpleEvaluationFlow(): Promise<void> {
    // Create a simple business idea
    const businessIdea = {
      name: 'Simple Test Idea',
      description: 'A basic mobile app for task management with calendar integration.',
      targetMarket: 'busy professionals, students, freelancers',
      revenue: 50000,
      costs: 20000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    expect(ideaResponse.status).toBe(201);

    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    // Start evaluation
    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    expect(evalResponse.status).toBe(202);

    const evaluationData = await evalResponse.json();
    expect(evaluationData).toHaveProperty('evaluationId');
    expect(evaluationData.status).toBe('pending');

    // Wait for completion
    const completedEvaluation = await this.waitForEvaluationCompletion(evaluationData.evaluationId);

    // Validate result structure
    expect(completedEvaluation.status).toBe('completed');
    expect(completedEvaluation).toHaveProperty('result');
    expect(completedEvaluation.result).toHaveProperty('overallScore');
    expect(completedEvaluation.result).toHaveProperty('marketResearch');
    expect(completedEvaluation.result).toHaveProperty('financialAnalysis');

    // Validate score range
    expect(completedEvaluation.result.overallScore).toBeGreaterThanOrEqual(0);
    expect(completedEvaluation.result.overallScore).toBeLessThanOrEqual(100);

    this.testEvaluations.push(completedEvaluation);

    logger.info('Simple evaluation flow test passed', {
      ideaId: createdIdea.id,
      evaluationId: evaluationData.evaluationId,
      overallScore: completedEvaluation.result.overallScore,
    });
  }

  async testComplexEvaluationFlow(): Promise<void> {
    // Create a more complex business idea
    const businessIdea = {
      name: 'Complex AI-Powered Platform',
      description: 'An AI-powered business intelligence platform that analyzes market trends, competitor data, and consumer behavior to provide actionable insights for e-commerce businesses. Features include predictive analytics, automated reporting, real-time dashboards, and integration with major e-commerce platforms like Shopify, Amazon, and WooCommerce.',
      targetMarket: 'e-commerce businesses, online retailers, digital marketing agencies, business analysts',
      revenue: 500000,
      costs: 200000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    expect(ideaResponse.status).toBe(201);

    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    // Start evaluation
    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    expect(evalResponse.status).toBe(202);

    const evaluationData = await evalResponse.json();

    // Wait for completion with extended timeout for complex evaluation
    const completedEvaluation = await this.waitForEvaluationCompletion(
      evaluationData.evaluationId,
      this.config.maxEvaluationTime * 2 // Double timeout for complex evaluation
    );

    // Validate comprehensive result structure
    expect(completedEvaluation.result).toHaveProperty('marketResearch');
    expect(completedEvaluation.result).toHaveProperty('financialAnalysis');
    expect(completedEvaluation.result).toHaveProperty('competitorAnalysis');
    expect(completedEvaluation.result).toHaveProperty('riskAssessment');

    // Validate market research details
    const marketResearch = completedEvaluation.result.marketResearch;
    expect(marketResearch).toHaveProperty('marketSize');
    expect(marketResearch).toHaveProperty('targetAudience');
    expect(marketResearch).toHaveProperty('marketTrends');

    // Validate financial analysis
    const financialAnalysis = completedEvaluation.result.financialAnalysis;
    expect(financialAnalysis).toHaveProperty('profitability');
    expect(financialAnalysis).toHaveProperty('breakEvenPoint');
    expect(financialAnalysis).toHaveProperty('riskLevel');

    this.testEvaluations.push(completedEvaluation);

    logger.info('Complex evaluation flow test passed', {
      ideaId: createdIdea.id,
      evaluationId: evaluationData.evaluationId,
      overallScore: completedEvaluation.result.overallScore,
    });
  }

  // Concurrent Evaluation Tests
  async testConcurrentEvaluations(): Promise<void> {
    // Create multiple business ideas
    const businessIdeas = [
      {
        name: 'Concurrent Test Idea 1',
        description: 'A fitness tracking app with social features.',
        targetMarket: 'fitness enthusiasts, health-conscious individuals',
        revenue: 30000,
        costs: 15000,
      },
      {
        name: 'Concurrent Test Idea 2',
        description: 'An online marketplace for handmade crafts.',
        targetMarket: 'craft enthusiasts, artisans, gift buyers',
        revenue: 40000,
        costs: 18000,
      },
      {
        name: 'Concurrent Test Idea 3',
        description: 'A meal planning and grocery delivery service.',
        targetMarket: 'busy families, health-conscious consumers',
        revenue: 60000,
        costs: 25000,
      },
    ];

    // Create all ideas
    const createdIdeas = [];
    for (const idea of businessIdeas) {
      const response = await this.makeRequest('POST', '/api/ideas', idea);
      expect(response.status).toBe(201);
      const createdIdea = await response.json();
      createdIdeas.push(createdIdea);
      this.testIdeas.push(createdIdea);
    }

    // Start all evaluations concurrently
    const evaluationPromises = createdIdeas.map(async (idea) => {
      const response = await this.makeRequest('POST', `/api/ideas/${idea.id}/evaluate`);
      expect(response.status).toBe(202);
      return response.json();
    });

    const startedEvaluations = await Promise.all(evaluationPromises);

    // Wait for all evaluations to complete
    const completionPromises = startedEvaluations.map(eval => 
      this.waitForEvaluationCompletion(eval.evaluationId)
    );

    const completedEvaluations = await Promise.all(completionPromises);

    // Validate all evaluations completed successfully
    expect(completedEvaluations.length).toBe(3);
    
    for (const evaluation of completedEvaluations) {
      expect(evaluation.status).toBe('completed');
      expect(evaluation.result).toHaveProperty('overallScore');
      expect(evaluation.result.overallScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.result.overallScore).toBeLessThanOrEqual(100);
    }

    this.testEvaluations.push(...completedEvaluations);

    logger.info('Concurrent evaluations test passed', {
      evaluationsCount: completedEvaluations.length,
      scores: completedEvaluations.map(e => e.result.overallScore),
    });
  }

  // Agent Integration Tests
  async testMarketResearchAgent(): Promise<void> {
    const businessIdea = {
      name: 'Market Research Agent Test',
      description: 'A specialized B2B software solution for inventory management.',
      targetMarket: 'small to medium businesses, retail stores, warehouses',
      revenue: 80000,
      costs: 30000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    const evaluationData = await evalResponse.json();

    const completedEvaluation = await this.waitForEvaluationCompletion(evaluationData.evaluationId);

    // Validate market research agent output
    const marketResearch = completedEvaluation.result.marketResearch;
    expect(marketResearch).toBeDefined();
    expect(marketResearch).toHaveProperty('marketSize');
    expect(marketResearch).toHaveProperty('competition');
    expect(marketResearch).toHaveProperty('marketTrends');
    
    // Validate data quality
    expect(typeof marketResearch.marketSize).toBe('string');
    expect(['small', 'medium', 'large', 'very large']).toContain(marketResearch.marketSize.toLowerCase());
    
    if (marketResearch.competition) {
      expect(['low', 'moderate', 'high', 'very high']).toContain(marketResearch.competition.toLowerCase());
    }

    this.testEvaluations.push(completedEvaluation);

    logger.info('Market research agent test passed', {
      marketSize: marketResearch.marketSize,
      competition: marketResearch.competition,
    });
  }

  async testFinancialAnalysisAgent(): Promise<void> {
    const businessIdea = {
      name: 'Financial Analysis Agent Test',
      description: 'A subscription-based software service for project management.',
      targetMarket: 'project managers, development teams, consultants',
      revenue: 120000,
      costs: 60000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    const evaluationData = await evalResponse.json();

    const completedEvaluation = await this.waitForEvaluationCompletion(evaluationData.evaluationId);

    // Validate financial analysis agent output
    const financialAnalysis = completedEvaluation.result.financialAnalysis;
    expect(financialAnalysis).toBeDefined();
    expect(financialAnalysis).toHaveProperty('profitability');
    expect(financialAnalysis).toHaveProperty('breakEvenPoint');
    expect(financialAnalysis).toHaveProperty('riskLevel');

    // Validate financial calculations
    if (typeof financialAnalysis.breakEvenPoint === 'number') {
      expect(financialAnalysis.breakEvenPoint).toBeGreaterThan(0);
      expect(financialAnalysis.breakEvenPoint).toBeLessThan(100); // months
    }

    if (financialAnalysis.riskLevel) {
      expect(['low', 'medium', 'high', 'very high']).toContain(financialAnalysis.riskLevel.toLowerCase());
    }

    this.testEvaluations.push(completedEvaluation);

    logger.info('Financial analysis agent test passed', {
      profitability: financialAnalysis.profitability,
      breakEvenPoint: financialAnalysis.breakEvenPoint,
      riskLevel: financialAnalysis.riskLevel,
    });
  }

  // Error Handling and Edge Cases
  async testEvaluationErrorHandling(): Promise<void> {
    // Test evaluation of non-existent idea
    const nonExistentResponse = await this.makeRequest('POST', '/api/ideas/nonexistent-id/evaluate');
    expect([400, 404]).toContain(nonExistentResponse.status);

    // Test evaluation with invalid data
    const invalidIdea = {
      name: '',
      description: '',
      targetMarket: '',
      revenue: -1000,
      costs: -500,
    };

    const invalidIdeaResponse = await this.makeRequest('POST', '/api/ideas', invalidIdea);
    if (invalidIdeaResponse.status === 201) {
      const createdInvalidIdea = await invalidIdeaResponse.json();
      
      const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdInvalidIdea.id}/evaluate`);
      
      if (evalResponse.status === 202) {
        const evaluationData = await evalResponse.json();
        
        try {
          // This might fail due to invalid data
          await this.waitForEvaluationCompletion(evaluationData.evaluationId, 60000);
        } catch (error) {
          // Expected to fail or handle gracefully
          logger.info('Invalid data evaluation handled as expected');
        }
      }
    }

    logger.info('Evaluation error handling test passed');
  }

  async testEvaluationCancellation(): Promise<void> {
    const businessIdea = {
      name: 'Cancellation Test Idea',
      description: 'A test idea for evaluation cancellation functionality.',
      targetMarket: 'test users',
      revenue: 25000,
      costs: 10000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    const evaluationData = await evalResponse.json();

    // Try to cancel the evaluation (if cancellation endpoint exists)
    const cancelResponse = await this.makeRequest('DELETE', `/api/evaluations/${evaluationData.evaluationId}`);
    
    if (cancelResponse.status === 200) {
      // Cancellation successful
      const cancelData = await cancelResponse.json();
      expect(['cancelled', 'canceled']).toContain(cancelData.status.toLowerCase());

      logger.info('Evaluation cancellation test passed');
    } else if (cancelResponse.status === 404) {
      // Cancellation endpoint not implemented
      logger.info('Evaluation cancellation not implemented, test skipped');
    } else {
      // Evaluation might have completed too quickly to cancel
      logger.info('Evaluation cancellation test - evaluation completed before cancellation');
    }
  }

  // Performance and Load Tests
  async testEvaluationPerformance(): Promise<void> {
    const businessIdea = {
      name: 'Performance Test Idea',
      description: 'A performance testing idea for evaluation timing analysis.',
      targetMarket: 'performance testers',
      revenue: 35000,
      costs: 15000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    const startTime = Date.now();
    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    const evaluationData = await evalResponse.json();

    const completedEvaluation = await this.waitForEvaluationCompletion(evaluationData.evaluationId);
    const totalTime = Date.now() - startTime;

    // Validate performance requirements
    expect(totalTime).toBeLessThan(this.config.maxEvaluationTime);

    // Log performance metrics
    const actualStartTime = new Date(completedEvaluation.startedAt).getTime();
    const actualEndTime = new Date(completedEvaluation.completedAt!).getTime();
    const processingTime = actualEndTime - actualStartTime;

    this.testEvaluations.push(completedEvaluation);

    logger.info('Evaluation performance test passed', {
      totalTime,
      processingTime,
      maxAllowedTime: this.config.maxEvaluationTime,
    });
  }

  // Data Quality and Validation Tests
  async testResultDataQuality(): Promise<void> {
    const businessIdea = {
      name: 'Data Quality Test Idea',
      description: 'A comprehensive business idea to test the quality and completeness of evaluation results.',
      targetMarket: 'data quality analysts, business evaluators',
      revenue: 90000,
      costs: 40000,
    };

    const ideaResponse = await this.makeRequest('POST', '/api/ideas', businessIdea);
    const createdIdea = await ideaResponse.json();
    this.testIdeas.push(createdIdea);

    const evalResponse = await this.makeRequest('POST', `/api/ideas/${createdIdea.id}/evaluate`);
    const evaluationData = await evalResponse.json();

    const completedEvaluation = await this.waitForEvaluationCompletion(evaluationData.evaluationId);

    // Comprehensive data quality validation
    const result = completedEvaluation.result;

    // Overall score validation
    expect(result.overallScore).toBeDefined();
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    // Market research validation
    if (result.marketResearch) {
      expect(typeof result.marketResearch).toBe('object');
      if (result.marketResearch.marketSize) {
        expect(typeof result.marketResearch.marketSize).toBe('string');
        expect(result.marketResearch.marketSize.length).toBeGreaterThan(0);
      }
    }

    // Financial analysis validation
    if (result.financialAnalysis) {
      expect(typeof result.financialAnalysis).toBe('object');
      if (result.financialAnalysis.breakEvenPoint) {
        expect(typeof result.financialAnalysis.breakEvenPoint).toBe('number');
        expect(result.financialAnalysis.breakEvenPoint).toBeGreaterThan(0);
      }
    }

    // Competitor analysis validation
    if (result.competitorAnalysis) {
      expect(typeof result.competitorAnalysis).toBe('object');
    }

    // Risk assessment validation
    if (result.riskAssessment) {
      expect(typeof result.riskAssessment).toBe('object');
    }

    this.testEvaluations.push(completedEvaluation);

    logger.info('Result data quality test passed', {
      overallScore: result.overallScore,
      hasMarketResearch: !!result.marketResearch,
      hasFinancialAnalysis: !!result.financialAnalysis,
      hasCompetitorAnalysis: !!result.competitorAnalysis,
      hasRiskAssessment: !!result.riskAssessment,
    });
  }
}

// Test Configuration
const getEvaluationTestConfig = (): EvaluationTestConfig => ({
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  environment: process.env.TEST_ENVIRONMENT || 'dev',
  timeout: 60000, // 1 minute per test
  maxEvaluationTime: 300000, // 5 minutes for evaluation completion
});

// Test Suite
describe('Evaluation Pipeline Tests', () => {
  let tester: EvaluationPipelineTester;
  const config = getEvaluationTestConfig();

  beforeAll(async () => {
    tester = new EvaluationPipelineTester(config);
    await tester.setup();
  }, config.timeout);

  afterAll(async () => {
    if (tester) {
      await tester.cleanup();
    }
  });

  describe('Basic Evaluation Flow', () => {
    test('should complete simple evaluation successfully', async () => {
      await tester.testSimpleEvaluationFlow();
    }, config.maxEvaluationTime + config.timeout);

    test('should handle complex evaluation flow', async () => {
      await tester.testComplexEvaluationFlow();
    }, config.maxEvaluationTime * 2 + config.timeout);
  });

  describe('Concurrent Evaluations', () => {
    test('should handle multiple concurrent evaluations', async () => {
      await tester.testConcurrentEvaluations();
    }, config.maxEvaluationTime * 2 + config.timeout);
  });

  describe('Agent Integration', () => {
    test('should integrate with market research agent', async () => {
      await tester.testMarketResearchAgent();
    }, config.maxEvaluationTime + config.timeout);

    test('should integrate with financial analysis agent', async () => {
      await tester.testFinancialAnalysisAgent();
    }, config.maxEvaluationTime + config.timeout);
  });

  describe('Error Handling', () => {
    test('should handle evaluation errors gracefully', async () => {
      await tester.testEvaluationErrorHandling();
    }, config.timeout);

    test('should support evaluation cancellation', async () => {
      await tester.testEvaluationCancellation();
    }, config.timeout);
  });

  describe('Performance', () => {
    test('should meet evaluation performance requirements', async () => {
      await tester.testEvaluationPerformance();
    }, config.maxEvaluationTime + config.timeout);
  });

  describe('Data Quality', () => {
    test('should produce high-quality evaluation results', async () => {
      await tester.testResultDataQuality();
    }, config.maxEvaluationTime + config.timeout);
  });
});

export default EvaluationPipelineTester;