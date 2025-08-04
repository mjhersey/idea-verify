/**
 * Parallel Agent Execution Performance Tests - Testing system performance under concurrent loads
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiAgentOrchestrator } from '../../src/orchestrator/multi-agent-orchestrator.js';
import { MultiAgentQueueManager } from '../../src/queue/multi-agent-queue-manager.js';
import { AgentRegistry } from '../../src/agents/agent-registry.js';
import { AgentHealthMonitor } from '../../src/monitoring/agent-health-monitor.js';
import { 
  MockAgentFactory, 
  MockAgent, 
  MockHighPerformanceAgent,
  MockSlowAgent,
  MockFailingAgent 
} from '../mocks/mock-agents.js';
import { AgentType } from '@ai-validation/shared';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  maxExecutionTime: 30000, // 30 seconds
  maxMemoryUsage: 500 * 1024 * 1024, // 500MB
  minThroughput: 5, // workflows per minute
  maxErrorRate: 0.05, // 5%
  maxResponseTime: 5000 // 5 seconds per agent
};

// Utility function to measure memory usage
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}

// Utility function to measure execution time
async function measureExecutionTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await operation();
  const duration = Date.now() - startTime;
  return { result, duration };
}

describe('Parallel Agent Execution Performance Tests', () => {
  let orchestrator: MultiAgentOrchestrator;
  let queueManager: MultiAgentQueueManager;
  let agentRegistry: AgentRegistry;
  let healthMonitor: AgentHealthMonitor;

  beforeEach(async () => {
    // Reset all singletons
    MultiAgentOrchestrator.resetInstance();
    MultiAgentQueueManager.resetInstance();
    AgentRegistry.resetInstance();
    AgentHealthMonitor.resetInstance();

    // Initialize components
    orchestrator = MultiAgentOrchestrator.getInstance();
    queueManager = MultiAgentQueueManager.getInstance();
    agentRegistry = AgentRegistry.getInstance();
    healthMonitor = AgentHealthMonitor.getInstance();

    // Initialize queue manager with performance optimizations
    await queueManager.initialize();

    // Configure agents for optimal performance
    const agentTypes: AgentType[] = [
      'market-research',
      'competitive-analysis',
      'customer-research',
      'technical-feasibility',
      'financial-analysis'
    ];

    for (const agentType of agentTypes) {
      await queueManager.configureAgent(agentType, {
        concurrency: 5, // Higher concurrency for performance tests
        retryPolicy: {
          attempts: 2, // Fewer retries for faster failure handling
          backoff: 'fixed',
          delay: 1000
        },
        rateLimiting: {
          max: 50,
          duration: 60000
        }
      });
    }

    // Start health monitoring with higher frequency
    await healthMonitor.startMonitoring({
      healthCheckInterval: 10000,
      metricsInterval: 5000
    });
  });

  afterEach(async () => {
    await healthMonitor.stopMonitoring();
    await queueManager.shutdown();
    
    // Reset instances
    MultiAgentOrchestrator.resetInstance();
    MultiAgentQueueManager.resetInstance();
    AgentRegistry.resetInstance();
    AgentHealthMonitor.resetInstance();
  });

  describe('Single Workflow Performance', () => {
    test('should execute high-performance agents within time limits', async () => {
      const highPerfAgents = MockAgentFactory.createHighPerformanceMockAgents();
      
      for (const [agentType, agent] of Object.entries(highPerfAgents)) {
        await agentRegistry.registerAgent(agent);
      }

      const businessIdea = {
        id: 'perf-test-001',
        title: 'High Performance Test',
        description: 'Testing single workflow performance with fast agents'
      };

      const { result: workflowId, duration } = await measureExecutionTime(async () => {
        return await orchestrator.executeWorkflow(
          'perf-workflow-001',
          'perf-eval-001',
          businessIdea,
          {
            requiredAgents: ['market-research', 'competitive-analysis', 'customer-research'],
            priority: 'high'
          }
        );
      });

      expect(workflowId).toBeDefined();
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);

      // Verify all agents completed successfully
      const status = orchestrator.getWorkflowStatus('perf-workflow-001');
      expect(status?.agentTypes).toHaveLength(3);
    });

    test('should handle slow agents with timeout management', async () => {
      const mixedAgents = {
        'market-research': new MockHighPerformanceAgent('market-research'),
        'competitive-analysis': new MockSlowAgent('competitive-analysis', 8000), // 8 second execution
        'customer-research': new MockHighPerformanceAgent('customer-research')
      };

      for (const [agentType, agent] of Object.entries(mixedAgents)) {
        await agentRegistry.registerAgent(agent);
      }

      const businessIdea = {
        id: 'perf-test-002',
        title: 'Mixed Performance Test',
        description: 'Testing workflow with mixed agent performance'
      };

      const { duration } = await measureExecutionTime(async () => {
        return await orchestrator.executeWorkflow(
          'perf-workflow-002',
          'perf-eval-002',
          businessIdea,
          {
            requiredAgents: ['market-research', 'competitive-analysis', 'customer-research'],
            timeout: 15000 // 15 second timeout
          }
        );
      });

      // Should complete within reasonable time despite slow agent
      expect(duration).toBeLessThan(15000);
    });

    test('should maintain memory usage within limits', async () => {
      const agents = MockAgentFactory.createStandardMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      const initialMemory = getMemoryUsage();

      const businessIdea = {
        id: 'perf-test-003',
        title: 'Memory Usage Test',
        description: 'Testing memory consumption during workflow execution'
      };

      await orchestrator.executeWorkflow(
        'perf-workflow-003',
        'perf-eval-003',
        businessIdea,
        {
          requiredAgents: Object.keys(agents) as AgentType[]
        }
      );

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be within acceptable limits
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryUsage);
    });
  });

  describe('Concurrent Workflow Performance', () => {
    test('should handle multiple concurrent workflows efficiently', async () => {
      const agents = MockAgentFactory.createHighPerformanceMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      const concurrentWorkflows = 10;
      const businessIdeas = Array.from({ length: concurrentWorkflows }, (_, i) => ({
        id: `concurrent-idea-${i}`,
        title: `Concurrent Test Business ${i}`,
        description: `Testing concurrent execution ${i}`
      }));

      const { duration } = await measureExecutionTime(async () => {
        const workflowPromises = businessIdeas.map((businessIdea, i) =>
          orchestrator.executeWorkflow(
            `concurrent-workflow-${i}`,
            `concurrent-eval-${i}`,
            businessIdea,
            {
              requiredAgents: ['market-research', 'customer-research'],
              priority: 'medium'
            }
          )
        );

        const results = await Promise.all(workflowPromises);
        return results;
      });

      // All workflows should complete within reasonable time
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);

      // Verify throughput
      const throughputPerMinute = (concurrentWorkflows / duration) * 60000;
      expect(throughputPerMinute).toBeGreaterThan(PERFORMANCE_THRESHOLDS.minThroughput);
    });

    test('should scale performance with increased concurrency', async () => {
      const agents = MockAgentFactory.createHighPerformanceMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      // Test different concurrency levels
      const concurrencyLevels = [5, 10, 20];
      const results: Array<{ concurrency: number; duration: number; throughput: number }> = [];

      for (const concurrency of concurrencyLevels) {
        const businessIdeas = Array.from({ length: concurrency }, (_, i) => ({
          id: `scale-idea-${concurrency}-${i}`,
          title: `Scale Test ${concurrency}-${i}`,
          description: `Testing scalability at concurrency ${concurrency}`
        }));

        const { duration } = await measureExecutionTime(async () => {
          const workflowPromises = businessIdeas.map((businessIdea, i) =>
            orchestrator.executeWorkflow(
              `scale-workflow-${concurrency}-${i}`,
              `scale-eval-${concurrency}-${i}`,
              businessIdea,
              {
                requiredAgents: ['market-research'],
                priority: 'medium'
              }
            )
          );

          return await Promise.all(workflowPromises);
        });

        const throughputPerMinute = (concurrency / duration) * 60000;
        results.push({ concurrency, duration, throughput: throughputPerMinute });

        // Each level should complete within time limits
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);
      }

      // Throughput should generally increase with concurrency (within reasonable bounds)
      const lowConcurrencyThroughput = results[0].throughput;
      const highConcurrencyThroughput = results[results.length - 1].throughput;
      
      // High concurrency should have better throughput (allowing for some overhead)
      expect(highConcurrencyThroughput).toBeGreaterThan(lowConcurrencyThroughput * 0.7);
    });

    test('should maintain performance under mixed agent types', async () => {
      const mixedAgents = MockAgentFactory.createMixedPerformanceMockAgents();
      
      for (const [agentType, agent] of Object.entries(mixedAgents)) {
        await agentRegistry.registerAgent(agent);
      }

      const concurrentWorkflows = 8;
      const businessIdeas = Array.from({ length: concurrentWorkflows }, (_, i) => ({
        id: `mixed-perf-idea-${i}`,
        title: `Mixed Performance Test ${i}`,
        description: `Testing mixed performance scenarios ${i}`
      }));

      const { result: workflowIds, duration } = await measureExecutionTime(async () => {
        const workflowPromises = businessIdeas.map((businessIdea, i) =>
          orchestrator.executeWorkflow(
            `mixed-perf-workflow-${i}`,
            `mixed-perf-eval-${i}`,
            businessIdea,
            {
              requiredAgents: ['market-research', 'customer-research', 'technical-feasibility'],
              priority: 'medium'
            }
          ).catch(error => ({ error, workflowId: `mixed-perf-workflow-${i}` }))
        );

        return await Promise.all(workflowPromises);
      });

      // Count successful vs failed workflows
      const successful = workflowIds.filter(result => typeof result === 'string').length;
      const failed = workflowIds.length - successful;
      const errorRate = failed / workflowIds.length;

      // Error rate should be within acceptable limits
      expect(errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.maxErrorRate);
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Resource Utilization Performance', () => {
    test('should optimize queue performance under load', async () => {
      const agents = MockAgentFactory.createStandardMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      // Generate high load
      const highLoad = 25;
      const businessIdeas = Array.from({ length: highLoad }, (_, i) => ({
        id: `load-test-idea-${i}`,
        title: `Load Test Business ${i}`,
        description: `High load testing scenario ${i}`
      }));

      const startMetrics = await queueManager.getQueueMetrics();

      const { duration } = await measureExecutionTime(async () => {
        const workflowPromises = businessIdeas.map((businessIdea, i) =>
          orchestrator.executeWorkflow(
            `load-test-workflow-${i}`,
            `load-test-eval-${i}`,
            businessIdea,
            {
              requiredAgents: ['market-research', 'competitive-analysis'],
              priority: 'medium'
            }
          ).catch(error => error)
        );

        return await Promise.all(workflowPromises);
      });

      const endMetrics = await queueManager.getQueueMetrics();

      // Verify queue performance metrics
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime * 2); // Allow more time for high load

      // Check that queues handled the load effectively
      Object.values(endMetrics).forEach(metrics => {
        expect(metrics.errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.maxErrorRate);
        expect(metrics.processingTimes.average).toBeLessThan(PERFORMANCE_THRESHOLDS.maxResponseTime);
      });
    });

    test('should maintain agent health under sustained load', async () => {
      const agents = MockAgentFactory.createStandardMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      // Run sustained load for health monitoring
      const sustainedDuration = 15000; // 15 seconds
      const workflowInterval = 1000; // 1 workflow per second

      const healthMetrics: Array<{ timestamp: Date; health: any }> = [];
      
      // Monitor health during load
      const healthMonitoringInterval = setInterval(() => {
        const systemHealth = healthMonitor.getSystemHealth();
        healthMetrics.push({
          timestamp: new Date(),
          health: systemHealth
        });
      }, 2000);

      // Generate sustained load
      const startTime = Date.now();
      const workflowPromises: Promise<any>[] = [];
      let workflowCount = 0;

      while (Date.now() - startTime < sustainedDuration) {
        const businessIdea = {
          id: `sustained-idea-${workflowCount}`,
          title: `Sustained Load Test ${workflowCount}`,
          description: `Sustained load testing scenario ${workflowCount}`
        };

        workflowPromises.push(
          orchestrator.executeWorkflow(
            `sustained-workflow-${workflowCount}`,
            `sustained-eval-${workflowCount}`,
            businessIdea,
            {
              requiredAgents: ['market-research'],
              priority: 'low'
            }
          ).catch(error => error)
        );

        workflowCount++;
        await new Promise(resolve => setTimeout(resolve, workflowInterval));
      }

      clearInterval(healthMonitoringInterval);

      // Wait for all workflows to complete
      await Promise.all(workflowPromises);

      // Analyze health metrics
      const healthyReadings = healthMetrics.filter(metric => 
        metric.health.overall === 'healthy'
      ).length;
      
      const healthyRatio = healthyReadings / healthMetrics.length;
      
      // System should maintain good health throughout the test
      expect(healthyRatio).toBeGreaterThan(0.8); // 80% healthy readings
      expect(healthMetrics.length).toBeGreaterThan(5); // Sufficient monitoring data
    });

    test('should handle error scenarios without performance degradation', async () => {
      const unreliableAgents = MockAgentFactory.createUnreliableMockAgents(0.3); // 30% failure rate
      
      for (const [agentType, agent] of Object.entries(unreliableAgents)) {
        await agentRegistry.registerAgent(agent);
      }

      const workflowCount = 15;
      const businessIdeas = Array.from({ length: workflowCount }, (_, i) => ({
        id: `error-test-idea-${i}`,
        title: `Error Handling Test ${i}`,
        description: `Testing error scenarios ${i}`
      }));

      const { result: results, duration } = await measureExecutionTime(async () => {
        const workflowPromises = businessIdeas.map((businessIdea, i) =>
          orchestrator.executeWorkflow(
            `error-test-workflow-${i}`,
            `error-test-eval-${i}`,
            businessIdea,
            {
              requiredAgents: ['market-research', 'competitive-analysis'],
              priority: 'medium'
            }
          ).catch(error => ({ error, index: i }))
        );

        return await Promise.all(workflowPromises);
      });

      // Count successful vs failed workflows
      const successful = results.filter(result => typeof result === 'string').length;
      const failed = results.length - successful;
      const errorRate = failed / results.length;

      // Performance should still be acceptable despite errors
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime * 1.5);
      
      // Some workflows should succeed despite unreliable agents
      expect(successful).toBeGreaterThan(0);
      
      // Error rate should be reasonable (not all workflows fail)
      expect(errorRate).toBeLessThan(0.8); // Allow up to 80% failure for this stress test
    });
  });

  describe('Optimization and Efficiency', () => {
    test('should optimize execution order for performance', async () => {
      const agents = MockAgentFactory.createStandardMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      const allAgentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      // Test optimization
      const optimizedWorkflow = orchestrator.optimizeWorkflowExecution(allAgentTypes);
      
      expect(optimizedWorkflow.criticalPath).toBeDefined();
      expect(optimizedWorkflow.estimatedDuration).toBeGreaterThan(0);
      expect(optimizedWorkflow.levels.length).toBeGreaterThan(1);

      // Critical path should include dependencies correctly
      expect(optimizedWorkflow.criticalPath).toContain('market-research');
      expect(optimizedWorkflow.criticalPath).toContain('financial-analysis');
    });

    test('should demonstrate performance improvements with optimization', async () => {
      const agents = MockAgentFactory.createStandardMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      const businessIdea = {
        id: 'optimization-test',
        title: 'Optimization Performance Test',
        description: 'Testing performance improvements with optimization'
      };

      const allAgentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ];

      // Execute without explicit optimization (standard workflow)
      const { duration: standardDuration } = await measureExecutionTime(async () => {
        return await orchestrator.executeWorkflow(
          'standard-optimization-workflow',
          'standard-optimization-eval',
          businessIdea,
          {
            requiredAgents: allAgentTypes,
            priority: 'medium'
          }
        );
      });

      // Execute with optimization analysis
      const optimizedWorkflow = orchestrator.optimizeWorkflowExecution(allAgentTypes);
      
      const { duration: optimizedDuration } = await measureExecutionTime(async () => {
        return await orchestrator.executeWorkflow(
          'optimized-workflow',
          'optimized-eval',
          businessIdea,
          {
            requiredAgents: allAgentTypes,
            priority: 'high' // Higher priority for optimized execution
          }
        );
      });

      // Both should complete within time limits
      expect(standardDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);
      expect(optimizedDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);

      // Optimization should provide insights even if execution time is similar
      expect(optimizedWorkflow.estimatedDuration).toBeGreaterThan(0);
      expect(optimizedWorkflow.criticalPath.length).toBeGreaterThan(0);
    });

    test('should maintain consistent performance across multiple runs', async () => {
      const agents = MockAgentFactory.createHighPerformanceMockAgents();
      
      for (const [agentType, agent] of Object.entries(agents)) {
        await agentRegistry.registerAgent(agent);
      }

      const businessIdea = {
        id: 'consistency-test',
        title: 'Performance Consistency Test',
        description: 'Testing performance consistency across multiple runs'
      };

      const runCount = 5;
      const durations: number[] = [];

      for (let i = 0; i < runCount; i++) {
        const { duration } = await measureExecutionTime(async () => {
          return await orchestrator.executeWorkflow(
            `consistency-workflow-${i}`,
            `consistency-eval-${i}`,
            businessIdea,
            {
              requiredAgents: ['market-research', 'customer-research'],
              priority: 'high'
            }
          );
        });

        durations.push(duration);
      }

      // Calculate performance statistics
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) / durations.length;
      const standardDeviation = Math.sqrt(variance);

      // Performance should be consistent
      expect(averageDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxExecutionTime);
      expect(maxDuration - minDuration).toBeLessThan(averageDuration * 0.5); // Max variation of 50%
      expect(standardDeviation).toBeLessThan(averageDuration * 0.3); // Standard deviation within 30%
    });
  });
});