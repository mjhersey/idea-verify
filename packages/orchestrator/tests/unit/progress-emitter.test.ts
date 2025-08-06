import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressEmitter } from '../../src/events/progress-emitter.js';

describe('ProgressEmitter', () => {
  let progressEmitter: ProgressEmitter;

  beforeEach(() => {
    progressEmitter = ProgressEmitter.getInstance();
    // Clear all listeners before each test
    progressEmitter.removeAllListeners();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ProgressEmitter.getInstance();
      const instance2 = ProgressEmitter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Agent Progress Events', () => {
    it('should emit agent progress events correctly', () => {
      const mockListener = vi.fn();
      progressEmitter.on('agent:progress', mockListener);

      const evaluationId = 'test-eval-123';
      const agentType = 'market-research';
      const status = 'running';
      const progressPercentage = 75;

      progressEmitter.emitAgentProgress(evaluationId, agentType, status, progressPercentage);

      expect(mockListener).toHaveBeenCalledWith(evaluationId, {
        agentType,
        status,
        progressPercentage,
        timestamp: expect.any(Date)
      });
    });

    it('should log progress events', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      progressEmitter.emitAgentProgress('eval-1', 'technical-feasibility', 'initializing', 10);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ProgressEmitter] Agent progress: technical-feasibility initializing 10%'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Insight Discovery Events', () => {
    it('should emit insight discovered events correctly', () => {
      const mockListener = vi.fn();
      progressEmitter.on('insight:discovered', mockListener);

      const evaluationId = 'test-eval-456';
      const agentType = 'competitive-analysis';
      const insight = {
        type: 'competitive-advantage',
        content: 'Unique value proposition identified',
        importance: 'high' as const
      };
      const confidence = 0.85;
      const metadata = { source: 'competitor-analysis' };

      progressEmitter.emitInsightDiscovered(
        evaluationId,
        agentType,
        insight,
        confidence,
        metadata
      );

      expect(mockListener).toHaveBeenCalledWith(evaluationId, {
        agentType,
        insight,
        confidence,
        metadata,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Evaluation Status Events', () => {
    it('should emit evaluation status events correctly', () => {
      const mockListener = vi.fn();
      progressEmitter.on('evaluation:status', mockListener);

      const evaluationId = 'test-eval-789';
      const overallProgress = 60;
      const activeAgents = ['market-research', 'technical-feasibility'];
      const completedAgents = ['competitive-analysis'];
      const failedAgents = ['customer-research'];

      progressEmitter.emitEvaluationStatus(
        evaluationId,
        overallProgress,
        activeAgents,
        completedAgents,
        failedAgents
      );

      expect(mockListener).toHaveBeenCalledWith(evaluationId, {
        evaluationId,
        overallProgress,
        activeAgents,
        completedAgents,
        failedAgents,
        estimatedCompletionTime: undefined,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Agent Completed Events', () => {
    it('should emit agent completed events correctly', () => {
      const mockListener = vi.fn();
      progressEmitter.on('agent:completed', mockListener);

      const evaluationId = 'test-eval-101';
      const agentType = 'market-research';
      const resultSummary = {
        score: 85,
        keyFindings: ['Large market size', 'Growing demand', 'Limited competition'],
        recommendation: 'Proceed with development'
      };
      const executionTime = 45000;
      const finalScore = 85;

      progressEmitter.emitAgentCompleted(
        evaluationId,
        agentType,
        resultSummary,
        executionTime,
        finalScore
      );

      expect(mockListener).toHaveBeenCalledWith(evaluationId, {
        agentType,
        evaluationId,
        resultSummary,
        executionTime,
        finalScore,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Error Events', () => {
    it('should emit error events correctly', () => {
      const mockListener = vi.fn();
      progressEmitter.on('evaluation:error', mockListener);

      const evaluationId = 'test-eval-error';
      const error = 'API rate limit exceeded';
      const severity = 'high';
      const agentType = 'technical-feasibility';
      const recoveryActions = ['Implement exponential backoff', 'Switch to backup API'];

      progressEmitter.emitError(
        evaluationId,
        error,
        severity,
        agentType,
        recoveryActions
      );

      expect(mockListener).toHaveBeenCalledWith(evaluationId, {
        evaluationId,
        error,
        severity,
        agentType,
        recoveryActions,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Evaluation Completed Events', () => {
    it('should emit evaluation completed events correctly', () => {
      const mockListener = vi.fn();
      progressEmitter.on('evaluation:completed', mockListener);

      const evaluationId = 'test-eval-complete';
      const finalResults = {
        overallScore: 78,
        recommendation: 'recommended' as const,
        summary: 'Promising business idea with moderate risk'
      };
      const totalTime = 120000;
      const agentSummaries = [
        { agentType: 'market-research', score: 85, executionTime: 45000 },
        { agentType: 'technical-feasibility', score: 72, executionTime: 38000 },
        { agentType: 'competitive-analysis', score: 76, executionTime: 37000 }
      ];

      progressEmitter.emitEvaluationCompleted(
        evaluationId,
        finalResults,
        totalTime,
        agentSummaries
      );

      expect(mockListener).toHaveBeenCalledWith(evaluationId, {
        evaluationId,
        finalResults,
        totalTime,
        agentSummaries,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Batch Events', () => {
    it('should emit multiple events in batch correctly', () => {
      const progressListener = vi.fn();
      const insightListener = vi.fn();
      const statusListener = vi.fn();

      progressEmitter.on('agent:progress', progressListener);
      progressEmitter.on('insight:discovered', insightListener);
      progressEmitter.on('evaluation:status', statusListener);

      const events = [
        {
          agentType: 'market-research',
          status: 'running' as const,
          progressPercentage: 50,
          timestamp: new Date()
        },
        {
          agentType: 'market-research',
          insight: {
            type: 'market-size',
            content: 'Large addressable market identified',
            importance: 'high' as const
          },
          confidence: 0.9,
          timestamp: new Date()
        },
        {
          evaluationId: 'eval-batch',
          overallProgress: 25,
          activeAgents: ['market-research'],
          completedAgents: [],
          timestamp: new Date()
        }
      ];

      progressEmitter.emitBatch('eval-batch', events);

      expect(progressListener).toHaveBeenCalledTimes(1);
      expect(insightListener).toHaveBeenCalledTimes(1);
      expect(statusListener).toHaveBeenCalledTimes(1);
    });
  });
});