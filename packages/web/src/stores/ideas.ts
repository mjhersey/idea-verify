/**
 * Pinia store for idea submission and management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ideasService } from '@/services/ideas'
import { evaluationService } from '@/services/evaluation'
import type { BusinessIdea, IdeaSubmissionRequest } from '@ai-validation/shared'

export interface IdeaSubmissionResult {
  success: boolean
  message: string
  ideaId?: string
  evaluationId?: string
}

export const useIdeasStore = defineStore('ideas', () => {
  // State
  const ideas = ref<BusinessIdea[]>([])
  const currentIdea = ref<BusinessIdea | null>(null)
  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  })

  // Getters
  const getIdeaById = computed(() => {
    return (id: string) => ideas.value.find(idea => idea.id === id)
  })

  const hasIdeas = computed(() => ideas.value.length > 0)

  const recentIdeas = computed(() => {
    return ideas.value
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  })

  // Actions
  const submitIdea = async (data: IdeaSubmissionRequest): Promise<IdeaSubmissionResult> => {
    try {
      isSubmitting.value = true
      error.value = null

      // Validate input
      const validation = ideasService.validateIdeaSubmission(data)
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors.join('; ')
        }
      }

      // Submit idea
      const ideaResponse = await ideasService.submitIdea(data)
      
      if (!ideaResponse.success) {
        return {
          success: false,
          message: ideaResponse.message || 'Failed to submit idea'
        }
      }

      // Add to local state
      if (ideaResponse.data) {
        ideas.value.unshift(ideaResponse.data)
        currentIdea.value = ideaResponse.data
      }

      // Start evaluation if idea was created successfully
      let evaluationId: string | undefined
      
      if (ideaResponse.data?.id) {
        try {
          const evaluationResponse = await evaluationService.submitEvaluation({
            description: ideaResponse.data.description
          })
          if (evaluationResponse?.id) {
            evaluationId = evaluationResponse.id
          }
        } catch (evalError) {
          console.warn('Failed to start evaluation automatically:', evalError)
          // Don't fail the whole operation if evaluation start fails
        }
      }

      return {
        success: true,
        message: 'Business idea submitted successfully!',
        ideaId: ideaResponse.data?.id,
        evaluationId
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('Error submitting idea:', error)
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit idea'
      error.value = errorMessage
      
      return {
        success: false,
        message: errorMessage
      }
    } finally {
      isSubmitting.value = false
    }
  }

  const fetchUserIdeas = async (page = 1, limit = 10, force = false) => {
    try {
      // Avoid duplicate requests
      if (isLoading.value && !force) return

      isLoading.value = true
      error.value = null

      const response = await ideasService.getUserIdeas(page, limit)
      
      if (page === 1) {
        ideas.value = response.data
      } else {
        ideas.value.push(...response.data)
      }

      pagination.value = response.pagination
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('Error fetching ideas:', error)
      error.value = error.message || 'Failed to fetch ideas'
    } finally {
      isLoading.value = false
    }
  }

  const fetchIdeaById = async (id: string, force = false) => {
    try {
      // Check local cache first
      const cached = getIdeaById.value(id)
      if (cached && !force) {
        currentIdea.value = cached
        return cached
      }

      isLoading.value = true
      error.value = null

      const idea = await ideasService.getIdeaById(id)
      
      // Update local cache
      const existingIndex = ideas.value.findIndex(i => i.id === id)
      if (existingIndex >= 0) {
        ideas.value[existingIndex] = idea
      } else {
        ideas.value.push(idea)
      }

      currentIdea.value = idea
      return idea
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      console.error('Error fetching idea:', error)
      error.value = error.message || 'Failed to fetch idea'
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const loadMoreIdeas = async () => {
    if (pagination.value.hasNext && !isLoading.value) {
      await fetchUserIdeas(pagination.value.page + 1, pagination.value.limit)
    }
  }

  const refreshIdeas = async () => {
    await fetchUserIdeas(1, pagination.value.limit, true)
  }

  const clearError = () => {
    error.value = null
  }

  const reset = () => {
    ideas.value = []
    currentIdea.value = null
    isLoading.value = false
    isSubmitting.value = false
    error.value = null
    pagination.value = {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false
    }
  }

  return {
    // State
    ideas,
    currentIdea,
    isLoading,
    isSubmitting,
    error,
    pagination,
    
    // Getters
    getIdeaById,
    hasIdeas,
    recentIdeas,
    
    // Actions
    submitIdea,
    fetchUserIdeas,
    fetchIdeaById,
    loadMoreIdeas,
    refreshIdeas,
    clearError,
    reset
  }
})