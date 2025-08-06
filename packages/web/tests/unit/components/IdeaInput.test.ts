/**
 * Unit tests for IdeaInput component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import IdeaInput from '@/components/evaluation/IdeaInput.vue'
import { useIdeasStore } from '@/stores/ideas'
import { useAuthStore } from '@/stores/auth'

// Mock router
const mockRouter = {
  push: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

// Mock stores
vi.mock('@/stores/ideas', () => ({
  useIdeasStore: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

describe('IdeaInput', () => {
  let wrapper: any
  let mockIdeasStore: any
  let mockAuthStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockIdeasStore = {
      submitIdea: vi.fn(),
    }

    mockAuthStore = {
      isAuthenticated: true,
      logout: vi.fn(),
    }
    ;(useIdeasStore as any).mockReturnValue(mockIdeasStore)
    ;(useAuthStore as any).mockReturnValue(mockAuthStore)

    wrapper = mount(IdeaInput, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })
  })

  describe('Form Validation', () => {
    it('should show validation error for empty description', async () => {
      const textarea = wrapper.find('textarea')
      await textarea.setValue('')
      await textarea.trigger('input')

      expect(wrapper.text()).toContain('0 / 5000 characters')
    })

    it('should show validation error for description under 50 characters', async () => {
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Short description')
      await textarea.trigger('input')

      expect(wrapper.text()).toContain('more needed')
    })

    it('should show valid state for description between 50-5000 characters', async () => {
      const textarea = wrapper.find('textarea')
      const validDescription = 'A'.repeat(100) // 100 characters
      await textarea.setValue(validDescription)
      await textarea.trigger('input')

      expect(wrapper.text()).toContain('Valid length')
    })

    it('should show validation error for description over 5000 characters', async () => {
      const textarea = wrapper.find('textarea')
      const longDescription = 'A'.repeat(5001)
      await textarea.setValue(longDescription)
      await textarea.trigger('input')

      expect(wrapper.find('.text-red-600').exists()).toBe(true)
    })

    it('should disable submit button when form is invalid', async () => {
      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should enable submit button when form is valid', async () => {
      const textarea = wrapper.find('textarea')
      const validDescription =
        'This is a valid business idea description that is long enough to pass validation and contains meaningful content about my innovative startup concept.'
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Character Counter', () => {
    it('should display correct character count', async () => {
      const textarea = wrapper.find('textarea')
      const testText = 'Test description'
      await textarea.setValue(testText)
      await textarea.trigger('input')

      expect(wrapper.text()).toContain(`${testText.length} / 5000 characters`)
    })

    it('should show red text for invalid length', async () => {
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Short')
      await textarea.trigger('input')

      const counter = wrapper.find('.text-red-600')
      expect(counter.exists()).toBe(true)
    })

    it('should show green text for valid length', async () => {
      const textarea = wrapper.find('textarea')
      const validDescription =
        'This is a valid business idea description that is long enough to pass validation.'
      await textarea.setValue(validDescription)
      await textarea.trigger('input')

      const validIndicator = wrapper.find('.text-green-600')
      expect(validIndicator.exists()).toBe(true)
    })
  })

  describe('Form Submission', () => {
    it('should call submitIdea when form is submitted with valid data', async () => {
      const validDescription =
        'This is a comprehensive business idea description that meets all validation requirements and provides detailed information about the proposed venture.'

      mockIdeasStore.submitIdea.mockResolvedValue({
        success: true,
        message: 'Success',
        ideaId: 'test-id',
        evaluationId: 'eval-id',
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit.prevent')

      expect(mockIdeasStore.submitIdea).toHaveBeenCalledWith({
        title: '',
        description: validDescription,
      })
    })

    it('should show loading state during submission', async () => {
      const validDescription =
        'This is a comprehensive business idea description that meets all validation requirements.'

      // Mock a slow submission
      mockIdeasStore.submitIdea.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      const textarea = wrapper.find('textarea')
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      form.trigger('submit.prevent')
      await nextTick()

      expect(wrapper.text()).toContain('Submitting...')

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should show success message on successful submission', async () => {
      const validDescription =
        'This is a comprehensive business idea description that meets all validation requirements.'

      mockIdeasStore.submitIdea.mockResolvedValue({
        success: true,
        message: 'Success message',
        ideaId: 'test-id',
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await nextTick()

      expect(wrapper.text()).toContain('Your business idea has been submitted successfully!')
    })

    it('should show error message on submission failure', async () => {
      const validDescription =
        'This is a comprehensive business idea description that meets all validation requirements.'

      mockIdeasStore.submitIdea.mockResolvedValue({
        success: false,
        message: 'Submission failed',
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await nextTick()

      expect(wrapper.text()).toContain('Submission failed')
    })

    it('should redirect to login if user is not authenticated', async () => {
      mockAuthStore.isAuthenticated = false

      const validDescription =
        'This is a comprehensive business idea description that meets all validation requirements.'

      const textarea = wrapper.find('textarea')
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await nextTick()

      expect(wrapper.text()).toContain('Please log in to submit your business idea')
      expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
  })

  describe('Input Sanitization', () => {
    it('should sanitize HTML input', async () => {
      const maliciousInput =
        '<script>alert("xss")</script>This is a business idea that has enough characters to pass validation and contains malicious HTML content that should be sanitized.'

      mockIdeasStore.submitIdea.mockResolvedValue({
        success: true,
        message: 'Success',
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue(maliciousInput)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await nextTick()

      expect(mockIdeasStore.submitIdea).toHaveBeenCalledWith({
        title: '',
        description:
          'This is a business idea that has enough characters to pass validation and contains malicious HTML content that should be sanitized.', // HTML tags should be stripped
      })
    })
  })

  describe('Auto-redirect', () => {
    it('should auto-redirect to evaluation results after successful submission', async () => {
      vi.useFakeTimers()

      const validDescription =
        'This is a comprehensive business idea description that meets all validation requirements.'

      mockIdeasStore.submitIdea.mockResolvedValue({
        success: true,
        message: 'Success',
        evaluationId: 'eval-123',
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue(validDescription)
      await textarea.trigger('input')
      await nextTick()

      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await nextTick()

      // Fast-forward time
      vi.advanceTimersByTime(3000)

      expect(mockRouter.push).toHaveBeenCalledWith('/evaluation/eval-123')

      vi.useRealTimers()
    })
  })
})
