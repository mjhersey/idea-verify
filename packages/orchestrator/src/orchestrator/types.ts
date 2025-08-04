/**
 * Orchestrator Service Types
 */

import { AgentType, EvaluationStatus, EvaluationPriority } from '@ai-validation/shared';

export interface EvaluationRequest {
  businessIdeaId: string;
  userId: string;
  priority?: EvaluationPriority;
  correlationId?: string;
  agentTypes?: AgentType[];
  config?: EvaluationConfig;
}

export interface EvaluationConfig {
  timeout?: number; // Timeout in milliseconds
  concurrency?: number; // Max concurrent agents
  retryAttempts?: number;
  requireAllAgents?: boolean; // If true, fail if any agent fails
  scoringWeights?: Record<AgentType, number>; // Weights for final score calculation
}

export interface EvaluationProgress {
  evaluationId: string;
  dbEvaluationId?: string; // Database ID when different from evaluationId
  status: EvaluationStatus;
  progress: number; // 0-100
  startedAt?: Date;
  estimatedCompletion?: Date;
  agentProgress: Record<AgentType, AgentProgress>;
  errors?: string[];
}

export interface AgentProgress {
  agentType: AgentType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  score?: number;
  insights?: string[];
  error?: string;
}

export interface EvaluationResult {
  evaluationId: string;
  businessIdeaId: string;
  status: EvaluationStatus;
  overallScore: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  summary: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    recommendations: string[];
  };
  agentResults: AgentExecutionResult[];
  metadata: {
    startedAt: Date;
    completedAt: Date;
    processingTime: number;
    agentsExecuted: number;
    agentsFailed: number;
    correlationId: string;
  };
}

export interface AgentExecutionResult {
  agentType: AgentType;
  status: 'completed' | 'failed';
  score?: number;
  insights?: string[];
  details?: Record<string, any>;
  processingTime: number;
  error?: string;
}

export interface OrchestratorConfig {
  maxConcurrentEvaluations: number;
  defaultTimeout: number;
  defaultAgentTypes: AgentType[];
  enableProgressTracking: boolean;
  autoRetryFailedAgents: boolean;
  scoringWeights: Record<AgentType, number>;
}

export interface EvaluationMetrics {
  totalEvaluations: number;
  activeEvaluations: number;
  completedEvaluations: number;
  failedEvaluations: number;
  averageProcessingTime: number;
  averageScore: number;
  agentSuccessRates: Record<AgentType, { total: number; successful: number; rate: number }>;
  throughput: number; // evaluations per hour
}