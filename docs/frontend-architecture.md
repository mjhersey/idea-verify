# AI-Powered Business Idea Validation Platform - Frontend Architecture

## Introduction

This document defines the frontend architecture for the AI-Powered Business Idea
Validation Platform, built with Vue.js 3 and designed to provide an intuitive,
real-time interface for business idea evaluation. The architecture supports
real-time progress visualization, responsive design, and seamless integration
with the backend API Gateway.

### Change Log

| Date           | Version | Description                   | Author            |
| -------------- | ------- | ----------------------------- | ----------------- |
| [Current Date] | 1.0     | Initial Frontend Architecture | Sally (UX Expert) |

## Tech Stack

| Category         | Technology             | Version     | Purpose                 | Rationale                                          |
| ---------------- | ---------------------- | ----------- | ----------------------- | -------------------------------------------------- |
| Framework        | Vue.js                 | 3.4+        | UI Framework            | Reactive, performant, excellent TypeScript support |
| Build Tool       | Vite                   | 5.0+        | Development & Build     | Fast HMR, optimized production builds              |
| Language         | TypeScript             | 5.0+        | Type Safety             | Improved developer experience and code reliability |
| State Management | Pinia                  | 2.1+        | Application State       | Vue 3 recommended, composable, lightweight         |
| Routing          | Vue Router             | 4.2+        | Client-side Routing     | Official Vue.js router with type support           |
| UI Framework     | Headless UI Vue        | 1.7+        | Accessible Components   | WCAG compliant, unstyled components                |
| Styling          | Tailwind CSS           | 3.4+        | Utility-first CSS       | Rapid development, consistent design system        |
| Real-time        | Socket.IO Client       | 4.7+        | WebSocket Communication | Reliable real-time updates with fallbacks          |
| HTTP Client      | Axios                  | 1.6+        | API Communication       | Request/response interceptors, error handling      |
| Forms            | VeeValidate            | 4.12+       | Form Validation         | Vue 3 optimized, declarative validation            |
| Charts           | Chart.js + vue-chartjs | 5.4+ / 5.3+ | Data Visualization      | Interactive charts for progress and results        |
| Animation        | @vueuse/motion         | 2.0+        | Micro-interactions      | Performant animations with Vue directives          |
| Testing (Unit)   | Vitest                 | 1.0+        | Unit Testing            | Fast, Vite-native testing framework                |
| Testing (E2E)    | Cypress                | 13.0+       | End-to-end Testing      | Reliable e2e testing with component testing        |
| Testing (Utils)  | @vue/test-utils        | 2.4+        | Vue Testing             | Official Vue testing utilities                     |
| Dev Tools        | Vue DevTools           | 6.5+        | Development             | Vue-specific debugging tools                       |

## Project Structure

