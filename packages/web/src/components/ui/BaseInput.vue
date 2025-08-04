<template>
  <div class="space-y-1">
    <label
      v-if="label"
      :for="inputId"
      class="block text-sm font-medium text-gray-700"
    >
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    
    <div class="relative">
      <input
        :id="inputId"
        v-model="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :class="inputClasses"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />
      
      <!-- Error icon -->
      <div v-if="error && !disabled" class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      </div>
      
      <!-- Success icon -->
      <div v-if="success && !error && !disabled" class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
    
    <!-- Help text -->
    <p v-if="helpText && !error" class="text-sm text-gray-500">
      {{ helpText }}
    </p>
    
    <!-- Error message -->
    <p v-if="error" class="text-sm text-red-600">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

interface Props {
  modelValue?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  label?: string
  placeholder?: string
  helpText?: string
  error?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  success?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  readonly: false,
  required: false,
  success: false,
  size: 'md'
})

defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: Event]
  focus: [event: Event]
}>()

const inputId = useId()

const inputClasses = computed(() => {
  const base = [
    'block w-full rounded-md border shadow-sm',
    'focus:outline-none focus:ring-1',
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
    'readonly:bg-gray-50 readonly:text-gray-500'
  ]

  // Size variants
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  // State variants
  let stateClasses: string[] = []
  
  if (props.error) {
    stateClasses = [
      'border-red-300',
      'focus:border-red-500 focus:ring-red-500'
    ]
  } else if (props.success) {
    stateClasses = [
      'border-green-300',
      'focus:border-green-500 focus:ring-green-500'
    ]
  } else {
    stateClasses = [
      'border-gray-300',
      'focus:border-indigo-500 focus:ring-indigo-500'
    ]
  }

  return [
    ...base,
    sizeClasses[props.size],
    ...stateClasses
  ].join(' ')
})
</script>