/**
 * Agent Registry - Manages agent discovery, registration, and metadata
 */

import { AgentType } from '@ai-validation/shared';
import { BaseAgent, AgentMetadata, AgentCapability } from './types.js';
import { EventEmitter } from 'events';

export interface AgentRegistration {
  agent: BaseAgent;
  metadata: AgentMetadata;
  registeredAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'inactive' | 'error';
}

export interface AgentDependencyGraph {
  [agentType: string]: {
    dependencies: AgentType[];
    dependents: AgentType[];
    executionOrder: number;
    canParallel: boolean;
  };
}

export class AgentRegistry extends EventEmitter {
  private static instance: AgentRegistry;
  private registrations: Map<AgentType, AgentRegistration> = new Map();
  private dependencyGraph: AgentDependencyGraph = {};
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startHealthMonitoring();
  }

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  async registerAgent(agent: BaseAgent): Promise<void> {
    const agentType = agent.getAgentType();
    
    // Initialize agent if not already initialized
    if (!agent.isInitialized()) {
      await agent.initialize();
    }

    const metadata = await agent.healthCheck();
    
    const registration: AgentRegistration = {
      agent,
      metadata,
      registeredAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active'
    };

    this.registrations.set(agentType, registration);
    this.updateDependencyGraph();
    this.emit('agentRegistered', { agentType, registration });

    console.log(`[AgentRegistry] Registered agent: ${agentType}`);
  }

  async unregisterAgent(agentType: AgentType): Promise<void> {
    const registration = this.registrations.get(agentType);
    if (!registration) return;

    // Cleanup agent
    await registration.agent.cleanup();
    
    this.registrations.delete(agentType);
    this.updateDependencyGraph();
    this.emit('agentUnregistered', { agentType });

    console.log(`[AgentRegistry] Unregistered agent: ${agentType}`);
  }

  getAgent(agentType: AgentType): BaseAgent | undefined {
    const registration = this.registrations.get(agentType);
    return registration?.agent;
  }

  getAgentMetadata(agentType: AgentType): AgentMetadata | undefined {
    const registration = this.registrations.get(agentType);
    return registration?.metadata;
  }

  getAllRegisteredAgents(): AgentType[] {
    return Array.from(this.registrations.keys());
  }

  getActiveAgents(): AgentType[] {
    return Array.from(this.registrations.entries())
      .filter(([_, registration]) => registration.status === 'active')
      .map(([agentType, _]) => agentType);
  }

  getAgentCapabilities(agentType: AgentType): AgentCapability | undefined {
    const registration = this.registrations.get(agentType);
    return registration?.metadata.capabilities;
  }

  getDependencyGraph(): AgentDependencyGraph {
    return { ...this.dependencyGraph };
  }

  getExecutionOrder(): AgentType[] {
    const graph = this.dependencyGraph;
    const sortedAgents = Object.entries(graph)
      .sort(([, a], [, b]) => a.executionOrder - b.executionOrder)
      .map(([agentType, _]) => agentType as AgentType);

    return sortedAgents;
  }

  getParallelExecutionGroups(): AgentType[][] {
    const graph = this.dependencyGraph;
    const groups: AgentType[][] = [];
    const orderMap = new Map<number, AgentType[]>();

    // Group agents by execution order
    Object.entries(graph).forEach(([agentType, config]) => {
      const order = config.executionOrder;
      if (!orderMap.has(order)) {
        orderMap.set(order, []);
      }
      orderMap.get(order)!.push(agentType as AgentType);
    });

    // Convert to array of groups
    const sortedOrders = Array.from(orderMap.keys()).sort((a, b) => a - b);
    sortedOrders.forEach(order => {
      const agentsAtOrder = orderMap.get(order)!;
      // Only agents that can run in parallel are grouped together
      const parallelAgents = agentsAtOrder.filter(agentType => 
        graph[agentType]?.canParallel
      );
      if (parallelAgents.length > 0) {
        groups.push(parallelAgents);
      }
    });

    return groups;
  }

  canAgentExecute(agentType: AgentType, completedAgents: Set<AgentType>): boolean {
    const agentConfig = this.dependencyGraph[agentType];
    if (!agentConfig) return false;

    // Check if all dependencies are completed
    return agentConfig.dependencies.every(dep => completedAgents.has(dep));
  }

  validateDependencies(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const registeredTypes = new Set(this.getAllRegisteredAgents());

    // Check if all dependencies are registered
    Object.entries(this.dependencyGraph).forEach(([agentType, config]) => {
      config.dependencies.forEach(dep => {
        if (!registeredTypes.has(dep)) {
          issues.push(`Agent ${agentType} depends on unregistered agent ${dep}`);
        }
      });
    });

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (agentType: string): boolean => {
      if (recursionStack.has(agentType)) return true;
      if (visited.has(agentType)) return false;

      visited.add(agentType);
      recursionStack.add(agentType);

      const config = this.dependencyGraph[agentType];
      if (config) {
        for (const dep of config.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      recursionStack.delete(agentType);
      return false;
    };

    Object.keys(this.dependencyGraph).forEach(agentType => {
      if (hasCycle(agentType)) {
        issues.push(`Circular dependency detected involving agent ${agentType}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  async performHealthCheck(): Promise<Map<AgentType, AgentMetadata>> {
    const healthResults = new Map<AgentType, AgentMetadata>();

    const healthPromises = Array.from(this.registrations.entries()).map(
      async ([agentType, registration]) => {
        try {
          const metadata = await registration.agent.healthCheck();
          registration.metadata = metadata;
          registration.lastActivityAt = new Date();
          registration.status = metadata.healthStatus === 'healthy' ? 'active' : 'error';
          
          healthResults.set(agentType, metadata);
          
          this.emit('agentHealthUpdate', { agentType, metadata });
        } catch (error) {
          registration.status = 'error';
          registration.metadata.healthStatus = 'unhealthy';
          
          console.error(`[AgentRegistry] Health check failed for ${agentType}:`, error);
          this.emit('agentHealthError', { agentType, error });
        }
      }
    );

    await Promise.all(healthPromises);
    return healthResults;
  }

  private updateDependencyGraph(): void {
    this.dependencyGraph = {};

    // Build dependency graph from registered agents
    this.registrations.forEach((registration, agentType) => {
      const capabilities = registration.metadata.capabilities;
      
      this.dependencyGraph[agentType] = {
        dependencies: capabilities.dependencies,
        dependents: [],
        executionOrder: 0,
        canParallel: capabilities.dependencies.length === 0
      };
    });

    // Calculate dependents and execution order
    Object.entries(this.dependencyGraph).forEach(([agentType, config]) => {
      config.dependencies.forEach(dep => {
        if (this.dependencyGraph[dep]) {
          this.dependencyGraph[dep].dependents.push(agentType as AgentType);
        }
      });
    });

    // Calculate execution order using topological sort
    this.calculateExecutionOrder();
  }

  private calculateExecutionOrder(): void {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Initialize in-degrees
    Object.keys(this.dependencyGraph).forEach(agentType => {
      inDegree.set(agentType, this.dependencyGraph[agentType].dependencies.length);
    });

    // Find agents with no dependencies
    inDegree.forEach((degree, agentType) => {
      if (degree === 0) {
        queue.push(agentType);
        this.dependencyGraph[agentType].executionOrder = 0;
      }
    });

    let order = 0;
    while (queue.length > 0) {
      const currentLevelSize = queue.length;
      
      for (let i = 0; i < currentLevelSize; i++) {
        const currentAgent = queue.shift()!;
        this.dependencyGraph[currentAgent].executionOrder = order;

        // Process dependents
        this.dependencyGraph[currentAgent].dependents.forEach(dependent => {
          const newInDegree = inDegree.get(dependent)! - 1;
          inDegree.set(dependent, newInDegree);

          if (newInDegree === 0) {
            queue.push(dependent);
          }
        });
      }
      
      order++;
    }

    // Update parallel execution flags
    Object.keys(this.dependencyGraph).forEach(agentType => {
      const config = this.dependencyGraph[agentType];
      config.canParallel = config.dependencies.length === 0 || 
        config.dependencies.every(dep => 
          this.dependencyGraph[dep]?.executionOrder < config.executionOrder
        );
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('[AgentRegistry] Health monitoring error:', error);
      }
    }, 30000); // Every 30 seconds
  }

  async shutdown(): Promise<void> {
    console.log('[AgentRegistry] Shutting down...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Cleanup all registered agents
    const cleanupPromises = Array.from(this.registrations.keys()).map(
      agentType => this.unregisterAgent(agentType)
    );

    await Promise.all(cleanupPromises);
    this.removeAllListeners();

    console.log('[AgentRegistry] Shutdown complete');
  }

  // Test utilities
  static resetInstance(): void {
    if (AgentRegistry.instance) {
      AgentRegistry.instance.shutdown();
    }
    AgentRegistry.instance = null as any;
  }

  // Debug utilities
  getRegistrationInfo(): Record<string, any> {
    const info: Record<string, any> = {};
    
    this.registrations.forEach((registration, agentType) => {
      info[agentType] = {
        status: registration.status,
        registeredAt: registration.registeredAt,
        lastActivityAt: registration.lastActivityAt,
        healthStatus: registration.metadata.healthStatus,
        version: registration.metadata.version,
        dependencies: registration.metadata.capabilities.dependencies,
        provides: registration.metadata.capabilities.provides,
        requires: registration.metadata.capabilities.requires
      };
    });

    return info;
  }
}