/**
 * Database types for the AI Validation Platform
 * These types mirror the Prisma schema for cross-package usage
 */

// User model types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  name: string;
}

export interface UpdateUserInput {
  email?: string;
  password_hash?: string;
  name?: string;
}

// Business Idea model types
export interface BusinessIdea {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: BusinessIdeaStatus;
  created_at: Date;
  updated_at: Date;
}

export type BusinessIdeaStatus = 'draft' | 'submitted' | 'evaluating' | 'completed';

export interface CreateBusinessIdeaInput {
  user_id: string;
  title: string;
  description: string;
  status?: BusinessIdeaStatus;
}

export interface UpdateBusinessIdeaInput {
  title?: string;
  description?: string;
  status?: BusinessIdeaStatus;
}

// Evaluation model types
export interface Evaluation {
  id: string;
  business_idea_id: string;
  status: EvaluationStatus;
  priority: EvaluationPriority;
  started_at: Date | null;
  completed_at: Date | null;
  results: Record<string, unknown> | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export type EvaluationStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type EvaluationPriority = 'low' | 'normal' | 'high';

export interface CreateEvaluationInput {
  business_idea_id: string;
  priority?: EvaluationPriority;
}

export interface UpdateEvaluationInput {
  status?: EvaluationStatus;
  priority?: EvaluationPriority;
  started_at?: Date | null;
  completed_at?: Date | null;
  results?: Record<string, unknown> | null;
  error_message?: string | null;
}

// Agent Result model types
export interface AgentResult {
  id: string;
  evaluation_id: string;
  agent_type: AgentType;
  status: AgentResultStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  score: number | null;
  insights: Record<string, unknown> | null;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export type AgentType = 
  | 'market-research'
  | 'competitive-analysis' 
  | 'customer-research'
  | 'technical-feasibility'
  | 'financial-analysis';

export type AgentResultStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CreateAgentResultInput {
  evaluation_id: string;
  agent_type: AgentType;
  input_data?: Record<string, unknown>;
}

export interface UpdateAgentResultInput {
  status?: AgentResultStatus;
  input_data?: Record<string, unknown> | null;
  output_data?: Record<string, unknown> | null;
  score?: number | null;
  insights?: Record<string, unknown> | null;
  started_at?: Date | null;
  completed_at?: Date | null;
  error_message?: string | null;
}

// Relations for populated data
export interface UserWithBusinessIdeas extends User {
  business_ideas: BusinessIdea[];
}

export interface BusinessIdeaWithUser extends BusinessIdea {
  user: User;
}

export interface BusinessIdeaWithEvaluations extends BusinessIdea {
  evaluations: Evaluation[];
}

export interface EvaluationWithBusinessIdea extends Evaluation {
  business_idea: BusinessIdea;
}

export interface EvaluationWithAgentResults extends Evaluation {
  agent_results: AgentResult[];
}

export interface AgentResultWithEvaluation extends AgentResult {
  evaluation: Evaluation;
}

// Complete nested types for full data fetching
export interface EvaluationComplete extends Evaluation {
  business_idea: BusinessIdeaWithUser;
  agent_results: AgentResult[];
}

export interface BusinessIdeaComplete extends BusinessIdea {
  user: User;
  evaluations: EvaluationWithAgentResults[];
}

// Query filter types
export interface UserFilters {
  email?: string;
  name?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface BusinessIdeaFilters {
  user_id?: string;
  status?: BusinessIdeaStatus;
  title_contains?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface EvaluationFilters {
  business_idea_id?: string;
  status?: EvaluationStatus;
  priority?: EvaluationPriority;
  created_after?: Date;
  created_before?: Date;
}

export interface AgentResultFilters {
  evaluation_id?: string;
  agent_type?: AgentType;
  status?: AgentResultStatus;
  created_after?: Date;
  created_before?: Date;
}

// Pagination
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}