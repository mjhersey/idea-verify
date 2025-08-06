// Base WebSocket event interface
export interface WebSocketEvent {
  timestamp: Date;
}

// Agent progress event
export interface AgentProgressEvent extends WebSocketEvent {
  agentType: string;
  status: 'pending' | 'initializing' | 'running' | 'completed' | 'failed' | 'retrying';
  progressPercentage: number;
}

// Insight discovered event
export interface InsightDiscoveredEvent extends WebSocketEvent {
  agentType: string;
  insight: {
    type: string;
    content: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
  };
  confidence: number;
  metadata?: Record<string, any>;
}

// Evaluation status event
export interface EvaluationStatusEvent extends WebSocketEvent {
  evaluationId: string;
  overallProgress: number;
  activeAgents: string[];
  completedAgents: string[];
  failedAgents?: string[];
  estimatedCompletionTime?: Date;
}

// Agent completed event
export interface AgentCompletedEvent extends WebSocketEvent {
  agentType: string;
  evaluationId: string;
  resultSummary: {
    score: number;
    keyFindings: string[];
    recommendation: string;
  };
  executionTime: number;
  finalScore: number;
}

// Error event
export interface ErrorEvent extends WebSocketEvent {
  agentType?: string;
  evaluationId: string;
  error: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoveryActions?: string[];
}

// Evaluation completed event
export interface EvaluationCompletedEvent extends WebSocketEvent {
  evaluationId: string;
  finalResults: {
    overallScore: number;
    recommendation: 'highly-recommended' | 'recommended' | 'neutral' | 'not-recommended';
    summary: string;
  };
  totalTime: number;
  agentSummaries: Array<{
    agentType: string;
    score: number;
    executionTime: number;
  }>;
}

// Connection state
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

// WebSocket client options
export interface WebSocketClientOptions {
  url: string;
  token: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

// Subscription options
export interface SubscriptionOptions {
  evaluationId: string;
  onProgress?: (event: AgentProgressEvent) => void;
  onInsight?: (event: InsightDiscoveredEvent) => void;
  onStatus?: (event: EvaluationStatusEvent) => void;
  onAgentCompleted?: (event: AgentCompletedEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onCompleted?: (event: EvaluationCompletedEvent) => void;
}