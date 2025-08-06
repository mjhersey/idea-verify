/**
 * Tests for MockServiceManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MockServiceManager } from './mock-service-manager.js'

// Mock the service classes
vi.mock('./openai/mock-openai-service.js', () => ({
  MockOpenAIService: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}))

vi.mock('./anthropic/mock-anthropic-service.js', () => ({
  MockAnthropicService: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('MockServiceManager', () => {
  let manager: MockServiceManager
  let mockConfig: any

  beforeEach(() => {
    mockConfig = {
      openai: {
        port: 3001,
        rateLimits: {
          requestsPerMinute: 1000,
          tokensPerMinute: 100000,
        },
      },
      anthropic: {
        port: 3002,
        rateLimits: {
          requestsPerMinute: 500,
          tokensPerMinute: 50000,
        },
      },
      localstack: {
        endpoint: 'http://localhost:4566',
        services: ['s3', 'secretsmanager'],
      },
    }

    manager = new MockServiceManager(mockConfig)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('startAll', () => {
    it('should start all services successfully', async () => {
      await manager.startAll()

      const status = manager.getStatus()
      expect(status.isRunning).toBe(true)
    })

    it('should not start services if already running', async () => {
      // Start services once
      await manager.startAll()

      // Try to start again - should do nothing
      await manager.startAll()

      const status = manager.getStatus()
      expect(status.isRunning).toBe(true)
    })
  })

  describe('stopAll', () => {
    it('should stop all services', async () => {
      // Start services first
      await manager.startAll()

      // Then stop them
      await manager.stopAll()

      const status = manager.getStatus()
      expect(status.isRunning).toBe(false)
    })

    it('should handle stop when services not running', async () => {
      // Should not throw when services aren't running
      await expect(manager.stopAll()).resolves.not.toThrow()
    })
  })

  describe('getStatus', () => {
    it('should return correct status when services are stopped', () => {
      const status = manager.getStatus()

      expect(status.isRunning).toBe(false)
      expect(status.services).toHaveProperty('openai')
      expect(status.services).toHaveProperty('anthropic')
      expect(status.services).toHaveProperty('localstack')
    })

    it('should return correct status when services are running', async () => {
      await manager.startAll()
      const status = manager.getStatus()

      expect(status.isRunning).toBe(true)
      expect(status.services.openai.port).toBe(3001)
      expect(status.services.anthropic.port).toBe(3002)
      expect(status.services.localstack.endpoint).toBe('http://localhost:4566')
    })
  })

  describe('validateServices', () => {
    it('should return false when services are not running', async () => {
      const isValid = await manager.validateServices()
      expect(isValid).toBe(false)
    })

    it('should validate services successfully when all are responding', async () => {
      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({ ok: true })

      await manager.startAll()
      const isValid = await manager.validateServices()

      expect(isValid).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(3) // OpenAI, Anthropic, LocalStack
    })

    it('should return false when OpenAI service is not responding', async () => {
      const mockFetch = global.fetch as any
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 }) // OpenAI fails
        .mockResolvedValue({ ok: true }) // Others succeed

      await manager.startAll()
      const isValid = await manager.validateServices()

      expect(isValid).toBe(false)
    })

    it('should handle LocalStack being unavailable gracefully', async () => {
      const mockFetch = global.fetch as any
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // OpenAI succeeds
        .mockResolvedValueOnce({ ok: true }) // Anthropic succeeds
        .mockRejectedValueOnce(new Error('LocalStack not available')) // LocalStack fails

      await manager.startAll()
      const isValid = await manager.validateServices()

      // Should still return true as LocalStack failure is handled gracefully
      expect(isValid).toBe(true)
    })
  })
})
