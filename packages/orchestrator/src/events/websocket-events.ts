// Re-export WebSocket event types from shared package
export {
  WebSocketEvent,
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent,
  ConnectionState,
  WebSocketClientOptions,
  SubscriptionOptions
} from '@ai-validation/shared';

// Additional orchestrator-specific event types
export interface AgentExecutionStarted {
  evaluationId: string;
  agentType: string;
  timestamp: Date;
  executionContext: {
    businessIdea: {
      id: string;
      title: string;
      description: string;
    };
    priority: string;
    expectedDuration?: number;
  };
}

export interface AgentExecutionProgress {
  evaluationId: string;
  agentType: string;
  stage: string;
  progress: number;
  message?: string;
  timestamp: Date;
}

export interface AgentExecutionError {
  evaluationId: string;
  agentType: string;
  error: Error;
  retryAttempt: number;
  maxRetries: number;
  timestamp: Date;
}

export interface EvaluationQueued {
  evaluationId: string;
  agentTypes: string[];
  priority: string;
  queuePosition: number;
  estimatedStartTime?: Date;
  timestamp: Date;
}

export interface EvaluationStarted {
  evaluationId: string;
  agentTypes: string[];
  startTime: Date;
  estimatedDuration?: number;
}

export interface EvaluationProgressUpdate {
  evaluationId: string;
  overallProgress: number;
  agentStatuses: Array<{
    agentType: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
  }>;
  timestamp: Date;
}