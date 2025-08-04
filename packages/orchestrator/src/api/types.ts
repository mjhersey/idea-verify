/**
 * API Types and Interfaces
 * Defines the HTTP API contract for the orchestrator
 */

import { AgentType } from '@ai-validation/shared';

// Request types
export interface CreateEvaluationRequest {
  businessIdeaId: string;
  businessIdeaTitle: string;
  businessIdeaDescription: string;
  agentTypes?: AgentType[];
  priority?: 'low' | 'normal' | 'high';
  userId: string;
}

export interface UpdateEvaluationRequest {
  priority?: 'low' | 'normal' | 'high';
  agentTypes?: AgentType[];
}

// Response types
export interface EvaluationResponse {
  id: string;
  businessIdeaId: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high';
  progress: number;
  agentProgress: Record<AgentType, {
    agentType: AgentType;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errors?: string[];
}

export interface EvaluationResultResponse {
  evaluationId: string;
  businessIdeaId: string;
  status: 'completed' | 'failed';
  overallScore: number;
  agentResults: Array<{
    agentType: AgentType;
    success: boolean;
    score: number;
    confidence: 'low' | 'medium' | 'high';
    insights: any;
    executionTime: number;
    metadata: any;
  }>;
  completedAt: Date;
  totalTime: number;
  error?: string;
}

export interface EvaluationListResponse {
  evaluations: EvaluationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    orchestrator: boolean;
    llm: boolean;
    queue: boolean;
    database: boolean;
  };
  usingMockServices: boolean;
  metrics: {
    totalEvaluations: number;
    activeEvaluations: number;
    completedEvaluations: number;
    failedEvaluations: number;
    averageProcessingTime: number;
    averageScore: number;
  };
}

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Error codes
export const ERROR_CODES = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SYSTEM_UNAVAILABLE: 'SYSTEM_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EVALUATION_NOT_FOUND: 'EVALUATION_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  EVALUATION_ALREADY_EXISTS: 'EVALUATION_ALREADY_EXISTS',
  INVALID_AGENT_TYPE: 'INVALID_AGENT_TYPE',
  CONFLICT: 'CONFLICT'
} as const;

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

// WebSocket event types
export interface WebSocketEvent {
  type: 'evaluation-progress' | 'evaluation-completed' | 'evaluation-failed' | 'system-health';
  data: any;
  timestamp: string;
}

export interface EvaluationProgressEvent extends WebSocketEvent {
  type: 'evaluation-progress';
  data: {
    evaluationId: string;
    progress: number;
    status: string;
    agentProgress: Record<AgentType, any>;
  };
}

export interface EvaluationCompletedEvent extends WebSocketEvent {
  type: 'evaluation-completed';
  data: EvaluationResultResponse;
}

export interface EvaluationFailedEvent extends WebSocketEvent {
  type: 'evaluation-failed';
  data: {
    evaluationId: string;
    error: string;
    partialResults?: any[];
  };
}

export interface SystemHealthEvent extends WebSocketEvent {
  type: 'system-health';
  data: SystemHealthResponse;
}

// Query parameters
export interface EvaluationQueryParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'analyzing' | 'completed' | 'failed';
  userId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface AgentQueryParams {
  evaluationId?: string;
  agentType?: AgentType;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  page?: number;
  limit?: number;
}

// API routes
export const API_ROUTES = {
  // Evaluation endpoints
  CREATE_EVALUATION: '/api/evaluations',
  GET_EVALUATION: '/api/evaluations/:id',
  UPDATE_EVALUATION: '/api/evaluations/:id',
  DELETE_EVALUATION: '/api/evaluations/:id',
  LIST_EVALUATIONS: '/api/evaluations',
  GET_EVALUATION_RESULT: '/api/evaluations/:id/result',
  
  // Agent endpoints
  LIST_AGENT_RESULTS: '/api/agents/results',
  GET_AGENT_RESULT: '/api/agents/results/:id',
  
  // System endpoints
  HEALTH_CHECK: '/api/health',
  SYSTEM_STATUS: '/api/status',
  METRICS: '/api/metrics',
  
  // Development endpoints
  MOCK_SERVICES: '/api/dev/mock-services',
  RESET_SYSTEM: '/api/dev/reset',
  
  // WebSocket endpoint
  WEBSOCKET: '/ws'
} as const;

