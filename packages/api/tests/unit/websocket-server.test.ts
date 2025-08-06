import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Socket as ClientSocket, io as ioClient } from 'socket.io-client'
import express from 'express'
import jwt from 'jsonwebtoken'

// Mock OrchestratorService
vi.mock('@ai-validation/orchestrator', () => ({
  OrchestratorService: {
    getInstance: vi.fn(() => ({
      getEvaluationProgress: vi.fn(() => ({
        evaluationId: 'test-eval',
        progress: 50,
        status: 'running',
        activeAgents: ['market-research'],
        completedAgents: [],
      })),
    })),
  },
}))

import { initializeWebSocketServer, getWebSocketServer } from '../../src/websocket/websocket-server'

// Mock JWT secret
process.env.JWT_SECRET = 'test-secret'
process.env.FRONTEND_URL = 'http://localhost:5173'

describe('WebSocketServer', () => {
  let httpServer: any
  let wsServer: any
  let clientSocket: ClientSocket
  let serverUrl: string
  const testToken = jwt.sign({ userId: 'test-user', email: 'test@example.com' }, 'test-secret')

  beforeEach(async () => {
    // Create test server
    const app = express()
    httpServer = createServer(app)

    // Initialize WebSocket server
    wsServer = initializeWebSocketServer(httpServer)

    // Start server on random port
    await new Promise<void>(resolve => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port
        serverUrl = `http://localhost:${port}`
        resolve()
      })
    })
  })

  afterEach(async () => {
    // Cleanup
    if (clientSocket?.connected) {
      clientSocket.disconnect()
    }
    wsServer?.shutdown()
    await new Promise<void>(resolve => {
      httpServer.close(() => resolve())
    })
  })

  describe('Connection Management', () => {
    it('should accept authenticated connections', async () => {
      clientSocket = ioClient(`${serverUrl}/evaluation-progress`, {
        auth: { token: testToken },
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000)

        clientSocket.on('connect', () => {
          clearTimeout(timeout)
          expect(clientSocket.connected).toBe(true)
          resolve()
        })

        clientSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    })

    it('should reject connections without authentication', async () => {
      clientSocket = ioClient(`${serverUrl}/evaluation-progress`)

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timeout')), 3000)

        clientSocket.on('connect', () => {
          clearTimeout(timeout)
          reject(new Error('Connection should have been rejected'))
        })

        clientSocket.on('connect_error', error => {
          clearTimeout(timeout)
          // Just check that there was an error, regardless of specific message
          expect(error).toBeDefined()
          resolve()
        })
      })
    })

    it('should handle client disconnection gracefully', async () => {
      clientSocket = ioClient(`${serverUrl}/evaluation-progress`, {
        auth: { token: testToken },
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timeout')), 3000)

        clientSocket.on('connect', () => {
          const connectionCount = wsServer.getConnectionManager().getTotalConnections()
          expect(connectionCount).toBe(1)

          clientSocket.disconnect()

          setTimeout(() => {
            const afterDisconnect = wsServer.getConnectionManager().getTotalConnections()
            expect(afterDisconnect).toBe(0)
            clearTimeout(timeout)
            resolve()
          }, 100)
        })

        clientSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    })
  })

  describe('Basic Functionality', () => {
    beforeEach(async () => {
      clientSocket = ioClient(`${serverUrl}/evaluation-progress`, {
        auth: { token: testToken },
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000)

        clientSocket.on('connect', () => {
          clearTimeout(timeout)
          resolve()
        })

        clientSocket.on('connect_error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    })

    it('should allow subscribing to evaluation rooms', async () => {
      const evaluationId = 'test-eval-123'
      let subscriptionCompleted = false

      clientSocket.on('evaluation:status', status => {
        expect(status).toBeDefined()
        subscriptionCompleted = true
      })

      clientSocket.emit('subscribe', evaluationId)

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 200))
      expect(subscriptionCompleted).toBe(true)
    })

    it('should respond to ping with pong', async () => {
      let pongReceived = false

      clientSocket.on('pong', data => {
        expect(data.timestamp).toBeDefined()
        pongReceived = true
      })

      clientSocket.emit('ping')

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 200))
      expect(pongReceived).toBe(true)
    })
  })
})
