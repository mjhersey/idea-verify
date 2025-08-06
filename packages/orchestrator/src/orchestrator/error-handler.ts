/**
 * Error Handler - Comprehensive error categorization and handling for multi-agent systems
 */

import { AgentType } from '@ai-validation/shared'
import { EventEmitter } from 'events'

export enum ErrorCategory {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  RESOURCE_ERROR = 'resource_error',
  DEPENDENCY_ERROR = 'dependency_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  SYSTEM_ERROR = 'system_error',
  UNKNOWN_ERROR = 'unknown_error',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  evaluationId?: string
  agentType?: AgentType
  operation?: string
  timestamp: Date
  correlationId?: string
  userId?: string
  metadata?: Record<string, any>
}

export interface CategorizedError {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  originalError: Error
  context: ErrorContext
  retryable: boolean
  retryPolicy?: RetryPolicy
  escalationLevel: number
  acknowledgedAt?: Date
  resolvedAt?: Date
}

export interface RetryPolicy {
  maxRetries: number
  backoffStrategy: 'exponential' | 'linear' | 'fixed' | 'custom'
  baseDelay: number
  maxDelay: number
  jitter: boolean
  retryCondition?: (error: CategorizedError, attempt: number) => boolean
  customBackoff?: (attempt: number, baseDelay: number) => number
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringWindow: number
  halfOpenMaxCalls: number
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime?: Date
  nextAttemptTime?: Date
  successCount: number
}

export interface CompensationAction {
  name: string
  description: string
  execute: (context: ErrorContext, error: CategorizedError) => Promise<boolean>
  rollback?: (context: ErrorContext) => Promise<void>
  priority: number
}

export interface ErrorPattern {
  name: string
  matcher: (error: Error, context: ErrorContext) => boolean
  category: ErrorCategory
  severity: ErrorSeverity
  retryable: boolean
  retryPolicy?: RetryPolicy
  compensationActions?: string[]
}

export class ErrorHandler extends EventEmitter {
  private static instance: ErrorHandler

  private errorPatterns: Map<string, ErrorPattern> = new Map()
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private circuitBreakerConfigs: Map<string, CircuitBreakerConfig> = new Map()
  private compensationActions: Map<string, CompensationAction> = new Map()
  private errorHistory: CategorizedError[] = []
  private maxHistorySize: number = 1000

