/**
 * Multi-Agent Orchestrator - Advanced orchestration for parallel agent workflows
 */

import { EventEmitter } from 'events';
import { AgentType } from '@ai-validation/shared';
import { AgentRegistry } from '../agents/agent-registry.js';
import { MultiAgentQueueManager, MultiAgentJobData, AgentExecutionJob } from '../queue/multi-agent-queue-manager.js';
import { MessageRouter } from '../communication/message-router.js';
import { AgentService } from '../agents/agent-service.js';
import { 
  AgentRequest, 
  AgentExecutionContext, 
  AgentCommunicationContext,
  AgentResponse
} from '../agents/types.js';

export interface WorkflowDefinition {
  id: string;
  name: string;
  agents: AgentType[];
  dependencies: Record<AgentType, AgentType[]>;
  parallelGroups: AgentType[][];
  executionOrder: number[];
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
    baseDelay: number;
  };
}

export interface WorkflowExecution {
  workflowId: string;
  evaluationId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  agentStatuses: Map<AgentType, {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    result?: AgentResponse;
    error?: string;
    retryCount: number;
  }>;
  sharedContext: AgentCommunicationContext;
  metadata: {
    businessIdea: any;
    priority: 'high' | 'medium' | 'low';
    requestedBy: string;
    correlationId: string;
  };
}

export interface ExecutionPlan {
  evaluationId: string;
  workflow: WorkflowDefinition;
  executionGroups: {
    groupIndex: number;
    agents: AgentType[];
    dependencies: AgentType[];
    canExecuteInParallel: boolean;
    estimatedDuration: number;
  }[];
  totalEstimatedDuration: number;
  resourceRequirements: {
    maxConcurrency: number;
    memoryEstimate: number;
    computeIntensity: 'low' | 'medium' | 'high';
  };
}

export class MultiAgentOrchestrator extends EventEmitter {
  private static instance: MultiAgentOrchestrator;
  private agentRegistry: AgentRegistry;
  private queueManager: MultiAgentQueueManager;
  private messageRouter: MessageRouter;
  private agentService: AgentService;

  private workflows: Map<string, WorkflowDefinition> = new Map();
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionHistory: Map<string, WorkflowExecution> = new Map();

