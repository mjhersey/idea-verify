import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  ConnectionState,
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent,
} from '@ai-validation/shared'
import { useWebSocket } from '@/composables/useWebSocket'

interface EvaluationState {
  evaluationId: string
  overallProgress: number
  activeAgents: string[]
  completedAgents: string[]
  failedAgents: string[]
  estimatedCompletionTime?: Date
  insights: InsightDiscoveredEvent[]
  errors: ErrorEvent[]
  startTime?: Date
  endTime?: Date
  finalResults?: EvaluationCompletedEvent['finalResults']
  agentProgresses: Record<
    string,
    {
      status: string
      progressPercentage: number
      lastUpdate: Date
    }
  >
}

interface NotificationMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  autoClose?: boolean
}

export const useWebSocketStore = defineStore('websocket', () => {
  // WebSocket composable
  const webSocket = useWebSocket()

  // Connection state
  const connectionState = ref<ConnectionState>('disconnected')
  const lastError = ref<string | null>(null)
  const reconnectAttempts = ref(0)

  // Current evaluation state
  const currentEvaluation = ref<EvaluationState | null>(null)

  // Notifications
  const notifications = ref<NotificationMessage[]>([])

  // Computed properties
  const isConnected = computed(() => connectionState.value === 'connected')
  const isEvaluationActive = computed(
    () =>
      currentEvaluation.value &&
      currentEvaluation.value.activeAgents.length > 0 &&
      !currentEvaluation.value.endTime
  )
  const evaluationProgress = computed(() => currentEvaluation.value?.overallProgress || 0)

  // Initialize WebSocket connection
  const initializeConnection = async (token?: string) => {
    try {
      const connected = await webSocket.connect({ token })
      if (connected) {
        connectionState.value = webSocket.connectionState.value
        setupConnectionStateWatcher()
        addNotification({
          type: 'success',
          title: 'Connected',
          message: webSocket.usingSse.value
            ? 'Connected via Server-Sent Events'
            : 'Connected via WebSocket',
          autoClose: true,
        })
      } else {
        throw new Error('Failed to establish connection')
      }
    } catch (error: any) {
      lastError.value = error.message
      addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: error.message || 'Failed to connect to real-time updates',
        autoClose: false,
      })
    }
  }

  // Watch connection state changes
  const setupConnectionStateWatcher = () => {
    // Sync connection state
    const unwatchConnection = watch(
      () => webSocket.connectionState.value,
      newState => {
        connectionState.value = newState

        if (newState === 'disconnected') {
          addNotification({
            type: 'warning',
            title: 'Disconnected',
            message: 'Lost connection to real-time updates',
            autoClose: true,
          })
        } else if (newState === 'reconnecting') {
          addNotification({
            type: 'info',
            title: 'Reconnecting',
            message: 'Attempting to restore connection...',
            autoClose: true,
          })
        } else if (newState === 'connected') {
          if (reconnectAttempts.value > 0) {
            addNotification({
              type: 'success',
              title: 'Reconnected',
              message: 'Real-time updates restored',
              autoClose: true,
            })
          }
        }
      }
    )

    // Sync reconnect attempts
    const unwatchReconnects = watch(
      () => webSocket.reconnectAttempts.value,
      attempts => {
        reconnectAttempts.value = attempts
      }
    )

    // Sync errors
    const unwatchErrors = watch(
      () => webSocket.lastError.value,
      error => {
        lastError.value = error
        if (error) {
          addNotification({
            type: 'error',
            title: 'Connection Error',
            message: error,
            autoClose: false,
          })
        }
      }
    )

    return () => {
      unwatchConnection()
      unwatchReconnects()
      unwatchErrors()
    }
  }

  // Subscribe to evaluation updates
  const subscribeToEvaluation = (evaluationId: string) => {
    // Initialize evaluation state
    currentEvaluation.value = {
      evaluationId,
      overallProgress: 0,
      activeAgents: [],
      completedAgents: [],
      failedAgents: [],
      insights: [],
      errors: [],
      agentProgresses: {},
      startTime: new Date(),
    }

    // Subscribe to WebSocket events
    webSocket.subscribeToEvaluation(evaluationId, {
      onProgress: handleAgentProgress,
      onInsight: handleInsightDiscovered,
      onStatus: handleEvaluationStatus,
      onAgentCompleted: handleAgentCompleted,
      onError: handleError,
      onCompleted: handleEvaluationCompleted,
    })

    addNotification({
      type: 'info',
      title: 'Evaluation Started',
      message: `Monitoring progress for evaluation ${evaluationId}`,
      autoClose: true,
    })
  }

  // Unsubscribe from evaluation
  const unsubscribeFromEvaluation = () => {
    if (currentEvaluation.value) {
      webSocket.unsubscribeFromEvaluation(currentEvaluation.value.evaluationId)
      currentEvaluation.value = null
    }
  }

  // Handle agent progress updates
  const handleAgentProgress = (event: AgentProgressEvent) => {
    if (!currentEvaluation.value) return

    currentEvaluation.value.agentProgresses[event.agentType] = {
      status: event.status,
      progressPercentage: event.progressPercentage,
      lastUpdate: new Date(event.timestamp),
    }

    // Add notification for major progress milestones
    if (event.status === 'running' && event.progressPercentage === 50) {
      addNotification({
        type: 'info',
        title: 'Agent Progress',
        message: `${event.agentType} analysis is halfway complete`,
        autoClose: true,
      })
    }
  }

  // Handle insight discoveries
  const handleInsightDiscovered = (event: InsightDiscoveredEvent) => {
    if (!currentEvaluation.value) return

    currentEvaluation.value.insights.push(event)

    // Add notification for high-importance insights
    if (event.insight.importance === 'high' || event.insight.importance === 'critical') {
      addNotification({
        type: event.insight.importance === 'critical' ? 'warning' : 'info',
        title: 'New Insight',
        message: `${event.agentType}: ${event.insight.content}`,
        autoClose: false,
      })
    }
  }

  // Handle evaluation status updates
  const handleEvaluationStatus = (event: EvaluationStatusEvent) => {
    if (!currentEvaluation.value) return

    currentEvaluation.value.overallProgress = event.overallProgress
    currentEvaluation.value.activeAgents = event.activeAgents
    currentEvaluation.value.completedAgents = event.completedAgents
    currentEvaluation.value.failedAgents = event.failedAgents || []

    if (event.estimatedCompletionTime) {
      currentEvaluation.value.estimatedCompletionTime = new Date(event.estimatedCompletionTime)
    }
  }

  // Handle agent completion
  const handleAgentCompleted = (event: AgentCompletedEvent) => {
    if (!currentEvaluation.value) return

    // Update agent progress to completed
    currentEvaluation.value.agentProgresses[event.agentType] = {
      status: 'completed',
      progressPercentage: 100,
      lastUpdate: new Date(event.timestamp),
    }

    addNotification({
      type: 'success',
      title: 'Agent Completed',
      message: `${event.agentType} analysis completed with score: ${event.finalScore}`,
      autoClose: true,
    })
  }

  // Handle errors
  const handleError = (event: ErrorEvent) => {
    if (!currentEvaluation.value) return

    currentEvaluation.value.errors.push(event)

    const notificationType =
      event.severity === 'high' || event.severity === 'critical' ? 'error' : 'warning'

    addNotification({
      type: notificationType,
      title: 'Evaluation Error',
      message: `${event.agentType || 'System'}: ${event.error}`,
      autoClose: event.severity === 'low',
    })
  }

  // Handle evaluation completion
  const handleEvaluationCompleted = (event: EvaluationCompletedEvent) => {
    if (!currentEvaluation.value) return

    currentEvaluation.value.endTime = new Date(event.timestamp)
    currentEvaluation.value.finalResults = event.finalResults

    addNotification({
      type: 'success',
      title: 'Evaluation Complete',
      message: `Final score: ${event.finalResults.overallScore} - ${event.finalResults.recommendation}`,
      autoClose: false,
    })
  }

  // Add notification
  const addNotification = (notification: Omit<NotificationMessage, 'id' | 'timestamp'>) => {
    const newNotification: NotificationMessage = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
    }

    notifications.value.push(newNotification)

    // Auto-remove notification after 5 seconds if autoClose is true
    if (notification.autoClose) {
      setTimeout(() => {
        removeNotification(newNotification.id)
      }, 5000)
    }
  }

  // Remove notification
  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  // Clear all notifications
  const clearNotifications = () => {
    notifications.value = []
  }

  // Disconnect WebSocket
  const disconnect = () => {
    webSocket.disconnect()
    currentEvaluation.value = null
    connectionState.value = 'disconnected'
  }

  return {
    // State
    connectionState,
    lastError,
    reconnectAttempts,
    currentEvaluation,
    notifications,

    // Computed
    isConnected,
    isEvaluationActive,
    evaluationProgress,

    // Actions
    initializeConnection,
    subscribeToEvaluation,
    unsubscribeFromEvaluation,
    addNotification,
    removeNotification,
    clearNotifications,
    disconnect,
  }
})
