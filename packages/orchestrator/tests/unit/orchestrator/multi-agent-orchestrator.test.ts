/**
 * MultiAgentOrchestrator Unit Tests - Testing workflow management and parallel execution coordination
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { MultiAgentOrchestrator } from '../../../src/orchestrator/multi-agent-orchestrator.js';
import { DependencyEngine } from '../../../src/orchestrator/dependency-engine.js';
import { ResultAggregator } from '../../../src/orchestrator/result-aggregator.js';
import { MultiAgentQueueManager } from '../../../src/queue/multi-agent-queue-manager.js';
import { AgentRegistry } from '../../../src/agents/agent-registry.js';
import { AgentType } from '@ai-validation/shared';

// Mock dependencies
vi.mock('../../../src/orchestrator/dependency-engine.js');
vi.mock('../../../src/orchestrator/result-aggregator.js');
vi.mock('../../../src/queue/multi-agent-queue-manager.js');
vi.mock('../../../src/agents/agent-registry.js');

const MockDependencyEngine = vi.mocked(DependencyEngine);
const MockResultAggregator = vi.mocked(ResultAggregator);
const MockMultiAgentQueueManager = vi.mocked(MultiAgentQueueManager);
const MockAgentRegistry = vi.mocked(AgentRegistry);

describe('MultiAgentOrchestrator', () => {
  let orchestrator: MultiAgentOrchestrator;
  let mockDependencyEngine: any;
  let mockResultAggregator: any;
  let mockQueueManager: any;
  let mockAgentRegistry: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock instances
    mockDependencyEngine = {
      buildDependencyGraph: vi.fn(),
      getReadyAgents: vi.fn(),
      calculateCriticalPath: vi.fn(),
      optimizeExecutionOrder: vi.fn()
    };
    MockDependencyEngine.getInstance.mockReturnValue(mockDependencyEngine);

    mockResultAggregator = {
      aggregateResults: vi.fn(),
      validateResults: vi.fn(),
      calculateConfidence: vi.fn()
    };
    MockResultAggregator.getInstance.mockReturnValue(mockResultAggregator);

    mockQueueManager = {
      addMultiAgentEvaluation: vi.fn(),
      addAgentExecution: vi.fn(),
      getQueueMetrics: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    };
    MockMultiAgentQueueManager.getInstance.mockReturnValue(mockQueueManager);

    mockAgentRegistry = {
      getAllRegisteredAgents: vi.fn(),
      getParallelExecutionGroups: vi.fn(),
      validateDependencies: vi.fn(),
      isAgentAvailable: vi.fn()
    };
    MockAgentRegistry.getInstance.mockReturnValue(mockAgentRegistry);

    orchestrator = MultiAgentOrchestrator.getInstance();
  });

  afterEach(() => {
    MultiAgentOrchestrator.resetInstance();
  });

  describe('Workflow Execution', () => {
    test('should execute workflow with single agent', async () => {
      const businessIdea = {
        id: 'idea-123',
        title: 'Test Business Idea',
        description: 'A revolutionary new concept'
      };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-123',
        'eval-123',
        businessIdea
      );

      expect(workflowId).toBe('workflow-job-123');
      expect(mockQueueManager.addMultiAgentEvaluation).toHaveBeenCalledWith({
        evaluationId: 'eval-123',
        workflowId: 'workflow-123',
        agentTypes: ['market-research'],
        parallelGroups: [['market-research']],
        dependencies: expect.any(Object),
        priority: 'medium',
        timeout: 1800000,
        businessIdea,
        context: expect.any(Object)
      });
    });

    test('should execute workflow with multiple parallel agents', async () => {
      const businessIdea = {
        id: 'idea-123',
        title: 'Test Business Idea',
        description: 'A revolutionary new concept'
      };

      const agentTypes: AgentType[] = ['market-research', 'competitive-analysis', 'customer-research'];
      const parallelGroups: AgentType[][] = [
        ['market-research'],
        ['competitive-analysis', 'customer-research']
      ];

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(agentTypes);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue(parallelGroups);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: agentTypes,
        edges: [
          { from: 'market-research', to: 'competitive-analysis' },
          { from: 'market-research', to: 'customer-research' }
        ],
        levels: parallelGroups
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-123',
        'eval-123',
        businessIdea
      );

      expect(workflowId).toBe('workflow-job-123');
      expect(mockQueueManager.addMultiAgentEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          agentTypes,
          parallelGroups,
          businessIdea
        })
      );
    });

    test('should handle dependency validation failures', async () => {
      const businessIdea = {
        id: 'idea-123',
        title: 'Test Business Idea', 
        description: 'A revolutionary new concept'
      };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['competitive-analysis']);
      mockAgentRegistry.validateDependencies.mockReturnValue({
        valid: false,
        issues: ['Missing dependency: market-research required by competitive-analysis']
      });

      await expect(
        orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea)
      ).rejects.toThrow('Dependency validation failed');
    });

    test('should handle workflow execution with custom priority and timeout', async () => {
      const businessIdea = {
        id: 'idea-123',
        title: 'Urgent Business Idea',
        description: 'Time-sensitive concept'
      };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      const workflowId = await orchestrator.executeWorkflow(
        'workflow-123',
        'eval-123',
        businessIdea,
        {
          requiredAgents: ['market-research'],
          priority: 'high',
          timeout: 600000,
          context: { urgent: true }
        }
      );

      expect(mockQueueManager.addMultiAgentEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
          timeout: 600000,
          context: expect.objectContaining({ urgent: true })
        })
      );
    });
  });

  describe('Dependency Graph Building', () => {
    test('should build dependency graph for all available agents', () => {
      const allAgents: AgentType[] = [
        'market-research',
        'competitive-analysis', 
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: allAgents,
        edges: [
          { from: 'market-research', to: 'competitive-analysis' },
          { from: 'market-research', to: 'customer-research' },
          { from: 'competitive-analysis', to: 'financial-analysis' },
          { from: 'customer-research', to: 'financial-analysis' }
        ],
        levels: [
          ['market-research', 'technical-feasibility'],
          ['competitive-analysis', 'customer-research'],
          ['financial-analysis']
        ]
      });

      const graph = orchestrator.buildDependencyGraph(allAgents);

      expect(mockDependencyEngine.buildDependencyGraph).toHaveBeenCalledWith(allAgents);
      expect(graph.nodes).toHaveLength(5);
      expect(graph.levels).toHaveLength(3);
    });

    test('should build dependency graph for subset of agents', () => {
      const selectedAgents: AgentType[] = ['market-research', 'competitive-analysis'];

      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: selectedAgents,
        edges: [{ from: 'market-research', to: 'competitive-analysis' }],
        levels: [['market-research'], ['competitive-analysis']]
      });

      const graph = orchestrator.buildDependencyGraph(selectedAgents);

      expect(mockDependencyEngine.buildDependencyGraph).toHaveBeenCalledWith(selectedAgents);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.levels).toHaveLength(2);
    });
  });

  describe('Workflow State Management', () => {
    test('should track active workflows', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      await orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea);

      const activeWorkflows = orchestrator.getActiveWorkflows();
      expect(activeWorkflows).toContain('workflow-123');
    });

    test('should get workflow status', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      await orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea);

      const status = orchestrator.getWorkflowStatus('workflow-123');
      expect(status).toBeDefined();
      expect(status?.workflowId).toBe('workflow-123');
      expect(status?.evaluationId).toBe('eval-123');
      expect(status?.status).toBe('running');
      expect(status?.agentTypes).toContain('market-research');
    });

    test('should return undefined for non-existent workflow', () => {
      const status = orchestrator.getWorkflowStatus('non-existent');
      expect(status).toBeUndefined();
    });

    test('should cancel workflow', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      await orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea);

      const result = await orchestrator.cancelWorkflow('workflow-123');
      expect(result).toBe(true);

      const status = orchestrator.getWorkflowStatus('workflow-123');
      expect(status?.status).toBe('cancelled');
    });

    test('should return false when cancelling non-existent workflow', async () => {
      const result = await orchestrator.cancelWorkflow('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Event Handling', () => {
    test('should emit workflow started event', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('workflowStarted', eventSpy);

      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      await orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea);

      expect(eventSpy).toHaveBeenCalledWith({
        workflowId: 'workflow-123',
        evaluationId: 'eval-123',
        jobId: 'workflow-job-123',
        agentTypes: ['market-research'],
        startedAt: expect.any(Date)
      });
    });

    test('should handle queue manager events', () => {
      // Verify event listeners are set up on queue manager
      expect(mockQueueManager.on).toHaveBeenCalledWith('evaluationCompleted', expect.any(Function));
      expect(mockQueueManager.on).toHaveBeenCalledWith('evaluationFailed', expect.any(Function));
      expect(mockQueueManager.on).toHaveBeenCalledWith('agentExecutionCompleted', expect.any(Function));
      expect(mockQueueManager.on).toHaveBeenCalledWith('agentExecutionFailed', expect.any(Function));
    });

    test('should emit workflow completed event when evaluation completes', () => {
      const eventSpy = vi.fn();
      orchestrator.on('workflowCompleted', eventSpy);

      // Get the event handler that was registered with the queue manager
      const onEvaluationCompleted = mockQueueManager.on.mock.calls
        .find(call => call[0] === 'evaluationCompleted')?.[1];

      expect(onEvaluationCompleted).toBeDefined();

      // Simulate evaluation completion
      onEvaluationCompleted({ jobId: 'workflow-job-123' });

      expect(eventSpy).toHaveBeenCalled();
    });

    test('should emit workflow failed event when evaluation fails', () => {
      const eventSpy = vi.fn();
      orchestrator.on('workflowFailed', eventSpy);

      // Get the event handler that was registered with the queue manager
      const onEvaluationFailed = mockQueueManager.on.mock.calls
        .find(call => call[0] === 'evaluationFailed')?.[1];

      expect(onEvaluationFailed).toBeDefined();

      // Simulate evaluation failure
      const error = new Error('Evaluation failed');
      onEvaluationFailed({ jobId: 'workflow-job-123', error });

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    test('should optimize execution order based on dependencies', () => {
      const agentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'financial-analysis'
      ];

      const originalGraph = {
        nodes: agentTypes,
        edges: [
          { from: 'market-research', to: 'competitive-analysis' },
          { from: 'market-research', to: 'customer-research' },
          { from: 'competitive-analysis', to: 'financial-analysis' },
          { from: 'customer-research', to: 'financial-analysis' }
        ],
        levels: [
          ['market-research'],
          ['competitive-analysis', 'customer-research'],
          ['financial-analysis']
        ]
      };

      const optimizedGraph = {
        ...originalGraph,
        criticalPath: ['market-research', 'competitive-analysis', 'financial-analysis'],
        estimatedDuration: 15000
      };

      mockDependencyEngine.buildDependencyGraph.mockReturnValue(originalGraph);
      mockDependencyEngine.optimizeExecutionOrder.mockReturnValue(optimizedGraph);

      const result = orchestrator.optimizeWorkflowExecution(agentTypes);

      expect(mockDependencyEngine.optimizeExecutionOrder).toHaveBeenCalledWith(originalGraph);
      expect(result).toEqual(optimizedGraph);
    });

    test('should calculate critical path for complex workflows', () => {
      const agentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      const graph = {
        nodes: agentTypes,
        edges: [
          { from: 'market-research', to: 'competitive-analysis' },
          { from: 'market-research', to: 'customer-research' },
          { from: 'competitive-analysis', to: 'financial-analysis' },
          { from: 'customer-research', to: 'financial-analysis' }
        ],
        levels: [
          ['market-research', 'technical-feasibility'],
          ['competitive-analysis', 'customer-research'],
          ['financial-analysis']
        ]
      };

      mockDependencyEngine.buildDependencyGraph.mockReturnValue(graph);
      mockDependencyEngine.calculateCriticalPath.mockReturnValue({
        path: ['market-research', 'competitive-analysis', 'financial-analysis'],
        duration: 18000
      });

      const criticalPath = orchestrator.calculateCriticalPath(agentTypes);

      expect(mockDependencyEngine.calculateCriticalPath).toHaveBeenCalledWith(graph);
      expect(criticalPath.path).toContain('market-research');
      expect(criticalPath.path).toContain('financial-analysis');
      expect(criticalPath.duration).toBe(18000);
    });
  });

  describe('Error Handling', () => {
    test('should handle queue manager failures', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockRejectedValue(new Error('Queue unavailable'));

      await expect(
        orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea)
      ).rejects.toThrow('Queue unavailable');
    });

    test('should handle agent registry failures', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockImplementation(() => {
        throw new Error('Registry unavailable');
      });

      await expect(
        orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea)
      ).rejects.toThrow('Registry unavailable');
    });

    test('should handle dependency engine failures', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };
      const agentTypes: AgentType[] = ['market-research'];

      mockDependencyEngine.buildDependencyGraph.mockImplementation(() => {
        throw new Error('Dependency engine error');
      });

      await expect(
        orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea, {
          requiredAgents: agentTypes
        })
      ).rejects.toThrow('Dependency engine error');
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should get orchestrator statistics', () => {
      const stats = orchestrator.getStatistics();

      expect(stats).toHaveProperty('totalWorkflows');
      expect(stats).toHaveProperty('activeWorkflows');
      expect(stats).toHaveProperty('completedWorkflows');
      expect(stats).toHaveProperty('failedWorkflows');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats.totalWorkflows).toBe(0);
      expect(stats.activeWorkflows).toBe(0);
    });

    test('should track workflow statistics', async () => {
      const businessIdea = { id: 'idea-123', title: 'Test', description: 'Test' };

      mockAgentRegistry.getAllRegisteredAgents.mockReturnValue(['market-research']);
      mockAgentRegistry.getParallelExecutionGroups.mockReturnValue([['market-research']]);
      mockAgentRegistry.validateDependencies.mockReturnValue({ valid: true, issues: [] });
      mockDependencyEngine.buildDependencyGraph.mockReturnValue({
        nodes: ['market-research'],
        edges: [],
        levels: [['market-research']]
      });
      mockQueueManager.addMultiAgentEvaluation.mockResolvedValue('workflow-job-123');

      await orchestrator.executeWorkflow('workflow-123', 'eval-123', businessIdea);

      const stats = orchestrator.getStatistics();
      expect(stats.totalWorkflows).toBe(1);
      expect(stats.activeWorkflows).toBe(1);
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = MultiAgentOrchestrator.getInstance();
      const instance2 = MultiAgentOrchestrator.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should reset instance for testing', () => {
      const instance1 = MultiAgentOrchestrator.getInstance();
      MultiAgentOrchestrator.resetInstance();
      const instance2 = MultiAgentOrchestrator.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});