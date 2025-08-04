/**
 * Agent Service - Executes agents and manages their lifecycle
 */

import { AgentType } from '@ai-validation/shared';
import { AgentFactory } from './agent-factory.js';
import { AgentRequest, AgentResponse, AgentExecutionContext } from './types.js';
import { MessageBus } from '../communication/message-bus.js';
import { 
  MessageType, 
  MessageHandler, 
  Message,
  AgentStartMessage,
  AgentProgressMessage,
  AgentCompleteMessage,
  AgentErrorMessage
} from '../communication/message-types.js';

export interface AgentExecutionResult {
  success: boolean;
  response?: AgentResponse;
  error?: string;
  retryCount: number;
  totalTime: number;
}

export class AgentService implements MessageHandler {
  private static instance: AgentService;
  private messageBus: MessageBus;
  private activeExecutions: Map<string, AbortController> = new Map();

  private constructor() {
    this.messageBus = MessageBus.getInstance();
    this.initializeMessageHandlers();
  }

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  private async initializeMessageHandlers(): Promise<void> {
    await this.messageBus.subscribe(MessageType.AGENT_START, this);
  }

  canHandle(message: Message): message is AgentStartMessage {
    return message.type === MessageType.AGENT_START;
  }

  async handle(message: Message): Promise<void> {
    if (message.type === MessageType.AGENT_START) {
      await this.handleAgentStartMessage(message as AgentStartMessage);
    }
  }

  private async handleAgentStartMessage(message: AgentStartMessage): Promise<void> {
    const { evaluationId, agentType, businessIdea, configuration } = message.payload;
    
    const request: AgentRequest = {
      businessIdea,
      analysisType: 'comprehensive',
      context: configuration || {}
    };

    const context: AgentExecutionContext = {
      evaluationId,
      correlationId: message.correlationId || message.id,
      requestId: message.id,
      userId: businessIdea.user_id || 'system',
      timestamp: message.timestamp
    };

    // Execute agent asynchronously
    this.executeAgentWithMessaging(agentType, request, context).catch(error => {
      console.error(`[AgentService] Unhandled error in agent execution:`, error);
    });
  }

