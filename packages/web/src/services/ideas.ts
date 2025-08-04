/**
 * Ideas API service for frontend
 */

import { axiosInstance } from './api.js';
import type { IdeaSubmissionRequest, BusinessIdea } from '@ai-validation/shared';

export class IdeasService {
  private baseUrl = '/api/ideas';

  /**
   * Submit a new business idea
   */
  async submitIdea(data: IdeaSubmissionRequest): Promise<{
    success: boolean;
    message: string;
    data?: BusinessIdea;
  }> {
    try {
      const response = await axiosInstance.post(this.baseUrl, data);
      return {
        success: true,
        message: 'Idea submitted successfully',
        data: response.data.data
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string, message?: string } } };
      return {
        success: false,
        message: err.response?.data?.message || err.response?.data?.error || 'Failed to submit idea'
      };
    }
  }

  /**
   * Get user's business ideas
   */
  async getUserIdeas(page = 1, limit = 10): Promise<{
    data: BusinessIdea[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    try {
      const response = await axiosInstance.get(`${this.baseUrl}/user`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Failed to fetch ideas');
    }
  }

  /**
   * Get business idea by ID
   */
  async getIdeaById(id: string): Promise<BusinessIdea> {
    try {
      const response = await axiosInstance.get(`${this.baseUrl}/${id}`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      throw new Error(err.response?.data?.error || 'Failed to fetch idea');
    }
  }

  /**
   * Validate idea submission data
   */
  validateIdeaSubmission(data: IdeaSubmissionRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate description
    if (!data.description || data.description.trim().length === 0) {
      errors.push('Description is required');
    } else if (data.description.length < 50) {
      errors.push('Description must be at least 50 characters long');
    } else if (data.description.length > 5000) {
      errors.push('Description must be no more than 5000 characters long');
    }

    // Validate title if provided
    if (data.title) {
      if (data.title.length < 5) {
        errors.push('Title must be at least 5 characters long');
      } else if (data.title.length > 100) {
        errors.push('Title must be no more than 100 characters long');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const ideasService = new IdeasService();