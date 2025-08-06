/**
 * Tests for CredentialValidator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CredentialValidator } from './credential-validator.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('CredentialValidator', () => {
  let validator: CredentialValidator

  beforeEach(() => {
    validator = new CredentialValidator()
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.USE_MOCK_SERVICES
  })

  describe('validateOpenAI', () => {
    it('should validate OpenAI credentials in mock mode', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const result = await validator.validateOpenAI({ apiKey: 'sk-test' })

      expect(result).toEqual({
        service: 'openai',
        valid: true,
        details: {
          accountInfo: { type: 'individual', tier: 'tier-1' },
          rateLimit: { remaining: 1000, resetTime: expect.any(Date) },
        },
      })
    })

    it('should reject invalid OpenAI key format in mock mode', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const result = await validator.validateOpenAI({ apiKey: 'invalid-key' })

      expect(result.valid).toBe(false)
    })

    it('should handle successful API response in production mode', async () => {
      process.env.USE_MOCK_SERVICES = 'false'
      const mockFetch = global.fetch as any

      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi
            .fn()
            .mockReturnValueOnce('100') // x-ratelimit-remaining
            .mockReturnValueOnce('1625097600'), // x-ratelimit-reset-time
        },
      })

      const result = await validator.validateOpenAI({ apiKey: 'sk-test' })

      expect(result.valid).toBe(true)
      expect(result.service).toBe('openai')
    })

    it('should handle failed API response in production mode', async () => {
      process.env.USE_MOCK_SERVICES = 'false'
      const mockFetch = global.fetch as any

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const result = await validator.validateOpenAI({ apiKey: 'sk-invalid' })

      expect(result.valid).toBe(false)
      expect(result.error).toContain('HTTP 401')
    })

    it('should handle network errors', async () => {
      process.env.USE_MOCK_SERVICES = 'false'
      const mockFetch = global.fetch as any

      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await validator.validateOpenAI({ apiKey: 'sk-test' })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('validateAnthropic', () => {
    it('should validate Anthropic credentials in mock mode', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const result = await validator.validateAnthropic({ apiKey: 'sk-ant-test' })

      expect(result).toEqual({
        service: 'anthropic',
        valid: true,
        details: {
          accountInfo: { type: 'individual' },
          rateLimit: { remaining: 500, resetTime: expect.any(Date) },
        },
      })
    })

    it('should reject invalid Anthropic key format in mock mode', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const result = await validator.validateAnthropic({ apiKey: 'invalid-key' })

      expect(result.valid).toBe(false)
    })

    it('should handle successful API response in production mode', async () => {
      process.env.USE_MOCK_SERVICES = 'false'
      const mockFetch = global.fetch as any

      mockFetch.mockResolvedValue({ ok: true })

      const result = await validator.validateAnthropic({ apiKey: 'sk-ant-test' })

      expect(result.valid).toBe(true)
      expect(result.service).toBe('anthropic')
    })
  })

  describe('validateAWS', () => {
    it('should validate AWS credentials in mock mode', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const result = await validator.validateAWS({
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret',
        region: 'us-east-1',
      })

      expect(result).toEqual({
        service: 'aws',
        valid: true,
        details: {
          accountInfo: { accountId: '123456789012', region: 'us-east-1' },
        },
      })
    })

    it('should reject empty credentials in mock mode', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const result = await validator.validateAWS({
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
      })

      expect(result.valid).toBe(false)
    })
  })

  describe('validateAllCredentials', () => {
    it('should validate all credentials successfully', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const results = await validator.validateAllCredentials(
        { apiKey: 'sk-test' },
        { apiKey: 'sk-ant-test' },
        { accessKeyId: 'AKIATEST', secretAccessKey: 'secret', region: 'us-east-1' }
      )

      expect(results).toHaveLength(3)
      expect(results.every(r => r.valid)).toBe(true)
    })

    it('should return mixed results when some credentials are invalid', async () => {
      process.env.USE_MOCK_SERVICES = 'true'

      const results = await validator.validateAllCredentials(
        { apiKey: 'invalid' },
        { apiKey: 'sk-ant-test' },
        { accessKeyId: 'AKIATEST', secretAccessKey: 'secret', region: 'us-east-1' }
      )

      expect(results).toHaveLength(3)
      expect(results[0].valid).toBe(false) // OpenAI
      expect(results[1].valid).toBe(true) // Anthropic
      expect(results[2].valid).toBe(true) // AWS
    })
  })
})
