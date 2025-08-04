<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="buttonClasses"
    @click="$emit('click', $event)"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-3 h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  fullWidth: false
})

defineEmits<{
  click: [event: Event]
}>()

const buttonClasses = computed(() => {
  const base = [
    // Base styles
    'inline-flex items-center justify-center font-medium rounded-md',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'transition-colors duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ]

  // Size variants
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  // Color variants
  const variantClasses = {
    primary: [
      'bg-indigo-600 text-white',
      'hover:bg-indigo-700 focus:ring-indigo-500',
      'disabled:bg-indigo-400'
    ],
    secondary: [
      'bg-gray-600 text-white',
      'hover:bg-gray-700 focus:ring-gray-500',
      'disabled:bg-gray-400'
    ],
    outline: [
      'border border-gray-300 bg-white text-gray-700',
      'hover:bg-gray-50 focus:ring-indigo-500',
      'disabled:bg-gray-50 disabled:text-gray-400'
    ],
    danger: [
      'bg-red-600 text-white',
      'hover:bg-red-700 focus:ring-red-500',
      'disabled:bg-red-400'
    ],
    ghost: [
      'text-gray-700 bg-transparent',
      'hover:bg-gray-100 focus:ring-gray-500',
      'disabled:text-gray-400'
    ]
  }

  // Width classes
  const widthClasses = props.fullWidth ? 'w-full' : ''

  return [
    ...base,
    sizeClasses[props.size],
    ...variantClasses[props.variant],
    widthClasses
  ].filter(Boolean).join(' ')
})
</script>