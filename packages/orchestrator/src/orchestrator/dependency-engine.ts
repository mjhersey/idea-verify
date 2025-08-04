/**
 * Dependency Engine - Manages agent dependencies and execution ordering
 */

import { AgentType } from '@ai-validation/shared';
import { AgentResponse } from '../agents/types.js';
import { EventEmitter } from 'events';

export interface DependencyNode {
  agentType: AgentType;
  dependencies: AgentType[];
  dependents: AgentType[];
  executionOrder: number;
  isOptional: boolean;
  executionGroup: number;
  canRunInParallel: boolean;
  estimatedDuration: number;
  requiredData: string[];
  providedData: string[];
}

export interface DependencyGraph {
  nodes: Map<AgentType, DependencyNode>;
  executionGroups: AgentType[][];
  totalEstimatedTime: number;
  maxParallelism: number;
  criticalPath: AgentType[];
}

export interface ExecutionContext {
  completedAgents: Set<AgentType>;
  failedAgents: Set<AgentType>;
  availableData: Map<string, any>;
  agentResults: Map<AgentType, AgentResponse>;
  startTime: Date;
  currentGroup: number;
}

export interface DependencyRule {
  name: string;
  description: string;
  condition: (sourceAgent: AgentType, targetAgent: AgentType) => boolean;
  required: boolean;
  dataMapping?: (sourceResult: AgentResponse) => Record<string, any>;
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  optimize: (graph: DependencyGraph) => DependencyGraph;
  estimateImprovement: (originalGraph: DependencyGraph, optimizedGraph: DependencyGraph) => number;
}

export class DependencyEngine extends EventEmitter {
  private static instance: DependencyEngine;
  
  private dependencyRules: Map<string, DependencyRule> = new Map();
  private optimizationStrategies: Map<string, OptimizationStrategy> = new Map();
  private agentCapabilities: Map<AgentType, {
    provides: string[];
    requires: string[];
    optional: string[];
    estimatedDuration: number;
  }> = new Map();

  private constructor() {
    super();
    this.initializeDefaultDependencies();
    this.initializeAgentCapabilities();
    this.initializeOptimizationStrategies();
  }

  static getInstance(): DependencyEngine {
    if (!DependencyEngine.instance) {
      DependencyEngine.instance = new DependencyEngine();
    }
    return DependencyEngine.instance;
  }

  private initializeDefaultDependencies(): void {
    // Market research provides foundational data
    this.addDependencyRule({
      name: 'market-to-competitive',
      description: 'Market research provides market context for competitive analysis',
      condition: (source, target) => 
        source === 'market-research' && target === 'competitive-analysis',
      required: false,
      dataMapping: (result) => ({
        marketSize: result.rawData.marketResearch?.marketSize,
        marketTrends: result.rawData.marketResearch?.trends,
        targetMarket: result.rawData.marketResearch?.targetMarket
      })
    });

    this.addDependencyRule({
      name: 'market-to-customer',
      description: 'Market research provides market context for customer research',
      condition: (source, target) => 
        source === 'market-research' && target === 'customer-research',
      required: false,
      dataMapping: (result) => ({
        marketSegments: result.rawData.marketResearch?.segments,
        marketSize: result.rawData.marketResearch?.marketSize,
        demographics: result.rawData.marketResearch?.demographics
      })
    });

    this.addDependencyRule({
      name: 'market-to-financial',
      description: 'Market research provides revenue projections context',
      condition: (source, target) => 
        source === 'market-research' && target === 'financial-analysis',
      required: true,
      dataMapping: (result) => ({
        marketSize: result.rawData.marketResearch?.marketSize,
        growthRate: result.rawData.marketResearch?.marketGrowthRate,
        marketPotential: result.score
      })
    });

    this.addDependencyRule({
      name: 'competitive-to-financial',
      description: 'Competitive analysis provides market share and pricing context',
      condition: (source, target) => 
        source === 'competitive-analysis' && target === 'financial-analysis',
      required: false,
      dataMapping: (result) => ({
        competitorPricing: result.rawData.competitiveAnalysis?.pricing,
        marketShare: result.rawData.competitiveAnalysis?.marketShare,
        competitiveRisks: result.insights.filter(i => i.includes('risk'))
      })
    });

    this.addDependencyRule({
      name: 'customer-to-financial',
      description: 'Customer research provides revenue model validation',
      condition: (source, target) => 
        source === 'customer-research' && target === 'financial-analysis',
      required: false,
      dataMapping: (result) => ({
        customerSegments: result.rawData.customerResearch?.segments,
        willingness_to_pay: result.rawData.customerResearch?.pricing,
        customerAcquisitionCost: result.rawData.customerResearch?.cac
      })
    });

    this.addDependencyRule({
      name: 'technical-to-financial',
      description: 'Technical feasibility provides development cost estimates',
      condition: (source, target) => 
        source === 'technical-feasibility' && target === 'financial-analysis',
      required: false,
      dataMapping: (result) => ({
        developmentCost: result.rawData.technicalAnalysis?.developmentCost,
        maintenanceCost: result.rawData.technicalAnalysis?.maintenanceCost,
        technicalRisks: result.rawData.technicalAnalysis?.risks
      })
    });
  }

