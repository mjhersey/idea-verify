/**
 * API Module Exports
 * Provides HTTP and WebSocket API functionality for the orchestrator
 */

export * from './types.js'
export { APIRouter } from './router.js'
export { WebSocketServer } from './websocket.js'
export { ErrorHandler } from './error-handler.js'
export { RequestValidator } from './request-validator.js'

// API utilities
export { formatEvaluationResponse, formatAgentResultResponse } from './utils.js'

// Re-export types for convenience
export type {
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
  EvaluationResponse,
  EvaluationResultResponse,
  EvaluationListResponse,
  SystemHealthResponse,
  ErrorResponse,
  WebSocketEvent,
  EvaluationProgressEvent,
  EvaluationCompletedEvent,
  EvaluationFailedEvent,
  SystemHealthEvent,
  EvaluationQueryParams,
  AgentQueryParams,
} from './types.js'