  private async executeAgentWithMessaging(
    agentType: AgentType,
    request: AgentRequest,
    context: AgentExecutionContext
  ): Promise<void> {
    const executionId = `${context.evaluationId}-${agentType}`;
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    try {
      // Execute the agent with communication
      const result = await this.executeAgent(agentType, request, context, {
        maxRetries: 3,
        timeout: 60000, // 1 minute
        signal: abortController.signal
      });

      if (result.success && result.response) {
        // Publish completion message
        const completeMessage = this.messageBus.createMessage(
          MessageType.AGENT_COMPLETE,
          {
            evaluationId: context.evaluationId,
            agentType,
            result: result.response,
            executionTime: result.totalTime,
            metrics: {
              tokensUsed: result.response.metadata?.tokensUsed,
              apiCalls: result.response.metadata?.apiCalls,
              cacheHits: result.response.metadata?.cacheHits
            }
          }
        );

        await this.messageBus.publish(completeMessage);
      } else {
        // Publish error message
        const errorMessage = this.messageBus.createMessage(
          MessageType.AGENT_ERROR,
          {
            evaluationId: context.evaluationId,
            agentType,
            error: {
              code: 'EXECUTION_FAILED',
              message: result.error || 'Unknown error',
              retryable: result.retryCount < 3
            },
            context: { retryCount: result.retryCount }
          }
        );

        await this.messageBus.publish(errorMessage);
      }
    } catch (error) {
      console.error(`[AgentService] Agent execution failed:`, error);
      
      // Publish error message
      const errorMessage = this.messageBus.createMessage(
        MessageType.AGENT_ERROR,
        {
          evaluationId: context.evaluationId,
          agentType,
          error: {
            code: 'EXECUTION_EXCEPTION',
            message: error instanceof Error ? error.message : 'Unknown error',
            retryable: false
          }
        }
      );

      await this.messageBus.publish(errorMessage);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private async publishProgress(
    evaluationId: string,
    agentType: AgentType,
    progress: number,
    status: string,
    currentStep?: string
  ): Promise<void> {
    const progressMessage = this.messageBus.createMessage(
      MessageType.AGENT_PROGRESS,
      {
        evaluationId,
        agentType,
        progress,
        status,
        currentStep
      }
    );

    await this.messageBus.publish(progressMessage);
  }

  async executeAgent(
    agentType: AgentType,
    request: AgentRequest,
    context: AgentExecutionContext,
    options: {
      maxRetries?: number;
      timeout?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 30000; // 30 seconds

    console.log(`Executing agent: ${agentType} for evaluation: ${context.evaluationId}`);

    // Validate agent type
    if (!AgentFactory.isAgentSupported(agentType)) {
      return {
        success: false,
        error: `Agent type '${agentType}' is not supported`,
        retryCount: 0,
        totalTime: Date.now() - startTime
      };
    }

    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if execution was aborted
        if (options.signal?.aborted) {
          throw new Error('Agent execution was aborted');
        }

        console.log(`Agent ${agentType} attempt ${attempt + 1}/${maxRetries + 1}`);

        // Publish progress at start of attempt
        await this.publishProgress(
          context.evaluationId,
          agentType,
          (attempt / (maxRetries + 1)) * 100,
          `Attempt ${attempt + 1}/${maxRetries + 1}`
        );

        // Get agent instance
        const agent = AgentFactory.getAgent(agentType);

        // Execute with timeout and abort signal
        const response = await this.executeWithTimeout(
          () => agent.execute(request, context),
          timeout,
          options.signal
        );

        // Validate response
        this.validateResponse(response);

        console.log(`Agent ${agentType} completed successfully with score: ${response.score}`);

        return {
          success: true,
          response: {
            ...response,
            metadata: {
              ...response.metadata,
              retryCount: attempt
            }
          },
          retryCount: attempt,
          totalTime: Date.now() - startTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        console.warn(`Agent ${agentType} attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error(`Agent ${agentType} failed after ${maxRetries + 1} attempts:`, lastError?.message);

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retryCount,
      totalTime: Date.now() - startTime
    };
  }

  async executeMultipleAgents(
    agentRequests: Array<{
      agentType: AgentType;
      request: AgentRequest;
    }>,
    context: AgentExecutionContext,
    options: {
      maxRetries?: number;
      timeout?: number;
      concurrency?: number;
    } = {}
  ): Promise<AgentExecutionResult[]> {
    const concurrency = options.concurrency || 3;

    console.log(`Executing ${agentRequests.length} agents with concurrency: ${concurrency}`);

    // Execute agents in batches
    const results: AgentExecutionResult[] = [];
    
    for (let i = 0; i < agentRequests.length; i += concurrency) {
      const batch = agentRequests.slice(i, i + concurrency);
      
      const batchPromises = batch.map(({ agentType, request }) =>
        this.executeAgent(agentType, request, context, options)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Agent execution completed: ${successCount}/${results.length} successful`);

    return results;
  }

  getAvailableAgents(): Array<{
    type: AgentType;
    name: string;
    description: string;
  }> {
    return AgentFactory.getAvailableAgentTypes().map(type => {
      const agent = AgentFactory.getAgent(type);
      return {
        type,
        name: agent.getName(),
        description: agent.getDescription()
      };
    });
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (signal?.aborted) {
        reject(new Error('Operation was aborted'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Agent execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Handle abort signal
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Agent execution was aborted'));
      };

      signal?.addEventListener('abort', abortHandler);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          signal?.removeEventListener('abort', abortHandler);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          signal?.removeEventListener('abort', abortHandler);
          reject(error);
        });
    });
  }

  private validateResponse(response: AgentResponse): void {
    if (!response) {
      throw new Error('Agent response is null or undefined');
    }

    if (typeof response.score !== 'number' || response.score < 0 || response.score > 100) {
      throw new Error('Agent response score must be a number between 0 and 100');
    }

    if (!Array.isArray(response.insights)) {
      throw new Error('Agent response insights must be an array');
    }

    if (!['high', 'medium', 'low'].includes(response.confidence)) {
      throw new Error('Agent response confidence must be high, medium, or low');
    }

    if (!response.metadata || typeof response.metadata !== 'object') {
      throw new Error('Agent response metadata is required');
    }

    if (!response.rawData || typeof response.rawData !== 'object') {
      throw new Error('Agent response rawData is required');
    }
  }

  // Public API methods

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  async cancelExecution(evaluationId: string, agentType: AgentType): Promise<boolean> {
    const executionId = `${evaluationId}-${agentType}`;
    const controller = this.activeExecutions.get(executionId);
    
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(executionId);
      console.log(`[AgentService] Cancelled execution: ${executionId}`);
      return true;
    }
    
    return false;
  }

  async cancelAllExecutions(): Promise<void> {
    const executionIds = Array.from(this.activeExecutions.keys());
    
    for (const executionId of executionIds) {
      const controller = this.activeExecutions.get(executionId);
      if (controller) {
        controller.abort();
      }
    }
    
    this.activeExecutions.clear();
    console.log(`[AgentService] Cancelled all executions (${executionIds.length})`);
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      activeExecutions: number;
      supportedAgents: string[];
      messageBusStatus: any;
    };
  }> {
    const messageBusHealth = await this.messageBus.healthCheck();
    const activeExecutions = this.activeExecutions.size;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (activeExecutions > 50) {
      status = 'degraded';
    }
    if (activeExecutions > 100 || messageBusHealth.status === 'unhealthy') {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        activeExecutions,
        supportedAgents: AgentFactory.getAvailableAgentTypes(),
        messageBusStatus: messageBusHealth
      }
    };
  }

  async shutdown(): Promise<void> {
    console.log('[AgentService] Shutting down...');
    
    // Cancel all active executions
    await this.cancelAllExecutions();
    
    // Unsubscribe from message bus
    await this.messageBus.unsubscribe(MessageType.AGENT_START, this);
    
    console.log('[AgentService] Shutdown complete');
  }

  // Test utilities
  static resetInstance(): void {
    if (AgentService.instance) {
      AgentService.instance.shutdown();
    }
    AgentService.instance = null as any;
  }

  resetState(): void {
    this.activeExecutions.clear();
  }
}