<template>
  <div v-if="hasError" class="error-boundary p-6 border border-red-200 rounded-lg bg-red-50">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-800">Something went wrong</h3>
        <p class="mt-1 text-sm text-red-700">
          {{ displayMessage }}
        </p>
        <div class="mt-4">
          <div class="flex space-x-2">
            <button
              class="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              @click="retry"
            >
              Try again
            </button>
            <button
              v-if="showDetails"
              class="bg-white px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-gray-50 border border-red-300"
              @click="toggleDetails"
            >
              {{ showingDetails ? 'Hide details' : 'Show details' }}
            </button>
          </div>
        </div>
        <div v-if="showingDetails && error" class="mt-3 p-3 bg-red-100 rounded-md">
          <pre class="text-xs text-red-800 whitespace-pre-wrap">{{
            error.stack || error.message
          }}</pre>
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, provide } from 'vue'

interface Props {
  fallbackMessage?: string
  showDetails?: boolean
  onError?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  fallbackMessage: 'An unexpected error occurred. Please try again.',
  showDetails: false,
})

const hasError = ref(false)
const error = ref<Error | null>(null)
const showingDetails = ref(false)

const displayMessage = ref('')

const reset = () => {
  hasError.value = false
  error.value = null
  showingDetails.value = false
  displayMessage.value = ''
}

const retry = () => {
  reset()
  // Trigger a re-render by toggling a key on the parent
  // This is a simple approach - more sophisticated error boundaries
  // might want to implement retry logic differently
}

const toggleDetails = () => {
  showingDetails.value = !showingDetails.value
}

// Provide reset function to child components
provide('resetErrorBoundary', reset)

onErrorCaptured((err: Error, instance, info) => {
  hasError.value = true
  error.value = err

  // Set user-friendly message
  displayMessage.value = props.fallbackMessage

  // Call custom error handler if provided
  if (props.onError) {
    props.onError(err, instance, info)
  }

  // Log error in development
  if (import.meta.env.DEV) {
    console.group('🚨 Error Boundary Caught Error')
    console.error('Error:', err)
    console.log('Component:', instance?.$options?.name)
    console.log('Info:', info)
    console.groupEnd()
  }

  // Prevent the error from propagating up
  return false
})
</script>

<style scoped>
.error-boundary {
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
}
</style>