```
packages/web/
├── public/
│   ├── favicon.ico
│   └── index.html
├── src/
│   ├── components/          # Reusable components
│   │   ├── ui/             # Design system components
│   │   │   ├── BaseButton.vue
│   │   │   ├── BaseCard.vue
│   │   │   ├── BaseInput.vue
│   │   │   ├── BaseBadge.vue
│   │   │   └── index.ts
│   │   ├── layout/         # Layout components
│   │   │   ├── AppHeader.vue
│   │   │   ├── AppSidebar.vue
│   │   │   ├── AppLayout.vue
│   │   │   └── index.ts
│   │   ├── evaluation/     # Evaluation-specific components
│   │   │   ├── IdeaInput.vue
│   │   │   ├── ProgressDashboard.vue
│   │   │   ├── AgentCard.vue
│   │   │   ├── InsightCard.vue
│   │   │   ├── ResultsSummary.vue
│   │   │   └── index.ts
│   │   └── common/         # Common components
│   │       ├── LoadingSpinner.vue
│   │       ├── ErrorBoundary.vue
│   │       └── index.ts
│   ├── composables/        # Vue composables
│   │   ├── useApi.ts
│   │   ├── useWebSocket.ts
│   │   ├── useEvaluation.ts
│   │   ├── useAuth.ts
│   │   └── useDesignTokens.ts
│   ├── stores/             # Pinia stores
│   │   ├── auth.ts
│   │   ├── evaluation.ts
│   │   ├── websocket.ts
│   │   └── index.ts
│   ├── services/           # API services
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── evaluation.ts
│   │   └── websocket.ts
│   ├── types/              # TypeScript types
│   │   ├── api.ts
│   │   ├── evaluation.ts
│   │   ├── user.ts
│   │   └── index.ts
│   ├── router/             # Vue Router configuration
│   │   ├── index.ts
│   │   ├── guards.ts
│   │   └── routes.ts
│   ├── views/              # Page components
│   │   ├── HomePage.vue
│   │   ├── LoginPage.vue
│   │   ├── DashboardPage.vue
│   │   ├── EvaluationPage.vue
│   │   ├── ResultsPage.vue
│   │   └── ProfilePage.vue
│   ├── assets/             # Static assets
│   │   ├── images/
│   │   ├── icons/
│   │   └── styles/
│   │       ├── main.css
│   │       ├── components.css
│   │       └── design-tokens.css
│   ├── utils/              # Utility functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── App.vue
│   └── main.ts
├── tests/
│   ├── unit/               # Unit tests
│   ├── e2e/                # E2E tests
│   └── __mocks__/          # Test mocks
├── cypress/                # Cypress configuration
├── public/
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Design System Integration

### Design Tokens CSS Variables

Based on the provided `design-system.json`, create CSS custom properties:

```css
/* assets/styles/design-tokens.css */
:root {
  /* Colors */
  --color-primary: #4f46e5;
  --color-success: #22c55e;
  --color-warning: #facc15;
  --color-danger: #ef4444;
  --color-info: #3b82f6;
  --color-sidebar-bg: #0f172a;
  --color-sidebar-highlight: #f97316;
  --color-surface: #ffffff;
  --color-background: #f8fafc;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-muted: #e2e8f0;
  --color-accent: #818cf8;
  --color-highlight: #a5b4fc;
  --color-chart-bar: #6366f1;
  --color-chart-line: #e0e7ff;

  /* Typography */
  --font-family: 'Inter', sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-none: 0px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 40px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### Tailwind Config Integration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        sidebar: {
          bg: 'var(--color-sidebar-bg)',
          highlight: 'var(--color-sidebar-highlight)',
        },
        surface: 'var(--color-surface)',
        background: 'var(--color-background)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        highlight: 'var(--color-highlight)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
```

## Component Architecture

### Base UI Components

#### BaseButton Component

```vue
<!-- components/ui/BaseButton.vue -->
<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    v-bind="$attrs"
    @click="handleClick"
  >
    <LoadingSpinner v-if="loading" class="w-4 h-4 mr-2" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LoadingSpinner from '../common/LoadingSpinner.vue'

interface Props {
  variant?: 'primary' | 'success' | 'danger' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => [
  'inline-flex items-center justify-center font-medium rounded-md transition-colors',
  'focus:outline-none focus:ring-2 focus:ring-offset-2',
  'disabled:opacity-50 disabled:cursor-not-allowed',

  // Size variants
  {
    'px-3 py-1.5 text-sm': props.size === 'sm',
    'px-4 py-2 text-base': props.size === 'md',
    'px-6 py-3 text-lg': props.size === 'lg',
  },

  // Color variants
  {
    'bg-primary text-white hover:bg-primary/90 focus:ring-primary':
      props.variant === 'primary',
    'bg-success text-white hover:bg-success/90 focus:ring-success':
      props.variant === 'success',
    'bg-danger text-white hover:bg-danger/90 focus:ring-danger':
      props.variant === 'danger',
    'bg-surface text-text-primary border border-muted hover:bg-muted/50 focus:ring-accent':
      props.variant === 'secondary',
  },
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>
```

#### BaseCard Component

```vue
<!-- components/ui/BaseCard.vue -->
<template>
  <div :class="cardClasses">
    <div v-if="$slots.header" class="px-6 py-4 border-b border-muted">
      <slot name="header" />
    </div>
    <div :class="contentClasses">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-6 py-4 border-t border-muted">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  padding?: boolean
  shadow?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  padding: true,
  shadow: 'md',
})

const cardClasses = computed(() => [
  'bg-surface rounded-md border border-muted',
  {
    'shadow-sm': props.shadow === 'sm',
    'shadow-md': props.shadow === 'md',
    'shadow-lg': props.shadow === 'lg',
  },
])

