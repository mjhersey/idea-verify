export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ValidationError {
  field: string
  message: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta
}

export * from '../stores/evaluation'

// Re-export WebSocket types from shared package for convenience
export type {
  ConnectionState,
  WebSocketClientOptions,
  SubscriptionOptions,
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent
} from '@ai-validation/shared';

// Frontend-specific WebSocket types
export interface WebSocketConnection {
  state: import('@ai-validation/shared').ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;
  lastError?: string;
  reconnectAttempts: number;
  usingSse: boolean;
}

export interface EvaluationProgress {
  evaluationId: string;
  overallProgress: number;
  activeAgents: string[];
  completedAgents: string[];
  failedAgents: string[];
  estimatedCompletionTime?: Date;
  agentProgresses: Record<string, {
    status: string;
    progressPercentage: number;
    lastUpdate: Date;
  }>;
}

export interface NotificationMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
}

export interface EvaluationInsight {
  id: string;
  agentType: string;
  type: string;
  content: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}