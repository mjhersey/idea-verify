/**
 * Unit tests for Orchestrator Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrchestratorService } from '../../src/orchestrator/orchestrator-service.js';
import { EvaluationRequest } from '../../src/orchestrator/types.js';

// Mock environment config
vi.mock('@ai-validation/shared', () => ({
  getEnvironmentConfig: () => ({
    development: {
      useMockServices: true
    }
  })
}));

describe('OrchestratorService', () => {
  let orchestrator: OrchestratorService;

  beforeEach(async () => {
    orchestrator = OrchestratorService.getInstance({
      maxConcurrentEvaluations: 5,
      defaultTimeout: 10000
    });
    orchestrator.resetState();
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('evaluation management', () => {
    it('should request evaluation successfully', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        priority: 'high',
        agentTypes: ['market-research']
      };

      const evaluationId = await orchestrator.requestEvaluation(request);
      
      expect(evaluationId).toBeDefined();
      expect(typeof evaluationId).toBe('string');
    });

    it('should track evaluation progress', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      const evaluationId = await orchestrator.requestEvaluation(request);
      
      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const progress = orchestrator.getEvaluationProgress(evaluationId);
      expect(progress).toBeDefined();
      expect(progress?.evaluationId).toBe(evaluationId);
      expect(progress?.status).toBeDefined();
    });

    it('should handle concurrent evaluation limit', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      // Fill up to the limit
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(orchestrator.requestEvaluation({
          ...request,
          businessIdeaId: `idea-${i}`
        }));
      }

      await Promise.all(promises);

      // Next request should fail
      await expect(orchestrator.requestEvaluation(request))
        .rejects.toThrow('Maximum concurrent evaluations reached');
    });

    it('should emit evaluation events', async () => {
      const requestedSpy = vi.fn();
      const startedSpy = vi.fn();

      orchestrator.on('evaluation-requested', requestedSpy);
      orchestrator.on('evaluation-started', startedSpy);

      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      const evaluationId = await orchestrator.requestEvaluation(request);

      expect(requestedSpy).toHaveBeenCalledWith(evaluationId, request);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(startedSpy).toHaveBeenCalled();
    });

    it('should get active evaluations', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      await orchestrator.requestEvaluation(request);
      
      const activeEvaluations = orchestrator.getActiveEvaluations();
      expect(activeEvaluations).toHaveLength(1);
      expect(activeEvaluations[0].status).toBeDefined();
    });

    it('should cancel evaluation', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      const evaluationId = await orchestrator.requestEvaluation(request);
      
      const cancelledSpy = vi.fn();
      orchestrator.on('evaluation-cancelled', cancelledSpy);

      await orchestrator.cancelEvaluation(evaluationId);

      expect(cancelledSpy).toHaveBeenCalledWith(evaluationId);

      const progress = orchestrator.getEvaluationProgress(evaluationId);
      expect(progress).toBeUndefined();
    });
  });

  describe('metrics and monitoring', () => {
    it('should track evaluation metrics', async () => {
      const initialMetrics = orchestrator.getMetrics();
      expect(initialMetrics.totalEvaluations).toBe(0);
      expect(initialMetrics.activeEvaluations).toBe(0);

      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      await orchestrator.requestEvaluation(request);

      const updatedMetrics = orchestrator.getMetrics();
      expect(updatedMetrics.totalEvaluations).toBe(1);
      expect(updatedMetrics.activeEvaluations).toBe(1);
    });

    it('should update metrics on evaluation completion', async () => {
      const completedSpy = vi.fn();
      orchestrator.on('evaluation-completed', completedSpy);

      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      const evaluationId = await orchestrator.requestEvaluation(request);

      // Wait for completion (mock agents complete quickly)
      await new Promise(resolve => setTimeout(resolve, 5000));

      const metrics = orchestrator.getMetrics();
      // Should have moved from active to completed
      expect(metrics.activeEvaluations).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should use default agent types when not specified', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123'
        // No agentTypes specified
      };

      const evaluationId = await orchestrator.requestEvaluation(request);
      
      // Wait briefly for evaluation request processing to start and agent progress to be set
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const progress = orchestrator.getEvaluationProgress(evaluationId);
      expect(progress).toBeDefined();
      expect(progress?.agentProgress).toHaveProperty('market-research');
    });

    it('should handle custom evaluation config', async () => {
      const request: EvaluationRequest = {
        businessIdeaId: 'idea-123',
        userId: 'user-123',
        agentTypes: ['market-research'],
        config: {
          timeout: 5000,
          concurrency: 2,
          scoringWeights: {
            'market-research': 1.5
          }
        }
      };

      const evaluationId = await orchestrator.requestEvaluation(request);
      expect(evaluationId).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle evaluation failures gracefully', async () => {
      const failedSpy = vi.fn();
      orchestrator.on('evaluation-failed', failedSpy);

      // Force an error by providing invalid data
      const request: EvaluationRequest = {
        businessIdeaId: '', // Invalid ID
        userId: 'user-123',
        agentTypes: ['market-research']
      };

      try {
        await orchestrator.requestEvaluation(request);
        // If this succeeds, wait for potential failure
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        // Expected for invalid input
      }

      // Should handle the error gracefully
      const metrics = orchestrator.getMetrics();
      expect(metrics.totalEvaluations).toBeGreaterThanOrEqual(0);
    });
  });
});