const contentClasses = computed(() => [props.padding ? 'p-6' : ''])
</script>
```

### Evaluation Flow Components

#### IdeaInput Component

```vue
<!-- components/evaluation/IdeaInput.vue -->
<template>
  <BaseCard>
    <template #header>
      <h2 class="text-2xl font-semibold text-text-primary">
        Describe Your Business Idea
      </h2>
      <p class="text-text-secondary mt-2">
        Provide a clear description of your business idea (50-5000 characters)
      </p>
    </template>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label
          for="idea-description"
          class="block text-sm font-medium text-text-primary mb-2"
        >
          Business Idea Description *
        </label>
        <textarea
          id="idea-description"
          v-model="description"
          :class="textareaClasses"
          placeholder="Example: A mobile app that uses AI to help small businesses optimize their inventory management by predicting demand patterns and automating reorder points..."
          rows="8"
          @input="validateInput"
        />
        <div class="flex justify-between items-center mt-2">
          <p v-if="error" class="text-danger text-sm">{{ error }}</p>
          <div class="text-sm text-text-secondary ml-auto">
            {{ description.length }}/5000 characters
            <span v-if="description.length < 50" class="text-warning">
              ({{ 50 - description.length }} more needed)
            </span>
          </div>
        </div>
      </div>

      <div class="flex gap-4">
        <BaseButton
          type="submit"
          :disabled="!isValid || loading"
          :loading="loading"
          class="flex-1"
        >
          Start Evaluation
        </BaseButton>

        <BaseButton
          variant="secondary"
          type="button"
          @click="clearForm"
          :disabled="loading"
        >
          Clear
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEvaluationStore } from '@/stores/evaluation'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const evaluationStore = useEvaluationStore()

const description = ref('')
const error = ref('')
const loading = ref(false)

const isValid = computed(() => {
  return description.value.length >= 50 && description.value.length <= 5000
})

const textareaClasses = computed(() => [
  'w-full px-3 py-2 border rounded-md resize-none',
  'focus:outline-none focus:ring-2 focus:border-transparent',
  {
    'border-muted focus:ring-accent': !error.value,
    'border-danger focus:ring-danger': error.value,
  },
])

const validateInput = () => {
  error.value = ''

  if (description.value.length > 5000) {
    error.value = 'Description must be less than 5000 characters'
  } else if (description.value.length > 0 && description.value.length < 50) {
    error.value = 'Description must be at least 50 characters'
  }
}

const handleSubmit = async () => {
  if (!isValid.value) return

  loading.value = true
  try {
    const evaluation = await evaluationStore.startEvaluation(description.value)
    router.push(`/evaluation/${evaluation.id}`)
  } catch (err) {
    error.value = 'Failed to start evaluation. Please try again.'
  } finally {
    loading.value = false
  }
}

const clearForm = () => {
  description.value = ''
  error.value = ''
}
</script>
```

#### ProgressDashboard Component

```vue
<!-- components/evaluation/ProgressDashboard.vue -->
<template>
  <div class="space-y-6">
    <!-- Overall Progress -->
    <BaseCard>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-text-primary">
          Evaluation Progress
        </h2>
        <span class="text-2xl font-bold text-primary">
          {{ Math.round(overallProgress) }}%
        </span>
      </div>

      <div class="w-full bg-muted rounded-pill h-3 mb-4">
        <div
          class="bg-primary h-3 rounded-pill transition-all duration-300"
          :style="{ width: `${overallProgress}%` }"
        />
      </div>

      <div class="flex justify-between text-sm text-text-secondary">
        <span>Started {{ formatTime(evaluation.startedAt) }}</span>
        <span v-if="estimatedCompletion">
          Est. completion: {{ formatTime(estimatedCompletion) }}
        </span>
      </div>
    </BaseCard>

    <!-- Agent Status Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AgentCard
        v-for="agent in agents"
        :key="agent.id"
        :agent="agent"
        @click="selectAgent(agent)"
      />
    </div>

    <!-- Live Insights Feed -->
    <BaseCard v-if="recentInsights.length > 0">
      <template #header>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-success rounded-full animate-pulse" />
          <h3 class="text-lg font-medium text-text-primary">Live Insights</h3>
        </div>
      </template>

      <div class="space-y-3 max-h-96 overflow-y-auto">
        <InsightCard
          v-for="insight in recentInsights"
          :key="insight.id"
          :insight="insight"
          :animate="true"
        />
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluation } from '@/composables/useEvaluation'
import { formatDistanceToNow } from 'date-fns'
import BaseCard from '@/components/ui/BaseCard.vue'
import AgentCard from './AgentCard.vue'
import InsightCard from './InsightCard.vue'
import type { Agent, Insight } from '@/types'

interface Props {
  evaluationId: string
}

const props = defineProps<Props>()

const { evaluation, agents, insights } = useEvaluation(props.evaluationId)

