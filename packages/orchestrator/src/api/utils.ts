/**
 * API Utility Functions
 * Helper functions for formatting API responses and handling common operations
 */

import { AgentType } from '@ai-validation/shared';
import {
  EvaluationResponse,
  EvaluationResultResponse,
  EvaluationListResponse,
  SystemHealthResponse
} from './types.js';

// Response formatting functions

export function formatEvaluationResponse(progress: any): EvaluationResponse {
  if (!progress) {
    throw new Error('Progress data is required to format evaluation response');
  }

  return {
    id: progress.evaluationId,
    businessIdeaId: progress.businessIdeaId,
    status: progress.status,
    priority: progress.priority || 'normal',
    progress: progress.progress,
    agentProgress: progress.agentProgress || {},
    createdAt: progress.createdAt || new Date(),
    startedAt: progress.startedAt,
    completedAt: progress.completedAt,
    errors: progress.errors
  };
}

export function formatAgentResultResponse(agentResult: any): any {
  if (!agentResult) {
    throw new Error('Agent result data is required to format response');
  }

  return {
    evaluationId: agentResult.evaluationId,
    businessIdeaId: agentResult.businessIdeaId,
    agentType: agentResult.agentType,
    success: agentResult.success,
    score: agentResult.score,
    confidence: agentResult.confidence,
    insights: agentResult.insights,
    executionTime: agentResult.executionTime,
    metadata: agentResult.metadata,
    completedAt: agentResult.completedAt,
    error: agentResult.error
  };
}

export function formatEvaluationListResponse(
  evaluations: any[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): EvaluationListResponse {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  return {
    evaluations: evaluations.map(formatEvaluationResponse),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1
    }
  };
}

export function formatSystemHealthResponse(
  health: any,
  metrics?: any
): SystemHealthResponse {
  return {
    status: health.status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: health.services || {
      orchestrator: true,
      llm: true,
      queue: true,
      database: true
    },
    usingMockServices: health.usingMockServices || false,
    metrics: metrics || {
      totalEvaluations: 0,
      activeEvaluations: 0,
      completedEvaluations: 0,
      failedEvaluations: 0,
      averageProcessingTime: 0,
      averageScore: 0
    }
  };
}

// Validation helpers

export function isValidAgentType(agentType: string): agentType is AgentType {
  const validTypes: AgentType[] = [
    'market-research',
    'competitive-analysis',
    'customer-research',
    'technical-feasibility',
    'financial-analysis'
  ];
  return validTypes.includes(agentType as AgentType);
}

export function isValidPriority(priority: string): priority is 'low' | 'normal' | 'high' {
  return ['low', 'normal', 'high'].includes(priority);
}

export function isValidStatus(status: string): status is 'pending' | 'analyzing' | 'completed' | 'failed' {
  return ['pending', 'analyzing', 'completed', 'failed'].includes(status);
}

export function isValidAgentStatus(status: string): status is 'pending' | 'running' | 'completed' | 'failed' {
  return ['pending', 'running', 'completed', 'failed'].includes(status);
}

export function isValidSortBy(sortBy: string): sortBy is 'createdAt' | 'updatedAt' | 'priority' {
  return ['createdAt', 'updatedAt', 'priority'].includes(sortBy);
}

export function isValidSortOrder(sortOrder: string): sortOrder is 'asc' | 'desc' {
  return ['asc', 'desc'].includes(sortOrder);
}

// Data transformation helpers

export function sanitizeEvaluationInput(input: any): {
  businessIdeaId: string;
  businessIdeaTitle: string;
  businessIdeaDescription: string;
  agentTypes?: AgentType[];
  priority?: 'low' | 'normal' | 'high';
  userId: string;
} {
  return {
    businessIdeaId: String(input.businessIdeaId || '').trim(),
    businessIdeaTitle: String(input.businessIdeaTitle || '').trim(),
    businessIdeaDescription: String(input.businessIdeaDescription || '').trim(),
    ...(input.agentTypes && Array.isArray(input.agentTypes) && {
      agentTypes: input.agentTypes.filter(isValidAgentType)
    }),
    ...(input.priority && isValidPriority(input.priority) && {
      priority: input.priority
    }),
    userId: String(input.userId || '').trim()
  };
}

export function buildDatabaseQuery(params: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: string;
}): {
  offset: number;
  limit: number;
  where: any;
  orderBy: any;
} {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const where: any = {};
  if (params.status && isValidStatus(params.status)) {
    where.status = params.status;
  }
  if (params.userId) {
    where.userId = params.userId;
  }

  const orderBy: any = {};
  const sortBy = params.sortBy && isValidSortBy(params.sortBy) ? params.sortBy : 'createdAt';
  const sortOrder = params.sortOrder && isValidSortOrder(params.sortOrder) ? params.sortOrder : 'desc';
  orderBy[sortBy] = sortOrder;

  return {
    offset,
    limit,
    where,
    orderBy
  };
}

// Response filtering and transformation

export function filterSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const filtered = { ...data };
  
  // Remove sensitive fields
  delete filtered.password;
  delete filtered.passwordHash;
  delete filtered.secret;
  delete filtered.apiKey;
  delete filtered.token;
  
  // Filter nested objects
  Object.keys(filtered).forEach(key => {
    if (typeof filtered[key] === 'object' && filtered[key] !== null) {
      if (Array.isArray(filtered[key])) {
        filtered[key] = filtered[key].map(filterSensitiveData);
      } else {
        filtered[key] = filterSensitiveData(filtered[key]);
      }
    }
  });

  return filtered;
}

export function transformAgentProgressForAPI(agentProgress: any): Record<AgentType, any> {
  if (!agentProgress || typeof agentProgress !== 'object') {
    return {} as Record<AgentType, any>;
  }

  const transformed: Record<string, any> = {};
  
  Object.entries(agentProgress).forEach(([agentType, progress]: [string, any]) => {
    if (isValidAgentType(agentType) && progress) {
      transformed[agentType] = {
        agentType: agentType as AgentType,
        status: progress.status || 'pending',
        progress: progress.progress || 0,
        ...(progress.error && { error: progress.error })
      };
    }
  });

  return transformed as Record<AgentType, any>;
}

// Error formatting helpers

export function formatAPIError(error: Error, requestId?: string): any {
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
    },
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };
}

export function createValidationErrorResponse(field: string, message: string, value?: any): any {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: `Validation failed for field: ${field}`,
      details: {
        field,
        message,
        ...(value !== undefined && { value })
      }
    },
    timestamp: new Date().toISOString()
  };
}

// Utility functions for common operations

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function safeParseInt(value: any, defaultValue: number = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function safeParseFloat(value: any, defaultValue: number = 0): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}