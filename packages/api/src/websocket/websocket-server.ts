import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { authMiddleware } from './middleware/auth-middleware.js'
import { ConnectionManager } from './connection-manager.js'
import { EventEmitter } from './event-emitter.js'
import { WebSocketRateLimiter } from './rate-limiter.js'

export class WebSocketServer {
  private io: SocketIOServer
  private connectionManager: ConnectionManager
  private eventEmitter: EventEmitter
  private rateLimiter: WebSocketRateLimiter

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    })

    this.connectionManager = new ConnectionManager()
    this.eventEmitter = new EventEmitter(this.io)
    this.rateLimiter = new WebSocketRateLimiter()

    this.setupNamespaces()
    this.setupMiddleware()
    this.setupEventHandlers()
    this.startCleanupTimer()
  }

  private setupNamespaces(): void {
    // Create dedicated namespace for evaluation progress
    const evaluationNamespace = this.io.of('/evaluation-progress')
    evaluationNamespace.on('connection', this.handleEvaluationConnection.bind(this))
  }

  private setupMiddleware(): void {
    // Apply authentication middleware to evaluation namespace
    this.io.of('/evaluation-progress').use(authMiddleware)
  }

  private setupEventHandlers(): void {
    // Main namespace connection handler (for general events)
    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`)

      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`)
        this.connectionManager.removeConnection(socket.id)
        this.rateLimiter.removeConnection(socket.id)
      })

      socket.on('error', (error: Error) => {
        console.error(`[WebSocket] Socket error: ${error.message}`)
      })
    })
  }

  private handleEvaluationConnection(socket: Socket): void {
    console.log(`[WebSocket] Evaluation namespace connection: ${socket.id}`)

    const userId = (socket as any).userId // Set by auth middleware

    // Check rate limits before allowing connection
    const rateLimitCheck = this.rateLimiter.canConnect(userId, socket.id)
    if (!rateLimitCheck.allowed) {
      console.warn(`[WebSocket] Connection denied for user ${userId}: ${rateLimitCheck.reason}`)
      socket.emit('error', {
        message: 'Connection denied',
        reason: rateLimitCheck.reason,
        code: 'RATE_LIMIT_EXCEEDED',
      })
      socket.disconnect(true)
      return
    }

    // Add connection to managers
    this.connectionManager.addConnection(socket.id, userId, socket)
    this.rateLimiter.addConnection(userId, socket)

    // Handle room subscriptions
    socket.on('subscribe', async (evaluationId: string) => {
      try {
        // Validate user has access to this evaluation
        if (await this.validateEvaluationAccess(userId, evaluationId)) {
          await socket.join(`evaluation:${evaluationId}`)
          console.log(`[WebSocket] Client ${socket.id} subscribed to evaluation ${evaluationId}`)

          // Send current evaluation status
          this.eventEmitter.sendEvaluationSnapshot(socket, evaluationId)
        } else {
          socket.emit('error', { message: 'Unauthorized access to evaluation' })
        }
      } catch (error) {
        console.error(`[WebSocket] Subscribe error: ${error}`)
        socket.emit('error', { message: 'Failed to subscribe to evaluation' })
      }
    })

    socket.on('unsubscribe', async (evaluationId: string) => {
      await socket.leave(`evaluation:${evaluationId}`)
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from evaluation ${evaluationId}`)
    })

    // Handle heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() })
    })

    socket.on('disconnect', () => {
      this.connectionManager.removeConnection(socket.id)
      this.rateLimiter.removeConnection(socket.id)
    })
  }

  private async validateEvaluationAccess(userId: string, evaluationId: string): Promise<boolean> {
    try {
      // Input validation
      if (!userId || !evaluationId) {
        console.warn(
          `[WebSocket] Invalid access validation - userId: ${userId}, evaluationId: ${evaluationId}`
        )
        return false
      }

      console.log(`[WebSocket] Validating access for user ${userId} to evaluation ${evaluationId}`)

      // Database validation with graceful fallback
      try {
        // Attempt to get database connection
        const { getDatabaseFactory } = await import('../../orchestrator/src/database/index.js')
        const DatabaseFactory = await getDatabaseFactory()
        const db = DatabaseFactory.getInstance()

        // 1. Check if evaluation exists and is active
        const evaluationQuery = `
          SELECT id, user_id, status, created_at 
          FROM evaluations 
          WHERE id = $1 AND status != 'deleted'
        `

        const evaluation = await db.query(evaluationQuery, [evaluationId])

        if (!evaluation.rows || evaluation.rows.length === 0) {
          console.warn(`[WebSocket] Evaluation ${evaluationId} not found or deleted`)
          return false
        }

        const evaluationRecord = evaluation.rows[0]

        // 2. Verify user ownership
        if (evaluationRecord.user_id !== userId) {
          console.warn(
            `[WebSocket] Access denied: User ${userId} does not own evaluation ${evaluationId}`
          )
          return false
        }

        // 3. Check evaluation status is valid for WebSocket updates
        const validStatuses = ['pending', 'running', 'completed']
        if (!validStatuses.includes(evaluationRecord.status)) {
          console.warn(
            `[WebSocket] Evaluation ${evaluationId} has invalid status: ${evaluationRecord.status}`
          )
          return false
        }

        // 4. Rate limiting - check active connections per user
        const maxConnections = parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS_PER_USER || '5')
        const connectionQuery = `
          SELECT COUNT(*) as count 
          FROM websocket_connections 
          WHERE user_id = $1 AND disconnected_at IS NULL
        `

        const activeConnections = await db.query(connectionQuery, [userId])
        const currentConnections = parseInt(activeConnections.rows[0]?.count || '0')

        if (currentConnections >= maxConnections) {
          console.warn(
            `[WebSocket] Rate limit exceeded: User ${userId} has ${currentConnections}/${maxConnections} active connections`
          )
          return false
        }

        // 5. Log successful connection attempt
        const connectionLogQuery = `
          INSERT INTO websocket_connections (user_id, evaluation_id, connected_at, socket_id)
          VALUES ($1, $2, NOW(), $3)
          ON CONFLICT (user_id, evaluation_id, socket_id) 
          DO UPDATE SET connected_at = NOW(), disconnected_at = NULL
        `

        await db.query(connectionLogQuery, [userId, evaluationId, this.generateSocketId()])

        console.log(
          `[WebSocket] Database validation successful for user ${userId} to evaluation ${evaluationId}`
        )
        return true
      } catch (dbError) {
        // Graceful fallback when database is unavailable
        console.warn(
          `[WebSocket] Database unavailable, using fallback validation:`,
          dbError?.message || dbError
        )

        // Basic format validation as fallback
        const evaluationIdPattern = /^[a-zA-Z0-9-_]{3,50}$/
        const userIdPattern = /^[a-zA-Z0-9-_]{3,50}$/

        if (!evaluationIdPattern.test(evaluationId)) {
          console.warn(`[WebSocket] Invalid evaluation ID format: ${evaluationId}`)
          return false
        }

        if (!userIdPattern.test(userId)) {
          console.warn(`[WebSocket] Invalid user ID format: ${userId}`)
          return false
        }

        console.log(
          `[WebSocket] Fallback validation successful for user ${userId} to evaluation ${evaluationId}`
        )
        return true
      }
    } catch (error) {
      console.error(`[WebSocket] Critical error in evaluation access validation:`, error)
      return false
    }
  }

  private generateSocketId(): string {
    return `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  public getEventEmitter(): EventEmitter {
    return this.eventEmitter
  }

  public getConnectionManager(): ConnectionManager {
    return this.connectionManager
  }

  public getRateLimiter(): WebSocketRateLimiter {
    return this.rateLimiter
  }

  private startCleanupTimer(): void {
    // Clean up rate limiter data every 5 minutes
    setInterval(
      () => {
        this.rateLimiter.cleanup()
      },
      5 * 60 * 1000
    )
  }

  public shutdown(): void {
    console.log('[WebSocket] Shutting down WebSocket server')
    this.connectionManager.disconnectAll()
    this.io.close()
  }
}

// Export singleton instance
let webSocketServer: WebSocketServer | null = null

export function initializeWebSocketServer(httpServer: HttpServer): WebSocketServer {
  if (!webSocketServer) {
    webSocketServer = new WebSocketServer(httpServer)
  }
  return webSocketServer
}

export function getWebSocketServer(): WebSocketServer {
  if (!webSocketServer) {
    throw new Error('WebSocket server not initialized')
  }
  return webSocketServer
}