  private initializeAgentCapabilities(): void {
    this.agentCapabilities.set('market-research', {
      provides: ['market-size', 'market-trends', 'target-market', 'market-segments'],
      requires: ['business-idea'],
      optional: [],
      estimatedDuration: 120000 // 2 minutes
    });

    this.agentCapabilities.set('competitive-analysis', {
      provides: ['competitor-analysis', 'market-share', 'competitive-pricing'],
      requires: ['business-idea'],
      optional: ['market-size', 'market-trends'],
      estimatedDuration: 180000 // 3 minutes
    });

    this.agentCapabilities.set('customer-research', {
      provides: ['customer-segments', 'customer-needs', 'willingness-to-pay'],
      requires: ['business-idea'],
      optional: ['market-segments', 'target-market'],
      estimatedDuration: 150000 // 2.5 minutes
    });

    this.agentCapabilities.set('technical-feasibility', {
      provides: ['technical-requirements', 'development-cost', 'technical-risks'],
      requires: ['business-idea'],
      optional: [],
      estimatedDuration: 240000 // 4 minutes
    });

    this.agentCapabilities.set('financial-analysis', {
      provides: ['revenue-projections', 'cost-analysis', 'profitability'],
      requires: ['business-idea', 'market-size'],
      optional: ['competitor-analysis', 'customer-segments', 'development-cost'],
      estimatedDuration: 200000 // 3.3 minutes
    });
  }

  private initializeOptimizationStrategies(): void {
    // Parallel execution optimization
    const parallelOptimization: OptimizationStrategy = {
      name: 'parallel-execution',
      description: 'Maximize parallel execution opportunities',
      optimize: (graph) => this.optimizeForParallelism(graph),
      estimateImprovement: (original, optimized) => 
        this.estimateTimeImprovement(original, optimized)
    };

    // Critical path optimization
    const criticalPathOptimization: OptimizationStrategy = {
      name: 'critical-path',
      description: 'Optimize critical path to minimize total execution time',
      optimize: (graph) => this.optimizeCriticalPath(graph),
      estimateImprovement: (original, optimized) => 
        this.estimateTimeImprovement(original, optimized)
    };

    this.optimizationStrategies.set(parallelOptimization.name, parallelOptimization);
    this.optimizationStrategies.set(criticalPathOptimization.name, criticalPathOptimization);
  }