const overallProgress = computed(() => {
  if (!agents.value.length) return 0
  const totalProgress = agents.value.reduce(
    (sum, agent) => sum + agent.progress,
    0
  )
  return totalProgress / agents.value.length
})

const estimatedCompletion = computed(() => {
  if (!evaluation.value || overallProgress.value === 0) return null

  const elapsed = Date.now() - new Date(evaluation.value.startedAt).getTime()
  const totalEstimated = (elapsed / overallProgress.value) * 100
  return new Date(
    new Date(evaluation.value.startedAt).getTime() + totalEstimated
  )
})

const recentInsights = computed(() => {
  return insights.value
    .filter(insight => insight.timestamp > Date.now() - 300000) // Last 5 minutes
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
})

const formatTime = (date: Date | string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

const selectAgent = (agent: Agent) => {
  // Handle agent selection for detailed view
  console.log('Selected agent:', agent)
}
</script>
```

## State Management (Pinia)

### Evaluation Store

```typescript
// stores/evaluation.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { evaluationApi } from '@/services/evaluation'
import type { Evaluation, Agent, Insight } from '@/types'

export const useEvaluationStore = defineStore('evaluation', () => {
  // State
  const evaluations = ref<Map<string, Evaluation>>(new Map())
  const agents = ref<Map<string, Agent[]>>(new Map())
  const insights = ref<Map<string, Insight[]>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const getEvaluation = computed(() => {
    return (id: string) => evaluations.value.get(id)
  })

  const getAgents = computed(() => {
    return (evaluationId: string) => agents.value.get(evaluationId) || []
  })

  const getInsights = computed(() => {
    return (evaluationId: string) => insights.value.get(evaluationId) || []
  })

  const getOverallProgress = computed(() => {
    return (evaluationId: string) => {
      const evalAgents = getAgents.value(evaluationId)
      if (!evalAgents.length) return 0
      return (
        evalAgents.reduce((sum, agent) => sum + agent.progress, 0) /
        evalAgents.length
      )
    }
  })

  // Actions
  const startEvaluation = async (description: string): Promise<Evaluation> => {
    loading.value = true
    error.value = null

    try {
      const evaluation = await evaluationApi.start(description)
      evaluations.value.set(evaluation.id, evaluation)
      agents.value.set(evaluation.id, evaluation.agents || [])
      insights.value.set(evaluation.id, [])
      return evaluation
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to start evaluation'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateAgent = (
    evaluationId: string,
    agentUpdate: Partial<Agent> & { id: string }
  ) => {
    const evalAgents = agents.value.get(evaluationId)
    if (!evalAgents) return

    const agentIndex = evalAgents.findIndex(a => a.id === agentUpdate.id)
    if (agentIndex !== -1) {
      evalAgents[agentIndex] = { ...evalAgents[agentIndex], ...agentUpdate }
      agents.value.set(evaluationId, [...evalAgents])
    }
  }

  const addInsight = (evaluationId: string, insight: Insight) => {
    const evalInsights = insights.value.get(evaluationId) || []
    insights.value.set(evaluationId, [insight, ...evalInsights])
  }

  const completeEvaluation = async (evaluationId: string) => {
    const evaluation = evaluations.value.get(evaluationId)
    if (!evaluation) return

    evaluation.status = 'completed'
    evaluation.completedAt = new Date()
    evaluations.value.set(evaluationId, evaluation)
  }

  return {
    // State
    evaluations,
    agents,
    insights,
    loading,
    error,

    // Getters
    getEvaluation,
    getAgents,
    getInsights,
    getOverallProgress,

    // Actions
    startEvaluation,
    updateAgent,
    addInsight,
    completeEvaluation,
  }
})
```

### WebSocket Store

```typescript
// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWebSocketService } from '@/services/websocket'
import { useEvaluationStore } from './evaluation'

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref(null)
  const connected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5

  const evaluationStore = useEvaluationStore()
  const webSocketService = useWebSocketService()

  const connectionStatus = computed(() => {
    if (connected.value) return 'connected'
    if (reconnectAttempts.value > 0) return 'reconnecting'
    return 'disconnected'
  })

  const connect = () => {
    socket.value = webSocketService.connect()

    socket.value?.on('connect', () => {
      connected.value = true
      reconnectAttempts.value = 0
    })

    socket.value?.on('disconnect', () => {
      connected.value = false
      attemptReconnect()
    })

    socket.value?.on('agent_progress', data => {
      evaluationStore.updateAgent(data.evaluationId, {
        id: data.agentId,
        progress: data.progress,
        status: data.status,
      })
    })

    socket.value?.on('new_insight', data => {
      evaluationStore.addInsight(data.evaluationId, data.insight)
    })

    socket.value?.on('evaluation_complete', data => {
      evaluationStore.completeEvaluation(data.evaluationId)
    })
  }

  const disconnect = () => {
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
  }

  const attemptReconnect = () => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++
      setTimeout(
        () => {
          connect()
        },
        Math.pow(2, reconnectAttempts.value) * 1000
      ) // Exponential backoff
    }
  }

  const joinEvaluation = (evaluationId: string) => {
    socket.value?.emit('join_evaluation', { evaluationId })
  }

  const leaveEvaluation = (evaluationId: string) => {
    socket.value?.emit('leave_evaluation', { evaluationId })
  }

  return {
    connected,
    connectionStatus,
    reconnectAttempts,
    connect,
    disconnect,
    joinEvaluation,
    leaveEvaluation,
  }
})
```

## Real-time WebSocket Integration

### WebSocket Service

```typescript
// services/websocket.ts
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth'

