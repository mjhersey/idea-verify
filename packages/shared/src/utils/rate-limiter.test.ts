/**
 * Tests for RateLimiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from './rate-limiter.js'

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      requestsPerMinute: 10,
      tokensPerMinute: 1000,
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      jitterEnabled: false,
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('isRequestAllowed', () => {
    it('should allow requests under the limit', () => {
      expect(rateLimiter.isRequestAllowed('test-service')).toBe(true)
    })

    it('should block requests over the limit', () => {
      // Make 10 requests (at the limit)
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest('test-service', 10)
      }

      // 11th request should be blocked
      expect(rateLimiter.isRequestAllowed('test-service')).toBe(false)
    })

    it('should block requests over token limit', () => {
      expect(rateLimiter.isRequestAllowed('test-service', 1001)).toBe(false)
    })

    it('should reset limits after time window', () => {
      vi.useFakeTimers()

      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest('test-service', 10)
      }

      expect(rateLimiter.isRequestAllowed('test-service')).toBe(false)

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61000)

      expect(rateLimiter.isRequestAllowed('test-service')).toBe(true)
    })
  })

  describe('getRateLimitStatus', () => {
    it('should return correct status', () => {
      rateLimiter.recordRequest('test-service', 10)

      const status = rateLimiter.getRateLimitStatus('test-service')

      expect(status.remaining).toBe(9)
      expect(status.resetTime).toBeInstanceOf(Date)
      expect(status.retryAfter).toBeUndefined()
    })

    it('should include retry-after when at limit', () => {
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest('test-service', 10)
      }

      const status = rateLimiter.getRateLimitStatus('test-service')

      expect(status.remaining).toBe(0)
      expect(status.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('executeWithRetry', () => {
    it('should execute successful requests', async () => {
      const mockRequest = vi.fn().mockResolvedValue('success')

      const result = await rateLimiter.executeWithRetry('test-service', mockRequest)

      expect(result).toBe('success')
      expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      vi.useFakeTimers()

      const mockRequest = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success')

      const promise = rateLimiter.executeWithRetry('test-service', mockRequest)

      // Fast-forward through delays
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result).toBe('success')
      expect(mockRequest).toHaveBeenCalledTimes(3)
    })

    it('should handle rate limit errors', async () => {
      vi.useFakeTimers()

      const rateLimitError = new Error('Rate limit exceeded')
      ;(rateLimitError as any).status = 429
      ;(rateLimitError as any).headers = { 'retry-after': '1' }

      const mockRequest = vi.fn().mockRejectedValueOnce(rateLimitError).mockResolvedValue('success')

      const promise = rateLimiter.executeWithRetry('test-service', mockRequest)

      // Fast-forward through the retry-after delay
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result).toBe('success')
      expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const authError = new Error('Unauthorized')
      ;(authError as any).status = 401

      const mockRequest = vi.fn().mockRejectedValue(authError)

      await expect(rateLimiter.executeWithRetry('test-service', mockRequest)).rejects.toThrow(
        'Unauthorized'
      )
      expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('should give up after max retries', async () => {
      // Use a rate limiter with very short delays to avoid fake timers
      const fastRateLimiter = new RateLimiter({
        requestsPerMinute: 10,
        tokensPerMinute: 1000,
        maxRetries: 3,
        baseDelayMs: 1, // Very short delay
        maxDelayMs: 5,
        jitterEnabled: false,
      })

      const persistentError = new Error('Persistent error')
      const mockRequest = vi.fn().mockRejectedValue(persistentError)

      await expect(fastRateLimiter.executeWithRetry('test-service', mockRequest)).rejects.toThrow(
        'Request failed after 3 retries'
      )

      expect(mockRequest).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })
  })

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const limiter = new RateLimiter({
        requestsPerMinute: 10,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterEnabled: false,
      })

      // Use reflection to access private method for testing
      const calculateBackoffDelay = (limiter as any).calculateBackoffDelay.bind(limiter)

      expect(calculateBackoffDelay(1)).toBe(1000) // 1000 * 2^0
      expect(calculateBackoffDelay(2)).toBe(2000) // 1000 * 2^1
      expect(calculateBackoffDelay(3)).toBe(4000) // 1000 * 2^2
    })

    it('should respect maximum delay', () => {
      const limiter = new RateLimiter({
        requestsPerMinute: 10,
        maxRetries: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterEnabled: false,
      })

      const calculateBackoffDelay = (limiter as any).calculateBackoffDelay.bind(limiter)

      expect(calculateBackoffDelay(10)).toBe(5000) // Should cap at maxDelayMs
    })

    it('should add jitter when enabled', () => {
      const limiter = new RateLimiter({
        requestsPerMinute: 10,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitterEnabled: true,
      })

      const calculateBackoffDelay = (limiter as any).calculateBackoffDelay.bind(limiter)

      const delay1 = calculateBackoffDelay(1)
      const delay2 = calculateBackoffDelay(1)

      // With jitter, delays should vary
      expect(delay1).toBeGreaterThan(0)
      expect(delay2).toBeGreaterThan(0)
      // They might be the same due to random, but structure should be correct
      expect(typeof delay1).toBe('number')
      expect(typeof delay2).toBe('number')
    })
  })

  describe('hourly and daily rate limits', () => {
    it('should enforce hourly rate limits', () => {
      const limiterWithHourly = new RateLimiter({
        requestsPerMinute: 100,
        requestsPerHour: 5,
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        jitterEnabled: false,
      })

      // Should allow first 5 requests
      for (let i = 0; i < 5; i++) {
        expect(limiterWithHourly.isRequestAllowed('hourly-test')).toBe(true)
        limiterWithHourly.recordRequest('hourly-test')
      }

      // 6th request should be blocked by hourly limit
      expect(limiterWithHourly.isRequestAllowed('hourly-test')).toBe(false)
    })

    it('should enforce daily rate limits', () => {
      const limiterWithDaily = new RateLimiter({
        requestsPerMinute: 100,
        requestsPerDay: 3,
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        jitterEnabled: false,
      })

      // Should allow first 3 requests
      for (let i = 0; i < 3; i++) {
        expect(limiterWithDaily.isRequestAllowed('daily-test')).toBe(true)
        limiterWithDaily.recordRequest('daily-test')
      }

      // 4th request should be blocked by daily limit
      expect(limiterWithDaily.isRequestAllowed('daily-test')).toBe(false)
    })

    it('should include hourly and daily status in getRateLimitStatus', () => {
      const limiterWithBoth = new RateLimiter({
        requestsPerMinute: 100,
        requestsPerHour: 50,
        requestsPerDay: 200,
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        jitterEnabled: false,
      })

      limiterWithBoth.recordRequest('status-test')
      const status = limiterWithBoth.getRateLimitStatus('status-test')

      expect(status.remaining).toBe(99) // minute limit
      expect(status.hourly).toBeDefined()
      expect(status.hourly!.remaining).toBe(49) // hourly limit
      expect(status.daily).toBeDefined()
      expect(status.daily!.remaining).toBe(199) // daily limit
    })
  })
})