  // Main dependency resolution methods
  buildDependencyGraph(requiredAgents: AgentType[]): DependencyGraph {
    console.log(`[DependencyEngine] Building dependency graph for agents: [${requiredAgents.join(', ')}]`);

    const nodes = new Map<AgentType, DependencyNode>();

    // Create nodes for each required agent
    for (const agentType of requiredAgents) {
      const capabilities = this.agentCapabilities.get(agentType);
      if (!capabilities) {
        throw new Error(`Unknown agent type: ${agentType}`);
      }

      const dependencies = this.calculateDependencies(agentType, requiredAgents);
      
      const node: DependencyNode = {
        agentType,
        dependencies,
        dependents: [],
        executionOrder: 0,
        isOptional: false,
        executionGroup: 0,
        canRunInParallel: dependencies.length === 0,
        estimatedDuration: capabilities.estimatedDuration,
        requiredData: capabilities.requires,
        providedData: capabilities.provides
      };

      nodes.set(agentType, node);
    }

    // Calculate dependents
    this.calculateDependents(nodes);

    // Calculate execution order and groups
    const { executionOrder, executionGroups } = this.calculateExecutionOrder(nodes);
    
    // Update nodes with execution order and groups
    executionOrder.forEach((agentType, index) => {
      const node = nodes.get(agentType)!;
      node.executionOrder = index;
    });

    executionGroups.forEach((group, groupIndex) => {
      group.forEach(agentType => {
        const node = nodes.get(agentType)!;
        node.executionGroup = groupIndex;
        node.canRunInParallel = group.length > 1;
      });
    });

    // Calculate timing estimates
    const totalEstimatedTime = this.calculateTotalTime(executionGroups, nodes);
    const maxParallelism = Math.max(...executionGroups.map(group => group.length));
    const criticalPath = this.calculateCriticalPath(nodes);

    const graph: DependencyGraph = {
      nodes,
      executionGroups,
      totalEstimatedTime,
      maxParallelism,
      criticalPath
    };

    this.emit('dependencyGraphBuilt', { graph, requiredAgents });
    return graph;
  }

