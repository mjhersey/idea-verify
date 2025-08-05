/**
 * AgentRegistry Unit Tests - Testing agent discovery and dependency management
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentRegistry } from '../../../src/agents/agent-registry.js';
import { BaseAgent } from '../../../src/agents/types.js';
import { AgentType } from '@ai-validation/shared';

// Mock agent implementation for testing
class MockAgent extends BaseAgent {
  private agentType: AgentType;
  private dependencies: AgentType[];
  private capabilities: string[];

  constructor(type: AgentType, deps: AgentType[] = [], caps: string[] = []) {
    super();
    this.agentType = type;
    this.dependencies = deps;
    this.capabilities = caps;
  }

  getName(): string {
    return `Mock ${this.agentType} Agent`;
  }

  getDescription(): string {
    return `Mock agent for ${this.agentType}`;
  }

  defineCapabilities() {
    return {
      name: this.agentType,
      version: '1.0.0',
      dependencies: this.dependencies || [],
      provides: this.capabilities || [],
      requires: (this.dependencies || []).map(dep => `${dep}-data`)
    };
  }

  getCapabilities() {
    return this.defineCapabilities();
  }

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }

  async healthCheck() {
    return {
      agentType: this.agentType,
      version: '1.0.0',
      status: 'healthy' as const,
      lastActivity: new Date(),
      resourceUsage: {
        cpu: 0.1,
        memory: 0.2,
        responseTime: 100
      },
      healthStatus: 'healthy' as const,
      capabilities: this.getCapabilities()
    };
  }

  async execute() {
    return {
      score: 85,
      confidence: 'high' as const,
      insights: ['Mock insight'],
      recommendations: ['Mock recommendation'],
      metadata: { processingTime: 1000, model: 'mock', retryCount: 0 },
      rawData: { mockData: true }
    };
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    // Reset singleton instance for each test
    AgentRegistry.resetInstance();
    registry = AgentRegistry.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Registration', () => {
    test('should register a single agent successfully', async () => {
      const mockAgent = new MockAgent('market-research');
      
      await registry.registerAgent(mockAgent);
      
      const registeredAgents = registry.getAllRegisteredAgents();
      expect(registeredAgents).toContain('market-research');
      expect(registeredAgents).toHaveLength(1);
    });

    test('should register multiple agents with different types', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis'),
        new MockAgent('customer-research')
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const registeredAgents = registry.getAllRegisteredAgents();
      expect(registeredAgents).toHaveLength(3);
      expect(registeredAgents).toContain('market-research');
      expect(registeredAgents).toContain('competitive-analysis');
      expect(registeredAgents).toContain('customer-research');
    });

    test('should prevent duplicate agent registration', async () => {
      const agent1 = new MockAgent('market-research');
      const agent2 = new MockAgent('market-research');

      await registry.registerAgent(agent1);
      await expect(registry.registerAgent(agent2)).rejects.toThrow('Agent market-research is already registered');
    });

    test('should unregister agent successfully', async () => {
      const mockAgent = new MockAgent('market-research');
      
      await registry.registerAgent(mockAgent);
      expect(registry.getAllRegisteredAgents()).toContain('market-research');
      
      const result = await registry.unregisterAgent('market-research');
      expect(result).toBe(true);
      expect(registry.getAllRegisteredAgents()).not.toContain('market-research');
    });

    test('should return false when unregistering non-existent agent', async () => {
      const result = await registry.unregisterAgent('non-existent' as AgentType);
      expect(result).toBe(false);
    });
  });

  describe('Agent Metadata', () => {
    test('should retrieve agent metadata', async () => {
      const mockAgent = new MockAgent('market-research', [], ['market-analysis']);
      await registry.registerAgent(mockAgent);

      const metadata = registry.getAgentMetadata('market-research');
      expect(metadata).toBeDefined();
      expect(metadata?.agentType).toBe('market-research');
      expect(metadata?.status).toBe('healthy');
      expect(metadata?.capabilities.provides).toContain('market-analysis');
    });

    test('should return undefined for non-existent agent', () => {
      const metadata = registry.getAgentMetadata('non-existent' as AgentType);
      expect(metadata).toBeUndefined();
    });

    test('should update agent metadata after health check', async () => {
      const mockAgent = new MockAgent('market-research');
      await registry.registerAgent(mockAgent);

      // Perform health check
      await registry.performHealthCheck();

      const metadata = registry.getAgentMetadata('market-research');
      expect(metadata?.lastActivity).toBeInstanceOf(Date);
      expect(metadata?.resourceUsage).toBeDefined();
    });
  });

  describe('Dependency Management', () => {
    test('should build dependency graph with no dependencies', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis'),
        new MockAgent('customer-research')
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const graph = registry.getDependencyGraph();
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(0);
      expect(graph.levels).toHaveLength(1);
      expect(graph.levels[0]).toHaveLength(3);
    });

    test('should build dependency graph with linear dependencies', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis', ['market-research']),
        new MockAgent('financial-analysis', ['competitive-analysis'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const graph = registry.getDependencyGraph();
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2);
      expect(graph.levels).toHaveLength(3);
      expect(graph.levels[0]).toContain('market-research');
      expect(graph.levels[1]).toContain('competitive-analysis');
      expect(graph.levels[2]).toContain('financial-analysis');
    });

    test('should build dependency graph with complex dependencies', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis', ['market-research']),
        new MockAgent('customer-research', ['market-research']),
        new MockAgent('technical-feasibility'),
        new MockAgent('financial-analysis', ['competitive-analysis', 'customer-research'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const graph = registry.getDependencyGraph();
      expect(graph.nodes).toHaveLength(5);
      expect(graph.levels[0]).toContain('market-research');
      expect(graph.levels[0]).toContain('technical-feasibility');
      expect(graph.levels[1]).toContain('competitive-analysis');
      expect(graph.levels[1]).toContain('customer-research');
      expect(graph.levels[2]).toContain('financial-analysis');
    });

    test('should detect circular dependencies', async () => {
      const agents = [
        new MockAgent('market-research', ['financial-analysis']),
        new MockAgent('competitive-analysis', ['market-research']),
        new MockAgent('financial-analysis', ['competitive-analysis'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const validation = registry.validateDependencies();
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Circular dependency detected');
    });

    test('should validate dependencies successfully', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis', ['market-research']),
        new MockAgent('financial-analysis', ['competitive-analysis'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const validation = registry.validateDependencies();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should identify missing dependencies', async () => {
      const agents = [
        new MockAgent('competitive-analysis', ['market-research']),
        new MockAgent('financial-analysis', ['competitive-analysis'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const validation = registry.validateDependencies();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('market-research'))).toBe(true);
    });
  });

  describe('Parallel Execution Groups', () => {
    test('should generate parallel execution groups correctly', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis', ['market-research']),
        new MockAgent('customer-research', ['market-research']),
        new MockAgent('technical-feasibility'),
        new MockAgent('financial-analysis', ['competitive-analysis', 'customer-research'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const groups = registry.getParallelExecutionGroups();
      expect(groups).toHaveLength(3);
      
      // First group should have independent agents
      expect(groups[0]).toContain('market-research');
      expect(groups[0]).toContain('technical-feasibility');
      
      // Second group should have agents depending on first group
      expect(groups[1]).toContain('competitive-analysis');
      expect(groups[1]).toContain('customer-research');
      
      // Third group should have agents depending on second group
      expect(groups[2]).toContain('financial-analysis');
    });

    test('should handle single agent group', async () => {
      const agent = new MockAgent('market-research');
      await registry.registerAgent(agent);

      const groups = registry.getParallelExecutionGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0]).toContain('market-research');
    });
  });

  describe('Health Monitoring', () => {
    test('should perform health check on all registered agents', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis'),
        new MockAgent('customer-research')
      ];

      const healthCheckSpies = agents.map(agent => vi.spyOn(agent, 'healthCheck'));

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      await registry.performHealthCheck();

      healthCheckSpies.forEach(spy => {
        expect(spy).toHaveBeenCalledOnce();
      });
    });

    test('should handle health check failures gracefully', async () => {
      const healthyAgent = new MockAgent('market-research');
      const unhealthyAgent = new MockAgent('competitive-analysis');
      
      vi.spyOn(unhealthyAgent, 'healthCheck').mockRejectedValue(new Error('Health check failed'));

      await registry.registerAgent(healthyAgent);
      await registry.registerAgent(unhealthyAgent);

      await registry.performHealthCheck();

      const healthyMetadata = registry.getAgentMetadata('market-research');
      const unhealthyMetadata = registry.getAgentMetadata('competitive-analysis');

      expect(healthyMetadata?.status).toBe('healthy');
      expect(unhealthyMetadata?.status).toBe('unhealthy');
    });
  });

  describe('Agent Discovery', () => {
    test('should discover agents by capability', async () => {
      const agents = [
        new MockAgent('market-research', [], ['market-analysis', 'trend-analysis']),
        new MockAgent('competitive-analysis', [], ['competitor-analysis']),
        new MockAgent('customer-research', [], ['customer-analysis', 'survey-analysis'])
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const marketAgents = registry.findAgentsByCapability('market-analysis');
      const surveyAgents = registry.findAgentsByCapability('survey-analysis');
      const nonExistentAgents = registry.findAgentsByCapability('non-existent');

      expect(marketAgents).toContain('market-research');
      expect(surveyAgents).toContain('customer-research');
      expect(nonExistentAgents).toHaveLength(0);
    });

    test('should check agent availability', async () => {
      const agent = new MockAgent('market-research');
      await registry.registerAgent(agent);

      expect(registry.isAgentAvailable('market-research')).toBe(true);
      expect(registry.isAgentAvailable('non-existent' as AgentType)).toBe(false);
    });

    test('should get agent statistics', async () => {
      const agents = [
        new MockAgent('market-research'),
        new MockAgent('competitive-analysis'),
        new MockAgent('customer-research')
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const stats = registry.getRegistryStatistics();
      expect(stats.totalAgents).toBe(3);
      expect(stats.healthyAgents).toBe(3);
      expect(stats.unhealthyAgents).toBe(0);
      expect(stats.agentTypes).toContain('market-research');
      expect(stats.agentTypes).toContain('competitive-analysis');
      expect(stats.agentTypes).toContain('customer-research');
    });
  });

  describe('Event Handling', () => {
    test('should emit events on agent registration', async () => {
      const eventSpy = vi.fn();
      registry.on('agentRegistered', eventSpy);

      const agent = new MockAgent('market-research');
      await registry.registerAgent(agent);

      expect(eventSpy).toHaveBeenCalledWith({
        agentType: 'market-research',
        capabilities: agent.getCapabilities()
      });
    });

    test('should emit events on agent unregistration', async () => {
      const eventSpy = vi.fn();
      registry.on('agentUnregistered', eventSpy);

      const agent = new MockAgent('market-research');
      await registry.registerAgent(agent);
      await registry.unregisterAgent('market-research');

      expect(eventSpy).toHaveBeenCalledWith({
        agentType: 'market-research'
      });
    });

    test('should emit events on health check completion', async () => {
      const eventSpy = vi.fn();
      registry.on('healthCheckCompleted', eventSpy);

      const agent = new MockAgent('market-research');
      await registry.registerAgent(agent);
      await registry.performHealthCheck();

      expect(eventSpy).toHaveBeenCalledWith({
        totalAgents: 1,
        healthyAgents: 1,
        unhealthyAgents: 0,
        results: expect.any(Array)
      });
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = AgentRegistry.getInstance();
      const instance2 = AgentRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should reset instance for testing', () => {
      const instance1 = AgentRegistry.getInstance();
      AgentRegistry.resetInstance();
      const instance2 = AgentRegistry.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});