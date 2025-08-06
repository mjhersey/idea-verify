/**
 * End-to-End Test Suite for Deployed Environment
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { EnvironmentValidator } from '../../packages/shared/src/testing/environment-validator.js'
import { createLogger } from '../../packages/shared/src/utils/logger.js'

const logger = createLogger('e2e-tests')

interface TestConfig {
  baseUrl: string
  environment: string
  timeout: number
  retryAttempts: number
}

interface TestUser {
  email: string
  password: string
  token?: string
  refreshToken?: string
}

interface BusinessIdea {
  id?: string
  name: string
  description: string
  targetMarket: string
  revenue: number
  costs: number
}

class E2ETestSuite {
  private config: TestConfig
  private testUser: TestUser
  private validator: EnvironmentValidator

  constructor(config: TestConfig) {
    this.config = config
    this.testUser = {
      email: `e2e-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    }
    this.validator = new EnvironmentValidator(config.environment, config.baseUrl)
  }

  async setup(): Promise<void> {
    logger.info('Setting up E2E test suite', {
      environment: this.config.environment,
      baseUrl: this.config.baseUrl,
    })

    // Validate environment before running tests
    const validationResult = await this.validator.validate()
    if (!validationResult.valid) {
      const failedChecks = validationResult.checks.filter(c => c.status === 'fail')
      throw new Error(
        `Environment validation failed: ${failedChecks.map(c => c.message).join(', ')}`
      )
    }

    logger.info('Environment validation passed, proceeding with tests')
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up E2E test suite')

    // Clean up test user and data if needed
    if (this.testUser.token) {
      try {
        // Delete test user's data
        await this.makeAuthenticatedRequest('DELETE', '/api/user/cleanup')
      } catch (error) {
        logger.warn('Failed to cleanup test user data', { error })
      }
    }
  }

  private async makeRequest(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    }

    logger.debug('Making request', { method, url, headers: requestHeaders })

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    return response
  }

  private async makeAuthenticatedRequest(
    method: string,
    path: string,
    body?: any
  ): Promise<Response> {
    if (!this.testUser.token) {
      throw new Error('No authentication token available')
    }

    return this.makeRequest(method, path, body, {
      Authorization: `Bearer ${this.testUser.token}`,
    })
  }

  // Authentication Flow Tests
  async testUserRegistration(): Promise<void> {
    const response = await this.makeRequest('POST', '/api/auth/register', {
      email: this.testUser.email,
      password: this.testUser.password,
      name: 'E2E Test User',
    })

    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data).toHaveProperty('user')
    expect(data).toHaveProperty('accessToken')
    expect(data.user.email).toBe(this.testUser.email)

    this.testUser.token = data.accessToken
    this.testUser.refreshToken = data.refreshToken

    logger.info('User registration test passed', { email: this.testUser.email })
  }

  async testUserLogin(): Promise<void> {
    const response = await this.makeRequest('POST', '/api/auth/login', {
      email: this.testUser.email,
      password: this.testUser.password,
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('user')
    expect(data).toHaveProperty('accessToken')

    // Update tokens
    this.testUser.token = data.accessToken
    this.testUser.refreshToken = data.refreshToken

    logger.info('User login test passed')
  }

  async testTokenRefresh(): Promise<void> {
    if (!this.testUser.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await this.makeRequest('POST', '/api/auth/refresh', {
      refreshToken: this.testUser.refreshToken,
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('accessToken')

    this.testUser.token = data.accessToken

    logger.info('Token refresh test passed')
  }

  async testProtectedEndpointAccess(): Promise<void> {
    const response = await this.makeAuthenticatedRequest('GET', '/api/user/profile')

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.email).toBe(this.testUser.email)

    logger.info('Protected endpoint access test passed')
  }

  // Business Logic Tests
  async testBusinessIdeaSubmission(): Promise<BusinessIdea> {
    const idea: BusinessIdea = {
      name: 'E2E Test Idea',
      description:
        'A revolutionary app that helps people test their business ideas using AI validation.',
      targetMarket: 'entrepreneurs, startups, small business owners',
      revenue: 100000,
      costs: 50000,
    }

    const response = await this.makeAuthenticatedRequest('POST', '/api/ideas', idea)

    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data).toHaveProperty('id')
    expect(data.name).toBe(idea.name)
    expect(data.description).toBe(idea.description)

    idea.id = data.id

    logger.info('Business idea submission test passed', { ideaId: idea.id })
    return idea
  }

  async testBusinessIdeaRetrieval(ideaId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest('GET', `/api/ideas/${ideaId}`)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.id).toBe(ideaId)
    expect(data.name).toBe('E2E Test Idea')

    logger.info('Business idea retrieval test passed', { ideaId })
  }

  async testEvaluationStart(ideaId: string): Promise<string> {
    const response = await this.makeAuthenticatedRequest('POST', `/api/ideas/${ideaId}/evaluate`)

    expect(response.status).toBe(202)

    const data = await response.json()
    expect(data).toHaveProperty('evaluationId')
    expect(data.status).toBe('pending')

    const evaluationId = data.evaluationId

    logger.info('Evaluation start test passed', { ideaId, evaluationId })
    return evaluationId
  }

  async testEvaluationStatusPolling(evaluationId: string): Promise<void> {
    let attempts = 0
    const maxAttempts = 30 // 5 minutes with 10-second intervals

    while (attempts < maxAttempts) {
      const response = await this.makeAuthenticatedRequest(
        'GET',
        `/api/evaluations/${evaluationId}`
      )
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(evaluationId)

      if (data.status === 'completed') {
        expect(data).toHaveProperty('result')
        expect(data.result).toHaveProperty('overallScore')
        expect(data.result).toHaveProperty('marketResearch')

        logger.info('Evaluation completed successfully', {
          evaluationId,
          overallScore: data.result.overallScore,
          attempts: attempts + 1,
        })
        return
      }

      if (data.status === 'failed') {
        throw new Error(`Evaluation failed: ${data.error || 'Unknown error'}`)
      }

      // Wait 10 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 10000))
      attempts++
    }

    throw new Error(`Evaluation did not complete within ${maxAttempts * 10} seconds`)
  }

  async testEvaluationResultRetrieval(evaluationId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest(
      'GET',
      `/api/evaluations/${evaluationId}/result`
    )

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('overallScore')
    expect(data).toHaveProperty('marketResearch')
    expect(data).toHaveProperty('financialAnalysis')
    expect(data.overallScore).toBeGreaterThan(0)
    expect(data.overallScore).toBeLessThanOrEqual(100)

    logger.info('Evaluation result retrieval test passed', { evaluationId })
  }

  // Performance and Load Tests
  async testConcurrentRequests(): Promise<void> {
    const promises = Array(10)
      .fill(null)
      .map(() => this.makeAuthenticatedRequest('GET', '/api/user/profile'))

    const responses = await Promise.all(promises)

    // All requests should succeed
    for (const response of responses) {
      expect(response.status).toBe(200)
    }

    logger.info('Concurrent requests test passed')
  }

  async testRateLimiting(): Promise<void> {
    // Make rapid requests to test rate limiting
    const promises = Array(50)
      .fill(null)
      .map((_, i) =>
        this.makeRequest('GET', '/api/health').then(response => ({
          index: i,
          status: response.status,
          headers: {
            rateLimit: response.headers.get('x-ratelimit-remaining'),
            retryAfter: response.headers.get('retry-after'),
          },
        }))
      )

    const results = await Promise.all(promises)

    // Check if some requests were rate limited (429 status)
    const rateLimitedRequests = results.filter(r => r.status === 429)

    if (this.config.environment === 'prod') {
      // In production, we expect rate limiting to be active
      expect(rateLimitedRequests.length).toBeGreaterThan(0)
    }

    logger.info('Rate limiting test completed', {
      totalRequests: results.length,
      rateLimitedRequests: rateLimitedRequests.length,
    })
  }

  // Health and Monitoring Tests
  async testHealthEndpoints(): Promise<void> {
    // Basic health check
    const healthResponse = await this.makeRequest('GET', '/health')
    expect(healthResponse.status).toBe(200)

    // API health check
    const apiHealthResponse = await this.makeRequest('GET', '/api/health')
    expect(apiHealthResponse.status).toBe(200)

    // Detailed health check
    const detailedHealthResponse = await this.makeRequest('GET', '/api/health/detailed')
    expect(detailedHealthResponse.status).toBe(200)

    const healthData = await detailedHealthResponse.json()
    expect(healthData).toHaveProperty('services')
    expect(healthData.services).toHaveProperty('database')
    expect(healthData.services).toHaveProperty('redis')

    logger.info('Health endpoints test passed')
  }

  async testDatabaseConnectivity(): Promise<void> {
    const response = await this.makeAuthenticatedRequest('GET', '/api/debug/db-status')

    // This endpoint might not exist in production for security reasons
    if (response.status === 404 && this.config.environment === 'prod') {
      logger.info('Database connectivity test skipped (endpoint not available in production)')
      return
    }

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.connected).toBe(true)

    logger.info('Database connectivity test passed')
  }
}

// Test Configuration
const getTestConfig = (): TestConfig => {
  const environment = process.env.TEST_ENVIRONMENT || 'dev'
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

  return {
    baseUrl,
    environment,
    timeout: 300000, // 5 minutes
    retryAttempts: 3,
  }
}

// Main Test Suite
describe('E2E Tests - Deployed Environment', () => {
  let testSuite: E2ETestSuite
  const config = getTestConfig()

  beforeAll(async () => {
    testSuite = new E2ETestSuite(config)
    await testSuite.setup()
  }, config.timeout)

  afterAll(async () => {
    if (testSuite) {
      await testSuite.cleanup()
    }
  })

  describe('Environment Health', () => {
    test('should have healthy infrastructure', async () => {
      await testSuite.testHealthEndpoints()
    })

    test('should have database connectivity', async () => {
      await testSuite.testDatabaseConnectivity()
    })
  })

  describe('Authentication Flow', () => {
    test('should register new user', async () => {
      await testSuite.testUserRegistration()
    })

    test('should login existing user', async () => {
      await testSuite.testUserLogin()
    })

    test('should refresh authentication token', async () => {
      await testSuite.testTokenRefresh()
    })

    test('should access protected endpoints', async () => {
      await testSuite.testProtectedEndpointAccess()
    })
  })

  describe('Business Logic Flow', () => {
    let businessIdea: BusinessIdea
    let evaluationId: string

    test('should submit business idea', async () => {
      businessIdea = await testSuite.testBusinessIdeaSubmission()
    })

    test('should retrieve business idea', async () => {
      await testSuite.testBusinessIdeaRetrieval(businessIdea.id!)
    })

    test('should start evaluation', async () => {
      evaluationId = await testSuite.testEvaluationStart(businessIdea.id!)
    })

    test(
      'should complete evaluation',
      async () => {
        await testSuite.testEvaluationStatusPolling(evaluationId)
      },
      config.timeout
    )

    test('should retrieve evaluation result', async () => {
      await testSuite.testEvaluationResultRetrieval(evaluationId)
    })
  })

  describe('Performance and Load', () => {
    test('should handle concurrent requests', async () => {
      await testSuite.testConcurrentRequests()
    })

    test('should enforce rate limiting', async () => {
      await testSuite.testRateLimiting()
    })
  })
})

export default E2ETestSuite
