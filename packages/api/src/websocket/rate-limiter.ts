/**
 * WebSocket Rate Limiter
 * Implements comprehensive rate limiting for WebSocket connections
 */

import { Socket } from 'socket.io'

export interface RateLimitConfig {
  // Connection limits
  maxConnectionsPerUser: number
  maxConnectionsGlobal: number

  // Message rate limits
  messagesPerSecond: number
  messagesPerMinute: number

  // Burst limits
  burstAllowance: number
  burstWindowMs: number

  // Penalties
  violationPenaltyMs: number
  maxViolations: number
  banDurationMs: number
}

export interface ConnectionMetrics {
  userId: string
  socketId: string
  connectTime: number
  messageCount: number
  lastMessageTime: number
  violations: number
  isBanned: boolean
  banExpiresAt?: number
}

export class WebSocketRateLimiter {
  private config: RateLimitConfig
  private connections: Map<string, ConnectionMetrics> = new Map()
  private userConnections: Map<string, Set<string>> = new Map()
  private messageWindows: Map<string, number[]> = new Map()
  private violationTimestamps: Map<string, number[]> = new Map()

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      // Default configuration
      maxConnectionsPerUser: parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS_PER_USER || '5'),
      maxConnectionsGlobal: parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS_GLOBAL || '1000'),
      messagesPerSecond: parseInt(process.env.WEBSOCKET_MESSAGES_PER_SECOND || '10'),
      messagesPerMinute: parseInt(process.env.WEBSOCKET_MESSAGES_PER_MINUTE || '100'),
      burstAllowance: parseInt(process.env.WEBSOCKET_BURST_ALLOWANCE || '20'),
      burstWindowMs: parseInt(process.env.WEBSOCKET_BURST_WINDOW_MS || '5000'),
      violationPenaltyMs: parseInt(process.env.WEBSOCKET_VIOLATION_PENALTY_MS || '30000'),
      maxViolations: parseInt(process.env.WEBSOCKET_MAX_VIOLATIONS || '3'),
      banDurationMs: parseInt(process.env.WEBSOCKET_BAN_DURATION_MS || '300000'), // 5 minutes
      ...config,
    }
  }

  /**
   * Check if a user can establish a new connection
   */
  // eslint-disable-next-line no-unused-vars
  canConnect(userId: string, _socketId: string): { allowed: boolean; reason?: string } {
    // Check if user is banned
    if (this.isUserBanned(userId)) {
      return { allowed: false, reason: 'User is temporarily banned for rate limit violations' }
    }

    // Check global connection limit
    if (this.connections.size >= this.config.maxConnectionsGlobal) {
      return { allowed: false, reason: 'Global connection limit exceeded' }
    }

    // Check per-user connection limit
    const userConnectionCount = this.userConnections.get(userId)?.size || 0
    if (userConnectionCount >= this.config.maxConnectionsPerUser) {
      return {
        allowed: false,
        reason: `User connection limit exceeded (${userConnectionCount}/${this.config.maxConnectionsPerUser})`,
      }
    }

    return { allowed: true }
  }

  /**
   * Register a new connection
   */
  addConnection(userId: string, socket: Socket): void {
    const socketId = socket.id
    const now = Date.now()

    // Add connection metrics
    const metrics: ConnectionMetrics = {
      userId,
      socketId,
      connectTime: now,
      messageCount: 0,
      lastMessageTime: now,
      violations: 0,
      isBanned: false,
    }

    this.connections.set(socketId, metrics)

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set())
    }
    this.userConnections.get(userId)!.add(socketId)

    // Initialize message window
    this.messageWindows.set(socketId, [])

    console.log(
      `[RateLimit] Connection registered: user=${userId}, socket=${socketId}, total=${this.connections.size}`
    )
  }

  /**
   * Remove a connection
   */
  removeConnection(socketId: string): void {
    const metrics = this.connections.get(socketId)
    if (!metrics) return

    const { userId } = metrics

    // Remove from connections
    this.connections.delete(socketId)
    this.messageWindows.delete(socketId)

    // Update user connections
    const userSockets = this.userConnections.get(userId)
    if (userSockets) {
      userSockets.delete(socketId)
      if (userSockets.size === 0) {
        this.userConnections.delete(userId)
      }
    }

    console.log(
      `[RateLimit] Connection removed: user=${userId}, socket=${socketId}, total=${this.connections.size}`
    )
  }

  /**
   * Check if a message is allowed under rate limits
   */
  canSendMessage(socketId: string): { allowed: boolean; reason?: string; waitMs?: number } {
    const metrics = this.connections.get(socketId)
    if (!metrics) {
      return { allowed: false, reason: 'Connection not found' }
    }

    // Check if user is banned
    if (metrics.isBanned && metrics.banExpiresAt && Date.now() < metrics.banExpiresAt) {
      const remainingMs = metrics.banExpiresAt - Date.now()
      return { allowed: false, reason: 'User is banned for rate violations', waitMs: remainingMs }
    }

    const now = Date.now()
    const messageWindow = this.messageWindows.get(socketId) || []

    // Clean old messages from window
    const oneMinuteAgo = now - 60000
    const oneSecondAgo = now - 1000
    const recentMessages = messageWindow.filter(timestamp => timestamp > oneMinuteAgo)

    // Update window
    this.messageWindows.set(socketId, recentMessages)

    // Check per-second limit
    const messagesInLastSecond = recentMessages.filter(timestamp => timestamp > oneSecondAgo).length
    if (messagesInLastSecond >= this.config.messagesPerSecond) {
      this.recordViolation(metrics.userId, socketId, 'messages_per_second_exceeded')
      return {
        allowed: false,
        reason: `Message rate exceeded: ${messagesInLastSecond}/${this.config.messagesPerSecond} per second`,
        waitMs: 1000,
      }
    }

    // Check per-minute limit
    if (recentMessages.length >= this.config.messagesPerMinute) {
      this.recordViolation(metrics.userId, socketId, 'messages_per_minute_exceeded')
      return {
        allowed: false,
        reason: `Message rate exceeded: ${recentMessages.length}/${this.config.messagesPerMinute} per minute`,
        waitMs: 60000 - (now - recentMessages[0]),
      }
    }

    // Check burst limit
    const burstWindowStart = now - this.config.burstWindowMs
    const messagesInBurstWindow = recentMessages.filter(
      timestamp => timestamp > burstWindowStart
    ).length
    if (messagesInBurstWindow >= this.config.burstAllowance) {
      this.recordViolation(metrics.userId, socketId, 'burst_limit_exceeded')
      return {
        allowed: false,
        reason: `Burst limit exceeded: ${messagesInBurstWindow}/${this.config.burstAllowance} in ${this.config.burstWindowMs}ms`,
        waitMs: this.config.burstWindowMs,
      }
    }

    return { allowed: true }
  }

  /**
   * Record a message being sent
   */
  recordMessage(socketId: string): void {
    const metrics = this.connections.get(socketId)
    if (!metrics) return

    const now = Date.now()

    // Update metrics
    metrics.messageCount++
    metrics.lastMessageTime = now

    // Add to message window
    const messageWindow = this.messageWindows.get(socketId) || []
    messageWindow.push(now)
    this.messageWindows.set(socketId, messageWindow)
  }

  /**
   * Record a rate limit violation
   */
  private recordViolation(userId: string, socketId: string, violationType: string): void {
    const metrics = this.connections.get(socketId)
    if (!metrics) return

    const now = Date.now()
    metrics.violations++

    // Track violation timestamps
    if (!this.violationTimestamps.has(userId)) {
      this.violationTimestamps.set(userId, [])
    }

    const violations = this.violationTimestamps.get(userId)!
    violations.push(now)

    // Clean old violations (older than 1 hour)
    const oneHourAgo = now - 3600000
    const recentViolations = violations.filter(timestamp => timestamp > oneHourAgo)
    this.violationTimestamps.set(userId, recentViolations)

    console.warn(
      `[RateLimit] Violation recorded: user=${userId}, socket=${socketId}, type=${violationType}, total=${metrics.violations}`
    )

    // Apply ban if too many violations
    if (recentViolations.length >= this.config.maxViolations) {
      this.banUser(userId, socketId)
    }
  }

  /**
   * Ban a user temporarily
   */
  private banUser(userId: string, socketId: string): void {
    const metrics = this.connections.get(socketId)
    if (!metrics) return

    const now = Date.now()
    metrics.isBanned = true
    metrics.banExpiresAt = now + this.config.banDurationMs

    console.warn(
      `[RateLimit] User banned: user=${userId}, duration=${this.config.banDurationMs}ms, expires=${new Date(metrics.banExpiresAt).toISOString()}`
    )
  }

  /**
   * Check if a user is currently banned
   */
  private isUserBanned(userId: string): boolean {
    const userSockets = this.userConnections.get(userId)
    if (!userSockets) return false

    const now = Date.now()

    for (const socketId of userSockets) {
      const metrics = this.connections.get(socketId)
      if (metrics?.isBanned && metrics.banExpiresAt && now < metrics.banExpiresAt) {
        return true
      }
    }

    return false
  }

  /**
   * Get connection metrics for monitoring
   */
  getMetrics(): {
    totalConnections: number
    userCount: number
    bannedUsers: number
    avgMessagesPerConnection: number
    totalViolations: number
  } {
    const totalConnections = this.connections.size
    const userCount = this.userConnections.size
    let totalMessages = 0
    let totalViolations = 0
    let bannedUsers = 0

    const now = Date.now()
    const seenUsers = new Set<string>()

    // eslint-disable-next-line no-unused-vars
    for (const [_socketId, metrics] of this.connections) {
      totalMessages += metrics.messageCount
      totalViolations += metrics.violations

      if (!seenUsers.has(metrics.userId)) {
        seenUsers.add(metrics.userId)
        if (metrics.isBanned && metrics.banExpiresAt && now < metrics.banExpiresAt) {
          bannedUsers++
        }
      }
    }

    return {
      totalConnections,
      userCount,
      bannedUsers,
      avgMessagesPerConnection:
        totalConnections > 0 ? Math.round(totalMessages / totalConnections) : 0,
      totalViolations,
    }
  }

  /**
   * Clean up expired bans and old data
   */
  cleanup(): void {
    const now = Date.now()
    let cleanedConnections = 0
    let clearedBans = 0

    // Clean up expired bans
    // eslint-disable-next-line no-unused-vars
    for (const [_socketId, metrics] of this.connections) {
      if (metrics.isBanned && metrics.banExpiresAt && now >= metrics.banExpiresAt) {
        metrics.isBanned = false
        metrics.banExpiresAt = undefined
        clearedBans++
      }
    }

    // Clean up old violation timestamps
    const oneHourAgo = now - 3600000
    for (const [userId, violations] of this.violationTimestamps) {
      const recentViolations = violations.filter(timestamp => timestamp > oneHourAgo)
      if (recentViolations.length === 0) {
        this.violationTimestamps.delete(userId)
        cleanedConnections++
      } else {
        this.violationTimestamps.set(userId, recentViolations)
      }
    }

    if (cleanedConnections > 0 || clearedBans > 0) {
      console.log(
        `[RateLimit] Cleanup completed: cleared ${clearedBans} bans, cleaned ${cleanedConnections} violation records`
      )
    }
  }

  /**
   * Get rate limit configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config }
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log(`[RateLimit] Configuration updated:`, newConfig)
  }
}
