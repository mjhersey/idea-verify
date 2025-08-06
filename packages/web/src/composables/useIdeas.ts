/**
 * Ideas composable for reusable idea submission logic
 */

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ideasService } from '../services/ideas.js'
import type { IdeaSubmissionRequest, BusinessIdea } from '@ai-validation/shared'

export function useIdeas() {
  const router = useRouter()

  // State
  const isSubmitting = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const ideas = ref<BusinessIdea[]>([])
  const currentIdea = ref<BusinessIdea | null>(null)

  // Computed
  const hasIdeas = computed(() => ideas.value.length > 0)

  // Submit new idea
  const submitIdea = async (data: IdeaSubmissionRequest) => {
    isSubmitting.value = true
    error.value = null

    try {
      // Validate input
      const validation = ideasService.validateIdeaSubmission(data)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      const response = await ideasService.submitIdea(data)

      // Add to local ideas list
      ideas.value.unshift({
        id: response.data.id,
        user_id: response.data.submission_metadata.user_id,
        title: response.data.title,
        description: response.data.description,
        status: response.data.status,
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.created_at),
      })

      return response
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit idea'
      error.value = errorMessage
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  // Load user's ideas
  const loadUserIdeas = async (page = 1, limit = 10) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await ideasService.getUserIdeas(page, limit)

      if (page === 1) {
        ideas.value = response.data
      } else {
        ideas.value.push(...response.data)
      }

      return response
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ideas'
      error.value = errorMessage
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Load specific idea
  const loadIdea = async (id: string) => {
    isLoading.value = true
    error.value = null

    try {
      const idea = await ideasService.getIdeaById(id)
      currentIdea.value = idea
      return idea
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load idea'
      error.value = errorMessage
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Clear error
  const clearError = () => {
    error.value = null
  }

  // Navigate to idea details
  const viewIdea = (id: string) => {
    router.push(`/ideas/${id}`)
  }

  // Form validation helpers
  const validateDescription = (description: string): string | null => {
    if (!description || description.trim().length === 0) {
      return 'Description is required'
    }
    if (description.length < 50) {
      return 'Description must be at least 50 characters long'
    }
    if (description.length > 5000) {
      return 'Description must be no more than 5000 characters long'
    }
    return null
  }

  const validateTitle = (title: string): string | null => {
    if (title && title.length > 0) {
      if (title.length < 5) {
        return 'Title must be at least 5 characters long'
      }
      if (title.length > 100) {
        return 'Title must be no more than 100 characters long'
      }
    }
    return null
  }

  return {
    // State
    isSubmitting,
    isLoading,
    error,
    ideas,
    currentIdea,
    hasIdeas,

    // Actions
    submitIdea,
    loadUserIdeas,
    loadIdea,
    clearError,
    viewIdea,

    // Validation helpers
    validateDescription,
    validateTitle,
  }
}
