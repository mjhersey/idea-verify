/**
 * ErrorHandler Unit Tests - Testing comprehensive error categorization and handling
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  RetryPolicy,
  ErrorPattern,
  CompensationAction,
} from '../../../src/orchestrator/error-handler.js'
import { AgentType } from '@ai-validation/shared'

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler

  beforeEach(() => {
    ErrorHandler.resetInstance()
    errorHandler = ErrorHandler.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Error Categorization', () => {
    test('should categorize network timeout errors', async () => {
      const error = new Error('Request timeout after 30 seconds')
      const context: ErrorContext = {
        agentType: 'market-research',
        operation: 'data-fetch',
        timestamp: new Date(),
        correlationId: 'corr-123',
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.TIMEOUT_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM)
      expect(categorizedError.retryable).toBe(true)
      expect(categorizedError.retryPolicy).toBeDefined()
      expect(categorizedError.retryPolicy?.maxRetries).toBe(3)
    })

    test('should categorize network connection errors', async () => {
      const error = new Error('ECONNREFUSED: Connection refused')
      const context: ErrorContext = {
        agentType: 'competitive-analysis',
        operation: 'api-call',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.NETWORK_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.HIGH)
      expect(categorizedError.retryable).toBe(true)
      expect(categorizedError.retryPolicy?.maxRetries).toBe(5)
    })

    test('should categorize authentication errors', async () => {
      const error = new Error('Unauthorized: Invalid token')
      const context: ErrorContext = {
        agentType: 'customer-research',
        operation: 'auth-check',
        timestamp: new Date(),
        userId: 'user-123',
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.AUTHENTICATION_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.HIGH)
      expect(categorizedError.retryable).toBe(false)
    })

    test('should categorize rate limit errors', async () => {
      const error = new Error('Rate limit exceeded: Too many requests')
      const context: ErrorContext = {
        agentType: 'financial-analysis',
        operation: 'api-call',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.RATE_LIMIT_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM)
      expect(categorizedError.retryable).toBe(true)
      expect(categorizedError.retryPolicy?.maxRetries).toBe(10)
    })

    test('should categorize resource exhaustion errors', async () => {
      const error = new Error('Out of memory: Cannot allocate buffer')
      const context: ErrorContext = {
        agentType: 'technical-feasibility',
        operation: 'data-processing',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.RESOURCE_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.CRITICAL)
      expect(categorizedError.retryable).toBe(false)
    })

    test('should categorize validation errors', async () => {
      const error = new Error('Validation failed: Invalid input data format')
      const context: ErrorContext = {
        agentType: 'market-research',
        operation: 'input-validation',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.VALIDATION_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.LOW)
      expect(categorizedError.retryable).toBe(false)
    })

    test('should categorize dependency errors', async () => {
      const error = new Error('Service unavailable: Required dependency not accessible')
      const context: ErrorContext = {
        agentType: 'financial-analysis',
        operation: 'dependency-check',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.DEPENDENCY_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.HIGH)
      expect(categorizedError.retryable).toBe(true)
    })

    test('should categorize unknown errors with default pattern', async () => {
      const error = new Error('Something unexpected happened')
      const context: ErrorContext = {
        agentType: 'market-research',
        operation: 'unknown-operation',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      expect(categorizedError.category).toBe(ErrorCategory.UNKNOWN_ERROR)
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM)
      expect(categorizedError.retryable).toBe(true)
      expect(categorizedError.retryPolicy?.maxRetries).toBe(2)
    })
  })

  describe('Retry Logic', () => {
    test('should allow retry for retryable errors within limit', async () => {
      const error = new Error('Network timeout')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      const shouldRetry1 = await errorHandler.shouldRetry(categorizedError, 1)
      const shouldRetry2 = await errorHandler.shouldRetry(categorizedError, 2)
      const shouldRetry3 = await errorHandler.shouldRetry(categorizedError, 3)
      const shouldRetry4 = await errorHandler.shouldRetry(categorizedError, 4)

      expect(shouldRetry1).toBe(true)
      expect(shouldRetry2).toBe(true)
      expect(shouldRetry3).toBe(true)
      expect(shouldRetry4).toBe(false) // Exceeds max retries (3)
    })

    test('should not allow retry for non-retryable errors', async () => {
      const error = new Error('Invalid authentication token')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      const shouldRetry = await errorHandler.shouldRetry(categorizedError, 1)
      expect(shouldRetry).toBe(false)
    })

    test('should calculate exponential backoff delay', async () => {
      const error = new Error('Network timeout')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      const delay1 = errorHandler.calculateRetryDelay(categorizedError, 1)
      const delay2 = errorHandler.calculateRetryDelay(categorizedError, 2)
      const delay3 = errorHandler.calculateRetryDelay(categorizedError, 3)

      expect(delay1).toBe(1000) // Base delay
      expect(delay2).toBe(2000) // 2^1 * base
      expect(delay3).toBe(4000) // 2^2 * base
    })

    test('should calculate linear backoff delay', async () => {
      const error = new Error('Dependency unavailable')
      const context: ErrorContext = {
        agentType: 'financial-analysis',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      const delay1 = errorHandler.calculateRetryDelay(categorizedError, 1)
      const delay2 = errorHandler.calculateRetryDelay(categorizedError, 2)
      const delay3 = errorHandler.calculateRetryDelay(categorizedError, 3)

      expect(delay1).toBe(5000) // 1 * base delay
      expect(delay2).toBe(10000) // 2 * base delay
      expect(delay3).toBe(15000) // 3 * base delay
    })

    test('should apply maximum delay limit', async () => {
      const error = new Error('Rate limit exceeded')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      // Test with very high attempt number
      const delay = errorHandler.calculateRetryDelay(categorizedError, 10)
      expect(delay).toBeLessThanOrEqual(60000) // Max delay for rate limit errors
    })

    test('should apply jitter to delay calculation', async () => {
      const error = new Error('Network timeout')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      const categorizedError = await errorHandler.handleError(error, context)

      // Calculate multiple delays to test jitter variance
      const delays = Array.from({ length: 10 }, () =>
        errorHandler.calculateRetryDelay(categorizedError, 2)
      )

      // With jitter, delays should vary slightly
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1)

      // All delays should be around the expected base (2000ms ± 10%)
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(1800)
        expect(delay).toBeLessThanOrEqual(2200)
      })
    })
  })

  describe('Circuit Breaker', () => {
    test('should open circuit breaker after threshold failures', async () => {
      const error = new Error('Service unavailable')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      // Simulate 5 consecutive failures (threshold)
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context)
      }

      expect(errorHandler.isCircuitBreakerOpen('market-research')).toBe(true)
    })

    test('should prevent retry when circuit breaker is open', async () => {
      const error = new Error('Network timeout')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context)
      }

      const categorizedError = await errorHandler.handleError(error, context)
      const shouldRetry = await errorHandler.shouldRetry(categorizedError, 1)

      expect(shouldRetry).toBe(false)
    })

    test('should record success and potentially close circuit breaker', () => {
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        errorHandler.recordSuccess(context)
      }

      // Circuit breaker should remain closed for successful operations
      expect(errorHandler.isCircuitBreakerOpen('market-research')).toBe(false)
    })

    test('should have separate circuit breakers per agent', async () => {
      const error = new Error('Service failure')
      const context1: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }
      const context2: ErrorContext = {
        agentType: 'competitive-analysis',
        timestamp: new Date(),
      }

      // Fail market-research agent 5 times
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context1)
      }

      // Fail competitive-analysis agent 3 times
      for (let i = 0; i < 3; i++) {
        await errorHandler.handleError(error, context2)
      }

      expect(errorHandler.isCircuitBreakerOpen('market-research')).toBe(true)
      expect(errorHandler.isCircuitBreakerOpen('competitive-analysis')).toBe(false)
    })
  })

  describe('Compensation Actions', () => {
    test('should execute compensation actions for auth errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const error = new Error('Authentication failed: Invalid credentials')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Refreshing credentials for market-research')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Escalating auth failure to administrators')
      )

      consoleSpy.mockRestore()
    })

    test('should execute compensation actions for resource errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const error = new Error('Out of memory: Buffer allocation failed')
      const context: ErrorContext = {
        agentType: 'technical-feasibility',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaning up resources'))
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Requesting resource scaling')
      )

      consoleSpy.mockRestore()
    })

    test('should execute compensation actions for dependency errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const error = new Error('Service unavailable: External dependency unreachable')
      const context: ErrorContext = {
        agentType: 'financial-analysis',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using fallback service for financial-analysis')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping dependent agents for financial-analysis')
      )

      consoleSpy.mockRestore()
    })

    test('should handle compensation action failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Add a failing compensation action
      const failingAction: CompensationAction = {
        name: 'failing-action',
        description: 'Action that always fails',
        execute: vi.fn().mockRejectedValue(new Error('Compensation failed')),
        priority: 1,
      }

      errorHandler.addCompensationAction(failingAction)

      // Add error pattern that uses the failing action
      const pattern: ErrorPattern = {
        name: 'test-pattern',
        matcher: error => error.message.includes('test error'),
        category: ErrorCategory.SYSTEM_ERROR,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        compensationActions: ['failing-action'],
      }

      errorHandler.addErrorPattern(pattern)

      const error = new Error('This is a test error')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Compensation action threw error:'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Custom Error Patterns', () => {
    test('should add custom error pattern', () => {
      const customPattern: ErrorPattern = {
        name: 'custom-database-error',
        matcher: error => error.message.includes('DATABASE_CONNECTION_FAILED'),
        category: ErrorCategory.SYSTEM_ERROR,
        severity: ErrorSeverity.CRITICAL,
        retryable: true,
        retryPolicy: {
          maxRetries: 5,
          backoffStrategy: 'exponential',
          baseDelay: 2000,
          maxDelay: 30000,
          jitter: true,
        },
        compensationActions: ['use-fallback-service'],
      }

      errorHandler.addErrorPattern(customPattern)

      // Test that the custom pattern is used
      const error = new Error('DATABASE_CONNECTION_FAILED: Unable to connect to primary database')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      return errorHandler.handleError(error, context).then(categorizedError => {
        expect(categorizedError.category).toBe(ErrorCategory.SYSTEM_ERROR)
        expect(categorizedError.severity).toBe(ErrorSeverity.CRITICAL)
        expect(categorizedError.retryPolicy?.maxRetries).toBe(5)
      })
    })

    test('should remove error pattern', () => {
      const patternName = 'network-timeout'

      const removed = errorHandler.removeErrorPattern(patternName)
      expect(removed).toBe(true)

      // Try to remove again
      const removedAgain = errorHandler.removeErrorPattern(patternName)
      expect(removedAgain).toBe(false)
    })

    test('should add custom compensation action', () => {
      const customAction: CompensationAction = {
        name: 'custom-notification',
        description: 'Send custom notification',
        execute: vi.fn().mockResolvedValue(true),
        priority: 2,
      }

      errorHandler.addCompensationAction(customAction)

      // Add pattern that uses custom action
      const pattern: ErrorPattern = {
        name: 'custom-error',
        matcher: error => error.message.includes('CUSTOM_ERROR'),
        category: ErrorCategory.BUSINESS_LOGIC_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        compensationActions: ['custom-notification'],
      }

      errorHandler.addErrorPattern(pattern)

      const error = new Error('CUSTOM_ERROR: Business rule violation')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      return errorHandler.handleError(error, context).then(() => {
        expect(customAction.execute).toHaveBeenCalledWith(context, expect.any(Object))
      })
    })
  })

  describe('Error Statistics', () => {
    test('should track error statistics', async () => {
      const errors = [
        new Error('Network timeout'),
        new Error('Authentication failed'),
        new Error('Rate limit exceeded'),
        new Error('Network timeout'), // Duplicate to test counting
      ]

      const contexts = errors.map((_, index) => ({
        agentType: 'market-research' as AgentType,
        timestamp: new Date(),
        correlationId: `corr-${index}`,
      }))

      for (let i = 0; i < errors.length; i++) {
        await errorHandler.handleError(errors[i], contexts[i])
      }

      const stats = errorHandler.getErrorStatistics()

      expect(stats.totalErrors).toBe(4)
      expect(stats.errorsByCategory[ErrorCategory.TIMEOUT_ERROR]).toBe(2)
      expect(stats.errorsByCategory[ErrorCategory.AUTHENTICATION_ERROR]).toBe(1)
      expect(stats.errorsByCategory[ErrorCategory.RATE_LIMIT_ERROR]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(3)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1)
      expect(stats.recentErrors).toHaveLength(4)
    })

    test('should show circuit breaker states in statistics', async () => {
      const error = new Error('Service failure')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      // Open circuit breaker for market-research
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context)
      }

      const stats = errorHandler.getErrorStatistics()

      expect(stats.circuitBreakerStates['market-research']).toBe('open')
      expect(stats.circuitBreakerStates['competitive-analysis']).toBe('closed')
    })

    test('should clear error history', async () => {
      const error = new Error('Test error')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      let stats = errorHandler.getErrorStatistics()
      expect(stats.totalErrors).toBe(1)

      errorHandler.clearHistory()

      stats = errorHandler.getErrorStatistics()
      expect(stats.totalErrors).toBe(0)
    })
  })

  describe('Escalation Level Calculation', () => {
    test('should calculate escalation level based on severity', async () => {
      const lowError = new Error('Validation failed')
      const mediumError = new Error('Network timeout')
      const highError = new Error('Authentication failed')
      const criticalError = new Error('Out of memory')

      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      const lowCategorized = await errorHandler.handleError(lowError, context)
      const mediumCategorized = await errorHandler.handleError(mediumError, context)
      const highCategorized = await errorHandler.handleError(highError, context)
      const criticalCategorized = await errorHandler.handleError(criticalError, context)

      expect(lowCategorized.escalationLevel).toBe(1)
      expect(mediumCategorized.escalationLevel).toBe(2)
      expect(highCategorized.escalationLevel).toBe(3)
      expect(criticalCategorized.escalationLevel).toBe(4)
    })

    test('should increase escalation level for repeated errors', async () => {
      const error = new Error('Repeated network error')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      // Create multiple errors in short succession
      const categorizedErrors = []
      for (let i = 0; i < 6; i++) {
        const errorResult = await errorHandler.handleError(error, {
          ...context,
          correlationId: `corr-${i}`,
          timestamp: new Date(),
        })
        categorizedErrors.push(errorResult)
      }

      // Later errors should have higher escalation levels
      expect(categorizedErrors[0].escalationLevel).toBeLessThan(
        categorizedErrors[5].escalationLevel
      )
    })
  })

  describe('Event Emission', () => {
    test('should emit errorHandled event', async () => {
      const eventSpy = vi.fn()
      errorHandler.on('errorHandled', eventSpy)

      const error = new Error('Test error')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          category: expect.any(String),
          severity: expect.any(String),
          retryable: expect.any(Boolean),
        })
      )
    })

    test('should emit circuitBreakerOpened event', async () => {
      const eventSpy = vi.fn()
      errorHandler.on('circuitBreakerOpened', eventSpy)

      const error = new Error('Service failure')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context)
      }

      expect(eventSpy).toHaveBeenCalledWith({
        key: 'market-research',
        failureCount: 5,
      })
    })

    test('should emit compensation action events', async () => {
      const succeededSpy = vi.fn()
      const failedSpy = vi.fn()
      const errorSpy = vi.fn()

      errorHandler.on('compensationActionSucceeded', succeededSpy)
      errorHandler.on('compensationActionFailed', failedSpy)
      errorHandler.on('compensationActionError', errorSpy)

      const error = new Error('Authentication failed')
      const context: ErrorContext = {
        agentType: 'market-research',
        timestamp: new Date(),
      }

      await errorHandler.handleError(error, context)

      expect(succeededSpy).toHaveBeenCalled()
    })
  })

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = ErrorHandler.getInstance()
      const instance2 = ErrorHandler.getInstance()

      expect(instance1).toBe(instance2)
    })

    test('should reset instance for testing', () => {
      const instance1 = ErrorHandler.getInstance()
      ErrorHandler.resetInstance()
      const instance2 = ErrorHandler.getInstance()

      expect(instance1).not.toBe(instance2)
    })
  })
})
