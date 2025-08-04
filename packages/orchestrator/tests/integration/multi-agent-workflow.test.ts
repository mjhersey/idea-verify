/**
 * Multi-Agent Workflow Integration Tests - Testing end-to-end workflow execution
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiAgentOrchestrator } from '../../src/orchestrator/multi-agent-orchestrator.js';
import { MultiAgentQueueManager } from '../../src/queue/multi-agent-queue-manager.js';
import { AgentRegistry } from '../../src/agents/agent-registry.js';
import { DependencyEngine } from '../../src/orchestrator/dependency-engine.js';
import { ResultAggregator } from '../../src/orchestrator/result-aggregator.js';
import { ErrorHandler } from '../../src/orchestrator/error-handler.js';
import { AgentHealthMonitor } from '../../src/monitoring/agent-health-monitor.js';
import { MessageRouter } from '../../src/communication/message-router.js';
import { BaseAgent } from '../../src/agents/types.js';
import { AgentType } from '@ai-validation/shared';

// Mock agent implementations for integration testing
class IntegrationTestAgent extends BaseAgent {
  private agentType: AgentType;
  private dependencies: AgentType[];
  private executionDelay: number;
  private failureRate: number;

  constructor(
    type: AgentType, 
    deps: AgentType[] = [], 
    delay: number = 1000,
    failureRate: number = 0
  ) {
    super();
    this.agentType = type;
    this.dependencies = deps;
    this.executionDelay = delay;
    this.failureRate = failureRate;
  }

  getName(): string {
    return `Integration Test ${this.agentType} Agent`;
  }

  getDescription(): string {
    return `Integration test agent for ${this.agentType}`;
  }

  getCapabilities() {
    return {
      name: this.agentType,
      version: '1.0.0-test',
      dependencies: this.dependencies,
      provides: [`${this.agentType}-analysis`],
      requires: this.dependencies.map(dep => `${dep}-data`)
    };
  }

  async initialize(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async cleanup(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async healthCheck() {
    return {
      agentType: this.agentType,
      version: '1.0.0-test',
      status: 'healthy' as const,
      lastActivity: new Date(),
      resourceUsage: {
        cpu: Math.random() * 0.5,
        memory: 0.3 + Math.random() * 0.2,
        responseTime: this.executionDelay
      },
      healthStatus: 'healthy' as const,
      capabilities: this.getCapabilities()
    };
  }

  async execute(request: any, context: any) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, this.executionDelay));

    // Simulate failures based on failure rate
    if (Math.random() < this.failureRate) {
      throw new Error(`Simulated failure in ${this.agentType} agent`);
    }

    // Generate mock response based on agent type
    const baseScore = 70 + Math.random() * 25;
    const response = {
      score: Math.round(baseScore),
      confidence: baseScore > 85 ? 'high' : baseScore > 70 ? 'medium' : 'low' as const,
      insights: [
        `${this.agentType} analysis completed successfully`,
        `Key finding from ${this.agentType} agent`,
        `Recommendation based on ${this.agentType} data`
      ],
      recommendations: [
        `Primary recommendation from ${this.agentType}`,
        `Secondary suggestion from ${this.agentType}`
      ],
      metadata: {
        processingTime: this.executionDelay,
        model: 'integration-test-model',
        retryCount: 0,
        dependencies: this.dependencies.map(dep => `${dep}-data`)
      },
      rawData: {
        agentType: this.agentType,
        processingTime: this.executionDelay,
        dependencyData: this.dependencies.reduce((acc, dep) => {
          acc[dep] = { processed: true, score: Math.random() * 100 };
          return acc;
        }, {} as Record<string, any>)
      }
    };

    return response;
  }
}

describe('Multi-Agent Workflow Integration Tests', () => {
  let orchestrator: MultiAgentOrchestrator;
  let queueManager: MultiAgentQueueManager;
  let agentRegistry: AgentRegistry;
  let dependencyEngine: DependencyEngine;
  let resultAggregator: ResultAggregator;
  let errorHandler: ErrorHandler;
  let healthMonitor: AgentHealthMonitor;
  let messageRouter: MessageRouter;

  const testAgents = {
    'market-research': new IntegrationTestAgent('market-research', [], 800),
    'competitive-analysis': new IntegrationTestAgent('competitive-analysis', ['market-research'], 1200),
    'customer-research': new IntegrationTestAgent('customer-research', ['market-research'], 1000),
    'technical-feasibility': new IntegrationTestAgent('technical-feasibility', [], 1500),
    'financial-analysis': new IntegrationTestAgent('financial-analysis', ['competitive-analysis', 'customer-research'], 1800)
  };

  beforeEach(async () => {
    // Reset all singletons
    MultiAgentOrchestrator.resetInstance();
    MultiAgentQueueManager.resetInstance();
    AgentRegistry.resetInstance();
    DependencyEngine.resetInstance();
    ResultAggregator.resetInstance();
    ErrorHandler.resetInstance();
    AgentHealthMonitor.resetInstance();
    MessageRouter.resetInstance();

    // Initialize components
    orchestrator = MultiAgentOrchestrator.getInstance();
    queueManager = MultiAgentQueueManager.getInstance();
    agentRegistry = AgentRegistry.getInstance();
    dependencyEngine = DependencyEngine.getInstance();
    resultAggregator = ResultAggregator.getInstance();
    errorHandler = ErrorHandler.getInstance();
    healthMonitor = AgentHealthMonitor.getInstance();
    messageRouter = MessageRouter.getInstance();

    // Initialize queue manager (using mock queues for integration tests)
    await queueManager.initialize();

    // Register test agents
    for (const [agentType, agent] of Object.entries(testAgents)) {
      await agentRegistry.registerAgent(agent);
    }

    // Start health monitoring
    await healthMonitor.startMonitoring({
      healthCheckInterval: 5000,
      metricsInterval: 2000
    });
  });

  afterEach(async () => {
    // Cleanup
    await healthMonitor.stopMonitoring();
    await queueManager.shutdown();
    
    // Reset instances
    MultiAgentOrchestrator.resetInstance();
    MultiAgentQueueManager.resetInstance();
    AgentRegistry.resetInstance();
    DependencyEngine.resetInstance();
    ResultAggregator.resetInstance();
    ErrorHandler.resetInstance();
    AgentHealthMonitor.resetInstance();
    MessageRouter.resetInstance();
  });

  describe('Single Agent Workflow', () => {
    test('should execute workflow with single independent agent', async () => {
      const businessIdea = {
        id: 'idea-001',
        title: 'AI-Powered Personal Assistant',
        description: 'An intelligent assistant that helps users manage their daily tasks'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-001',
        'eval-001',
        businessIdea,
        {
          requiredAgents: ['market-research'],
          priority: 'high',
          timeout: 30000
        }
      );

      expect(workflowId).toBeDefined();
      expect(typeof workflowId).toBe('string');

      // Verify workflow is tracked
      const activeWorkflows = orchestrator.getActiveWorkflows();
      expect(activeWorkflows).toContain('workflow-001');

      // Verify workflow status
      const status = orchestrator.getWorkflowStatus('workflow-001');
      expect(status).toBeDefined();
      expect(status?.workflowId).toBe('workflow-001');
      expect(status?.evaluationId).toBe('eval-001');
      expect(status?.status).toBe('running');
      expect(status?.agentTypes).toContain('market-research');
    });

    test('should handle agent execution timeout', async () => {
      // Create agent with long execution time
      const slowAgent = new IntegrationTestAgent('market-research', [], 35000); // 35 seconds
      await agentRegistry.unregisterAgent('market-research');
      await agentRegistry.registerAgent(slowAgent);

      const businessIdea = {
        id: 'idea-002',
        title: 'Slow Processing Business',
        description: 'A business that requires long processing time'
      };

      await expect(
        orchestrator.executeWorkflow(
          'workflow-002',
          'eval-002',
          businessIdea,
          {
            requiredAgents: ['market-research'],
            timeout: 30000 // 30 second timeout
          }
        )
      ).rejects.toThrow();
    });
  });

  describe('Multi-Agent Parallel Workflow', () => {
    test('should execute workflow with independent parallel agents', async () => {
      const businessIdea = {
        id: 'idea-003',
        title: 'Multi-Service Platform',
        description: 'A platform offering multiple independent services'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-003',
        'eval-003',
        businessIdea,
        {
          requiredAgents: ['market-research', 'technical-feasibility'],
          priority: 'medium'
        }
      );

      expect(workflowId).toBeDefined();

      // Verify both agents are in the workflow
      const status = orchestrator.getWorkflowStatus('workflow-003');
      expect(status?.agentTypes).toContain('market-research');
      expect(status?.agentTypes).toContain('technical-feasibility');

      // Verify dependency graph shows parallel execution
      const graph = orchestrator.buildDependencyGraph(['market-research', 'technical-feasibility']);
      expect(graph.levels[0]).toContain('market-research');
      expect(graph.levels[0]).toContain('technical-feasibility');
      expect(graph.levels).toHaveLength(1); // Single level = parallel execution
    });

    test('should execute workflow with complex dependency chain', async () => {
      const businessIdea = {
        id: 'idea-004',
        title: 'Complex Business Model',
        description: 'A business requiring comprehensive analysis across all dimensions'
      };

      const allAgents: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-004',
        'eval-004',
        businessIdea,
        {
          requiredAgents: allAgents,
          priority: 'high'
        }
      );

      expect(workflowId).toBeDefined();

      // Verify complex dependency structure
      const graph = orchestrator.buildDependencyGraph(allAgents);
      expect(graph.nodes).toHaveLength(5);
      expect(graph.levels).toHaveLength(3);
      
      // First level: independent agents
      expect(graph.levels[0]).toContain('market-research');
      expect(graph.levels[0]).toContain('technical-feasibility');
      
      // Second level: agents depending on market-research
      expect(graph.levels[1]).toContain('competitive-analysis');
      expect(graph.levels[1]).toContain('customer-research');
      
      // Third level: agents depending on second level
      expect(graph.levels[2]).toContain('financial-analysis');
    });

    test('should handle partial agent failures gracefully', async () => {
      // Register agents with some failure rate
      const unreliableAgents = {
        'market-research': new IntegrationTestAgent('market-research', [], 1000, 0), // No failures
        'competitive-analysis': new IntegrationTestAgent('competitive-analysis', ['market-research'], 1000, 0.3), // 30% failure
        'customer-research': new IntegrationTestAgent('customer-research', ['market-research'], 1000, 0) // No failures
      };

      // Re-register agents with failure rates
      for (const [agentType, agent] of Object.entries(unreliableAgents)) {
        await agentRegistry.unregisterAgent(agentType as AgentType);
        await agentRegistry.registerAgent(agent);
      }

      const businessIdea = {
        id: 'idea-005',
        title: 'Resilient Business Model',
        description: 'A business model that should work despite some analysis failures'
      };

      const workflowPromise = orchestrator.executeWorkflow(
        'workflow-005',
        'eval-005',
        businessIdea,
        {
          requiredAgents: ['market-research', 'competitive-analysis', 'customer-research'],
          priority: 'medium'
        }
      );

      // Should not throw even if competitive-analysis fails
      const workflowId = await workflowPromise;
      expect(workflowId).toBeDefined();
    });
  });

  describe('Dependency Resolution', () => {
    test('should validate dependencies before execution', async () => {
      const businessIdea = {
        id: 'idea-006',
        title: 'Dependency Test Business',
        description: 'Testing dependency validation'
      };

      // Try to execute workflow with missing dependency
      await expect(
        orchestrator.executeWorkflow(
          'workflow-006',
          'eval-006',
          businessIdea,
          {
            requiredAgents: ['financial-analysis'], // Requires competitive-analysis and customer-research
            priority: 'medium'
          }
        )
      ).rejects.toThrow('Dependency validation failed');
    });

    test('should resolve dependencies correctly in execution order', async () => {
      const businessIdea = {
        id: 'idea-007',
        title: 'Ordered Execution Test',
        description: 'Testing correct dependency execution order'
      };

      const dependentAgents: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'financial-analysis'
      ];

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-007',
        'eval-007',
        businessIdea,
        {
          requiredAgents: dependentAgents
        }
      );

      expect(workflowId).toBeDefined();

      // Verify execution order through dependency graph
      const graph = orchestrator.buildDependencyGraph(dependentAgents);
      expect(graph.levels[0]).toContain('market-research');
      expect(graph.levels[1]).toContain('competitive-analysis');
      expect(graph.levels[2]).toContain('financial-analysis');
    });

    test('should calculate critical path correctly', async () => {
      const allAgents: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      const criticalPath = orchestrator.calculateCriticalPath(allAgents);
      
      expect(criticalPath).toBeDefined();
      expect(criticalPath.path).toContain('market-research');
      expect(criticalPath.path).toContain('financial-analysis');
      expect(criticalPath.duration).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle circuit breaker activation', async () => {
      // Create failing agent
      const failingAgent = new IntegrationTestAgent('market-research', [], 1000, 1.0); // 100% failure
      await agentRegistry.unregisterAgent('market-research');
      await agentRegistry.registerAgent(failingAgent);

      const businessIdea = {
        id: 'idea-008',
        title: 'Failure Test Business',
        description: 'Testing circuit breaker functionality'
      };

      // Try multiple executions to trigger circuit breaker
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        attempts.push(
          orchestrator.executeWorkflow(
            `workflow-008-${i}`,
            `eval-008-${i}`,
            businessIdea,
            {
              requiredAgents: ['market-research']
            }
          ).catch(error => error)
        );
      }

      const results = await Promise.all(attempts);
      
      // At least some should fail
      const failures = results.filter(result => result instanceof Error);
      expect(failures.length).toBeGreaterThan(0);

      // Check circuit breaker state
      expect(errorHandler.isCircuitBreakerOpen('market-research')).toBe(true);
    });

    test('should execute compensation actions on failures', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Create agent that throws specific error types
      const authFailingAgent = new IntegrationTestAgent('market-research', [], 1000, 1.0);
      vi.spyOn(authFailingAgent, 'execute').mockRejectedValue(new Error('Authentication failed: Invalid token'));
      
      await agentRegistry.unregisterAgent('market-research');
      await agentRegistry.registerAgent(authFailingAgent);

      const businessIdea = {
        id: 'idea-009',
        title: 'Auth Failure Test',
        description: 'Testing compensation actions'
      };

      try {
        await orchestrator.executeWorkflow(
          'workflow-009',
          'eval-009',
          businessIdea,
          {
            requiredAgents: ['market-research']
          }
        );
      } catch (error) {
        // Expected to fail
      }

      // Verify compensation actions were executed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Refreshing credentials')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Monitoring', () => {
    test('should collect performance metrics during execution', async () => {
      const businessIdea = {
        id: 'idea-010',
        title: 'Performance Test Business',
        description: 'Testing performance metrics collection'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-010',
        'eval-010',
        businessIdea,
        {
          requiredAgents: ['market-research', 'technical-feasibility']
        }
      );

      expect(workflowId).toBeDefined();

      // Allow some time for metrics collection
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify queue metrics
      const queueMetrics = await queueManager.getQueueMetrics();
      expect(queueMetrics).toBeDefined();
      expect(Object.keys(queueMetrics).length).toBeGreaterThan(0);

      // Verify health metrics
      const systemHealth = healthMonitor.getSystemHealth();
      expect(systemHealth.overall).toBeDefined();
      expect(systemHealth.details).toBeDefined();
      expect(systemHealth.agents.size).toBeGreaterThan(0);
    });

    test('should track agent health during workflow execution', async () => {
      const businessIdea = {
        id: 'idea-011',
        title: 'Health Monitoring Test',
        description: 'Testing agent health monitoring'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-011',
        'eval-011',
        businessIdea,
        {
          requiredAgents: ['market-research']
        }
      );

      expect(workflowId).toBeDefined();

      // Wait for health check cycle
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Verify agent health data
      const marketResearchHealth = healthMonitor.getAgentHealth('market-research');
      expect(marketResearchHealth).toBeDefined();
      expect(marketResearchHealth?.agentType).toBe('market-research');
      expect(marketResearchHealth?.status).toBe('healthy');
      expect(marketResearchHealth?.responseTime).toBeGreaterThan(0);
    });

    test('should optimize workflow execution based on performance data', async () => {
      const allAgents: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      const optimizedWorkflow = orchestrator.optimizeWorkflowExecution(allAgents);
      
      expect(optimizedWorkflow).toBeDefined();
      expect(optimizedWorkflow.nodes).toHaveLength(5);
      expect(optimizedWorkflow.levels).toBeDefined();
      expect(optimizedWorkflow.criticalPath).toBeDefined();
      expect(optimizedWorkflow.estimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('Result Aggregation', () => {
    test('should aggregate results from multiple agents', async () => {
      const businessIdea = {
        id: 'idea-012',
        title: 'Result Aggregation Test',
        description: 'Testing result aggregation from multiple agents'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-012',
        'eval-012',
        businessIdea,
        {
          requiredAgents: ['market-research', 'customer-research', 'technical-feasibility']
        }
      );

      expect(workflowId).toBeDefined();

      // Simulate agent completion and result aggregation
      // In real implementation, this would be handled by the queue system
      const mockResults = [
        {
          agentType: 'market-research' as AgentType,
          score: 85,
          confidence: 'high' as const,
          insights: ['Market opportunity exists'],
          recommendations: ['Focus on target market'],
          metadata: { processingTime: 1000, model: 'test', retryCount: 0 },
          rawData: { marketSize: 1000000 }
        },
        {
          agentType: 'customer-research' as AgentType,
          score: 78,
          confidence: 'medium' as const,
          insights: ['Customer validation needed'],
          recommendations: ['Conduct user interviews'],
          metadata: { processingTime: 1200, model: 'test', retryCount: 0 },
          rawData: { customerSegments: ['segment1', 'segment2'] }
        },
        {
          agentType: 'technical-feasibility' as AgentType,
          score: 92,
          confidence: 'high' as const,
          insights: ['Technically feasible with current technology'],
          recommendations: ['Use proven technology stack'],
          metadata: { processingTime: 1500, model: 'test', retryCount: 0 },
          rawData: { techStack: ['react', 'node', 'postgres'] }
        }
      ];

      const aggregatedResult = await resultAggregator.aggregateResults(
        'eval-012',
        mockResults,
        'weighted'
      );

      expect(aggregatedResult).toBeDefined();
      expect(aggregatedResult.evaluationId).toBe('eval-012');
      expect(aggregatedResult.overallScore).toBeGreaterThan(0);
      expect(aggregatedResult.overallScore).toBeLessThanOrEqual(100);
      expect(aggregatedResult.confidence).toBeDefined();
      expect(aggregatedResult.agentResults).toHaveLength(3);
    });
  });

  describe('Workflow State Management', () => {
    test('should track workflow state throughout execution', async () => {
      const businessIdea = {
        id: 'idea-013',
        title: 'State Management Test',
        description: 'Testing workflow state tracking'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-013',
        'eval-013',
        businessIdea,
        {
          requiredAgents: ['market-research']
        }
      );

      // Verify initial state
      const initialStatus = orchestrator.getWorkflowStatus('workflow-013');
      expect(initialStatus?.status).toBe('running');
      expect(initialStatus?.startedAt).toBeInstanceOf(Date);

      // Verify workflow is in active list
      const activeWorkflows = orchestrator.getActiveWorkflows();
      expect(activeWorkflows).toContain('workflow-013');

      // Test workflow cancellation
      const cancelled = await orchestrator.cancelWorkflow('workflow-013');
      expect(cancelled).toBe(true);

      const cancelledStatus = orchestrator.getWorkflowStatus('workflow-013');
      expect(cancelledStatus?.status).toBe('cancelled');
    });

    test('should maintain workflow statistics', async () => {
      const businessIdea = {
        id: 'idea-014',
        title: 'Statistics Test',
        description: 'Testing workflow statistics'
      };

      const initialStats = orchestrator.getStatistics();
      const initialTotal = initialStats.totalWorkflows;

      await orchestrator.executeWorkflow(
        'workflow-014',
        'eval-014',
        businessIdea,
        {
          requiredAgents: ['market-research']
        }
      );

      const updatedStats = orchestrator.getStatistics();
      expect(updatedStats.totalWorkflows).toBe(initialTotal + 1);
      expect(updatedStats.activeWorkflows).toBeGreaterThan(0);
    });
  });

  describe('Event-Driven Communication', () => {
    test('should emit workflow lifecycle events', async () => {
      const startedSpy = vi.fn();
      const completedSpy = vi.fn();
      
      orchestrator.on('workflowStarted', startedSpy);
      orchestrator.on('workflowCompleted', completedSpy);

      const businessIdea = {
        id: 'idea-015',
        title: 'Event Test Business',
        description: 'Testing workflow event emission'
      };

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-015',
        'eval-015',
        businessIdea,
        {
          requiredAgents: ['market-research']
        }
      );

      expect(startedSpy).toHaveBeenCalledWith({
        workflowId: 'workflow-015',
        evaluationId: 'eval-015',
        jobId: workflowId,
        agentTypes: ['market-research'],
        startedAt: expect.any(Date)
      });

      // Note: Completion event would be triggered by queue manager in real implementation
    });

    test('should handle message routing between components', async () => {
      const businessIdea = {
        id: 'idea-016',
        title: 'Message Routing Test',
        description: 'Testing message routing functionality'
      };

      // Add routing rule for test messages
      messageRouter.addRoutingRule({
        id: 'test-rule',
        pattern: { type: 'test-message' },
        destinations: ['test-destination'],
        priority: 1,
        enabled: true
      });

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-016',
        'eval-016',
        businessIdea,
        {
          requiredAgents: ['market-research']
        }
      );

      expect(workflowId).toBeDefined();

      // Verify message router is properly initialized
      const routingRules = messageRouter.getActiveRules();
      expect(routingRules.some(rule => rule.id === 'test-rule')).toBe(true);
    });
  });
});