class WebSocketService {
  private socket: Socket | null = null
  private baseUrl: string

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  }

  connect(): Socket {
    const authStore = useAuthStore()

    this.socket = io(this.baseUrl, {
      auth: {
        token: authStore.accessToken,
      },
      transports: ['websocket', 'polling'], // Fallback to polling
      timeout: 20000,
      forceNew: true,
    })

    return this.socket
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  emit(event: string, data: any): void {
    this.socket?.emit(event, data)
  }

  on(event: string, callback: (data: any) => void): void {
    this.socket?.on(event, callback)
  }

  off(event: string, callback?: (data: any) => void): void {
    this.socket?.off(event, callback)
  }
}

export const useWebSocketService = () => new WebSocketService()
```

### WebSocket Composable

```typescript
// composables/useWebSocket.ts
import { onMounted, onUnmounted } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'
import { useAuthStore } from '@/stores/auth'

export function useWebSocket() {
  const webSocketStore = useWebSocketStore()
  const authStore = useAuthStore()

  onMounted(() => {
    if (authStore.isAuthenticated) {
      webSocketStore.connect()
    }
  })

  onUnmounted(() => {
    webSocketStore.disconnect()
  })

  return {
    connected: webSocketStore.connected,
    connectionStatus: webSocketStore.connectionStatus,
    joinEvaluation: webSocketStore.joinEvaluation,
    leaveEvaluation: webSocketStore.leaveEvaluation,
  }
}
```

## API Integration

### API Service

```typescript
// services/api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      config => {
        const authStore = useAuthStore()
        if (authStore.accessToken) {
          config.headers.Authorization = `Bearer ${authStore.accessToken}`
        }
        return config
      },
      error => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      response => response,
      async error => {
        const authStore = useAuthStore()

        if (error.response?.status === 401) {
          try {
            await authStore.refreshToken()
            // Retry the original request
            return this.client.request(error.config)
          } catch (refreshError) {
            authStore.logout()
            router.push('/login')
          }
        }

        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config)
    return response.data
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post(url, data, config)
    return response.data
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config)
    return response.data
  }
}

export const apiService = new ApiService()
```

## Routing Configuration

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, guestGuard } from './guards'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomePage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    beforeEnter: guestGuard,
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardPage.vue'),
    beforeEnter: authGuard,
  },
  {
    path: '/evaluation/:id',
    name: 'Evaluation',
    component: () => import('@/views/EvaluationPage.vue'),
    beforeEnter: authGuard,
    props: true,
  },
  {
    path: '/results/:id',
    name: 'Results',
    component: () => import('@/views/ResultsPage.vue'),
    beforeEnter: authGuard,
    props: true,
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfilePage.vue'),
    beforeEnter: authGuard,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
```

## Responsive Design Strategy

### Breakpoints Strategy

- **Mobile**: 0px - 767px (Touch-optimized, single column)
- **Tablet**: 768px - 1023px (Hybrid layout, collapsible sidebar)
- **Desktop**: 1024px - 1439px (Full layout, persistent sidebar)
- **Wide**: 1440px+ (Expanded layout, wider content areas)

### Key Responsive Patterns

1. **Navigation**: Hamburger menu on mobile, sidebar on desktop
2. **Layout**: Single column on mobile, multi-column on larger screens
3. **Form Elements**: Full-width on mobile, constrained on desktop
4. **Data Visualization**: Simplified charts on mobile, full features on desktop

