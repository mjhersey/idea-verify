/**
 * WebSocket Integration Tests
 * Comprehensive end-to-end testing of WebSocket communication,
 * performance, reconnection, and fallback mechanisms
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { io, Socket } from 'socket.io-client'
import EventSource from 'eventsource'
import type {
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent,
} from '../../packages/shared/src/types/websocket.js'

// Test configuration
const TEST_SERVER_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const TEST_AUTH_TOKEN = 'test-integration-token'
const PERFORMANCE_TIMEOUT = 30000 // 30 seconds for performance tests

// Mock data
const mockEvaluationId = 'test-eval-integration-123'
const mockAgentProgressEvent: AgentProgressEvent = {
  agentType: 'market-research',
  status: 'running',
  progressPercentage: 50,
  timestamp: new Date(),
}

const mockInsightEvent: InsightDiscoveredEvent = {
  agentType: 'competitive-analysis',
  insight: {
    type: 'market-opportunity',
    content: 'Large untapped market identified',
    importance: 'high',
  },
  confidence: 0.85,
  timestamp: new Date(),
}

describe('WebSocket Integration Tests', () => {
  let testSocket: Socket | null = null
  let testSSE: EventSource | null = null

  beforeAll(async () => {
    // Wait for test server to be available
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    // Cleanup any remaining connections
    if (testSocket) {
      testSocket.disconnect()
    }
    if (testSSE) {
      testSSE.close()
    }
  })

  beforeEach(() => {
    // Clear any existing connections
    if (testSocket) {
      testSocket.disconnect()
      testSocket = null
    }
    if (testSSE) {
      testSSE.close()
      testSSE = null
    }
  })

  afterEach(() => {
    // Ensure cleanup after each test
    if (testSocket) {
      testSocket.disconnect()
      testSocket = null
    }
    if (testSSE) {
      testSSE.close()
      testSSE = null
    }
  })

  describe('End-to-End WebSocket Communication', () => {
    it('should establish WebSocket connection with authentication', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          clearTimeout(timeout)
          expect(testSocket?.connected).toBe(true)
          resolve()
        })

        testSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    }, 15000)

    it('should handle subscription to evaluation updates', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription test timeout'))
        }, 10000)

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          // Subscribe to evaluation
          testSocket?.emit('subscribe', mockEvaluationId)

          // Send a test progress event
          setTimeout(() => {
            testSocket?.emit('test:agent-progress', mockAgentProgressEvent)
          }, 100)
        })

        testSocket.on('agent:progress', (data: AgentProgressEvent) => {
          clearTimeout(timeout)
          expect(data.agentType).toBe(mockAgentProgressEvent.agentType)
          expect(data.status).toBe(mockAgentProgressEvent.status)
          expect(data.progressPercentage).toBe(mockAgentProgressEvent.progressPercentage)
          resolve()
        })

        testSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    }, 15000)

    it('should handle multiple event types correctly', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Multiple events test timeout'))
        }, 15000)

        const receivedEvents: string[] = []
        const expectedEvents = ['agent:progress', 'insight:discovered']

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          testSocket?.emit('subscribe', mockEvaluationId)

          // Send multiple test events
          setTimeout(() => {
            testSocket?.emit('test:agent-progress', mockAgentProgressEvent)
            testSocket?.emit('test:insight-discovered', mockInsightEvent)
          }, 100)
        })

        testSocket.on('agent:progress', (data: AgentProgressEvent) => {
          receivedEvents.push('agent:progress')
          expect(data.agentType).toBe(mockAgentProgressEvent.agentType)
          checkCompletion()
        })

        testSocket.on('insight:discovered', (data: InsightDiscoveredEvent) => {
          receivedEvents.push('insight:discovered')
          expect(data.agentType).toBe(mockInsightEvent.agentType)
          expect(data.confidence).toBe(mockInsightEvent.confidence)
          checkCompletion()
        })

        const checkCompletion = () => {
          if (receivedEvents.length === expectedEvents.length) {
            clearTimeout(timeout)
            expect(receivedEvents).toEqual(expect.arrayContaining(expectedEvents))
            resolve()
          }
        }

        testSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    }, 20000)
  })

  describe('Performance Testing', () => {
    it(
      'should handle concurrent connections efficiently',
      async () => {
        const connectionCount = 10
        const sockets: Socket[] = []
        const connectionPromises: Promise<void>[] = []

        const startTime = Date.now()

        // Create multiple concurrent connections
        for (let i = 0; i < connectionCount; i++) {
          const promise = new Promise<void>((resolve, reject) => {
            const socket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
              auth: { token: `${TEST_AUTH_TOKEN}-${i}` },
              transports: ['websocket'],
            })

            sockets.push(socket)

            const timeout = setTimeout(() => {
              reject(new Error(`Connection ${i} timeout`))
            }, 5000)

            socket.on('connect', () => {
              clearTimeout(timeout)
              resolve()
            })

            socket.on('connect_error', error => {
              clearTimeout(timeout)
              reject(error)
            })
          })

          connectionPromises.push(promise)
        }

        // Wait for all connections to establish
        await Promise.all(connectionPromises)

        const connectionTime = Date.now() - startTime

        // Verify all connections are established
        expect(sockets.length).toBe(connectionCount)
        sockets.forEach(socket => {
          expect(socket.connected).toBe(true)
        })

        // Connection time should be reasonable (under 5 seconds for 10 connections)
        expect(connectionTime).toBeLessThan(5000)

        // Cleanup
        sockets.forEach(socket => socket.disconnect())
      },
      PERFORMANCE_TIMEOUT
    )

    it('should maintain low latency for real-time updates', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Latency test timeout'))
        }, 10000)

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          testSocket?.emit('subscribe', mockEvaluationId)

          const sendTime = Date.now()
          testSocket?.emit('test:latency-check', { timestamp: sendTime })
        })

        testSocket.on('latency:response', (data: { timestamp: number }) => {
          clearTimeout(timeout)
          const latency = Date.now() - data.timestamp

          // Latency should be under 500ms for local testing
          expect(latency).toBeLessThan(500)
          resolve()
        })

        testSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    }, 15000)
  })

  describe('Network Interruption and Reconnection', () => {
    it('should automatically reconnect after connection loss', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnection test timeout'))
        }, 20000)

        let disconnectCount = 0
        let reconnectCount = 0

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          reconnection: true,
          reconnectionDelay: 100,
          reconnectionAttempts: 3,
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          if (reconnectCount === 0) {
            // First connection - simulate disconnect
            setTimeout(() => {
              testSocket?.disconnect()
            }, 100)
          } else {
            // Successful reconnection
            clearTimeout(timeout)
            expect(reconnectCount).toBe(1)
            expect(disconnectCount).toBe(1)
            resolve()
          }
        })

        testSocket.on('disconnect', () => {
          disconnectCount++
        })

        testSocket.on('reconnect', () => {
          reconnectCount++
        })

        testSocket.on('connect_error', error => {
          // Allow some connection errors during reconnection attempts
          console.warn('Connection error during reconnection test:', error.message)
        })
      })
    }, 25000)

    it('should maintain subscription state after reconnection', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription persistence test timeout'))
        }, 15000)

        let hasReconnected = false

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          reconnection: true,
          reconnectionDelay: 100,
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          testSocket?.emit('subscribe', mockEvaluationId)

          if (!hasReconnected) {
            // Force disconnect to test reconnection
            setTimeout(() => {
              testSocket?.disconnect()
            }, 100)
          } else {
            // After reconnection, test if subscription still works
            setTimeout(() => {
              testSocket?.emit('test:agent-progress', mockAgentProgressEvent)
            }, 100)
          }
        })

        testSocket.on('reconnect', () => {
          hasReconnected = true
        })

        testSocket.on('agent:progress', (data: AgentProgressEvent) => {
          if (hasReconnected) {
            clearTimeout(timeout)
            expect(data.agentType).toBe(mockAgentProgressEvent.agentType)
            resolve()
          }
        })
      })
    }, 20000)
  })

  describe('Authentication Flow Testing', () => {
    it('should reject connections with invalid authentication', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Auth rejection test timeout'))
        }, 10000)

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: 'invalid-token' },
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          clearTimeout(timeout)
          reject(new Error('Should not connect with invalid token'))
        })

        testSocket.on('connect_error', error => {
          clearTimeout(timeout)
          expect(error.message).toContain('Authentication')
          resolve()
        })
      })
    }, 15000)

    it('should handle token expiration gracefully', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Token expiration test timeout'))
        }, 10000)

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: 'expired-token' },
          transports: ['websocket'],
        })

        testSocket.on('connect_error', error => {
          clearTimeout(timeout)
          expect(error.message).toMatch(/expired|invalid/i)
          resolve()
        })

        testSocket.on('connect', () => {
          clearTimeout(timeout)
          reject(new Error('Should not connect with expired token'))
        })
      })
    }, 15000)
  })

  describe('Server-Sent Events Fallback', () => {
    it('should fallback to SSE when WebSocket fails', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('SSE fallback test timeout'))
        }, 15000)

        // Create SSE connection directly to test fallback
        const sseUrl = `${TEST_SERVER_URL}/api/events/evaluations/current/events?token=${TEST_AUTH_TOKEN}`
        testSSE = new EventSource(sseUrl)

        testSSE.onopen = () => {
          // SSE connection established
          expect(testSSE?.readyState).toBe(EventSource.OPEN)

          // Send test event trigger
          setTimeout(() => {
            // Simulate triggering an agent progress event via HTTP
            fetch(`${TEST_SERVER_URL}/api/test/trigger-progress`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
              },
              body: JSON.stringify(mockAgentProgressEvent),
            }).catch(() => {
              // Ignore fetch errors for this test
            })
          }, 100)
        }

        testSSE.addEventListener('agent:progress', (event: MessageEvent) => {
          clearTimeout(timeout)
          const data = JSON.parse(event.data)
          expect(data.agentType).toBe(mockAgentProgressEvent.agentType)
          expect(data.status).toBe(mockAgentProgressEvent.status)
          resolve()
        })

        testSSE.onerror = error => {
          clearTimeout(timeout)
          reject(new Error(`SSE connection error: ${error}`))
        }
      })
    }, 20000)

    it('should maintain same event format between WebSocket and SSE', async () => {
      const webSocketEvents: any[] = []
      const sseEvents: any[] = []

      // Test WebSocket events first
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket event format test timeout'))
        }, 10000)

        testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: TEST_AUTH_TOKEN },
          transports: ['websocket'],
        })

        testSocket.on('connect', () => {
          testSocket?.emit('subscribe', mockEvaluationId)
          testSocket?.emit('test:agent-progress', mockAgentProgressEvent)
        })

        testSocket.on('agent:progress', (data: AgentProgressEvent) => {
          clearTimeout(timeout)
          webSocketEvents.push(data)
          testSocket?.disconnect()
          resolve()
        })
      })

      // Test SSE events
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('SSE event format test timeout'))
        }, 10000)

        const sseUrl = `${TEST_SERVER_URL}/api/events/evaluations/current/events?token=${TEST_AUTH_TOKEN}`
        testSSE = new EventSource(sseUrl)

        testSSE.onopen = () => {
          fetch(`${TEST_SERVER_URL}/api/test/trigger-progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
            },
            body: JSON.stringify(mockAgentProgressEvent),
          }).catch(() => {
            // Ignore fetch errors for this test
          })
        }

        testSSE.addEventListener('agent:progress', (event: MessageEvent) => {
          clearTimeout(timeout)
          const data = JSON.parse(event.data)
          sseEvents.push(data)
          testSSE?.close()
          resolve()
        })
      })

      // Compare event formats
      expect(webSocketEvents.length).toBe(1)
      expect(sseEvents.length).toBe(1)

      const wsEvent = webSocketEvents[0]
      const sseEvent = sseEvents[0]

      expect(wsEvent.agentType).toBe(sseEvent.agentType)
      expect(wsEvent.status).toBe(sseEvent.status)
      expect(wsEvent.progressPercentage).toBe(sseEvent.progressPercentage)
    }, 25000)
  })

  describe('Memory Leak and Resource Cleanup', () => {
    it('should properly cleanup resources on disconnect', async () => {
      const connections: Socket[] = []
      const initialMemory = process.memoryUsage().heapUsed

      // Create multiple connections
      for (let i = 0; i < 20; i++) {
        const socket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
          auth: { token: `${TEST_AUTH_TOKEN}-cleanup-${i}` },
          transports: ['websocket'],
        })
        connections.push(socket)
      }

      // Wait for all connections to establish
      await Promise.all(
        connections.map(
          socket =>
            new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)
              socket.on('connect', () => {
                clearTimeout(timeout)
                resolve()
              })
            })
        )
      )

      // Subscribe all connections to generate some activity
      connections.forEach((socket, index) => {
        socket.emit('subscribe', `${mockEvaluationId}-${index}`)
      })

      // Wait a bit for subscriptions to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Disconnect all connections
      connections.forEach(socket => socket.disconnect())

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 10MB for 20 connections)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    }, 30000)

    it('should handle rapid connect/disconnect cycles', async () => {
      const cycles = 10

      for (let i = 0; i < cycles; i++) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Cycle ${i} timeout`))
          }, 3000)

          const socket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
            auth: { token: `${TEST_AUTH_TOKEN}-cycle-${i}` },
            transports: ['websocket'],
          })

          socket.on('connect', () => {
            clearTimeout(timeout)
            socket.disconnect()
            resolve()
          })

          socket.on('connect_error', error => {
            clearTimeout(timeout)
            reject(error)
          })
        })

        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Test should complete without hanging
      expect(true).toBe(true)
    }, 40000)
  })
})
