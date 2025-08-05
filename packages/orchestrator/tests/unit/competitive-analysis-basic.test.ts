/**
 * Basic Competitive Analysis Test
 * Tests the core competitive analysis agent functionality
 */

import { describe, it, expect } from 'vitest';
import { CompetitiveAnalysisAgent } from '../../src/agents/competitive-analysis-agent.js';
import { AgentRequest, AgentExecutionContext } from '../../src/agents/types.js';

describe('Competitive Analysis Agent', () => {
  let agent: CompetitiveAnalysisAgent;

  beforeEach(() => {
    agent = new CompetitiveAnalysisAgent();
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.getAgentType()).toBe('competitive-analysis');
    expect(agent.getName()).toBe('Competitive Analysis Agent');
  });

  it('should define enhanced capabilities', () => {
    const capabilities = agent.getCapabilities();
    expect(capabilities.version).toBe('2.0.0');
    expect(capabilities.provides).toContain('pricing-intelligence');
    expect(capabilities.provides).toContain('market-difficulty-scoring');
    expect(capabilities.provides).toContain('competitive-visualization');
    expect(capabilities.provides).toContain('opportunity-identification');
  });

  it('should validate business idea requirements', () => {
    const request: AgentRequest = {
      businessIdea: {
        id: 'test-id',
        title: 'Test Business',
        description: 'A test business idea'
      },
      analysisType: 'competitors'
    };

    expect(() => agent['validateRequest'](request)).not.toThrow();
  });

  it('should handle canHandle method correctly', () => {
    const validRequest: AgentRequest = {
      businessIdea: {
        id: 'test-id',
        title: 'Test Business',
        description: 'A test business idea'
      },
      analysisType: 'competitors'
    };

    const invalidRequest: AgentRequest = {
      businessIdea: {
        id: 'test-id',
        title: 'Test Business',
        description: 'A test business idea'
      },
      analysisType: 'invalid-type'
    };

    expect(agent.canHandle(validRequest)).toBe(true);
    expect(agent.canHandle(invalidRequest)).toBe(false);
  });

  it('should execute analysis successfully', async () => {
    const request: AgentRequest = {
      businessIdea: {
        id: 'test-id',
        title: 'AI-powered project management tool',
        description: 'A tool that uses AI to help teams manage projects more efficiently',
        targetMarket: 'Small to medium businesses',
        category: 'productivity'
      },
      analysisType: 'competitors'
    };

    const context: AgentExecutionContext = {
      evaluationId: 'test-eval',
      correlationId: 'test-corr',
      timestamp: new Date()
    };

    const response = await agent.execute(request, context);

    expect(response).toBeDefined();
    expect(response.agentType).toBe('competitive-analysis');
    expect(response.score).toBeGreaterThanOrEqual(0);
    expect(response.score).toBeLessThanOrEqual(100);
    expect(response.insights).toBeInstanceOf(Array);
    expect(response.confidence).toMatch(/^(high|medium|low)$/);
    expect(response.metadata.processingTime).toBeGreaterThan(0);
    expect(response.rawData).toBeDefined();
  }, 10000); // 10 second timeout for comprehensive analysis
});