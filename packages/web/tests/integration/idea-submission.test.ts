/**
 * Integration tests for idea submission flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'

import HomeView from '@/views/HomeView.vue'
import { useIdeasStore } from '@/stores/ideas'
import { useAuthStore } from '@/stores/auth'

// Mock external dependencies
vi.mock('@/services/ideas', () => ({
  ideasService: {
    submitIdea: vi.fn(),
    validateIdeaSubmission: vi.fn(() => ({ isValid: true, errors: [] }))
  }
}))
vi.mock('@/services/evaluation', () => ({
  evaluationService: {
    submitEvaluation: vi.fn()
  }
}))
vi.mock('@/services/auth', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn()
  }
}))

describe('Idea Submission Integration', () => {
  let router: any
  let wrapper: any
  let ideasStore: any
  let authStore: any
  let pinia: any

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Create router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: HomeView },
        { path: '/login', component: { template: '<div>Login</div>' } },
        { path: '/evaluation/:id', component: { template: '<div>Evaluation Results</div>' } }
      ]
    })

    await router.push('/')
    await router.isReady()

    // Setup stores
    ideasStore = useIdeasStore()
    authStore = useAuthStore()
    
    // Mock authenticated user by setting up the store state properly
    authStore.$patch({
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      }
    })

    // Mount component with proper global configuration
    wrapper = mount(HomeView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          'router-link': {
            template: '<a><slot /></a>'
          },
          'RouterLink': {
            template: '<a><slot /></a>'
          }
        },
        mocks: {
          $route: router.currentRoute.value
        }
      }
    })

    await nextTick()
  })

  describe('Complete Idea Submission Flow', () => {
    it('should complete full idea submission and evaluation flow', async () => {
      // Mock successful submission
      const mockSubmitIdea = vi.spyOn(ideasStore, 'submitIdea').mockImplementation(async (data) => {
        // Simulate the store's actual behavior
        ideasStore.isSubmitting = true
        await new Promise(resolve => setTimeout(resolve, 10))
        ideasStore.isSubmitting = false
        return {
          success: true,
          message: 'Idea submitted successfully!',
          ideaId: 'idea-123',
          evaluationId: 'eval-456'
        }
      })

      // Find the form elements
      const titleInput = wrapper.find('input[type="text"]')
      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      // Fill out the form
      await titleInput.setValue('Revolutionary AI Assistant')
      await descriptionTextarea.setValue(
        'This is a comprehensive business idea for an AI-powered personal assistant that helps users manage their daily tasks, schedule appointments, and provide intelligent recommendations based on their preferences and behavior patterns. The system would use advanced machine learning algorithms to learn from user interactions and continuously improve its assistance capabilities.'
      )

      // Trigger input event to update validation state
      await descriptionTextarea.trigger('input')
      await nextTick()

      // Verify form is valid and submit button is enabled
      expect(submitButton.attributes('disabled')).toBeUndefined()

      // Submit the form
      await submitButton.trigger('click')
      await nextTick()

      // Verify submission was called with correct data
      expect(mockSubmitIdea).toHaveBeenCalledWith({
        title: 'Revolutionary AI Assistant',
        description: expect.stringContaining('This is a comprehensive business idea')
      })

      // Wait for success message
      await nextTick()
      expect(wrapper.text()).toContain('Your business idea has been submitted successfully!')
    })

    it('should handle authentication required scenario', async () => {
      // Mock unauthenticated user
      authStore.$patch({ user: null })

      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      // Fill out valid form
      await descriptionTextarea.setValue(
        'A valid business idea description that meets all the required validation criteria and provides comprehensive information about the proposed venture.'
      )
      await descriptionTextarea.trigger('input')
      await nextTick()

      // Submit the form
      await submitButton.trigger('click')
      await nextTick()

      // Should show authentication error
      expect(wrapper.text()).toContain('Please log in to submit your business idea')
    })

    it('should handle submission errors gracefully', async () => {
      // Mock failed submission
      const mockSubmitIdea = vi.spyOn(ideasStore, 'submitIdea').mockResolvedValue({
        success: false,
        message: 'Network error occurred'
      })

      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      // Fill out valid form
      await descriptionTextarea.setValue(
        'A valid business idea description that meets all the required validation criteria and provides comprehensive information about the proposed venture.'
      )
      await descriptionTextarea.trigger('input')
      await nextTick()

      // Submit the form
      await submitButton.trigger('click')
      await nextTick()

      // Should show error message
      expect(wrapper.text()).toContain('Network error occurred')
    })

    it('should validate form before submission', async () => {
      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      // Try with invalid (too short) description
      await descriptionTextarea.setValue('Too short')
      await descriptionTextarea.trigger('input')
      await nextTick()

      // Submit button should be disabled
      expect(submitButton.attributes('disabled')).toBeDefined()

      // Should show validation error
      expect(wrapper.text()).toContain('more needed')
    })

    it('should show loading state during submission', async () => {
      // Mock slow submission
      const mockSubmitIdea = vi.spyOn(ideasStore, 'submitIdea').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          message: 'Success'
        }), 100))
      )

      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      // Fill out valid form
      await descriptionTextarea.setValue(
        'A comprehensive business idea description that meets all validation requirements and provides detailed information about the proposed venture and its market potential.'
      )
      await descriptionTextarea.trigger('input')
      await nextTick()

      // Submit the form
      submitButton.trigger('click')
      await nextTick()

      // Should show loading state
      expect(wrapper.text()).toContain('Submitting...')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Form Validation Integration', () => {
    it('should provide real-time character count feedback', async () => {
      const descriptionTextarea = wrapper.find('textarea')
      
      const testDescription = 'Testing character count functionality'
      await descriptionTextarea.setValue(testDescription)
      await descriptionTextarea.trigger('input')
      await nextTick()

      expect(wrapper.text()).toContain(`${testDescription.length} / 5000 characters`)
    })

    it('should show validation status indicators', async () => {
      const descriptionTextarea = wrapper.find('textarea')
      
      // Test invalid length
      await descriptionTextarea.setValue('Short')
      await descriptionTextarea.trigger('input')
      await nextTick()
      
      expect(wrapper.find('.text-red-600').exists()).toBe(true)

      // Test valid length
      await descriptionTextarea.setValue(
        'This is a valid business idea description that meets the minimum character requirements and provides adequate detail about the proposed business concept.'
      )
      await descriptionTextarea.trigger('input')
      await nextTick()
      
      expect(wrapper.find('.text-green-600').exists()).toBe(true)
    })
  })

  describe('User Experience Features', () => {
    it('should display helpful feature information', () => {
      // Check for feature benefits
      expect(wrapper.text()).toContain('Market size and opportunity analysis')
      expect(wrapper.text()).toContain('Competitive landscape overview')
      expect(wrapper.text()).toContain('Business viability score (0-100)')
      expect(wrapper.text()).toContain('Actionable recommendations')
    })

    it('should display quick start guide', () => {
      expect(wrapper.text()).toContain('Quick Start')
      expect(wrapper.text()).toContain('Describe your business idea (50-5000 characters)')
      expect(wrapper.text()).toContain('Submit for AI analysis')
      expect(wrapper.text()).toContain('Get your comprehensive evaluation report')
    })

    it('should have proper form labels and accessibility', () => {
      const titleLabel = wrapper.find('label[for="title"]')
      const descriptionLabel = wrapper.find('label[for="description"]')
      
      expect(titleLabel.exists()).toBe(true)
      expect(descriptionLabel.exists()).toBe(true)
      expect(descriptionLabel.text()).toContain('*') // Required indicator
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors during submission', async () => {
      // Mock network error
      const mockSubmitIdea = vi.spyOn(ideasStore, 'submitIdea').mockRejectedValue(
        new Error('Network error')
      )

      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      await descriptionTextarea.setValue(
        'A valid business idea description that meets all requirements and contains comprehensive information about the proposed business venture.'
      )
      await descriptionTextarea.trigger('input')
      await nextTick()

      await submitButton.trigger('click')
      await nextTick()

      // Should handle the error gracefully
      expect(wrapper.find('.text-red-600').exists()).toBe(true)
    })

    it('should clear previous errors on new submission', async () => {
      // First, cause an error
      vi.spyOn(ideasStore, 'submitIdea').mockResolvedValueOnce({
        success: false,
        message: 'First error'
      })

      const descriptionTextarea = wrapper.find('textarea')
      const submitButton = wrapper.find('button[type="submit"]')

      await descriptionTextarea.setValue(
        'A valid business idea description that meets all validation requirements.'
      )
      await descriptionTextarea.trigger('input')
      await nextTick()

      await submitButton.trigger('click')
      await nextTick()

      expect(wrapper.text()).toContain('First error')

      // Now mock success
      vi.spyOn(ideasStore, 'submitIdea').mockResolvedValueOnce({
        success: true,
        message: 'Success'
      })

      await submitButton.trigger('click')
      await nextTick()

      // Error should be cleared
      expect(wrapper.text()).not.toContain('First error')
      expect(wrapper.text()).toContain('successfully')
    })
  })
})