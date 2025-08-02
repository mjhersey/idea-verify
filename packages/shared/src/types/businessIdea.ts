/**
 * Shared TypeScript types for business ideas
 */

export type BusinessIdeaStatus = 'draft' | 'submitted' | 'evaluating' | 'completed';

export interface BusinessIdea {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: BusinessIdeaStatus;
  created_at: Date;
  updated_at: Date;
}

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

export interface BusinessIdeaFilters {
  user_id?: string;
  status?: BusinessIdeaStatus;
  title_contains?: string;
  created_after?: Date;
  created_before?: Date;
}

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

// Frontend-specific types
export interface IdeaSubmissionRequest {
  title?: string;
  description: string;
}

export interface IdeaSubmissionResponse {
  message: string;
  data: {
    id: string;
    title: string;
    description: string;
    status: BusinessIdeaStatus;
    created_at: string;
    submission_metadata: {
      user_id: string;
      next_steps: string;
      estimated_processing_time: string;
    };
  };
}

// Extended types with relations
export interface BusinessIdeaWithUser extends BusinessIdea {
  user: {
    id: string;
    email: string;
    name: string;
    created_at: Date;
    updated_at: Date;
  };
}

export interface BusinessIdeaWithEvaluations extends BusinessIdea {
  evaluations: Array<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>;
}

export interface BusinessIdeaComplete extends BusinessIdea {
  user: {
    id: string;
    email: string;
    name: string;
    created_at: Date;
    updated_at: Date;
  };
  evaluations: Array<{
    id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    agent_results: Array<{
      id: string;
      agent_type: string;
      status: string;
      result_data: unknown;
      created_at: Date;
    }>;
  }>;
}