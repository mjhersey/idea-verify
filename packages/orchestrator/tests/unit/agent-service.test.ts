/**
 * Unit tests for Agent Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '../../src/agents/agent-service.js';
import { AgentRequest, AgentExecutionContext } from '../../src/agents/types.js';

// Mock AgentFactory
vi.mock('../../src/agents/agent-factory.js', () => ({
  AgentFactory: {
    isAgentSupported: vi.fn(),
    getAgent: vi.fn(),
    getAvailableAgentTypes: vi.fn(() => ['market-research'])
  }
}));

describe('AgentService', () => {
  let agentService: AgentService;
  let mockRequest: AgentRequest;
  let mockContext: AgentExecutionContext;

  beforeEach(() => {
    agentService = AgentService.getInstance();
    
    mockRequest = {
      businessIdea: {
        id: 'idea-123',
        title: 'AI-Powered Fitness Tracking App',
        description: 'A mobile app that uses AI to provide personalized fitness recommendations'
      },
      analysisType: 'market_size'
    };

    mockContext = {
      evaluationId: 'eval-123',
      correlationId: 'corr-123',
      timestamp: new Date()
    };
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AgentService.getInstance();
      const instance2 = AgentService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('executeAgent', () => {
    it('should execute supported agent successfully', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          agentType: 'market-research',
          score: 85,
          insights: ['Great market opportunity'],
          confidence: 'high' as const,
          metadata: {
            processingTime: 1000,
            model: 'gpt-4',
            retryCount: 0
          },
          rawData: { test: 'data' }
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response!.score).toBe(85);
      expect(result.response!.confidence).toBe('high');
      expect(result.retryCount).toBe(0);
      expect(mockAgent.execute).toHaveBeenCalledWith(mockRequest, mockContext);
    });

    it('should handle unsupported agent type', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(false);

      const result = await agentService.executeAgent(
        'unsupported-agent' as any,
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
      expect(result.retryCount).toBe(0);
    });

    it('should retry on agent failure', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            agentType: 'market-research',
            score: 75,
            insights: ['Analysis completed'],
            confidence: 'medium' as const,
            metadata: {
              processingTime: 1500,
              model: 'gpt-4',
              retryCount: 1
            },
            rawData: { test: 'data' }
          })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext,
        { maxRetries: 2 }
      );

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(mockAgent.execute).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockRejectedValue(new Error('Persistent failure'))
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext,
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent failure');
      expect(result.retryCount).toBe(1);
      expect(mockAgent.execute).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should handle timeout', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 2000))
        )
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext,
        { timeout: 100, maxRetries: 0 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should validate agent response', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          agentType: 'market-research',
          score: 150, // Invalid score > 100
          insights: ['Test'],
          confidence: 'high',
          metadata: { processingTime: 1000, model: 'test', retryCount: 0 },
          rawData: {}
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('score must be a number between 0 and 100');
    });
  });

  describe('executeMultipleAgents', () => {
    it('should execute multiple agents successfully', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          agentType: 'market-research',
          score: 80,
          insights: ['Analysis completed'],
          confidence: 'high' as const,
          metadata: {
            processingTime: 1000,
            model: 'gpt-4',
            retryCount: 0
          },
          rawData: { test: 'data' }
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const agentRequests = [
        { agentType: 'market-research' as const, request: mockRequest },
        { agentType: 'market-research' as const, request: mockRequest }
      ];

      const results = await agentService.executeMultipleAgents(
        agentRequests,
        mockContext
      );

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockAgent.execute).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in multiple agents', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn()
          .mockResolvedValueOnce({
            agentType: 'market-research',
            score: 80,
            insights: ['Success'],
            confidence: 'high' as const,
            metadata: { processingTime: 1000, model: 'gpt-4', retryCount: 0 },
            rawData: {}
          })
          .mockRejectedValueOnce(new Error('Second agent failed'))
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const agentRequests = [
        { agentType: 'market-research' as const, request: mockRequest },
        { agentType: 'market-research' as const, request: mockRequest }
      ];

      const results = await agentService.executeMultipleAgents(
        agentRequests,
        mockContext,
        { maxRetries: 0 }
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Second agent failed');
    });

    it('should respect concurrency limits', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      let concurrentExecutions = 0;
      let maxConcurrentExecutions = 0;
      
      const mockAgent = {
        execute: vi.fn().mockImplementation(async () => {
          concurrentExecutions++;
          maxConcurrentExecutions = Math.max(maxConcurrentExecutions, concurrentExecutions);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          concurrentExecutions--;
          
          return {
            agentType: 'market-research',
            score: 80,
            insights: ['Success'],
            confidence: 'high' as const,
            metadata: { processingTime: 100, model: 'gpt-4', retryCount: 0 },
            rawData: {}
          };
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const agentRequests = Array(5).fill(null).map(() => ({
        agentType: 'market-research' as const,
        request: mockRequest
      }));

      await agentService.executeMultipleAgents(
        agentRequests,
        mockContext,
        { concurrency: 2 }
      );

      expect(maxConcurrentExecutions).toBeLessThanOrEqual(2);
    });
  });

  describe('getAvailableAgents', () => {
    it('should return available agent information', () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      const mockAgent = {
        getName: () => 'Market Research Agent',
        getDescription: () => 'Analyzes market opportunities'
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const agents = agentService.getAvailableAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual({
        type: 'market-research',
        name: 'Market Research Agent',
        description: 'Analyzes market opportunities'
      });
    });
  });

  describe('response validation', () => {
    it('should reject null response', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue(null)
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('null or undefined');
    });

    it('should reject invalid score range', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          agentType: 'market-research',
          score: -10, // Invalid score
          insights: ['Test'],
          confidence: 'high',
          metadata: { processingTime: 1000, model: 'test', retryCount: 0 },
          rawData: {}
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('score must be a number between 0 and 100');
    });

    it('should reject invalid insights format', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          agentType: 'market-research',
          score: 80,
          insights: 'not an array', // Invalid insights
          confidence: 'high',
          metadata: { processingTime: 1000, model: 'test', retryCount: 0 },
          rawData: {}
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('insights must be an array');
    });

    it('should reject invalid confidence values', async () => {
      const { AgentFactory } = await import('../../src/agents/agent-factory.js');
      
      vi.mocked(AgentFactory.isAgentSupported).mockReturnValue(true);
      
      const mockAgent = {
        execute: vi.fn().mockResolvedValue({
          agentType: 'market-research',
          score: 80,
          insights: ['Test'],
          confidence: 'invalid', // Invalid confidence
          metadata: { processingTime: 1000, model: 'test', retryCount: 0 },
          rawData: {}
        })
      };
      
      vi.mocked(AgentFactory.getAgent).mockReturnValue(mockAgent as any);

      const result = await agentService.executeAgent(
        'market-research',
        mockRequest,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('confidence must be high, medium, or low');
    });
  });
});