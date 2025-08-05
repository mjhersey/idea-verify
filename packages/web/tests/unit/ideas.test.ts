/**
 * Unit tests for ideas frontend services and composables
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdeasService } from '../../src/services/ideas.js';
import { useIdeas } from '../../src/composables/useIdeas.js';

// Mock axios instance
vi.mock('../../src/services/api.js', () => ({
  axiosInstance: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

// Mock router
const mockRouter = {
  push: vi.fn()
};

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter
}));

describe('IdeasService', () => {
  let service: IdeasService;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const apiModule = await import('../../src/services/api.js');
    mockAxiosInstance = apiModule.axiosInstance;
    service = new IdeasService();
  });

  describe('submitIdea', () => {
    const validIdea = {
      title: 'Test Idea',
      description: 'This is a valid business idea description that meets the minimum character requirements for submission.'
    };

    const mockResponse = {
      data: {
        message: 'Business idea submitted successfully',
        data: {
          id: 'idea-123',
          title: validIdea.title,
          description: validIdea.description,
          status: 'submitted',
          created_at: '2024-01-01T00:00:00Z',
          submission_metadata: {
            user_id: 'user-123',
            next_steps: 'Your idea will be evaluated',
            estimated_processing_time: '24-48 hours'
          }
        }
      }
    };

    it('should submit idea successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await service.submitIdea(validIdea);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/ideas', validIdea);
      expect(result).toEqual({
        success: true,
        message: 'Idea submitted successfully',
        data: mockResponse.data.data
      });
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        response: {
          data: {
            error: 'Validation failed'
          }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(errorResponse);

      const result = await service.submitIdea(validIdea);
      
      expect(result).toEqual({
        success: false,
        message: 'Validation failed'
      });
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      const result = await service.submitIdea(validIdea);
      
      expect(result).toEqual({
        success: false,
        message: 'Failed to submit idea'
      });
    });
  });

  describe('getUserIdeas', () => {
    const mockIdeasResponse = {
      data: {
        data: [
          {
            id: 'idea-1',
            user_id: 'user-123',
            title: 'First Idea',
            description: 'Description 1',
            status: 'submitted',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false
        }
      }
    };

    it('should fetch user ideas successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockIdeasResponse);

      const result = await service.getUserIdeas(1, 10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/ideas/user', {
        params: { page: 1, limit: 10 }
      });
      expect(result).toEqual(mockIdeasResponse.data);
    });

    it('should use default pagination parameters', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockIdeasResponse);

      await service.getUserIdeas();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/ideas/user', {
        params: { page: 1, limit: 10 }
      });
    });
  });

  describe('validateIdeaSubmission', () => {
    it('should validate valid idea', () => {
      const validIdea = {
        title: 'Valid Title',
        description: 'This is a valid description that meets all the requirements including the minimum character count.'
      };

      const result = service.validateIdeaSubmission(validIdea);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty description', () => {
      const invalidIdea = {
        description: ''
      };

      const result = service.validateIdeaSubmission(invalidIdea);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should reject short description', () => {
      const invalidIdea = {
        description: 'Too short'
      };

      const result = service.validateIdeaSubmission(invalidIdea);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be at least 50 characters long');
    });

    it('should reject long description', () => {
      const invalidIdea = {
        description: 'A'.repeat(5001)
      };

      const result = service.validateIdeaSubmission(invalidIdea);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be no more than 5000 characters long');
    });

    it('should reject short title', () => {
      const invalidIdea = {
        title: 'Hi',
        description: 'This is a valid description that meets the minimum character requirements for submission to the platform.'
      };

      const result = service.validateIdeaSubmission(invalidIdea);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title must be at least 5 characters long');
    });

    it('should reject long title', () => {
      const invalidIdea = {
        title: 'A'.repeat(101),
        description: 'This is a valid description that meets the minimum character requirements for submission to the platform.'
      };

      const result = service.validateIdeaSubmission(invalidIdea);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title must be no more than 100 characters long');
    });

    it('should allow missing title', () => {
      const validIdea = {
        description: 'This is a valid description without a title that meets the minimum character requirements.'
      };

      const result = service.validateIdeaSubmission(validIdea);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('useIdeas composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { isSubmitting, isLoading, error, ideas, hasIdeas } = useIdeas();

    expect(isSubmitting.value).toBe(false);
    expect(isLoading.value).toBe(false);
    expect(error.value).toBe(null);
    expect(ideas.value).toEqual([]);
    expect(hasIdeas.value).toBe(false);
  });

  it('should validate description correctly', () => {
    const { validateDescription } = useIdeas();

    expect(validateDescription('')).toBe('Description is required');
    expect(validateDescription('Short')).toBe('Description must be at least 50 characters long');
    expect(validateDescription('A'.repeat(5001))).toBe('Description must be no more than 5000 characters long');
    expect(validateDescription('This is a valid description that meets the minimum character requirements.')).toBe(null);
  });

  it('should validate title correctly', () => {
    const { validateTitle } = useIdeas();

    expect(validateTitle('')).toBe(null); // Empty title is allowed
    expect(validateTitle('Hi')).toBe('Title must be at least 5 characters long');
    expect(validateTitle('A'.repeat(101))).toBe('Title must be no more than 100 characters long');
    expect(validateTitle('Valid Title')).toBe(null);
  });

  it('should navigate to idea details', () => {
    const { viewIdea } = useIdeas();

    viewIdea('idea-123');

    expect(mockRouter.push).toHaveBeenCalledWith('/ideas/idea-123');
  });

  it('should clear error', () => {
    const { error, clearError } = useIdeas();
    
    // Manually set error to test clearing
    error.value = 'Test error';
    expect(error.value).toBe('Test error');

    clearError();
    expect(error.value).toBe(null);
  });
});