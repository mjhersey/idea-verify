/**
 * Unit tests for ideas store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useIdeasStore } from '@/stores/ideas'
import { ideasService } from '@/services/ideas'
import { evaluationService } from '@/services/evaluation'

// Mock services
vi.mock('@/services/ideas', () => ({
  ideasService: {
    submitIdea: vi.fn(),
    getUserIdeas: vi.fn(),
    getIdeaById: vi.fn(),
    validateIdeaSubmission: vi.fn(),
  },
}))
vi.mock('@/services/evaluation', () => ({
  evaluationService: {
    submitEvaluation: vi.fn(),
  },
}))

describe('Ideas Store', () => {
  let store: ReturnType<typeof useIdeasStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useIdeasStore()
    vi.clearAllMocks()
  })

  describe('submitIdea', () => {
    it('should successfully submit idea and start evaluation', async () => {
      const mockIdeaResponse = {
        success: true,
        message: 'Idea submitted',
        data: {
          id: 'idea-123',
          title: 'Test Idea',
          description: 'Test description',
          status: 'submitted' as const,
          user_id: 'user-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
      }

      const mockEvaluationResponse = {
        id: 'eval-123',
        status: 'pending' as const,
      }

      vi.mocked(ideasService.validateIdeaSubmission).mockReturnValue({
        isValid: true,
        errors: [],
      })
      vi.mocked(ideasService.submitIdea).mockResolvedValue(mockIdeaResponse)
      vi.mocked(evaluationService.submitEvaluation).mockResolvedValue(mockEvaluationResponse)

      const result = await store.submitIdea({
        title: 'Test Idea',
        description:
          'Test description that is long enough to meet validation requirements and provides comprehensive details about the business concept.',
      })

      expect(result.success).toBe(true)
      expect(result.ideaId).toBe('idea-123')
      expect(result.evaluationId).toBe('eval-123')
      expect(store.ideas).toHaveLength(1)
      expect(store.currentIdea).toEqual(mockIdeaResponse.data)
    })

    it('should handle validation errors', async () => {
      vi.mocked(ideasService.validateIdeaSubmission).mockReturnValue({
        isValid: false,
        errors: ['Description must be at least 50 characters'],
      })

      const result = await store.submitIdea({
        description: 'Short', // Too short
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('must be at least 50 characters')
    })

    it('should handle API errors', async () => {
      vi.mocked(ideasService.validateIdeaSubmission).mockReturnValue({
        isValid: true,
        errors: [],
      })
      vi.mocked(ideasService.submitIdea).mockResolvedValue({
        success: false,
        message: 'Server error',
      })

      const result = await store.submitIdea({
        description:
          'This is a valid description that meets all length requirements and contains meaningful content about a business idea.',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Server error')
    })

    it('should continue if evaluation start fails', async () => {
      const mockIdeaResponse = {
        success: true,
        message: 'Idea submitted',
        data: {
          id: 'idea-123',
          title: 'Test Idea',
          description: 'Test description',
          status: 'submitted' as const,
          user_id: 'user-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
      }

      vi.mocked(ideasService.validateIdeaSubmission).mockReturnValue({
        isValid: true,
        errors: [],
      })
      vi.mocked(ideasService.submitIdea).mockResolvedValue(mockIdeaResponse)
      vi.mocked(evaluationService.submitEvaluation).mockRejectedValue(
        new Error('Evaluation failed')
      )

      const result = await store.submitIdea({
        description:
          'This is a valid description that meets all length requirements and contains meaningful content about a business idea.',
      })

      // Should still succeed even if evaluation fails
      expect(result.success).toBe(true)
      expect(result.ideaId).toBe('idea-123')
      expect(result.evaluationId).toBeUndefined()
    })
  })

  describe('fetchUserIdeas', () => {
    it('should fetch and store user ideas', async () => {
      const mockIdeas = [
        {
          id: 'idea-1',
          title: 'Idea 1',
          description: 'Description 1',
          status: 'submitted' as const,
          user_id: 'user-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'idea-2',
          title: 'Idea 2',
          description: 'Description 2',
          status: 'completed' as const,
          user_id: 'user-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      const mockResponse = {
        data: mockIdeas,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      }

      vi.mocked(ideasService.getUserIdeas).mockResolvedValue(mockResponse)

      await store.fetchUserIdeas()

      expect(store.ideas).toEqual(mockIdeas)
      expect(store.pagination).toEqual(mockResponse.pagination)
      expect(store.isLoading).toBe(false)
    })

    it('should handle fetch errors', async () => {
      vi.mocked(ideasService.getUserIdeas).mockRejectedValue(new Error('Fetch failed'))

      await store.fetchUserIdeas()

      expect(store.error).toBe(null)
      expect(store.isLoading).toBe(false)
    })
  })

  describe('fetchIdeaById', () => {
    it('should fetch specific idea by ID', async () => {
      const mockIdea = {
        id: 'idea-123',
        title: 'Test Idea',
        description: 'Test description',
        status: 'submitted' as const,
        user_id: 'user-123',
        created_at: new Date(),
        updated_at: new Date(),
      }

      vi.mocked(ideasService.getIdeaById).mockResolvedValue(mockIdea)

      const result = await store.fetchIdeaById('idea-123')

      expect(result).toEqual(mockIdea)
      expect(store.currentIdea).toEqual(mockIdea)
      expect(store.ideas.some(idea => idea.id === mockIdea.id)).toBe(true)
    })

    it('should return cached idea if available', async () => {
      const mockIdea = {
        id: 'idea-123',
        title: 'Test Idea',
        description: 'Test description',
        status: 'submitted' as const,
        user_id: 'user-123',
        created_at: new Date(),
        updated_at: new Date(),
      }

      // Add idea to cache
      store.ideas.push(mockIdea)

      const result = await store.fetchIdeaById('idea-123')

      expect(result).toEqual(mockIdea)
      expect(store.currentIdea).toEqual(mockIdea)
      // Should not have called the service
      expect(ideasService.getIdeaById).not.toHaveBeenCalled()
    })
  })

  describe('getters', () => {
    beforeEach(() => {
      store.ideas = [
        {
          id: 'idea-1',
          title: 'Idea 1',
          description: 'Description 1',
          status: 'submitted',
          user_id: 'user-123',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
        {
          id: 'idea-2',
          title: 'Idea 2',
          description: 'Description 2',
          status: 'completed',
          user_id: 'user-123',
          created_at: new Date('2024-01-02'),
          updated_at: new Date('2024-01-02'),
        },
      ]
    })

    it('should return correct hasIdeas value', () => {
      expect(store.hasIdeas).toBe(true)
    })

    it('should return idea by ID', () => {
      const idea = store.getIdeaById('idea-1')
      expect(idea?.id).toBe('idea-1')
    })

    it('should return recent ideas sorted by date', () => {
      const recent = store.recentIdeas
      expect(recent[0].id).toBe('idea-2') // More recent
      expect(recent[1].id).toBe('idea-1')
    })
  })

  describe('loadMoreIdeas', () => {
    it('should load more ideas when hasNext is true', async () => {
      store.pagination.hasNext = true
      store.pagination.page = 1

      const mockResponse = {
        data: [
          {
            id: 'idea-3',
            title: 'Idea 3',
            description: 'Description 3',
            status: 'submitted' as const,
            user_id: 'user-123',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        pagination: {
          page: 2,
          limit: 10,
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrevious: true,
        },
      }

      vi.mocked(ideasService.getUserIdeas).mockResolvedValue(mockResponse)

      await store.loadMoreIdeas()

      expect(ideasService.getUserIdeas).toHaveBeenCalledWith(2, 10)
    })

    it('should not load more ideas when hasNext is false', async () => {
      store.pagination.hasNext = false

      await store.loadMoreIdeas()

      expect(ideasService.getUserIdeas).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('should reset all store state', () => {
      // Set some state
      store.ideas = [{ id: 'test' } as any]
      store.currentIdea = { id: 'test' } as any
      store.error = 'Test error'

      store.reset()

      expect(store.ideas).toEqual([])
      expect(store.currentIdea).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.isSubmitting).toBe(false)
    })
  })
})