## Performance Optimization

### Bundle Optimization

- **Code Splitting**: Route-based and component-based splitting
- **Tree Shaking**: Remove unused code with ES modules
- **Asset Optimization**: Image compression and lazy loading
- **CDN Integration**: Static assets served from CDN

### Performance Goals

- **Initial Load**: < 3 seconds on 3G
- **First Contentful Paint**: < 1.5 seconds
- **Time to Interactive**: < 5 seconds
- **Bundle Size**: < 500KB initial, < 200KB per route

## Testing Strategy

### Unit Testing (Vitest)

```typescript
// tests/unit/components/BaseButton.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '@/components/ui/BaseButton.vue'

describe('BaseButton', () => {
  it('renders correctly with default props', () => {
    const wrapper = mount(BaseButton, {
      slots: { default: 'Click me' },
    })

    expect(wrapper.text()).toBe('Click me')
    expect(wrapper.classes()).toContain('bg-primary')
  })

  it('emits click event when clicked', async () => {
    const wrapper = mount(BaseButton)
    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('is disabled when loading', () => {
    const wrapper = mount(BaseButton, {
      props: { loading: true },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

### E2E Testing (Cypress)

```typescript
// cypress/e2e/evaluation-flow.cy.ts
describe('Evaluation Flow', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/dashboard')
  })

  it('should complete full evaluation flow', () => {
    // Start evaluation
    cy.get('[data-cy=start-evaluation]').click()

    // Enter idea description
    cy.get('[data-cy=idea-input]').type(
      'A mobile app for small business inventory management using AI prediction'
    )

    // Submit evaluation
    cy.get('[data-cy=submit-evaluation]').click()

    // Verify progress dashboard
    cy.get('[data-cy=progress-dashboard]').should('be.visible')
    cy.get('[data-cy=agent-card]').should('have.length', 5)

    // Wait for completion (mock WebSocket)
    cy.mockWebSocketProgress()

    // Verify results
    cy.get('[data-cy=results-summary]').should('be.visible')
    cy.get('[data-cy=recommendation]').should('contain', 'GO')
  })
})
```

## Environment Configuration

```bash
# .env.example
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_ENVIRONMENT=development
VITE_LOG_LEVEL=debug
```

## Build Configuration

### Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          ui: ['@headlessui/vue'],
          charts: ['chart.js', 'vue-chartjs'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
```

## Critical Development Standards

### Component Guidelines

1. **Single Responsibility**: Each component should have one clear purpose
2. **Prop Validation**: Always define prop types and defaults
3. **Event Naming**: Use kebab-case for custom events
4. **Slot Usage**: Provide named slots for flexible content insertion
5. **Accessibility**: Include ARIA labels and proper semantic HTML

### Code Quality Rules

1. **TypeScript First**: All new code must use TypeScript
2. **Composition API**: Use `<script setup>` syntax consistently
3. **Reactive References**: Use `ref()` for primitives, `reactive()` for objects
4. **Error Handling**: Wrap async operations in try-catch blocks
5. **Performance**: Use `computed()` for derived state, avoid watchers when
   possible

### File Naming Conventions

- **Components**: PascalCase (e.g., `BaseButton.vue`)
- **Views**: PascalCase with "Page" suffix (e.g., `DashboardPage.vue`)
- **Composables**: camelCase with "use" prefix (e.g., `useEvaluation.ts`)
- **Stores**: camelCase (e.g., `evaluation.ts`)
- **Types**: camelCase (e.g., `evaluation.ts`)

## Next Steps

### Immediate Actions

1. **Set up development environment** with Vite and Vue 3
2. **Implement design system** integration with Tailwind CSS
3. **Create base UI components** following the design system
4. **Set up WebSocket connection** for real-time updates
5. **Implement evaluation flow** with progress tracking

### Development Priorities

1. **Core evaluation flow** (Week 1-2)
2. **Real-time progress visualization** (Week 2-3)
3. **Results dashboard and reporting** (Week 3-4)
4. **User management and authentication** (Week 4-5)
5. **Performance optimization and testing** (Week 5-6)

This frontend architecture provides a solid foundation for building an
intuitive, performant, and scalable interface for your AI-Powered Business Idea
Validation Platform. The architecture emphasizes real-time user feedback,
responsive design, and maintainable code structure while integrating seamlessly
with your existing design system and backend API.
