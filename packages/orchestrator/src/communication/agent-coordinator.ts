/**
 * Agent Coordinator
 * Manages agent dependencies, communication, and workflow orchestration
 */

import { AgentType, BusinessIdea, AgentResult } from '@ai-validation/shared';
import { MessageBus } from './message-bus.js';
import { 
  Message,
  MessageType,
  MessageHandler,
  AgentStartMessage,
  AgentCompleteMessage,
  AgentErrorMessage,
  AgentProgressMessage,
  AgentDependencyCompleteMessage,
  AgentDataRequestMessage,
  AgentDataResponseMessage
} from './message-types.js';

export interface AgentDependency {
  agentType: AgentType;
  dependsOn: AgentType[];
  optional?: boolean;
}

export interface AgentWorkflow {
  evaluationId: string;
  businessIdea: BusinessIdea;
  agents: AgentDependency[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentExecutionState {
  agentType: AgentType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: AgentResult;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  dependencies: AgentType[];
  dependents: AgentType[];
}

export class AgentCoordinator implements MessageHandler {
  private messageBus: MessageBus;
  private workflows: Map<string, AgentWorkflow> = new Map();
  private agentStates: Map<string, Map<AgentType, AgentExecutionState>> = new Map();
  private agentData: Map<string, Map<AgentType, any>> = new Map();

  constructor() {
    this.messageBus = MessageBus.getInstance();
    this.initializeMessageHandlers();
  }

  private async initializeMessageHandlers(): Promise<void> {
    await this.messageBus.subscribe(MessageType.AGENT_COMPLETE, this);
    await this.messageBus.subscribe(MessageType.AGENT_ERROR, this);
    await this.messageBus.subscribe(MessageType.AGENT_PROGRESS, this);
    await this.messageBus.subscribe(MessageType.AGENT_DATA_REQUEST, this);
  }

  canHandle(message: Message): message is Message {
    return [
      MessageType.AGENT_COMPLETE,
      MessageType.AGENT_ERROR,
      MessageType.AGENT_PROGRESS,
      MessageType.AGENT_DATA_REQUEST
    ].includes(message.type);
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case MessageType.AGENT_COMPLETE:
        await this.handleAgentComplete(message as AgentCompleteMessage);
        break;
      case MessageType.AGENT_ERROR:
        await this.handleAgentError(message as AgentErrorMessage);
        break;
      case MessageType.AGENT_PROGRESS:
        await this.handleAgentProgress(message as AgentProgressMessage);
        break;
      case MessageType.AGENT_DATA_REQUEST:
        await this.handleAgentDataRequest(message as AgentDataRequestMessage);
        break;
    }
  }

  async startWorkflow(
    evaluationId: string,
    businessIdea: BusinessIdea,
    agentTypes: AgentType[]
  ): Promise<void> {
    console.log(`[AgentCoordinator] Starting workflow for evaluation: ${evaluationId}`);

    // Create agent dependencies based on predefined workflow
    const agentDependencies = this.createAgentDependencies(agentTypes);

    // Initialize workflow
    const workflow: AgentWorkflow = {
      evaluationId,
      businessIdea,
      agents: agentDependencies,
      status: 'running',
      startedAt: new Date()
    };

    this.workflows.set(evaluationId, workflow);

    // Initialize agent states
    const agentStatesMap = new Map<AgentType, AgentExecutionState>();
    const agentDataMap = new Map<AgentType, any>();

    for (const dependency of agentDependencies) {
      agentStatesMap.set(dependency.agentType, {
        agentType: dependency.agentType,
        status: 'pending',
        progress: 0,
        dependencies: dependency.dependsOn,
        dependents: this.getDependents(dependency.agentType, agentDependencies)
      });
    }

    this.agentStates.set(evaluationId, agentStatesMap);
    this.agentData.set(evaluationId, agentDataMap);

    // Start agents that have no dependencies
    await this.startReadyAgents(evaluationId);
  }

  private createAgentDependencies(agentTypes: AgentType[]): AgentDependency[] {
    // Define standard workflow dependencies
    const dependencies: AgentDependency[] = [];

    // Market research is usually first (no dependencies)
    if (agentTypes.includes('market-research')) {
      dependencies.push({
        agentType: 'market-research',
        dependsOn: []
      });
    }

    // Competitive analysis can run in parallel with market research
    if (agentTypes.includes('competitive-analysis')) {
      dependencies.push({
        agentType: 'competitive-analysis',
        dependsOn: []
      });
    }

    // Customer research depends on market research
    if (agentTypes.includes('customer-research')) {
      dependencies.push({
        agentType: 'customer-research',
        dependsOn: agentTypes.includes('market-research') ? ['market-research'] : []
      });
    }

    // Technical feasibility can run independently
    if (agentTypes.includes('technical-feasibility')) {
      dependencies.push({
        agentType: 'technical-feasibility',
        dependsOn: []
      });
    }

    // Financial analysis depends on market research and customer research
    if (agentTypes.includes('financial-analysis')) {
      const deps: AgentType[] = [];
      if (agentTypes.includes('market-research')) deps.push('market-research');
      if (agentTypes.includes('customer-research')) deps.push('customer-research');
      
      dependencies.push({
        agentType: 'financial-analysis',
        dependsOn: deps
      });
    }

    return dependencies;
  }

  private getDependents(agentType: AgentType, dependencies: AgentDependency[]): AgentType[] {
    return dependencies
      .filter(dep => dep.dependsOn.includes(agentType))
      .map(dep => dep.agentType);
  }

  private async startReadyAgents(evaluationId: string): Promise<void> {
    const agentStates = this.agentStates.get(evaluationId);
    const workflow = this.workflows.get(evaluationId);

    if (!agentStates || !workflow) {
      console.error(`[AgentCoordinator] No workflow found for evaluation: ${evaluationId}`);
      return;
    }

    for (const [agentType, state] of agentStates) {
      if (state.status === 'pending' && this.areDependenciesSatisfied(evaluationId, agentType)) {
        await this.startAgent(evaluationId, agentType, workflow.businessIdea);
      }
    }
  }

  private areDependenciesSatisfied(evaluationId: string, agentType: AgentType): boolean {
    const agentStates = this.agentStates.get(evaluationId);
    if (!agentStates) return false;

    const state = agentStates.get(agentType);
    if (!state) return false;

    return state.dependencies.every(depType => {
      const depState = agentStates.get(depType);
      return depState?.status === 'completed';
    });
  }

  private async startAgent(
    evaluationId: string,
    agentType: AgentType,
    businessIdea: BusinessIdea
  ): Promise<void> {
    console.log(`[AgentCoordinator] Starting agent: ${agentType} for evaluation: ${evaluationId}`);

    // Update agent state
    const agentStates = this.agentStates.get(evaluationId);
    if (agentStates) {
      const state = agentStates.get(agentType);
      if (state) {
        state.status = 'running';
        state.startedAt = new Date();
      }
    }

    // Gather dependency data
    const dependencyData = this.gatherDependencyData(evaluationId, agentType);

    // Create and publish agent start message
    const message = this.messageBus.createMessage(
      MessageType.AGENT_START,
      {
        evaluationId,
        agentType,
        businessIdea,
        dependencies: dependencyData ? Object.keys(dependencyData) : [],
        configuration: dependencyData
      }
    );

    await this.messageBus.publish(message);
  }

  private gatherDependencyData(evaluationId: string, agentType: AgentType): any {
    const agentStates = this.agentStates.get(evaluationId);
    const agentData = this.agentData.get(evaluationId);

    if (!agentStates || !agentData) return null;

    const state = agentStates.get(agentType);
    if (!state) return null;

    const dependencyData: any = {};

    for (const depType of state.dependencies) {
      const depData = agentData.get(depType);
      if (depData) {
        dependencyData[depType] = depData;
      }
    }

    return Object.keys(dependencyData).length > 0 ? dependencyData : null;
  }

  private async handleAgentComplete(message: AgentCompleteMessage): Promise<void> {
    const { evaluationId, agentType, result } = message.payload;
    
    console.log(`[AgentCoordinator] Agent completed: ${agentType} for evaluation: ${evaluationId}`);

    // Update agent state
    const agentStates = this.agentStates.get(evaluationId);
    if (agentStates) {
      const state = agentStates.get(agentType);
      if (state) {
        state.status = 'completed';
        state.progress = 100;
        state.result = result;
        state.completedAt = new Date();
      }
    }

    // Store agent data for dependents
    const agentData = this.agentData.get(evaluationId);
    if (agentData) {
      agentData.set(agentType, {
        result,
        completedAt: new Date(),
        insights: result.insights,
        score: result.score
      });
    }

    // Notify dependent agents
    await this.notifyDependentAgents(evaluationId, agentType, result);

    // Start any newly ready agents
    await this.startReadyAgents(evaluationId);

    // Check if workflow is complete
    await this.checkWorkflowCompletion(evaluationId);
  }

  private async handleAgentError(message: AgentErrorMessage): Promise<void> {
    const { evaluationId, agentType, error } = message.payload;
    
    console.error(`[AgentCoordinator] Agent error: ${agentType} for evaluation: ${evaluationId}`, error);

    // Update agent state
    const agentStates = this.agentStates.get(evaluationId);
    if (agentStates) {
      const state = agentStates.get(agentType);
      if (state) {
        state.status = 'failed';
        state.error = error.message;
        state.completedAt = new Date();
      }
    }

    // Handle error based on whether it's retryable and dependencies
    if (error.retryable) {
      // Could implement retry logic here
      console.log(`[AgentCoordinator] Agent ${agentType} failed but is retryable`);
    } else {
      // Check if we can continue without this agent
      await this.handleNonRetryableError(evaluationId, agentType);
    }

    // Check if workflow can still complete or should be failed
    await this.checkWorkflowCompletion(evaluationId);
  }

  private async handleAgentProgress(message: AgentProgressMessage): Promise<void> {
    const { evaluationId, agentType, progress, status } = message.payload;

    // Update agent state
    const agentStates = this.agentStates.get(evaluationId);
    if (agentStates) {
      const state = agentStates.get(agentType);
      if (state) {
        state.progress = progress;
      }
    }

    // Publish overall workflow progress
    await this.publishWorkflowProgress(evaluationId);
  }

  private async handleAgentDataRequest(message: AgentDataRequestMessage): Promise<void> {
    const { evaluationId, requestingAgent, targetAgent, dataType, parameters } = message.payload;

    console.log(`[AgentCoordinator] Data request: ${requestingAgent} requesting ${dataType} from ${targetAgent}`);

    const agentData = this.agentData.get(evaluationId);
    if (!agentData) {
      await this.sendDataResponse(message, null, false, 'Evaluation not found');
      return;
    }

    const targetData = agentData.get(targetAgent);
    if (!targetData) {
      await this.sendDataResponse(message, null, false, 'Target agent data not available');
      return;
    }

    // Extract requested data type
    let responseData: any = null;
    let success = false;

    switch (dataType) {
      case 'result':
        responseData = targetData.result;
        success = true;
        break;
      case 'insights':
        responseData = targetData.insights;
        success = true;
        break;
      case 'score':
        responseData = targetData.score;
        success = true;
        break;
      default:
        responseData = targetData[dataType];
        success = responseData !== undefined;
        break;
    }

    await this.sendDataResponse(message, responseData, success);
  }

  private async sendDataResponse(
    originalMessage: AgentDataRequestMessage,
    data: any,
    success: boolean,
    error?: string
  ): Promise<void> {
    const response = this.messageBus.createMessage(
      MessageType.AGENT_DATA_RESPONSE,
      {
        evaluationId: originalMessage.payload.evaluationId,
        sourceAgent: originalMessage.payload.targetAgent,
        targetAgent: originalMessage.payload.requestingAgent,
        dataType: originalMessage.payload.dataType,
        data,
        success,
        error
      },
      {
        replyTo: originalMessage.correlationId
      }
    );

    await this.messageBus.publish(response);
  }

  private async notifyDependentAgents(
    evaluationId: string,
    completedAgent: AgentType,
    result: AgentResult
  ): Promise<void> {
    const agentStates = this.agentStates.get(evaluationId);
    if (!agentStates) return;

    const completedState = agentStates.get(completedAgent);
    if (!completedState) return;

    const dependentAgents = completedState.dependents;

    if (dependentAgents.length > 0) {
      const message = this.messageBus.createMessage(
        MessageType.AGENT_DEPENDENCY_COMPLETE,
        {
          evaluationId,
          completedAgent,
          dependentAgents,
          result
        }
      );

      await this.messageBus.publish(message);
    }
  }

  private async handleNonRetryableError(evaluationId: string, failedAgent: AgentType): Promise<void> {
    const agentStates = this.agentStates.get(evaluationId);
    if (!agentStates) return;

    // Mark dependent agents as failed if they require this agent
    for (const [agentType, state] of agentStates) {
      if (state.dependencies.includes(failedAgent) && state.status === 'pending') {
        state.status = 'failed';
        state.error = `Dependency ${failedAgent} failed`;
        state.completedAt = new Date();
      }
    }
  }

  private async publishWorkflowProgress(evaluationId: string): Promise<void> {
    const agentStates = this.agentStates.get(evaluationId);
    if (!agentStates) return;

    const states = Array.from(agentStates.values());
    const totalAgents = states.length;
    const completedAgents = states.filter(s => s.status === 'completed').map(s => s.agentType);
    const runningAgents = states.filter(s => s.status === 'running').map(s => s.agentType);
    const pendingAgents = states.filter(s => s.status === 'pending').map(s => s.agentType);
    const failedAgents = states
      .filter(s => s.status === 'failed')
      .map(s => ({ agentType: s.agentType, error: s.error || 'Unknown error' }));

    const overallProgress = totalAgents > 0 
      ? Math.round((completedAgents.length / totalAgents) * 100)
      : 0;

    const message = this.messageBus.createMessage(
      MessageType.EVALUATION_PROGRESS,
      {
        evaluationId,
        overallProgress,
        completedAgents,
        runningAgents,
        pendingAgents,
        failedAgents
      }
    );

    await this.messageBus.publish(message);
  }

  private async checkWorkflowCompletion(evaluationId: string): Promise<void> {
    const agentStates = this.agentStates.get(evaluationId);
    const workflow = this.workflows.get(evaluationId);

    if (!agentStates || !workflow) return;

    const states = Array.from(agentStates.values());
    const allComplete = states.every(s => s.status === 'completed' || s.status === 'failed');

    if (allComplete) {
      workflow.status = states.some(s => s.status === 'completed') ? 'completed' : 'failed';
      workflow.completedAt = new Date();

      const results = states
        .filter(s => s.result)
        .map(s => s.result!);

      const summary = {
        totalAgents: states.length,
        successfulAgents: states.filter(s => s.status === 'completed').length,
        failedAgents: states.filter(s => s.status === 'failed').length,
        averageScore: results.length > 0 
          ? results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length 
          : 0
      };

      if (workflow.status === 'completed') {
        const message = this.messageBus.createMessage(
          MessageType.EVALUATION_COMPLETE,
          {
            evaluationId,
            results,
            overallScore: summary.averageScore,
            completionTime: workflow.completedAt.getTime() - workflow.startedAt!.getTime(),
            summary
          }
        );

        await this.messageBus.publish(message);
      } else {
        const message = this.messageBus.createMessage(
          MessageType.EVALUATION_ERROR,
          {
            evaluationId,
            error: {
              code: 'WORKFLOW_FAILED',
              message: 'All agents failed to complete successfully',
              phase: 'execution'
            },
            partialResults: results
          }
        );

        await this.messageBus.publish(message);
      }

      console.log(`[AgentCoordinator] Workflow ${workflow.status} for evaluation: ${evaluationId}`);
    }
  }

  // Public API methods

  getWorkflowStatus(evaluationId: string): AgentWorkflow | undefined {
    return this.workflows.get(evaluationId);
  }

  getAgentStates(evaluationId: string): Map<AgentType, AgentExecutionState> | undefined {
    return this.agentStates.get(evaluationId);
  }

  async cancelWorkflow(evaluationId: string): Promise<void> {
    const workflow = this.workflows.get(evaluationId);
    if (workflow && workflow.status === 'running') {
      workflow.status = 'failed';
      workflow.completedAt = new Date();

      // Clean up resources
      this.agentStates.delete(evaluationId);
      this.agentData.delete(evaluationId);

      console.log(`[AgentCoordinator] Cancelled workflow for evaluation: ${evaluationId}`);
    }
  }

  async shutdown(): Promise<void> {
    console.log('[AgentCoordinator] Shutting down...');

    // Cancel all running workflows
    for (const [evaluationId, workflow] of this.workflows) {
      if (workflow.status === 'running') {
        await this.cancelWorkflow(evaluationId);
      }
    }

    // Clear all data
    this.workflows.clear();
    this.agentStates.clear();
    this.agentData.clear();

    console.log('[AgentCoordinator] Shutdown complete');
  }

  // Test utilities
  resetState(): void {
    this.workflows.clear();
    this.agentStates.clear();
    this.agentData.clear();
  }
}