  private isInitialized: boolean = false;
  private maxConcurrentWorkflows: number = 10;
  private workflowTimeout: number = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    super();
    this.agentRegistry = AgentRegistry.getInstance();
    this.queueManager = MultiAgentQueueManager.getInstance();
    this.messageRouter = MessageRouter.getInstance();
    this.agentService = AgentService.getInstance();
  }

  static getInstance(): MultiAgentOrchestrator {
    if (!MultiAgentOrchestrator.instance) {
      MultiAgentOrchestrator.instance = new MultiAgentOrchestrator();
    }
    return MultiAgentOrchestrator.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[MultiAgentOrchestrator] Initializing...');

    // Initialize dependencies
    await this.agentRegistry.initialize?.();
    await this.queueManager.initialize();

    // Setup default workflows
    this.setupDefaultWorkflows();

    // Setup message routing
    this.setupMessageRouting();

    // Setup event listeners
    this.setupEventListeners();

    this.isInitialized = true;
    console.log('[MultiAgentOrchestrator] Initialization complete');
    this.emit('initialized');
  }

  private setupDefaultWorkflows(): void {
    // Define standard evaluation workflow
    const standardWorkflow: WorkflowDefinition = {
      id: 'standard-evaluation',
      name: 'Standard Business Idea Evaluation',
      agents: [
        'market-research',
        'competitive-analysis', 
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
      ],
      dependencies: {
        'market-research': [],
        'competitive-analysis': ['market-research'],
        'customer-research': ['market-research'],
        'technical-feasibility': [],
        'financial-analysis': ['market-research', 'competitive-analysis']
      },
      parallelGroups: [
        ['market-research'],
        ['competitive-analysis', 'customer-research', 'technical-feasibility'],
        ['financial-analysis']
      ],
      executionOrder: [0, 1, 1, 1, 2],
      timeout: 25 * 60 * 1000, // 25 minutes
      retryPolicy: {
        maxRetries: 2,
        backoffStrategy: 'exponential',
        baseDelay: 5000
      }
    };

    // Define fast evaluation workflow (only essential agents)
    const fastWorkflow: WorkflowDefinition = {
      id: 'fast-evaluation',
      name: 'Fast Business Idea Evaluation',
      agents: ['market-research', 'financial-analysis'],
      dependencies: {
        'market-research': [],
        'financial-analysis': ['market-research']
      },
      parallelGroups: [
        ['market-research'],
        ['financial-analysis']
      ],
      executionOrder: [0, 1],
      timeout: 10 * 60 * 1000, // 10 minutes
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        baseDelay: 2000
      }
    };

    this.workflows.set(standardWorkflow.id, standardWorkflow);
    this.workflows.set(fastWorkflow.id, fastWorkflow);

    console.log(`[MultiAgentOrchestrator] Registered ${this.workflows.size} default workflows`);
  }

  private setupMessageRouting(): void {
    // Register orchestrator as message handler
    this.messageRouter.registerHandler('multi-agent-orchestrator', this.agentService);

    // Setup routing rules for agent coordination
    this.messageRouter.addRoutingRule({
      id: 'agent-completion-to-orchestrator',
      name: 'Route agent completions to orchestrator',
      source: {
        messageType: ['AGENT_COMPLETE']
      },
      destination: {
        handler: 'multi-agent-orchestrator',
        priority: 'high'
      },
      enabled: true
    });

    this.messageRouter.addRoutingRule({
      id: 'agent-error-to-orchestrator',
      name: 'Route agent errors to orchestrator',
      source: {
        messageType: ['AGENT_ERROR']
      },
      destination: {
        handler: 'multi-agent-orchestrator',
        priority: 'high'
      },
      enabled: true
    });

    // Setup fanout pattern for workflow progress updates
    this.messageRouter.addFanoutPattern({
      id: 'workflow-progress-fanout',
      sourceMessageType: 'WORKFLOW_PROGRESS' as any,
      targetHandlers: ['workflow-monitor', 'metrics-collector'],
      parallel: true
    });
  }

  private setupEventListeners(): void {
    // Listen to queue manager events
    this.queueManager.on('agentExecutionCompleted', async (event) => {
      await this.handleAgentExecutionCompleted(event);
    });

    this.queueManager.on('agentExecutionFailed', async (event) => {
      await this.handleAgentExecutionFailed(event);
    });

    this.queueManager.on('evaluationCompleted', async (event) => {
      await this.handleEvaluationCompleted(event);
    });

    // Listen to agent registry events
    this.agentRegistry.on('agentHealthUpdate', (event) => {
      this.handleAgentHealthUpdate(event);
    });
  }

  // Workflow Management
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.validateWorkflow(workflow);
    this.workflows.set(workflow.id, workflow);
    console.log(`[MultiAgentOrchestrator] Registered workflow: ${workflow.name}`);
    this.emit('workflowRegistered', { workflow });
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  // Workflow Execution
  async executeWorkflow(
    workflowId: string,
    evaluationId: string,
    businessIdea: any,
    options: {
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
      requestedBy?: string;
      correlationId?: string;
      customAgentOrder?: AgentType[];
    } = {}
  ): Promise<string> {
    if (this.activeExecutions.size >= this.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows reached');
    }

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create execution plan
    const executionPlan = await this.createExecutionPlan(workflow, evaluationId, options);

    // Create workflow execution
    const execution: WorkflowExecution = {
      workflowId,
      evaluationId,
      status: 'pending',
      progress: 0,
      agentStatuses: new Map(),
      sharedContext: {
        sharedData: new Map(),
        dependencies: new Map(),
        coordination: {
          sequence: 0,
          priority: options.priority || 'medium',
          parallel: true
        }
      },
      metadata: {
        businessIdea,
        priority: options.priority || 'medium',
        requestedBy: options.requestedBy || 'system',
        correlationId: options.correlationId || evaluationId
      }
    };

    // Initialize agent statuses
    for (const agentType of workflow.agents) {
      execution.agentStatuses.set(agentType, {
        status: 'pending',
        retryCount: 0
      });
    }

    this.activeExecutions.set(evaluationId, execution);

    // Start execution
    await this.startWorkflowExecution(execution, executionPlan);

    console.log(`[MultiAgentOrchestrator] Started workflow: ${workflowId} for evaluation: ${evaluationId}`);
    this.emit('workflowStarted', { evaluationId, workflowId, execution });

    return evaluationId;
  }

  private async createExecutionPlan(
    workflow: WorkflowDefinition,
    evaluationId: string,
    options: any
  ): Promise<ExecutionPlan> {
    const executionGroups: ExecutionPlan['executionGroups'] = [];
    
    // Group agents by execution order
    const groupMap = new Map<number, AgentType[]>();
    workflow.parallelGroups.forEach((group, index) => {
      groupMap.set(index, group);
    });

    // Create execution groups with dependency information
    Array.from(groupMap.entries()).forEach(([groupIndex, agents]) => {
      const dependencies = this.getGroupDependencies(agents, workflow.dependencies);
      
      executionGroups.push({
        groupIndex,
        agents,
        dependencies,
        canExecuteInParallel: agents.length > 1,
        estimatedDuration: this.estimateGroupDuration(agents)
      });
    });

    const totalEstimatedDuration = executionGroups.reduce(
      (total, group) => total + group.estimatedDuration, 
      0
    );

    const maxConcurrency = Math.max(...executionGroups.map(g => g.agents.length));

    return {
      evaluationId,
      workflow,
      executionGroups,
      totalEstimatedDuration,
      resourceRequirements: {
        maxConcurrency,
        memoryEstimate: this.estimateMemoryRequirement(workflow.agents),
        computeIntensity: this.assessComputeIntensity(workflow.agents)
      }
    };
  }

  private async startWorkflowExecution(execution: WorkflowExecution, plan: ExecutionPlan): Promise<void> {
    execution.status = 'running';
    execution.startedAt = new Date();

    // Queue the multi-agent evaluation
    const jobData: MultiAgentJobData = {
      evaluationId: execution.evaluationId,
      agentTypes: plan.workflow.agents,
      parallelGroups: plan.workflow.parallelGroups,
      dependencies: plan.workflow.dependencies,
      priority: execution.metadata.priority,
      timeout: plan.workflow.timeout,
      businessIdea: execution.metadata.businessIdea,
      context: {
        workflowId: execution.workflowId,
        correlationId: execution.metadata.correlationId,
        plan: plan
      }
    } as any;

    await this.queueManager.addMultiAgentEvaluation(jobData, {
      priority: execution.metadata.priority
    });

    this.updateWorkflowProgress(execution);
  }

  // Event Handlers
  private async handleAgentExecutionCompleted(event: {
    jobId: string;
    agentType: AgentType;
    result: any;
  }): Promise<void> {
    const execution = this.findExecutionByAgentType(event.agentType);
    if (!execution) return;

    const agentStatus = execution.agentStatuses.get(event.agentType);
    if (!agentStatus) return;

    // Update agent status
    agentStatus.status = 'completed';
    agentStatus.completedAt = new Date();
    agentStatus.result = event.result;

    // Store result in shared context
    execution.sharedContext.dependencies.set(event.agentType, event.result);

    // Check if workflow is complete
    await this.checkWorkflowCompletion(execution);

    this.updateWorkflowProgress(execution);
    console.log(`[MultiAgentOrchestrator] Agent ${event.agentType} completed for evaluation: ${execution.evaluationId}`);
  }

  private async handleAgentExecutionFailed(event: {
    jobId: string;
    agentType: AgentType;
    error: any;
  }): Promise<void> {
    const execution = this.findExecutionByAgentType(event.agentType);
    if (!execution) return;

    const agentStatus = execution.agentStatuses.get(event.agentType);
    if (!agentStatus) return;

    const workflow = this.workflows.get(execution.workflowId)!;
    
    // Check if we should retry
    if (agentStatus.retryCount < workflow.retryPolicy.maxRetries) {
      agentStatus.retryCount++;
      
      // Calculate retry delay
      const delay = this.calculateRetryDelay(
        workflow.retryPolicy,
        agentStatus.retryCount
      );

      console.log(`[MultiAgentOrchestrator] Retrying ${event.agentType} in ${delay}ms (attempt ${agentStatus.retryCount})`);

      // Schedule retry
      setTimeout(async () => {
        await this.retryAgentExecution(execution, event.agentType);
      }, delay);

    } else {
      // Max retries exceeded
      agentStatus.status = 'failed';
      agentStatus.error = event.error.message;

      // Check if workflow should fail or continue with graceful degradation
      await this.handleAgentFailure(execution, event.agentType);
    }

    this.updateWorkflowProgress(execution);
  }

  private async handleEvaluationCompleted(event: { jobId: string }): Promise<void> {
    // Implementation would depend on specific event structure
    console.log(`[MultiAgentOrchestrator] Evaluation completed: ${event.jobId}`);
  }

  private handleAgentHealthUpdate(event: { agentType: AgentType; metadata: any }): void {
    // Monitor agent health and adjust workflow strategies if needed
    if (event.metadata.healthStatus === 'unhealthy') {
      console.warn(`[MultiAgentOrchestrator] Agent ${event.agentType} is unhealthy`);
      this.emit('agentHealthDegraded', event);
    }
  }

  // Helper Methods
  private findExecutionByAgentType(agentType: AgentType): WorkflowExecution | undefined {
    for (const execution of this.activeExecutions.values()) {
      if (execution.agentStatuses.has(agentType)) {
        return execution;
      }
    }
    return undefined;
  }

  private async checkWorkflowCompletion(execution: WorkflowExecution): Promise<void> {
    const allCompleted = Array.from(execution.agentStatuses.values())
      .every(status => status.status === 'completed' || status.status === 'failed' || status.status === 'skipped');

    if (allCompleted) {
      await this.completeWorkflow(execution);
    }
  }

  private async completeWorkflow(execution: WorkflowExecution): Promise<void> {
    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.progress = 100;

    // Aggregate results
    const results = Array.from(execution.agentStatuses.entries())
      .filter(([_, status]) => status.result)
      .map(([agentType, status]) => ({
        agentType,
        result: status.result!
      }));

    // Move to history
    this.executionHistory.set(execution.evaluationId, execution);
    this.activeExecutions.delete(execution.evaluationId);

    console.log(`[MultiAgentOrchestrator] Workflow completed: ${execution.workflowId} for evaluation: ${execution.evaluationId}`);
    this.emit('workflowCompleted', { execution, results });
  }

  private async retryAgentExecution(execution: WorkflowExecution, agentType: AgentType): Promise<void> {
    const agentStatus = execution.agentStatuses.get(agentType)!;
    agentStatus.status = 'running';
    agentStatus.startedAt = new Date();

    // Create retry job
    const retryJob: AgentExecutionJob = {
      evaluationId: execution.evaluationId,
      agentType,
      businessIdea: execution.metadata.businessIdea,
      context: {
        retryAttempt: agentStatus.retryCount,
        originalError: agentStatus.error
      },
      dependencies: this.extractAgentDependencies(execution, agentType),
      executionGroup: 0, // Will be recalculated
      isParallel: false
    };

    await this.queueManager.addAgentExecution(agentType, retryJob);
  }

  private async handleAgentFailure(execution: WorkflowExecution, failedAgentType: AgentType): Promise<void> {
    const workflow = this.workflows.get(execution.workflowId)!;
    
    // Check if this agent is critical for other agents
    const dependentAgents = Object.entries(workflow.dependencies)
      .filter(([_, deps]) => deps.includes(failedAgentType))
      .map(([agentType, _]) => agentType as AgentType);

    if (dependentAgents.length === 0) {
      // Non-critical agent, continue workflow
      console.log(`[MultiAgentOrchestrator] Non-critical agent ${failedAgentType} failed, continuing workflow`);
      return;
    }

    // Mark dependent agents as skipped
    for (const dependentAgent of dependentAgents) {
      const dependentStatus = execution.agentStatuses.get(dependentAgent);
      if (dependentStatus && dependentStatus.status === 'pending') {
        dependentStatus.status = 'skipped';
        console.log(`[MultiAgentOrchestrator] Skipping ${dependentAgent} due to failed dependency: ${failedAgentType}`);
      }
    }

    // Check if workflow can still produce meaningful results
    const completedAgents = Array.from(execution.agentStatuses.values())
      .filter(status => status.status === 'completed').length;

    if (completedAgents === 0) {
      // No agents completed, fail the workflow
      execution.status = 'failed';
      execution.completedAt = new Date();
      
      this.executionHistory.set(execution.evaluationId, execution);
      this.activeExecutions.delete(execution.evaluationId);
      
      this.emit('workflowFailed', { execution, reason: 'All critical agents failed' });
    }
  }

  private updateWorkflowProgress(execution: WorkflowExecution): void {
    const totalAgents = execution.agentStatuses.size;
    const completedAgents = Array.from(execution.agentStatuses.values())
      .filter(status => status.status === 'completed' || status.status === 'failed' || status.status === 'skipped').length;

    execution.progress = Math.round((completedAgents / totalAgents) * 100);
    
    this.emit('workflowProgress', {
      evaluationId: execution.evaluationId,
      progress: execution.progress,
      agentStatuses: execution.agentStatuses
    });
  }

  // Utility Methods
  private validateWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.id || !workflow.name) {
      throw new Error('Workflow must have id and name');
    }

    if (!workflow.agents || workflow.agents.length === 0) {
      throw new Error('Workflow must have at least one agent');
    }

    // Validate dependencies
    for (const [agent, deps] of Object.entries(workflow.dependencies)) {
      if (!workflow.agents.includes(agent as AgentType)) {
        throw new Error(`Dependency references unknown agent: ${agent}`);
      }
      
      for (const dep of deps) {
        if (!workflow.agents.includes(dep)) {
          throw new Error(`Dependency references unknown agent: ${dep}`);
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies(workflow.dependencies)) {
      throw new Error('Workflow has circular dependencies');
    }
  }

  private hasCircularDependencies(dependencies: Record<AgentType, AgentType[]>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (agent: string): boolean => {
      if (recursionStack.has(agent)) return true;
      if (visited.has(agent)) return false;

      visited.add(agent);
      recursionStack.add(agent);

      const deps = dependencies[agent as AgentType] || [];
      for (const dep of deps) {
        if (hasCycle(dep)) return true;
      }

      recursionStack.delete(agent);
      return false;
    };

    for (const agent of Object.keys(dependencies)) {
      if (hasCycle(agent)) return true;
    }

    return false;
  }

  private getGroupDependencies(agents: AgentType[], allDependencies: Record<AgentType, AgentType[]>): AgentType[] {
    const dependencies = new Set<AgentType>();
    
    for (const agent of agents) {
      const agentDeps = allDependencies[agent] || [];
      agentDeps.forEach(dep => dependencies.add(dep));
    }

    return Array.from(dependencies);
  }

  private estimateGroupDuration(agents: AgentType[]): number {
    // Rough estimates based on agent complexity (in milliseconds)
    const baseDurations = {
      'market-research': 120000, // 2 minutes
      'competitive-analysis': 180000, // 3 minutes
      'customer-research': 150000, // 2.5 minutes
      'technical-feasibility': 240000, // 4 minutes
      'financial-analysis': 200000 // 3.3 minutes
    };

    const maxDuration = Math.max(...agents.map(agent => 
      baseDurations[agent] || 120000
    ));

    return maxDuration; // Parallel execution takes as long as the slowest agent
  }

  private estimateMemoryRequirement(agents: AgentType[]): number {
    // Rough memory estimates in MB
    const baseMemory = {
      'market-research': 256,
      'competitive-analysis': 512,
      'customer-research': 384,
      'technical-feasibility': 768,
      'financial-analysis': 512
    };

    return agents.reduce((total, agent) => 
      total + (baseMemory[agent] || 256), 0
    );
  }

  private assessComputeIntensity(agents: AgentType[]): 'low' | 'medium' | 'high' {
    const intensityScores = {
      'market-research': 2,
      'competitive-analysis': 3,
      'customer-research': 2,
      'technical-feasibility': 4,
      'financial-analysis': 3
    };

    const avgIntensity = agents.reduce((total, agent) => 
      total + (intensityScores[agent] || 2), 0
    ) / agents.length;

    if (avgIntensity >= 3.5) return 'high';
    if (avgIntensity >= 2.5) return 'medium';
    return 'low';
  }

  private calculateRetryDelay(retryPolicy: WorkflowDefinition['retryPolicy'], attempt: number): number {
    const { backoffStrategy, baseDelay } = retryPolicy;

    switch (backoffStrategy) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return baseDelay * attempt;
      case 'fixed':
      default:
        return baseDelay;
    }
  }

  private extractAgentDependencies(execution: WorkflowExecution, agentType: AgentType): Record<AgentType, any> {
    const workflow = this.workflows.get(execution.workflowId)!;
    const dependencies = workflow.dependencies[agentType] || [];
    
    const result: Record<AgentType, any> = {};
    for (const dep of dependencies) {
      const depResult = execution.sharedContext.dependencies.get(dep);
      if (depResult) {
        result[dep] = depResult;
      }
    }

    return result;
  }

  // Public API
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  getExecutionHistory(limit?: number): WorkflowExecution[] {
    const history = Array.from(this.executionHistory.values());
    return limit ? history.slice(-limit) : history;
  }

  getExecutionStatus(evaluationId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(evaluationId) || this.executionHistory.get(evaluationId);
  }

  async cancelWorkflow(evaluationId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(evaluationId);
    if (!execution) return false;

    execution.status = 'cancelled';
    execution.completedAt = new Date();

    // Cancel queued agents
    for (const agentType of execution.agentStatuses.keys()) {
      await this.queueManager.pauseAgent(agentType);
    }

    this.executionHistory.set(evaluationId, execution);
    this.activeExecutions.delete(evaluationId);

    this.emit('workflowCancelled', { evaluationId, execution });
    return true;
  }

  async shutdown(): Promise<void> {
    console.log('[MultiAgentOrchestrator] Shutting down...');

    // Cancel all active workflows
    for (const evaluationId of this.activeExecutions.keys()) {
      await this.cancelWorkflow(evaluationId);
    }

    // Shutdown dependencies
    await this.queueManager.shutdown();
    await this.messageRouter.shutdown();

    this.workflows.clear();
    this.activeExecutions.clear();
    this.executionHistory.clear();

    this.removeAllListeners();
    this.isInitialized = false;

    console.log('[MultiAgentOrchestrator] Shutdown complete');
  }

  // Test utilities
  static async resetInstance(): Promise<void> {
    if (MultiAgentOrchestrator.instance) {
      await MultiAgentOrchestrator.instance.shutdown();
    }
    MultiAgentOrchestrator.instance = null as any;
  }
}