/**
 * WebSocket Integration Tests - Unit Level
 * Tests WebSocket integration without requiring live services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketRateLimiter } from '../../src/websocket/rate-limiter.js'
import { ConnectionManager } from '../../src/websocket/connection-manager.js'
import { ProgressCalculator } from '../../src/websocket/progress-calculator.js'

// Mock Socket.IO
const mockSocket = {
  id: 'test-socket-123',
  emit: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  userId: 'test-user-123',
}

describe('WebSocket Integration Tests', () => {
  let rateLimiter: WebSocketRateLimiter
  let connectionManager: ConnectionManager
  let progressCalculator: ProgressCalculator

  beforeEach(() => {
    rateLimiter = new WebSocketRateLimiter({
      maxConnectionsPerUser: 3,
      maxConnectionsGlobal: 10,
      messagesPerSecond: 5,
      messagesPerMinute: 50,
    })
    connectionManager = new ConnectionManager()
    progressCalculator = new ProgressCalculator()
    vi.clearAllMocks()
  })

  afterEach(() => {
    rateLimiter.cleanup()
  })

  describe('Concurrent Connection Management', () => {
    it('should handle multiple concurrent connections per user within limits', () => {
      const userId = 'test-user'
      const sockets = Array.from({ length: 3 }, (_, i) => ({
        ...mockSocket,
        id: `socket-${i}`,
        userId,
      }))

      // Test all connections are allowed within limit
      sockets.forEach((socket, index) => {
        const canConnect = rateLimiter.canConnect(userId, socket.id)
        expect(canConnect.allowed).toBe(true)

        rateLimiter.addConnection(userId, socket as any)
        connectionManager.addConnection(socket.id, userId, socket as any)
      })

      // Verify connections are tracked
      const metrics = rateLimiter.getMetrics()
      expect(metrics.totalConnections).toBe(3)
      expect(metrics.userCount).toBe(1)
    })

    it('should reject connections exceeding per-user limit', () => {
      const userId = 'test-user'

      // Add maximum allowed connections
      for (let i = 0; i < 3; i++) {
        const socketId = `socket-${i}`
        rateLimiter.addConnection(userId, { id: socketId } as any)
      }

      // Fourth connection should be rejected
      const canConnect = rateLimiter.canConnect(userId, 'socket-4')
      expect(canConnect.allowed).toBe(false)
      expect(canConnect.reason).toContain('User connection limit exceeded')
    })

    it('should handle global connection limits', () => {
      // Add connections up to global limit
      for (let i = 0; i < 10; i++) {
        const userId = `user-${i}`
        const socketId = `socket-${i}`
        rateLimiter.addConnection(userId, { id: socketId } as any)
      }

      // Next connection should be rejected
      const canConnect = rateLimiter.canConnect('user-11', 'socket-11')
      expect(canConnect.allowed).toBe(false)
      expect(canConnect.reason).toBe('Global connection limit exceeded')
    })

    it('should properly cleanup connections on disconnect', () => {
      const userId = 'test-user'
      const socketId = 'test-socket'

      // Add connection
      rateLimiter.addConnection(userId, { id: socketId } as any)
      connectionManager.addConnection(socketId, userId, mockSocket as any)

      expect(rateLimiter.getMetrics().totalConnections).toBe(1)

      // Remove connection
      rateLimiter.removeConnection(socketId)
      connectionManager.removeConnection(socketId)

      expect(rateLimiter.getMetrics().totalConnections).toBe(0)
    })
  })

  describe('Message Rate Limiting', () => {
    beforeEach(() => {
      const userId = 'test-user'
      const socketId = 'test-socket'
      rateLimiter.addConnection(userId, { id: socketId } as any)
    })

    it('should allow messages within rate limits', () => {
      const socketId = 'test-socket'

      // Send messages within limit (5 per second)
      for (let i = 0; i < 4; i++) {
        const canSend = rateLimiter.canSendMessage(socketId)
        expect(canSend.allowed).toBe(true)
        rateLimiter.recordMessage(socketId)
      }
    })

    it('should reject messages exceeding per-second limit', () => {
      const socketId = 'test-socket'

      // Fill up the per-second limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordMessage(socketId)
      }

      // Next message should be rate limited
      const canSend = rateLimiter.canSendMessage(socketId)
      expect(canSend.allowed).toBe(false)
      expect(canSend.reason).toContain('Message rate exceeded')
      expect(canSend.waitMs).toBe(1000)
    })

    it('should track violations and apply penalties', () => {
      const socketId = 'test-socket'

      // Cause multiple violations
      for (let violation = 0; violation < 3; violation++) {
        // Fill rate limit
        for (let i = 0; i < 6; i++) {
          rateLimiter.recordMessage(socketId)
        }

        // Try to send another message (should be rejected)
        rateLimiter.canSendMessage(socketId)

        // Small delay to separate violations
        vi.advanceTimersByTime(100)
      }

      const metrics = rateLimiter.getMetrics()
      expect(metrics.totalViolations).toBeGreaterThan(0)
    })
  })

  describe('Progress Calculation Integration', () => {
    it('should handle concurrent progress updates', () => {
      const evaluationId = 'test-eval'
      const agents = ['market-research', 'competitive-analysis', 'customer-research']

      // Initialize evaluation first
      progressCalculator.initializeEvaluation(evaluationId, agents)

      // Simulate multiple agents reporting progress concurrently
      agents.forEach((agentType, index) => {
        progressCalculator.updateAgentProgress(evaluationId, agentType, 'running', (index + 1) * 25)
      })

      const evaluationProgress = progressCalculator.getEvaluationProgress(evaluationId)
      expect(evaluationProgress?.overallProgress).toBeGreaterThan(0)
      expect(evaluationProgress?.overallProgress).toBeLessThanOrEqual(100)
    })

    it('should maintain consistent progress state across connections', () => {
      const evaluationId = 'test-eval-2'
      const agentType = 'market-research'
      const agents = [agentType]

      // Initialize evaluation first
      progressCalculator.initializeEvaluation(evaluationId, agents)

      // Update progress using correct method signature
      progressCalculator.updateAgentProgress(evaluationId, agentType, 'running', 75)

      // Multiple connections should see the same evaluation progress
      const progress1 = progressCalculator.getEvaluationProgress(evaluationId)
      const progress2 = progressCalculator.getEvaluationProgress(evaluationId)

      expect(progress1).toEqual(progress2)
      expect(progress1?.agentProgresses[agentType]?.progressPercentage).toBe(75)
    })

    it('should handle progress updates with edge cases', () => {
      const evaluationId = 'test-eval-3'
      const agentType = 'technical-feasibility'
      const agents = [agentType]

      // Initialize evaluation first
      progressCalculator.initializeEvaluation(evaluationId, agents)

      // Test edge cases
      const edgeCases = [
        { progressPercentage: 0, expected: 0 },
        { progressPercentage: 100, expected: 100 },
        { progressPercentage: -5, expected: 0 }, // Should clamp to 0
        { progressPercentage: 105, expected: 100 }, // Should clamp to 100
      ]

      edgeCases.forEach(({ progressPercentage, expected }) => {
        progressCalculator.updateAgentProgress(
          evaluationId,
          agentType,
          'running',
          progressPercentage
        )

        const evalProgress = progressCalculator.getEvaluationProgress(evaluationId)
        expect(evalProgress?.agentProgresses[agentType]?.progressPercentage).toBe(expected)
      })
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle connection errors gracefully', () => {
      const userId = 'test-user'
      const socketId = 'error-socket'

      // Add connection
      rateLimiter.addConnection(userId, { id: socketId } as any)

      // Simulate connection error by removing without proper cleanup
      rateLimiter.removeConnection(socketId)

      // Should not throw errors when trying to use removed connection
      expect(() => {
        rateLimiter.canSendMessage(socketId)
      }).not.toThrow()
    })

    it('should handle invalid input gracefully', () => {
      const userId = 'test-user'

      // Test invalid connection attempts
      expect(() => {
        rateLimiter.canConnect('', 'socket-1')
      }).not.toThrow()

      expect(() => {
        rateLimiter.canConnect(userId, '')
      }).not.toThrow()

      // Invalid socket ID for message checking
      const result = rateLimiter.canSendMessage('nonexistent-socket')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Connection not found')
    })

    it('should recover from temporary rate limit violations', async () => {
      const socketId = 'recovery-socket'
      rateLimiter.addConnection('test-user', { id: socketId } as any)

      // Cause rate limit violation
      for (let i = 0; i < 6; i++) {
        rateLimiter.recordMessage(socketId)
      }

      // Should be rate limited
      let canSend = rateLimiter.canSendMessage(socketId)
      expect(canSend.allowed).toBe(false)

      // Advance time to simulate recovery
      vi.advanceTimersByTime(2000)

      // Should be able to send again after time window
      canSend = rateLimiter.canSendMessage(socketId)
      expect(canSend.allowed).toBe(true)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should handle high connection turnover efficiently', () => {
      const connectionsToTest = 50
      const userIds: string[] = []

      // Create many connections
      for (let i = 0; i < connectionsToTest; i++) {
        const userId = `user-${i}`
        const socketId = `socket-${i}`
        userIds.push(userId)

        rateLimiter.addConnection(userId, { id: socketId } as any)
      }

      expect(rateLimiter.getMetrics().totalConnections).toBe(connectionsToTest)

      // Remove all connections
      for (let i = 0; i < connectionsToTest; i++) {
        const socketId = `socket-${i}`
        rateLimiter.removeConnection(socketId)
      }

      expect(rateLimiter.getMetrics().totalConnections).toBe(0)
    })

    it('should cleanup old data during maintenance', () => {
      const socketId = 'cleanup-socket'
      rateLimiter.addConnection('test-user', { id: socketId } as any)

      // Generate some activity
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordMessage(socketId)
      }

      // Run cleanup
      rateLimiter.cleanup()

      // Cleanup should run without errors
      expect(() => rateLimiter.cleanup()).not.toThrow()
    })

    it('should maintain performance with concurrent operations', () => {
      const operationCount = 100
      const startTime = Date.now()

      // Perform many concurrent operations
      for (let i = 0; i < operationCount; i++) {
        const userId = `user-${i % 10}` // 10 different users
        const socketId = `socket-${i}`

        rateLimiter.addConnection(userId, { id: socketId } as any)
        rateLimiter.canSendMessage(socketId)
        rateLimiter.recordMessage(socketId)
        rateLimiter.removeConnection(socketId)
      }

      const executionTime = Date.now() - startTime

      // Should complete within reasonable time (1 second for 100 operations)
      expect(executionTime).toBeLessThan(1000)
    })
  })
})

// Setup timer mocking for tests
vi.useFakeTimers()