  private constructor() {
    super()
    this.initializeDefaultPatterns()
    this.initializeDefaultCompensationActions()
    this.initializeCircuitBreakers()
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  private initializeDefaultPatterns(): void {
    // Network-related errors
    this.addErrorPattern({
      name: 'network-timeout',
      matcher: error =>
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('etimedout'),
      category: ErrorCategory.TIMEOUT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 10000,
        jitter: true,
      },
    })

    this.addErrorPattern({
      name: 'network-connection',
      matcher: error =>
        error.message.toLowerCase().includes('econnrefused') ||
        error.message.toLowerCase().includes('enotfound') ||
        error.message.toLowerCase().includes('network'),
      category: ErrorCategory.NETWORK_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      retryPolicy: {
        maxRetries: 5,
        backoffStrategy: 'exponential',
        baseDelay: 2000,
        maxDelay: 30000,
        jitter: true,
      },
    })

    // Authentication errors
    this.addErrorPattern({
      name: 'authentication-failed',
      matcher: error =>
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('authentication') ||
        error.message.toLowerCase().includes('invalid token'),
      category: ErrorCategory.AUTHENTICATION_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      compensationActions: ['refresh-credentials', 'escalate-auth-failure'],
    })

    // Rate limiting errors
    this.addErrorPattern({
      name: 'rate-limit-exceeded',
      matcher: error =>
        error.message.toLowerCase().includes('rate limit') ||
        error.message.toLowerCase().includes('too many requests') ||
        error.message.toLowerCase().includes('429'),
      category: ErrorCategory.RATE_LIMIT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      retryPolicy: {
        maxRetries: 10,
        backoffStrategy: 'exponential',
        baseDelay: 5000,
        maxDelay: 60000,
        jitter: true,
      },
    })

    // Resource errors
    this.addErrorPattern({
      name: 'resource-exhausted',
      matcher: error =>
        error.message.toLowerCase().includes('out of memory') ||
        error.message.toLowerCase().includes('disk full') ||
        error.message.toLowerCase().includes('resource unavailable'),
      category: ErrorCategory.RESOURCE_ERROR,
      severity: ErrorSeverity.CRITICAL,
      retryable: false,
      compensationActions: ['cleanup-resources', 'scale-resources'],
    })

    // Validation errors
    this.addErrorPattern({
      name: 'validation-error',
      matcher: error =>
        error.message.toLowerCase().includes('validation') ||
        error.message.toLowerCase().includes('invalid input') ||
        error.message.toLowerCase().includes('bad request'),
      category: ErrorCategory.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      retryable: false,
      compensationActions: ['log-validation-failure'],
    })

    // Dependency errors
    this.addErrorPattern({
      name: 'dependency-unavailable',
      matcher: (error, context) =>
        error.message.toLowerCase().includes('service unavailable') ||
        (context.agentType && error.message.toLowerCase().includes('dependency')),
      category: ErrorCategory.DEPENDENCY_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'linear',
        baseDelay: 5000,
        maxDelay: 15000,
        jitter: false,
      },
      compensationActions: ['use-fallback-service', 'skip-dependent-agents'],
    })
  }

  private initializeDefaultCompensationActions(): void {
    this.addCompensationAction({
      name: 'refresh-credentials',
      description: 'Attempt to refresh authentication credentials',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Refreshing credentials for ${context.agentType}`)
        // Implementation would refresh tokens/credentials
        return true
      },
      priority: 1,
    })

    this.addCompensationAction({
      name: 'use-fallback-service',
      description: 'Switch to fallback service or mock data',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Using fallback service for ${context.agentType}`)
        // Implementation would switch to mock/fallback
        return true
      },
      priority: 2,
    })

    this.addCompensationAction({
      name: 'skip-dependent-agents',
      description: 'Skip agents that depend on the failed agent',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Skipping dependent agents for ${context.agentType}`)
        // Implementation would update workflow to skip dependents
        return true
      },
      priority: 3,
    })

    this.addCompensationAction({
      name: 'cleanup-resources',
      description: 'Clean up resources to free memory/disk space',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Cleaning up resources`)
        // Implementation would clean up temporary files, caches, etc.
        return true
      },
      priority: 1,
    })

    this.addCompensationAction({
      name: 'scale-resources',
      description: 'Request additional resources from infrastructure',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Requesting resource scaling`)
        // Implementation would trigger auto-scaling
        return false // Requires manual intervention
      },
      priority: 4,
    })

    this.addCompensationAction({
      name: 'escalate-auth-failure',
      description: 'Escalate authentication failure to administrators',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Escalating auth failure to administrators`)
        // Implementation would send alerts/notifications
        return true
      },
      priority: 5,
    })

    this.addCompensationAction({
      name: 'log-validation-failure',
      description: 'Log validation failure for analysis',
      execute: async (context, error) => {
        console.log(`[ErrorHandler] Logging validation failure:`, {
          context,
          error: error.message,
        })
        return true
      },
      priority: 1,
    })
  }

  private initializeCircuitBreakers(): void {
    // Initialize circuit breakers for each agent type
    const agentTypes: AgentType[] = [
      'market-research',
      'competitive-analysis',
      'customer-research',
      'technical-feasibility',
      'financial-analysis',
    ]

    agentTypes.forEach(agentType => {
      this.circuitBreakerConfigs.set(agentType, {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
        halfOpenMaxCalls: 3,
      })

      this.circuitBreakers.set(agentType, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      })
    })

    // Global circuit breaker for system-wide issues
    this.circuitBreakerConfigs.set('system', {
      failureThreshold: 10,
      resetTimeout: 300000, // 5 minutes
      monitoringWindow: 600000, // 10 minutes
      halfOpenMaxCalls: 5,
    })

    this.circuitBreakers.set('system', {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    })
  }

  // Main error handling method
  async handleError(error: Error, context: ErrorContext): Promise<CategorizedError> {
    const categorizedError = this.categorizeError(error, context)

    console.log(`[ErrorHandler] Handling ${categorizedError.category} error:`, {
      id: categorizedError.id,
      message: categorizedError.message,
      severity: categorizedError.severity,
      agentType: context.agentType,
      evaluationId: context.evaluationId,
    })

    // Update circuit breakers
    if (context.agentType) {
      this.updateCircuitBreaker(context.agentType, false)
    }
    this.updateCircuitBreaker('system', false)

    // Store in history
    this.errorHistory.push(categorizedError)
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift()
    }

    // Execute compensation actions
    if (categorizedError.retryable) {
      // Will be handled by retry mechanism
    } else {
      await this.executeCompensationActions(categorizedError)
    }

    // Emit event for monitoring
    this.emit('errorHandled', categorizedError)

    return categorizedError
  }

  private categorizeError(error: Error, context: ErrorContext): CategorizedError {
    let matchedPattern: ErrorPattern | undefined

    // Find matching pattern
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.matcher(error, context)) {
        matchedPattern = pattern
        break
      }
    }

    // Use default pattern if no match
    if (!matchedPattern) {
      matchedPattern = {
        name: 'unknown-error',
        matcher: () => true,
        category: ErrorCategory.UNKNOWN_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        retryPolicy: {
          maxRetries: 2,
          backoffStrategy: 'fixed',
          baseDelay: 5000,
          maxDelay: 5000,
          jitter: false,
        },
      }
    }

    const categorizedError: CategorizedError = {
      id: this.generateErrorId(),
      category: matchedPattern.category,
      severity: matchedPattern.severity,
      message: error.message,
      originalError: error,
      context,
      retryable: matchedPattern.retryable,
      retryPolicy: matchedPattern.retryPolicy,
      escalationLevel: this.calculateEscalationLevel(matchedPattern.severity, context),
      acknowledgedAt: new Date(),
    }

    return categorizedError
  }

  private async executeCompensationActions(error: CategorizedError): Promise<void> {
    const pattern = this.findPatternForError(error)
    if (!pattern?.compensationActions) return

    console.log(`[ErrorHandler] Executing compensation actions for error: ${error.id}`)

    const actions = pattern.compensationActions
      .map(name => this.compensationActions.get(name))
      .filter(action => action !== undefined)
      .sort((a, b) => a!.priority - b!.priority)

    for (const action of actions) {
      try {
        console.log(`[ErrorHandler] Executing compensation action: ${action!.name}`)
        const success = await action!.execute(error.context, error)

        if (success) {
          console.log(`[ErrorHandler] Compensation action succeeded: ${action!.name}`)
          this.emit('compensationActionSucceeded', { error, action: action!.name })
        } else {
          console.warn(`[ErrorHandler] Compensation action failed: ${action!.name}`)
          this.emit('compensationActionFailed', { error, action: action!.name })
        }
      } catch (compensationError) {
        console.error(`[ErrorHandler] Compensation action threw error:`, compensationError)
        this.emit('compensationActionError', {
          error,
          action: action!.name,
          compensationError,
        })
      }
    }
  }

  // Retry mechanism
  async shouldRetry(error: CategorizedError, attemptNumber: number): Promise<boolean> {
    if (!error.retryable || !error.retryPolicy) {
      return false
    }

    if (attemptNumber >= error.retryPolicy.maxRetries) {
      return false
    }

    // Check circuit breaker
    if (error.context.agentType && this.isCircuitBreakerOpen(error.context.agentType)) {
      console.log(
        `[ErrorHandler] Circuit breaker open for ${error.context.agentType}, skipping retry`
      )
      return false
    }

    // Check custom retry condition
    if (error.retryPolicy.retryCondition) {
      return error.retryPolicy.retryCondition(error, attemptNumber)
    }

    return true
  }

  calculateRetryDelay(error: CategorizedError, attemptNumber: number): number {
    if (!error.retryPolicy) {
      return 1000 // Default 1 second
    }

    const { backoffStrategy, baseDelay, maxDelay, jitter, customBackoff } = error.retryPolicy

    let delay = baseDelay

    switch (backoffStrategy) {
      case 'exponential':
        delay = baseDelay * Math.pow(2, attemptNumber - 1)
        break
      case 'linear':
        delay = baseDelay * attemptNumber
        break
      case 'custom':
        if (customBackoff) {
          delay = customBackoff(attemptNumber, baseDelay)
        }
        break
      case 'fixed':
      default:
        delay = baseDelay
    }

    // Apply maximum delay
    delay = Math.min(delay, maxDelay)

    // Apply jitter if enabled
    if (jitter) {
      const jitterAmount = delay * 0.1 // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount
    }

    return Math.max(0, Math.round(delay))
  }

  // Circuit breaker methods
  isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key)
    const config = this.circuitBreakerConfigs.get(key)

    if (!state || !config) return false

    if (state.state === 'open') {
      // Check if it's time to move to half-open
      if (state.nextAttemptTime && new Date() >= state.nextAttemptTime) {
        state.state = 'half-open'
        state.successCount = 0
        console.log(`[ErrorHandler] Circuit breaker ${key} moved to half-open`)
      }
    }

    return state.state === 'open'
  }

  private updateCircuitBreaker(key: string, success: boolean): void {
    const state = this.circuitBreakers.get(key)
    const config = this.circuitBreakerConfigs.get(key)

    if (!state || !config) return

    if (success) {
      state.successCount++

      if (state.state === 'half-open' && state.successCount >= config.halfOpenMaxCalls) {
        state.state = 'closed'
        state.failureCount = 0
        console.log(`[ErrorHandler] Circuit breaker ${key} closed after successful recovery`)
      }
    } else {
      state.failureCount++
      state.lastFailureTime = new Date()

      if (state.state === 'closed' && state.failureCount >= config.failureThreshold) {
        state.state = 'open'
        state.nextAttemptTime = new Date(Date.now() + config.resetTimeout)
        console.log(
          `[ErrorHandler] Circuit breaker ${key} opened due to ${state.failureCount} failures`
        )
        this.emit('circuitBreakerOpened', { key, failureCount: state.failureCount })
      } else if (state.state === 'half-open') {
        state.state = 'open'
        state.nextAttemptTime = new Date(Date.now() + config.resetTimeout)
        console.log(
          `[ErrorHandler] Circuit breaker ${key} reopened after failure in half-open state`
        )
      }
    }
  }

  recordSuccess(context: ErrorContext): void {
    if (context.agentType) {
      this.updateCircuitBreaker(context.agentType, true)
    }
    this.updateCircuitBreaker('system', true)
  }

  // Utility methods
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private calculateEscalationLevel(severity: ErrorSeverity, context: ErrorContext): number {
    let level = 0

    switch (severity) {
      case ErrorSeverity.LOW:
        level = 1
        break
      case ErrorSeverity.MEDIUM:
        level = 2
        break
      case ErrorSeverity.HIGH:
        level = 3
        break
      case ErrorSeverity.CRITICAL:
        level = 4
        break
    }

    // Increase escalation for repeated errors
    const recentErrors = this.errorHistory.filter(
      e =>
        e.context.agentType === context.agentType &&
        e.category === this.errorPatterns.get('unknown-error')?.category &&
        Date.now() - e.context.timestamp.getTime() < 300000 // 5 minutes
    ).length

    return level + Math.floor(recentErrors / 3)
  }

  private findPatternForError(error: CategorizedError): ErrorPattern | undefined {
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.category === error.category) {
        return pattern
      }
    }
    return undefined
  }

  // Public API
  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.set(pattern.name, pattern)
    console.log(`[ErrorHandler] Added error pattern: ${pattern.name}`)
  }

  removeErrorPattern(name: string): boolean {
    const removed = this.errorPatterns.delete(name)
    if (removed) {
      console.log(`[ErrorHandler] Removed error pattern: ${name}`)
    }
    return removed
  }

  addCompensationAction(action: CompensationAction): void {
    this.compensationActions.set(action.name, action)
    console.log(`[ErrorHandler] Added compensation action: ${action.name}`)
  }

  getErrorStatistics(): {
    totalErrors: number
    errorsByCategory: Record<ErrorCategory, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    circuitBreakerStates: Record<string, string>
    recentErrors: CategorizedError[]
  } {
    const errorsByCategory = {} as Record<ErrorCategory, number>
    const errorsBySeverity = {} as Record<ErrorSeverity, number>

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0
    })
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0
    })

    // Count errors
    this.errorHistory.forEach(error => {
      errorsByCategory[error.category]++
      errorsBySeverity[error.severity]++
    })

    // Get circuit breaker states
    const circuitBreakerStates: Record<string, string> = {}
    this.circuitBreakers.forEach((state, key) => {
      circuitBreakerStates[key] = state.state
    })

    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory,
      errorsBySeverity,
      circuitBreakerStates,
      recentErrors: this.errorHistory.slice(-10), // Last 10 errors
    }
  }

  clearHistory(): void {
    this.errorHistory = []
    console.log('[ErrorHandler] Error history cleared')
  }

  // Test utilities
  static resetInstance(): void {
    ErrorHandler.instance = null as any
  }
}
