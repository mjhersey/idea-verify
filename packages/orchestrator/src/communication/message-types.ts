/**
 * Message Types for Agent Communication
 * Defines the structure of messages exchanged between agents and orchestrator
 */

import { AgentType, BusinessIdea, AgentResult } from '@ai-validation/shared';

export interface BaseMessage {
  id: string;
  timestamp: Date;
  type: MessageType;
  correlationId?: string;
  replyTo?: string;
}

export enum MessageType {
  // Agent execution messages
  AGENT_START = 'agent_start',
  AGENT_PROGRESS = 'agent_progress',
  AGENT_COMPLETE = 'agent_complete',
  AGENT_ERROR = 'agent_error',
  
  // Orchestrator messages
  EVALUATION_START = 'evaluation_start',
  EVALUATION_PROGRESS = 'evaluation_progress',
  EVALUATION_COMPLETE = 'evaluation_complete',
  EVALUATION_ERROR = 'evaluation_error',
  
  // Inter-agent communication
  AGENT_DATA_REQUEST = 'agent_data_request',
  AGENT_DATA_RESPONSE = 'agent_data_response',
  AGENT_DEPENDENCY_COMPLETE = 'agent_dependency_complete',
  
  // System messages
  HEALTH_CHECK = 'health_check',
  SHUTDOWN = 'shutdown'
}

export interface AgentStartMessage extends BaseMessage {
  type: MessageType.AGENT_START;
  payload: {
    evaluationId: string;
    agentType: AgentType;
    businessIdea: BusinessIdea;
    dependencies?: string[];
    configuration?: any;
  };
}

export interface AgentProgressMessage extends BaseMessage {
  type: MessageType.AGENT_PROGRESS;
  payload: {
    evaluationId: string;
    agentType: AgentType;
    progress: number; // 0-100
    status: string;
    currentStep?: string;
    estimatedTimeRemaining?: number;
  };
}

export interface AgentCompleteMessage extends BaseMessage {
  type: MessageType.AGENT_COMPLETE;
  payload: {
    evaluationId: string;
    agentType: AgentType;
    result: AgentResult;
    executionTime: number;
    metrics?: {
      tokensUsed?: number;
      apiCalls?: number;
      cacheHits?: number;
    };
  };
}

export interface AgentErrorMessage extends BaseMessage {
  type: MessageType.AGENT_ERROR;
  payload: {
    evaluationId: string;
    agentType: AgentType;
    error: {
      code: string;
      message: string;
      details?: any;
      retryable: boolean;
    };
    context?: any;
  };
}

export interface EvaluationStartMessage extends BaseMessage {
  type: MessageType.EVALUATION_START;
  payload: {
    evaluationId: string;
    businessIdea: BusinessIdea;
    priority: 'low' | 'normal' | 'high';
    requestedAgents: AgentType[];
  };
}

export interface EvaluationProgressMessage extends BaseMessage {
  type: MessageType.EVALUATION_PROGRESS;
  payload: {
    evaluationId: string;
    overallProgress: number; // 0-100
    completedAgents: AgentType[];
    runningAgents: AgentType[];
    pendingAgents: AgentType[];
    failedAgents: Array<{
      agentType: AgentType;
      error: string;
    }>;
  };
}

export interface EvaluationCompleteMessage extends BaseMessage {
  type: MessageType.EVALUATION_COMPLETE;
  payload: {
    evaluationId: string;
    results: AgentResult[];
    overallScore?: number;
    completionTime: number;
    summary: {
      totalAgents: number;
      successfulAgents: number;
      failedAgents: number;
      averageScore: number;
    };
  };
}

export interface EvaluationErrorMessage extends BaseMessage {
  type: MessageType.EVALUATION_ERROR;
  payload: {
    evaluationId: string;
    error: {
      code: string;
      message: string;
      phase: 'initialization' | 'execution' | 'completion';
    };
    partialResults?: AgentResult[];
  };
}

export interface AgentDataRequestMessage extends BaseMessage {
  type: MessageType.AGENT_DATA_REQUEST;
  payload: {
    evaluationId: string;
    requestingAgent: AgentType;
    targetAgent: AgentType;
    dataType: string;
    parameters?: any;
  };
}

export interface AgentDataResponseMessage extends BaseMessage {
  type: MessageType.AGENT_DATA_RESPONSE;
  payload: {
    evaluationId: string;
    sourceAgent: AgentType;
    targetAgent: AgentType;
    dataType: string;
    data: any;
    success: boolean;
    error?: string;
  };
}

export interface AgentDependencyCompleteMessage extends BaseMessage {
  type: MessageType.AGENT_DEPENDENCY_COMPLETE;
  payload: {
    evaluationId: string;
    completedAgent: AgentType;
    dependentAgents: AgentType[];
    result: AgentResult;
  };
}

export interface HealthCheckMessage extends BaseMessage {
  type: MessageType.HEALTH_CHECK;
  payload: {
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: any;
  };
}

export interface ShutdownMessage extends BaseMessage {
  type: MessageType.SHUTDOWN;
  payload: {
    graceful: boolean;
    timeoutMs?: number;
    reason?: string;
  };
}

export type Message = 
  | AgentStartMessage
  | AgentProgressMessage
  | AgentCompleteMessage
  | AgentErrorMessage
  | EvaluationStartMessage
  | EvaluationProgressMessage
  | EvaluationCompleteMessage
  | EvaluationErrorMessage
  | AgentDataRequestMessage
  | AgentDataResponseMessage
  | AgentDependencyCompleteMessage
  | HealthCheckMessage
  | ShutdownMessage;

export interface MessageHandler<T extends Message = Message> {
  canHandle(message: Message): message is T;
  handle(message: T): Promise<void>;
}

export interface MessageBus {
  publish(message: Message): Promise<void>;
  subscribe<T extends Message>(
    messageType: MessageType,
    handler: MessageHandler<T>
  ): Promise<void>;
  unsubscribe(messageType: MessageType, handler: MessageHandler): Promise<void>;
  request<TRequest extends Message, TResponse extends Message>(
    message: TRequest,
    timeoutMs?: number
  ): Promise<TResponse>;
}