  private calculateDependencies(agentType: AgentType, availableAgents: AgentType[]): AgentType[] {
    const dependencies: AgentType[] = [];

    // Check each dependency rule
    for (const rule of this.dependencyRules.values()) {
      for (const sourceAgent of availableAgents) {
        if (rule.condition(sourceAgent, agentType) && sourceAgent !== agentType) {
          if (rule.required || this.shouldIncludeOptionalDependency(sourceAgent, agentType)) {
            dependencies.push(sourceAgent);
          }
        }
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private shouldIncludeOptionalDependency(sourceAgent: AgentType, targetAgent: AgentType): boolean {
    // Include optional dependencies if they provide valuable data
    const sourceCapabilities = this.agentCapabilities.get(sourceAgent);
    const targetCapabilities = this.agentCapabilities.get(targetAgent);

    if (!sourceCapabilities || !targetCapabilities) return false;

    // Check if source provides data that target can optionally use
    return sourceCapabilities.provides.some(provided => 
      targetCapabilities.optional.includes(provided)
    );
  }

  private calculateDependents(nodes: Map<AgentType, DependencyNode>): void {
    // Build reverse dependency mapping
    nodes.forEach((node, agentType) => {
      node.dependencies.forEach(depType => {
        const depNode = nodes.get(depType);
        if (depNode) {
          depNode.dependents.push(agentType);
        }
      });
    });
  }

  private calculateExecutionOrder(nodes: Map<AgentType, DependencyNode>): {
    executionOrder: AgentType[];
    executionGroups: AgentType[][];
  } {
    // Topological sort with grouping
    const visited = new Set<AgentType>();
    const executionOrder: AgentType[] = [];
    const executionGroups: AgentType[][] = [];
    
    const inDegree = new Map<AgentType, number>();
    
    // Calculate in-degrees
    nodes.forEach((node, agentType) => {
      inDegree.set(agentType, node.dependencies.length);
    });

    // Process agents level by level
    while (visited.size < nodes.size) {
      const currentGroup: AgentType[] = [];
      
      // Find all agents with no remaining dependencies
      inDegree.forEach((degree, agentType) => {
        if (degree === 0 && !visited.has(agentType)) {
          currentGroup.push(agentType);
        }
      });

      if (currentGroup.length === 0) {
        throw new Error('Circular dependency detected in agent graph');
      }

      // Add current group to execution order
      executionOrder.push(...currentGroup);
      executionGroups.push(currentGroup);

      // Mark as visited and update in-degrees
      currentGroup.forEach(agentType => {
        visited.add(agentType);
        inDegree.delete(agentType);
        
        const node = nodes.get(agentType)!;
        node.dependents.forEach(dependent => {
          const currentDegree = inDegree.get(dependent);
          if (currentDegree !== undefined) {
            inDegree.set(dependent, currentDegree - 1);
          }
        });
      });
    }

    return { executionOrder, executionGroups };
  }

  private calculateTotalTime(
    executionGroups: AgentType[][], 
    nodes: Map<AgentType, DependencyNode>
  ): number {
    return executionGroups.reduce((total, group) => {
      const groupTime = Math.max(...group.map(agentType => 
        nodes.get(agentType)?.estimatedDuration || 0
      ));
      return total + groupTime;
    }, 0);
  }

  private calculateCriticalPath(nodes: Map<AgentType, DependencyNode>): AgentType[] {
    const path: AgentType[] = [];
    const pathTimes = new Map<AgentType, number>();

    // Calculate longest path to each node
    const calculateLongestPath = (agentType: AgentType): number => {
      if (pathTimes.has(agentType)) {
        return pathTimes.get(agentType)!;
      }

      const node = nodes.get(agentType)!;
      let maxDependencyTime = 0;

      for (const dependency of node.dependencies) {
        const depTime = calculateLongestPath(dependency);
        maxDependencyTime = Math.max(maxDependencyTime, depTime);
      }

      const totalTime = maxDependencyTime + node.estimatedDuration;
      pathTimes.set(agentType, totalTime);
      return totalTime;
    };

    // Find the agent with the longest total path
    let criticalAgent: AgentType | null = null;
    let maxTime = 0;

    nodes.forEach((_, agentType) => {
      const time = calculateLongestPath(agentType);
      if (time > maxTime) {
        maxTime = time;
        criticalAgent = agentType;
      }
    });

    // Reconstruct critical path
    if (criticalAgent) {
      const buildPath = (agentType: AgentType) => {
        path.unshift(agentType);
        const node = nodes.get(agentType)!;
        
        let criticalDependency: AgentType | null = null;
        let maxDepTime = 0;

        for (const dependency of node.dependencies) {
          const depTime = pathTimes.get(dependency) || 0;
          if (depTime > maxDepTime) {
            maxDepTime = depTime;
            criticalDependency = dependency;
          }
        }

        if (criticalDependency) {
          buildPath(criticalDependency);
        }
      };

      buildPath(criticalAgent);
    }

    return path;
  }

  // Execution context management
  createExecutionContext(): ExecutionContext {
    return {
      completedAgents: new Set(),
      failedAgents: new Set(),
      availableData: new Map(),
      agentResults: new Map(),
      startTime: new Date(),
      currentGroup: 0
    };
  }

  getReadyAgents(
    graph: DependencyGraph, 
    context: ExecutionContext
  ): AgentType[] {
    const readyAgents: AgentType[] = [];

    graph.nodes.forEach((node, agentType) => {
      // Skip if already processed
      if (context.completedAgents.has(agentType) || context.failedAgents.has(agentType)) {
        return;
      }

      // Check if all dependencies are completed
      const dependenciesMet = node.dependencies.every(dep => 
        context.completedAgents.has(dep)
      );

      if (dependenciesMet) {
        readyAgents.push(agentType);
      }
    });

    return readyAgents;
  }

  updateExecutionContext(
    context: ExecutionContext,
    agentType: AgentType,
    result: AgentResponse | null,
    failed: boolean = false
  ): void {
    if (failed) {
      context.failedAgents.add(agentType);
    } else if (result) {
      context.completedAgents.add(agentType);
      context.agentResults.set(agentType, result);

      // Extract and store data from the result
      this.extractAgentData(agentType, result, context);
    }

    this.emit('executionContextUpdated', { 
      context, 
      agentType, 
      success: !failed 
    });
  }

  private extractAgentData(
    agentType: AgentType,
    result: AgentResponse,
    context: ExecutionContext
  ): void {
    // Apply data mapping rules
    for (const rule of this.dependencyRules.values()) {
      if (rule.dataMapping && this.isDependencySourceFor(agentType, rule)) {
        const extractedData = rule.dataMapping(result);
        Object.entries(extractedData).forEach(([key, value]) => {
          context.availableData.set(key, value);
        });
      }
    }

    // Store raw agent capabilities data
    const capabilities = this.agentCapabilities.get(agentType);
    if (capabilities) {
      capabilities.provides.forEach(dataType => {
        context.availableData.set(dataType, result.rawData);
      });
    }
  }

  private isDependencySourceFor(agentType: AgentType, rule: DependencyRule): boolean {
    // Check if this agent is a source in the dependency rule
    const allAgentTypes: AgentType[] = [
      'market-research',
      'competitive-analysis',
      'customer-research',
      'technical-feasibility',
      'financial-analysis'
    ];

    return allAgentTypes.some(targetAgent => 
      rule.condition(agentType, targetAgent)
    );
  }

  // Optimization methods
  optimizeGraph(graph: DependencyGraph, strategyName: string = 'parallel-execution'): DependencyGraph {
    const strategy = this.optimizationStrategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown optimization strategy: ${strategyName}`);
    }

    console.log(`[DependencyEngine] Optimizing graph with strategy: ${strategyName}`);
    const optimizedGraph = strategy.optimize(graph);
    
    const improvement = strategy.estimateImprovement(graph, optimizedGraph);
    console.log(`[DependencyEngine] Estimated improvement: ${improvement.toFixed(2)}%`);

    this.emit('graphOptimized', { 
      originalGraph: graph, 
      optimizedGraph, 
      strategy: strategyName, 
      improvement 
    });

    return optimizedGraph;
  }

  private optimizeForParallelism(graph: DependencyGraph): DependencyGraph {
    // Create a copy of the graph
    const optimizedNodes = new Map<AgentType, DependencyNode>();
    
    graph.nodes.forEach((node, agentType) => {
      optimizedNodes.set(agentType, { ...node });
    });

    // Analyze dependency strictness and potentially relax non-critical dependencies
    optimizedNodes.forEach((node, agentType) => {
      const relaxableDepencies = node.dependencies.filter(dep => {
        const rule = this.findDependencyRule(dep, agentType);
        return rule && !rule.required;
      });

      // Consider removing some optional dependencies to increase parallelism
      if (relaxableDepencies.length > 0 && node.dependencies.length > 2) {
        // Remove one optional dependency to allow earlier execution
        node.dependencies = node.dependencies.filter((_, index) => index !== 0);
      }
    });

    // Recalculate execution order and groups
    const { executionOrder, executionGroups } = this.calculateExecutionOrder(optimizedNodes);
    const totalEstimatedTime = this.calculateTotalTime(executionGroups, optimizedNodes);
    const maxParallelism = Math.max(...executionGroups.map(group => group.length));
    const criticalPath = this.calculateCriticalPath(optimizedNodes);

    return {
      nodes: optimizedNodes,
      executionGroups,
      totalEstimatedTime,
      maxParallelism,
      criticalPath
    };
  }

  private optimizeCriticalPath(graph: DependencyGraph): DependencyGraph {
    // Focus on reducing the critical path duration
    const optimizedNodes = new Map<AgentType, DependencyNode>();
    
    graph.nodes.forEach((node, agentType) => {
      const optimizedNode = { ...node };
      
      // If this agent is on the critical path, try to optimize its duration
      if (graph.criticalPath.includes(agentType)) {
        // Reduce estimated duration by 10% (simulating optimization)
        optimizedNode.estimatedDuration = Math.round(node.estimatedDuration * 0.9);
      }
      
      optimizedNodes.set(agentType, optimizedNode);
    });

    // Recalculate with optimized durations
    const { executionOrder, executionGroups } = this.calculateExecutionOrder(optimizedNodes);
    const totalEstimatedTime = this.calculateTotalTime(executionGroups, optimizedNodes);
    const maxParallelism = Math.max(...executionGroups.map(group => group.length));
    const criticalPath = this.calculateCriticalPath(optimizedNodes);

    return {
      nodes: optimizedNodes,
      executionGroups,
      totalEstimatedTime,
      maxParallelism,
      criticalPath
    };
  }

  private estimateTimeImprovement(original: DependencyGraph, optimized: DependencyGraph): number {
    if (original.totalEstimatedTime === 0) return 0;
    
    const timeSaved = original.totalEstimatedTime - optimized.totalEstimatedTime;
    return (timeSaved / original.totalEstimatedTime) * 100;
  }

  private findDependencyRule(sourceAgent: AgentType, targetAgent: AgentType): DependencyRule | undefined {
    for (const rule of this.dependencyRules.values()) {
      if (rule.condition(sourceAgent, targetAgent)) {
        return rule;
      }
    }
    return undefined;
  }

  // Public API
  addDependencyRule(rule: DependencyRule): void {
    this.dependencyRules.set(rule.name, rule);
    console.log(`[DependencyEngine] Added dependency rule: ${rule.name}`);
  }

  removeDependencyRule(ruleName: string): boolean {
    const removed = this.dependencyRules.delete(ruleName);
    if (removed) {
      console.log(`[DependencyEngine] Removed dependency rule: ${ruleName}`);
    }
    return removed;
  }

  getDependencyRules(): DependencyRule[] {
    return Array.from(this.dependencyRules.values());
  }

  addOptimizationStrategy(strategy: OptimizationStrategy): void {
    this.optimizationStrategies.set(strategy.name, strategy);
    console.log(`[DependencyEngine] Added optimization strategy: ${strategy.name}`);
  }

  getOptimizationStrategies(): OptimizationStrategy[] {
    return Array.from(this.optimizationStrategies.values());
  }

  // Analysis methods
  analyzeDependencyComplexity(agents: AgentType[]): {
    totalDependencies: number;
    circularDependencies: boolean;
    maxDepth: number;
    parallelismOpportunities: number;
  } {
    const graph = this.buildDependencyGraph(agents);
    
    const totalDependencies = Array.from(graph.nodes.values())
      .reduce((sum, node) => sum + node.dependencies.length, 0);

    const maxDepth = Math.max(...Array.from(graph.nodes.values())
      .map(node => this.calculateNodeDepth(node, graph.nodes)));

    const parallelismOpportunities = graph.executionGroups
      .filter(group => group.length > 1).length;

    return {
      totalDependencies,
      circularDependencies: false, // Would be caught during graph building
      maxDepth,
      parallelismOpportunities
    };
  }

  private calculateNodeDepth(node: DependencyNode, nodes: Map<AgentType, DependencyNode>): number {
    if (node.dependencies.length === 0) {
      return 0;
    }

    const depthLevels = node.dependencies.map(dep => {
      const depNode = nodes.get(dep);
      return depNode ? this.calculateNodeDepth(depNode, nodes) + 1 : 0;
    });

    return Math.max(...depthLevels);
  }

  // Test utilities
  static resetInstance(): void {
    DependencyEngine.instance = null as any;
  }
}