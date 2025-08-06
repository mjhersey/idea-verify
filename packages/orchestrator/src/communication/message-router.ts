/**
 * Message Router - Advanced message routing and priority handling for multi-agent communication
 */

import { AgentType } from '@ai-validation/shared'
import { EventEmitter } from 'events'
import {
  Message,
  MessageType,
  MessageHandler,
  AgentStartMessage,
  AgentCompleteMessage,
  AgentErrorMessage,
  AgentProgressMessage,
} from './message-types.js'

export interface RoutingRule {
  id: string
  name: string
  source: {
    messageType?: MessageType[]
    agentType?: AgentType[]
    evaluationId?: string
  }
  destination: {
    handler: string
    priority: 'high' | 'medium' | 'low'
    fanout?: boolean
    transform?: (message: Message) => Message
  }
  condition?: (message: Message) => boolean
  enabled: boolean
}

export interface MessageRoute {
  rule: RoutingRule
  handler: MessageHandler
  lastUsed: Date
  messageCount: number
  errorCount: number
}

export interface FanoutPattern {
  id: string
  sourceMessageType: MessageType
  targetHandlers: string[]
  condition?: (message: Message) => boolean
  parallel: boolean
}

export interface MessagePersistence {
  store: (message: Message) => Promise<string>
  retrieve: (messageId: string) => Promise<Message | null>
  replay: (fromTime: Date, toTime?: Date) => Promise<Message[]>
  cleanup: (olderThan: Date) => Promise<number>
}

export class MessageRouter extends EventEmitter {
  private static instance: MessageRouter
  private routes: Map<string, MessageRoute> = new Map()
  private handlers: Map<string, MessageHandler> = new Map()
  private fanoutPatterns: Map<string, FanoutPattern> = new Map()
  private messageHistory: Message[] = []
  private persistence: MessagePersistence | null = null

  private priorityQueues: Map<'high' | 'medium' | 'low', Message[]> = new Map([
    ['high', []],
    ['medium', []],
    ['low', []],
  ])

  private isProcessing: boolean = false
  private processingInterval: NodeJS.Timeout | null = null

  private constructor() {
    super()
    this.startMessageProcessing()
  }

  static getInstance(): MessageRouter {
    if (!MessageRouter.instance) {
      MessageRouter.instance = new MessageRouter()
    }
    return MessageRouter.instance
  }

  // Routing Rule Management
  addRoutingRule(rule: RoutingRule): void {
    this.validateRoutingRule(rule)

    const route: MessageRoute = {
      rule,
      handler: this.handlers.get(rule.destination.handler)!,
      lastUsed: new Date(),
      messageCount: 0,
      errorCount: 0,
    }

    this.routes.set(rule.id, route)
    console.log(`[MessageRouter] Added routing rule: ${rule.name}`)
    this.emit('ruleAdded', { rule })
  }

  removeRoutingRule(ruleId: string): boolean {
    const removed = this.routes.delete(ruleId)
    if (removed) {
      console.log(`[MessageRouter] Removed routing rule: ${ruleId}`)
      this.emit('ruleRemoved', { ruleId })
    }
    return removed
  }

  updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): boolean {
    const route = this.routes.get(ruleId)
    if (!route) return false

    route.rule = { ...route.rule, ...updates }
    this.validateRoutingRule(route.rule)

    console.log(`[MessageRouter] Updated routing rule: ${ruleId}`)
    this.emit('ruleUpdated', { ruleId, updates })
    return true
  }

  // Handler Management
  registerHandler(name: string, handler: MessageHandler): void {
    this.handlers.set(name, handler)
    console.log(`[MessageRouter] Registered handler: ${name}`)
  }

  unregisterHandler(name: string): boolean {
    const removed = this.handlers.delete(name)
    if (removed) {
      // Remove any routes that depend on this handler
      const dependentRoutes = Array.from(this.routes.entries()).filter(
        ([_, route]) => route.rule.destination.handler === name
      )

      dependentRoutes.forEach(([ruleId, _]) => {
        this.removeRoutingRule(ruleId)
      })

      console.log(`[MessageRouter] Unregistered handler: ${name}`)
    }
    return removed
  }

  // Fanout Pattern Management
  addFanoutPattern(pattern: FanoutPattern): void {
    this.fanoutPatterns.set(pattern.id, pattern)
    console.log(`[MessageRouter] Added fanout pattern: ${pattern.id}`)
    this.emit('fanoutPatternAdded', { pattern })
  }

  removeFanoutPattern(patternId: string): boolean {
    const removed = this.fanoutPatterns.delete(patternId)
    if (removed) {
      console.log(`[MessageRouter] Removed fanout pattern: ${patternId}`)
      this.emit('fanoutPatternRemoved', { patternId })
    }
    return removed
  }

  // Message Routing
  async routeMessage(message: Message): Promise<void> {
    console.log(`[MessageRouter] Routing message: ${message.type} (${message.id})`)

    // Store message for persistence and history
    this.messageHistory.push(message)
    if (this.persistence) {
      await this.persistence.store(message)
    }

    // Find matching routes
    const matchingRoutes = this.findMatchingRoutes(message)

    if (matchingRoutes.length === 0) {
      console.warn(`[MessageRouter] No routes found for message: ${message.type}`)
      this.emit('unroutedMessage', { message })
      return
    }

    // Process fanout patterns first
    await this.processFanoutPatterns(message)

    // Route to matching handlers
    for (const route of matchingRoutes) {
      if (route.rule.enabled) {
        await this.routeToHandler(message, route)
      }
    }

    this.emit('messageRouted', { message, routeCount: matchingRoutes.length })
  }

  private findMatchingRoutes(message: Message): MessageRoute[] {
    const matchingRoutes: MessageRoute[] = []

    for (const route of this.routes.values()) {
      if (this.routeMatches(message, route.rule)) {
        matchingRoutes.push(route)
      }
    }

    // Sort by priority (high -> medium -> low)
    return matchingRoutes.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.rule.destination.priority] - priorityOrder[b.rule.destination.priority]
    })
  }

  private routeMatches(message: Message, rule: RoutingRule): boolean {
    const { source, condition } = rule

    // Check message type
    if (source.messageType && !source.messageType.includes(message.type)) {
      return false
    }

    // Check agent type (if message contains agent information)
    if (source.agentType) {
      const agentType = this.extractAgentType(message)
      if (!agentType || !source.agentType.includes(agentType)) {
        return false
      }
    }

    // Check evaluation ID
    if (source.evaluationId) {
      const evaluationId = this.extractEvaluationId(message)
      if (evaluationId !== source.evaluationId) {
        return false
      }
    }

    // Check custom condition
    if (condition && !condition(message)) {
      return false
    }

    return true
  }

  private async routeToHandler(message: Message, route: MessageRoute): Promise<void> {
    try {
      // Transform message if needed
      const processedMessage = route.rule.destination.transform
        ? route.rule.destination.transform(message)
        : message

      // Add to priority queue or process immediately
      if (route.rule.destination.priority === 'high') {
        await this.processMessageImmediate(processedMessage, route)
      } else {
        this.addToPriorityQueue(processedMessage, route)
      }

      // Update route statistics
      route.messageCount++
      route.lastUsed = new Date()
    } catch (error) {
      route.errorCount++
      console.error(
        `[MessageRouter] Error routing to handler ${route.rule.destination.handler}:`,
        error
      )
      this.emit('routingError', { message, route: route.rule, error })
    }
  }

  private async processMessageImmediate(message: Message, route: MessageRoute): Promise<void> {
    const handler = route.handler
    if (handler.canHandle(message)) {
      await handler.handle(message)
      console.log(`[MessageRouter] Processed high-priority message immediately: ${message.id}`)
    }
  }

  private addToPriorityQueue(message: Message, route: MessageRoute): void {
    const priority = route.rule.destination.priority
    const queue = this.priorityQueues.get(priority)!

    queue.push({
      ...message,
      routeInfo: {
        ruleId: route.rule.id,
        handler: route.rule.destination.handler,
        priority,
      },
    } as any)
  }

  private async processFanoutPatterns(message: Message): Promise<void> {
    const matchingPatterns = Array.from(this.fanoutPatterns.values()).filter(
      pattern =>
        pattern.sourceMessageType === message.type &&
        (!pattern.condition || pattern.condition(message))
    )

    for (const pattern of matchingPatterns) {
      if (pattern.parallel) {
        // Process all handlers in parallel
        const promises = pattern.targetHandlers.map(handlerName => {
          const handler = this.handlers.get(handlerName)
          return handler && handler.canHandle(message) ? handler.handle(message) : Promise.resolve()
        })

        await Promise.all(promises)
      } else {
        // Process handlers sequentially
        for (const handlerName of pattern.targetHandlers) {
          const handler = this.handlers.get(handlerName)
          if (handler && handler.canHandle(message)) {
            await handler.handle(message)
          }
        }
      }

      console.log(`[MessageRouter] Processed fanout pattern: ${pattern.id}`)
    }
  }

  private startMessageProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) return

      this.isProcessing = true
      try {
        await this.processQueuedMessages()
      } catch (error) {
        console.error('[MessageRouter] Error processing queued messages:', error)
      } finally {
        this.isProcessing = false
      }
    }, 100) // Process every 100ms
  }

  private async processQueuedMessages(): Promise<void> {
    // Process high priority first, then medium, then low
    for (const priority of ['high', 'medium', 'low'] as const) {
      const queue = this.priorityQueues.get(priority)!

      while (queue.length > 0) {
        const message = queue.shift()!
        const routeInfo = (message as any).routeInfo

        try {
          const handler = this.handlers.get(routeInfo.handler)
          if (handler && handler.canHandle(message)) {
            await handler.handle(message)
          }
        } catch (error) {
          console.error(`[MessageRouter] Error processing queued message:`, error)
          this.emit('processingError', { message, error })
        }
      }
    }
  }

  private extractAgentType(message: Message): AgentType | null {
    if ('agentType' in message.payload) {
      return message.payload.agentType as AgentType
    }
    return null
  }

  private extractEvaluationId(message: Message): string | null {
    if ('evaluationId' in message.payload) {
      return message.payload.evaluationId as string
    }
    return null
  }

  private validateRoutingRule(rule: RoutingRule): void {
    if (!rule.id || !rule.name) {
      throw new Error('Routing rule must have id and name')
    }

    if (!rule.destination.handler) {
      throw new Error('Routing rule must specify destination handler')
    }

    if (!this.handlers.has(rule.destination.handler)) {
      throw new Error(`Handler ${rule.destination.handler} not registered`)
    }
  }

  // Message Persistence
  setPersistence(persistence: MessagePersistence): void {
    this.persistence = persistence
    console.log('[MessageRouter] Message persistence configured')
  }

  async replayMessages(fromTime: Date, toTime?: Date): Promise<Message[]> {
    if (!this.persistence) {
      throw new Error('Message persistence not configured')
    }

    const messages = await this.persistence.replay(fromTime, toTime)
    console.log(`[MessageRouter] Replaying ${messages.length} messages`)

    for (const message of messages) {
      await this.routeMessage(message)
    }

    return messages
  }

  // Statistics and Monitoring
  getRoutingStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalRoutes: this.routes.size,
      totalHandlers: this.handlers.size,
      totalFanoutPatterns: this.fanoutPatterns.size,
      messageHistory: this.messageHistory.length,
      queueSizes: {
        high: this.priorityQueues.get('high')!.length,
        medium: this.priorityQueues.get('medium')!.length,
        low: this.priorityQueues.get('low')!.length,
      },
    }

    // Route-specific statistics
    stats.routes = {}
    this.routes.forEach((route, ruleId) => {
      stats.routes[ruleId] = {
        name: route.rule.name,
        messageCount: route.messageCount,
        errorCount: route.errorCount,
        enabled: route.rule.enabled,
        lastUsed: route.lastUsed,
      }
    })

    return stats
  }

  getMessageHistory(limit?: number): Message[] {
    return limit ? this.messageHistory.slice(-limit) : [...this.messageHistory]
  }

  clearMessageHistory(): void {
    this.messageHistory = []
    console.log('[MessageRouter] Message history cleared')
  }

  // Health Check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    const queueSizes = {
      high: this.priorityQueues.get('high')!.length,
      medium: this.priorityQueues.get('medium')!.length,
      low: this.priorityQueues.get('low')!.length,
    }

    const totalQueued = Object.values(queueSizes).reduce((sum, size) => sum + size, 0)

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (totalQueued > 1000) {
      status = 'degraded'
    } else if (totalQueued > 5000 || !this.processingInterval) {
      status = 'unhealthy'
    }

    return {
      status,
      details: {
        queueSizes,
        totalQueued,
        routeCount: this.routes.size,
        handlerCount: this.handlers.size,
        isProcessing: this.isProcessing,
        messageHistorySize: this.messageHistory.length,
      },
    }
  }

  // Shutdown
  async shutdown(): Promise<void> {
    console.log('[MessageRouter] Shutting down...')

    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    // Process remaining queued messages
    await this.processQueuedMessages()

    // Cleanup persistence if configured
    if (this.persistence) {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      await this.persistence.cleanup(cutoffTime)
    }

    // Clear all data
    this.routes.clear()
    this.handlers.clear()
    this.fanoutPatterns.clear()
    this.messageHistory = []
    this.priorityQueues.forEach(queue => (queue.length = 0))

    this.removeAllListeners()
    console.log('[MessageRouter] Shutdown complete')
  }

  // Test utilities
  static resetInstance(): void {
    if (MessageRouter.instance) {
      MessageRouter.instance.shutdown()
    }
    MessageRouter.instance = null as any
  }
}
