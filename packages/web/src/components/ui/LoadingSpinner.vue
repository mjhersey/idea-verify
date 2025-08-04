<template>
  <div :class="containerClasses">
    <svg
      :class="spinnerClasses"
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
    
    <span v-if="text" :class="textClasses">
      {{ text }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'white' | 'gray' | 'current'
  text?: string
  center?: boolean
  overlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'primary',
  center: false,
  overlay: false
})

const containerClasses = computed(() => {
  const base = ['flex items-center']
  
  if (props.text) {
    base.push('space-x-3')
  }
  
  if (props.center) {
    base.push('justify-center')
  }
  
  if (props.overlay) {
    base.push(
      'absolute inset-0 bg-white bg-opacity-75',
      'flex items-center justify-center z-50'
    )
  }
  
  return base.join(' ')
})

const spinnerClasses = computed(() => {
  const base = ['animate-spin']
  
  // Size variants
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }
  
  // Color variants
  const colorClasses = {
    primary: 'text-indigo-600',
    white: 'text-white',
    gray: 'text-gray-600',
    current: 'text-current'
  }
  
  return [
    ...base,
    sizeClasses[props.size],
    colorClasses[props.color]
  ].join(' ')
})

const textClasses = computed(() => {
  const base = ['text-sm']
  
  // Color variants for text
  const colorClasses = {
    primary: 'text-gray-900',
    white: 'text-white',
    gray: 'text-gray-600',
    current: 'text-current'
  }
  
  return [
    ...base,
    colorClasses[props.color]
  ].join(' ')
})
</script>