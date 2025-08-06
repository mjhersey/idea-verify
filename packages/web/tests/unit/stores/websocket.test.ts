import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWebSocketStore } from '@/stores/websocket'
import {
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent,
} from '@ai-validation/shared'

// Mock the composable
vi.mock('@/composables/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    connectionState: { value: 'disconnected' },
    isConnected: { value: false },
    isConnecting: { value: false },
    isReconnecting: { value: false },
    lastError: { value: null },
    reconnectAttempts: { value: 0 },
    usingSse: { value: false },
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    subscribeToEvaluation: vi.fn(),
    unsubscribeFromEvaluation: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    $watch: vi.fn(() => {
      // Return unwatch function
      return () => {}
    }),
  })),
}))

describe('WebSocket Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Store Initialization', () => {
    it('should initialize with correct default state', () => {
      const store = useWebSocketStore()

      expect(store.connectionState).toBe('disconnected')
      expect(store.isConnected).toBe(false)
      expect(store.currentEvaluation).toBeNull()
      expect(store.notifications).toEqual([])
      expect(store.lastError).toBeNull()
      expect(store.reconnectAttempts).toBe(0)
    })

    it('should have correct computed properties', () => {
      const store = useWebSocketStore()

      expect(store.isEvaluationActive).toBe(false)
      expect(store.evaluationProgress).toBe(0)
    })
  })

  describe('Connection Management', () => {
    it('should initialize connection successfully', async () => {
      const store = useWebSocketStore()

      await store.initializeConnection('test-token')

      expect(store.notifications.length).toBeGreaterThan(0)
      expect(store.notifications[0].type).toBe('success')
      expect(store.notifications[0].title).toBe('Connected')
    })

    it('should handle connection failure', async () => {
      const store = useWebSocketStore()
      const mockWebSocket = await import('@/composables/useWebSocket')

      // Make connect fail
      vi.mocked(mockWebSocket.useWebSocket().connect).mockRejectedValue(
        new Error('Connection failed')
      )

      try {
        await store.initializeConnection('test-token')
      } catch (error) {
        expect(store.notifications.some(n => n.type === 'error')).toBe(true)
      }
    })
  })

  describe('Evaluation Subscription', () => {
    it('should subscribe to evaluation and initialize state', () => {
      const store = useWebSocketStore()
      const evaluationId = 'test-eval-123'

      store.subscribeToEvaluation(evaluationId)

      expect(store.currentEvaluation).not.toBeNull()
      expect(store.currentEvaluation?.evaluationId).toBe(evaluationId)
      expect(store.currentEvaluation?.overallProgress).toBe(0)
      expect(store.currentEvaluation?.activeAgents).toEqual([])
      expect(store.currentEvaluation?.completedAgents).toEqual([])
      expect(store.currentEvaluation?.insights).toEqual([])
      expect(store.currentEvaluation?.errors).toEqual([])
    })

    it('should unsubscribe from evaluation', () => {
      const store = useWebSocketStore()
      const evaluationId = 'test-eval-123'

      store.subscribeToEvaluation(evaluationId)
      expect(store.currentEvaluation).not.toBeNull()

      store.unsubscribeFromEvaluation()
      expect(store.currentEvaluation).toBeNull()
    })
  })

  describe('Event Handlers', () => {
    beforeEach(() => {
      const store = useWebSocketStore()
      store.subscribeToEvaluation('test-eval')
    })

    it('should handle agent progress events', () => {
      const store = useWebSocketStore()

      const progressEvent: AgentProgressEvent = {
        agentType: 'market-research',
        status: 'running',
        progressPercentage: 75,
        timestamp: new Date(),
      }

      store.handleAgentProgress(progressEvent)

      expect(store.currentEvaluation?.agentProgresses['market-research']).toBeDefined()
      expect(store.currentEvaluation?.agentProgresses['market-research'].status).toBe('running')
      expect(store.currentEvaluation?.agentProgresses['market-research'].progressPercentage).toBe(
        75
      )
    })

    it('should handle insight discovered events', () => {
      const store = useWebSocketStore()

      const insightEvent: InsightDiscoveredEvent = {
        agentType: 'competitive-analysis',
        insight: {
          type: 'competitive-advantage',
          content: 'Unique value proposition identified',
          importance: 'high',
        },
        confidence: 0.85,
        timestamp: new Date(),
      }

      store.handleInsightDiscovered(insightEvent)

      expect(store.currentEvaluation?.insights).toContain(insightEvent)
      expect(store.notifications.some(n => n.title === 'New Insight')).toBe(true)
    })

    it('should handle evaluation status events', () => {
      const store = useWebSocketStore()

      const statusEvent: EvaluationStatusEvent = {
        evaluationId: 'test-eval',
        overallProgress: 60,
        activeAgents: ['market-research', 'technical-feasibility'],
        completedAgents: ['competitive-analysis'],
        failedAgents: [],
        timestamp: new Date(),
      }

      store.handleEvaluationStatus(statusEvent)

      expect(store.currentEvaluation?.overallProgress).toBe(60)
      expect(store.currentEvaluation?.activeAgents).toEqual([
        'market-research',
        'technical-feasibility',
      ])
      expect(store.currentEvaluation?.completedAgents).toEqual(['competitive-analysis'])
    })

    it('should handle agent completed events', () => {
      const store = useWebSocketStore()

      const completedEvent: AgentCompletedEvent = {
        agentType: 'market-research',
        evaluationId: 'test-eval',
        resultSummary: {
          score: 85,
          keyFindings: ['Large market', 'Growing demand'],
          recommendation: 'Proceed',
        },
        executionTime: 45000,
        finalScore: 85,
        timestamp: new Date(),
      }

      store.handleAgentCompleted(completedEvent)

      expect(store.currentEvaluation?.agentProgresses['market-research'].status).toBe('completed')
      expect(store.notifications.some(n => n.title === 'Agent Completed')).toBe(true)
    })

    it('should handle error events', () => {
      const store = useWebSocketStore()

      const errorEvent: ErrorEvent = {
        evaluationId: 'test-eval',
        error: 'API rate limit exceeded',
        severity: 'high',
        agentType: 'technical-feasibility',
        timestamp: new Date(),
      }

      store.handleError(errorEvent)

      expect(store.currentEvaluation?.errors).toContain(errorEvent)
      expect(store.notifications.some(n => n.type === 'error')).toBe(true)
    })

    it('should handle evaluation completed events', () => {
      const store = useWebSocketStore()

      const completedEvent: EvaluationCompletedEvent = {
        evaluationId: 'test-eval',
        finalResults: {
          overallScore: 78,
          recommendation: 'recommended',
          summary: 'Good business idea',
        },
        totalTime: 120000,
        agentSummaries: [{ agentType: 'market-research', score: 85, executionTime: 45000 }],
        timestamp: new Date(),
      }

      store.handleEvaluationCompleted(completedEvent)

      expect(store.currentEvaluation?.endTime).toBeDefined()
      expect(store.currentEvaluation?.finalResults).toBe(completedEvent.finalResults)
      expect(store.notifications.some(n => n.title === 'Evaluation Complete')).toBe(true)
    })
  })

  describe('Notifications', () => {
    it('should add notifications correctly', () => {
      const store = useWebSocketStore()

      store.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      })

      expect(store.notifications.length).toBe(1)
      expect(store.notifications[0].type).toBe('info')
      expect(store.notifications[0].title).toBe('Test')
      expect(store.notifications[0].message).toBe('Test message')
      expect(store.notifications[0].id).toBeDefined()
      expect(store.notifications[0].timestamp).toBeDefined()
    })

    it('should remove notifications', () => {
      const store = useWebSocketStore()

      store.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      })

      const notificationId = store.notifications[0].id
      store.removeNotification(notificationId)

      expect(store.notifications.length).toBe(0)
    })

    it('should clear all notifications', () => {
      const store = useWebSocketStore()

      store.addNotification({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1',
      })

      store.addNotification({
        type: 'error',
        title: 'Test 2',
        message: 'Message 2',
      })

      expect(store.notifications.length).toBe(2)

      store.clearNotifications()

      expect(store.notifications.length).toBe(0)
    })
  })
})
