<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Title Input (Optional) -->
    <div>
      <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
        Business Idea Title (Optional)
      </label>
      <input
        id="title"
        v-model="form.title"
        type="text"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        placeholder="e.g., AI-powered meal planning app"
        maxlength="100"
      />
      <p class="mt-1 text-xs text-gray-500">Leave blank to auto-generate from description</p>
    </div>

    <!-- Description Input -->
    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
        Business Idea Description *
      </label>
      <textarea
        id="description"
        v-model="form.description"
        rows="6"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        :class="{
          'border-red-300 focus:border-red-500 focus:ring-red-500': descriptionError,
          'border-green-300 focus:border-green-500 focus:ring-green-500':
            isDescriptionValid && form.description.length > 0,
        }"
        placeholder="Describe your business idea in detail. Include the problem you're solving, your solution, target market, and business model..."
        @input="validateDescription"
      ></textarea>

      <!-- Character Counter -->
      <div class="mt-2 flex justify-between items-center">
        <div class="text-xs text-gray-500">
          <span
            :class="{
              'text-red-600': characterCount < MIN_CHARS || characterCount > MAX_CHARS,
              'text-green-600': isDescriptionValid,
              'text-gray-500':
                !isDescriptionValid && characterCount >= MIN_CHARS && characterCount <= MAX_CHARS,
            }"
          >
            {{ characterCount }} / {{ MAX_CHARS }} characters
          </span>
          <span v-if="characterCount < MIN_CHARS" class="text-red-600 ml-2">
            ({{ MIN_CHARS - characterCount }} more needed)
          </span>
        </div>
        <div v-if="isDescriptionValid" class="text-xs text-green-600 flex items-center">
          <svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          Valid length
        </div>
      </div>

      <!-- Error Message -->
      <p v-if="descriptionError" class="mt-2 text-sm text-red-600">
        {{ descriptionError }}
      </p>
    </div>

    <!-- Submit Button -->
    <div>
      <button
        type="submit"
        :disabled="!isFormValid || isSubmitting"
        class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{
          'bg-indigo-600 hover:bg-indigo-700': isFormValid && !isSubmitting,
          'bg-gray-400': !isFormValid || isSubmitting,
        }"
      >
        <svg
          v-if="isSubmitting"
          class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {{ isSubmitting ? 'Submitting...' : 'Submit for AI Analysis' }}
      </button>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="bg-green-50 border border-green-200 rounded-md p-4">
      <div class="flex">
        <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <div class="ml-3">
          <p class="text-sm font-medium text-green-800">{{ successMessage }}</p>
          <p v-if="evaluationId" class="text-sm text-green-700 mt-1">
            <router-link :to="`/evaluation/${evaluationId}`" class="underline hover:no-underline">
              View your evaluation results
            </router-link>
          </p>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-md p-4">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <div class="ml-3">
          <p class="text-sm font-medium text-red-800">{{ errorMessage }}</p>
        </div>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const MIN_CHARS = 50
const MAX_CHARS = 5000

const ideasStore = useIdeasStore()
const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  title: '',
  description: '',
})

const isSubmitting = ref(false)
const descriptionError = ref('')
const successMessage = ref('')
const errorMessage = ref('')
const evaluationId = ref<string>('')

// Character count
const characterCount = computed(() => form.description.length)

// Validation
const isDescriptionValid = computed(() => {
  return characterCount.value >= MIN_CHARS && characterCount.value <= MAX_CHARS
})

const isFormValid = computed(() => {
  return isDescriptionValid.value && !descriptionError.value
})

const validateDescription = () => {
  descriptionError.value = ''

  if (form.description.length === 0) {
    return
  }

  if (form.description.length < MIN_CHARS) {
    descriptionError.value = `Description must be at least ${MIN_CHARS} characters`
    return
  }

  if (form.description.length > MAX_CHARS) {
    descriptionError.value = `Description must be no more than ${MAX_CHARS} characters`
    return
  }

  // Basic content validation
  if (form.description.trim().split(' ').length < 10) {
    descriptionError.value = 'Please provide a more detailed description (at least 10 words)'
    return
  }
}

const sanitizeInput = (input: string): string => {
  // Basic XSS prevention - remove HTML tags and script content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

const handleSubmit = async () => {
  if (!isFormValid.value) {
    validateDescription()
    return
  }

  // Check authentication
  if (!authStore.isAuthenticated) {
    errorMessage.value = 'Please log in to submit your business idea'
    router.push('/login')
    return
  }

  try {
    isSubmitting.value = true
    errorMessage.value = ''
    successMessage.value = ''

    // Sanitize inputs
    const sanitizedData = {
      title: form.title ? sanitizeInput(form.title) : '',
      description: sanitizeInput(form.description),
    }

    // Submit idea and start evaluation
    const result = await ideasStore.submitIdea(sanitizedData)

    if (result.success) {
      successMessage.value =
        'Your business idea has been submitted successfully! AI analysis is starting...'
      evaluationId.value = result.evaluationId || ''

      // Reset form
      form.title = ''
      form.description = ''

      // Auto-redirect to evaluation results after 3 seconds
      if (result.evaluationId) {
        window.setTimeout(() => {
          router.push(`/evaluation/${result.evaluationId}`)
        }, 3000)
      }
    } else {
      errorMessage.value = result.message || 'Failed to submit business idea. Please try again.'
    }
  } catch (err: unknown) {
    const error = err as {
      response?: { status?: number; data?: { message?: string } }
      message?: string
    }
    // eslint-disable-next-line no-console
    console.error('Error submitting idea:', error)

    if (error.response?.status === 401) {
      errorMessage.value = 'Your session has expired. Please log in again.'
      await authStore.logout()
      router.push('/login')
    } else if (error.response?.status === 429) {
      errorMessage.value =
        'You have submitted too many ideas recently. Please wait before submitting another.'
    } else if (error.response?.status === 422) {
      errorMessage.value = error.response.data?.message || 'Please check your input and try again.'
    } else {
      errorMessage.value = 'Network error. Please check your connection and try again.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>
