<template>
  <div :class="cardClasses">
    <div v-if="$slots.header" class="px-6 py-4 border-b border-gray-200">
      <slot name="header" />
    </div>
    
    <div :class="bodyClasses">
      <slot />
    </div>
    
    <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  shadow?: boolean
  hover?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: 'md',
  shadow: true,
  hover: false
})

const cardClasses = computed(() => {
  const base = [
    'bg-white rounded-lg overflow-hidden'
  ]

  // Variant styles
  const variantClasses = {
    default: [],
    outlined: ['border border-gray-200'],
    elevated: ['border border-gray-100']
  }

  // Shadow classes
  const shadowClasses = {
    true: 'shadow-md',
    false: ''
  }

  // Hover effects
  const hoverClasses = props.hover ? 'hover:shadow-lg transition-shadow duration-200' : ''

  return [
    ...base,
    ...variantClasses[props.variant],
    shadowClasses[props.shadow.toString() as keyof typeof shadowClasses],
    hoverClasses
  ].filter(Boolean).join(' ')
})

const bodyClasses = computed(() => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  return paddingClasses[props.padding]
})
</script>