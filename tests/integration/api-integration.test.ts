/**
 * API Integration Tests for Deployed Services
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createLogger } from '../../packages/shared/src/utils/logger.js'
import {
  getTestEnvironment,
  isFeatureEnabled,
  getTestUser,
  shouldSkipSlowTests,
} from '../config/test-environments.js'

// Get environment-specific configuration
const testEnv = getTestEnvironment()
const logger = createLogger('api-integration-tests', { level: testEnv.monitoring.logLevel })

interface ApiTestConfig {
  baseUrl: string
  environment: string
  timeout: number
}

interface TestContext {
  authToken?: string
  userId?: string
  ideaId?: string
  evaluationId?: string
}

class ApiIntegrationTester {
  private config: ApiTestConfig
  private context: TestContext = {}

  constructor(config: ApiTestConfig) {
    this.config = config
  }

  static create() {
    return new ApiIntegrationTester({
      baseUrl: testEnv.apiBaseUrl,
      environment: testEnv.name,
      timeout: testEnv.timeout,
    })
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    }

    if (this.context.authToken && !headers.Authorization) {
      requestHeaders.Authorization = `Bearer ${this.context.authToken}`
    }

    logger.debug('API request', { method, url, headers: Object.keys(requestHeaders) })

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      })

      logger.debug('API response', {
        method,
        url,
        status: response.status,
        statusText: response.statusText,
      })

      return response
    } catch (error) {
      logger.error('API request failed', { method, url, error })
      throw error
    }
  }

  async setupTestUser(): Promise<void> {
    const testUser = {
      email: `api-test-${Date.now()}@example.com`,
      password: 'ApiTest123!',
      name: 'API Integration Test User',
    }

    // Register user
    const registerResponse = await this.makeRequest('POST', '/api/auth/register', testUser)
    expect(registerResponse.status).toBe(201)

    const registerData = await registerResponse.json()
    this.context.authToken = registerData.accessToken
    this.context.userId = registerData.user.id

    logger.info('Test user created', { userId: this.context.userId })
  }

  async cleanupTestUser(): Promise<void> {
    if (this.context.authToken) {
      // Attempt to cleanup user data
      try {
        await this.makeRequest('DELETE', '/api/user/cleanup')
      } catch (error) {
        logger.warn('Failed to cleanup test user', { error })
      }
    }
  }

  // Health and Status Tests
  async testHealthEndpoints(): Promise<void> {
    // Basic health
    const healthResponse = await this.makeRequest('GET', '/health')
    expect(healthResponse.status).toBe(200)

    const healthData = await healthResponse.json()
    expect(healthData).toHaveProperty('status')
    expect(healthData.status).toBe('healthy')

    // API health
    const apiHealthResponse = await this.makeRequest('GET', '/api/health')
    expect(apiHealthResponse.status).toBe(200)

    // Detailed health
    const detailedResponse = await this.makeRequest('GET', '/api/health/detailed')
    expect(detailedResponse.status).toBe(200)

    const detailedData = await detailedResponse.json()
    expect(detailedData).toHaveProperty('services')
    expect(detailedData.services).toHaveProperty('database')
    expect(detailedData.services).toHaveProperty('redis')

    logger.info('Health endpoints test passed')
  }

  // Authentication API Tests
  async testAuthenticationEndpoints(): Promise<void> {
    const testEmail = `auth-test-${Date.now()}@example.com`
    const testPassword = 'AuthTest123!'

    // Test registration
    const registerResponse = await this.makeRequest('POST', '/api/auth/register', {
      email: testEmail,
      password: testPassword,
      name: 'Auth Test User',
    })

    expect(registerResponse.status).toBe(201)
    const registerData = await registerResponse.json()
    expect(registerData).toHaveProperty('user')
    expect(registerData).toHaveProperty('accessToken')
    expect(registerData).toHaveProperty('refreshToken')
    expect(registerData.user.email).toBe(testEmail)

    // Test login
    const loginResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword,
    })

    expect(loginResponse.status).toBe(200)
    const loginData = await loginResponse.json()
    expect(loginData).toHaveProperty('user')
    expect(loginData).toHaveProperty('accessToken')

    // Test token refresh
    const refreshResponse = await this.makeRequest('POST', '/api/auth/refresh', {
      refreshToken: registerData.refreshToken,
    })

    expect(refreshResponse.status).toBe(200)
    const refreshData = await refreshResponse.json()
    expect(refreshData).toHaveProperty('accessToken')

    // Test invalid credentials
    const invalidLoginResponse = await this.makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword',
    })

    expect(invalidLoginResponse.status).toBe(401)

    logger.info('Authentication endpoints test passed')
  }

  // User Management API Tests
  async testUserEndpoints(): Promise<void> {
    // Get user profile
    const profileResponse = await this.makeRequest('GET', '/api/user/profile')
    expect(profileResponse.status).toBe(200)

    const profileData = await profileResponse.json()
    expect(profileData).toHaveProperty('id')
    expect(profileData).toHaveProperty('email')
    expect(profileData.id).toBe(this.context.userId)

    // Update user profile
    const updateData = { name: 'Updated Test User' }
    const updateResponse = await this.makeRequest('PATCH', '/api/user/profile', updateData)
    expect(updateResponse.status).toBe(200)

    const updatedData = await updateResponse.json()
    expect(updatedData.name).toBe(updateData.name)

    // Test unauthorized access
    const unauthorizedResponse = await this.makeRequest('GET', '/api/user/profile', null, {})
    expect(unauthorizedResponse.status).toBe(401)

    logger.info('User endpoints test passed')
  }

  // Business Ideas API Tests
  async testBusinessIdeasEndpoints(): Promise<void> {
    // Create business idea
    const ideaData = {
      name: 'API Test Business Idea',
      description: 'A test business idea for API integration testing',
      targetMarket: 'test market',
      revenue: 75000,
      costs: 25000,
    }

    const createResponse = await this.makeRequest('POST', '/api/ideas', ideaData)
    expect(createResponse.status).toBe(201)

    const createdIdea = await createResponse.json()
    expect(createdIdea).toHaveProperty('id')
    expect(createdIdea.name).toBe(ideaData.name)
    expect(createdIdea.description).toBe(ideaData.description)

    this.context.ideaId = createdIdea.id

    // Get all user's ideas
    const listResponse = await this.makeRequest('GET', '/api/ideas')
    expect(listResponse.status).toBe(200)

    const ideas = await listResponse.json()
    expect(Array.isArray(ideas)).toBe(true)
    expect(ideas.length).toBeGreaterThan(0)
    expect(ideas.some((idea: any) => idea.id === this.context.ideaId)).toBe(true)

    // Get specific idea
    const getResponse = await this.makeRequest('GET', `/api/ideas/${this.context.ideaId}`)
    expect(getResponse.status).toBe(200)

    const retrievedIdea = await getResponse.json()
    expect(retrievedIdea.id).toBe(this.context.ideaId)
    expect(retrievedIdea.name).toBe(ideaData.name)

    // Update idea
    const updateData = { name: 'Updated API Test Idea' }
    const updateResponse = await this.makeRequest(
      'PATCH',
      `/api/ideas/${this.context.ideaId}`,
      updateData
    )
    expect(updateResponse.status).toBe(200)

    const updatedIdea = await updateResponse.json()
    expect(updatedIdea.name).toBe(updateData.name)

    // Test not found
    const notFoundResponse = await this.makeRequest('GET', '/api/ideas/nonexistent-id')
    expect([404, 400]).toContain(notFoundResponse.status)

    logger.info('Business ideas endpoints test passed', { ideaId: this.context.ideaId })
  }

  // Evaluation API Tests
  async testEvaluationEndpoints(): Promise<void> {
    if (!this.context.ideaId) {
      throw new Error('No idea ID available for evaluation tests')
    }

    // Start evaluation
    const startResponse = await this.makeRequest(
      'POST',
      `/api/ideas/${this.context.ideaId}/evaluate`
    )
    expect(startResponse.status).toBe(202)

    const evaluationData = await startResponse.json()
    expect(evaluationData).toHaveProperty('evaluationId')
    expect(evaluationData.status).toBe('pending')

    this.context.evaluationId = evaluationData.evaluationId

    // Get evaluation status
    const statusResponse = await this.makeRequest(
      'GET',
      `/api/evaluations/${this.context.evaluationId}`
    )
    expect(statusResponse.status).toBe(200)

    const statusData = await statusResponse.json()
    expect(statusData.id).toBe(this.context.evaluationId)
    expect(['pending', 'in_progress', 'completed', 'failed']).toContain(statusData.status)

    // Get user's evaluations
    const listResponse = await this.makeRequest('GET', '/api/evaluations')
    expect(listResponse.status).toBe(200)

    const evaluations = await listResponse.json()
    expect(Array.isArray(evaluations)).toBe(true)
    expect(evaluations.some((eval: any) => eval.id === this.context.evaluationId)).toBe(true)

    // Test evaluation result endpoint (may not be available immediately)
    const resultResponse = await this.makeRequest(
      'GET',
      `/api/evaluations/${this.context.evaluationId}/result`
    )
    expect([200, 202, 404]).toContain(resultResponse.status)

    if (resultResponse.status === 200) {
      const resultData = await resultResponse.json()
      expect(resultData).toHaveProperty('overallScore')
    }

    logger.info('Evaluation endpoints test passed', { evaluationId: this.context.evaluationId })
  }

  // Error Handling Tests
  async testErrorHandling(): Promise<void> {
    // Test 404 for non-existent resources
    const notFoundResponse = await this.makeRequest('GET', '/api/nonexistent-endpoint')
    expect(notFoundResponse.status).toBe(404)

    // Test method not allowed
    const methodNotAllowedResponse = await this.makeRequest('DELETE', '/api/health')
    expect([404, 405]).toContain(methodNotAllowedResponse.status)

    // Test malformed JSON
    const malformedResponse = await fetch(`${this.config.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid": json}',
    })
    expect(malformedResponse.status).toBe(400)

    // Test missing required fields
    const missingFieldsResponse = await this.makeRequest('POST', '/api/auth/register', {})
    expect(missingFieldsResponse.status).toBe(400)

    const errorData = await missingFieldsResponse.json()
    expect(errorData).toHaveProperty('error')

    logger.info('Error handling test passed')
  }

  // Security Tests
  async testSecurityFeatures(): Promise<void> {
    // Test CORS headers
    const corsResponse = await fetch(`${this.config.baseUrl}/api/health`, {
      method: 'OPTIONS',
    })

    const corsHeaders = {
      'access-control-allow-origin': corsResponse.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': corsResponse.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': corsResponse.headers.get('access-control-allow-headers'),
    }

    // Check if at least some CORS headers are present
    const hasCorsHeaders = Object.values(corsHeaders).some(header => header !== null)
    expect(hasCorsHeaders).toBe(true)

    // Test security headers on main response
    const securityResponse = await this.makeRequest('GET', '/api/health')
    const securityHeaders = {
      'x-frame-options': securityResponse.headers.get('x-frame-options'),
      'x-content-type-options': securityResponse.headers.get('x-content-type-options'),
      'x-xss-protection': securityResponse.headers.get('x-xss-protection'),
    }

    // Test SQL injection protection (should be handled by validation)
    const sqlInjectionResponse = await this.makeRequest('GET', `/api/ideas/'OR'1'='1`)
    expect([400, 404]).toContain(sqlInjectionResponse.status)

    // Test XSS protection (should be handled by validation)
    const xssResponse = await this.makeRequest('POST', '/api/ideas', {
      name: '<script>alert("xss")</script>',
      description: 'Test description',
      targetMarket: 'test',
      revenue: 1000,
      costs: 500,
    })

    if (xssResponse.status === 201) {
      const xssData = await xssResponse.json()
      // Should not contain unescaped script tags
      expect(xssData.name).not.toContain('<script>')
    }

    logger.info('Security features test passed', {
      corsHeaders: Object.keys(corsHeaders).filter(
        key => corsHeaders[key as keyof typeof corsHeaders]
      ),
      securityHeaders: Object.keys(securityHeaders).filter(
        key => securityHeaders[key as keyof typeof securityHeaders]
      ),
    })
  }

  // Performance Tests
  async testApiPerformance(): Promise<void> {
    const startTime = Date.now()

    // Test concurrent requests
    const promises = Array(20)
      .fill(null)
      .map((_, i) =>
        this.makeRequest('GET', '/api/health').then(response => ({
          index: i,
          status: response.status,
          duration: Date.now() - startTime,
        }))
      )

    const results = await Promise.all(promises)
    const successfulRequests = results.filter(r => r.status === 200)
    const averageResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length

    expect(successfulRequests.length).toBeGreaterThan(15) // Allow some failures
    expect(averageResponseTime).toBeLessThan(5000) // 5 seconds average

    // Test response times for different endpoints
    const endpoints = ['/api/health', '/api/user/profile', '/api/ideas']

    for (const endpoint of endpoints) {
      const start = Date.now()
      const response = await this.makeRequest('GET', endpoint)
      const duration = Date.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(3000) // 3 seconds per request
    }

    logger.info('API performance test passed', {
      concurrentRequests: results.length,
      successfulRequests: successfulRequests.length,
      averageResponseTime,
    })
  }
}

// Test Configuration
const getApiTestConfig = (): ApiTestConfig => ({
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  environment: process.env.TEST_ENVIRONMENT || 'dev',
  timeout: 30000, // 30 seconds per test
})

// Test Suite
describe('API Integration Tests', () => {
  let tester: ApiIntegrationTester
  const config = getApiTestConfig()

  beforeAll(async () => {
    tester = new ApiIntegrationTester(config)
    await tester.setupTestUser()
  }, config.timeout)

  afterAll(async () => {
    if (tester) {
      await tester.cleanupTestUser()
    }
  })

  describe('Health and Status', () => {
    test(
      'should have healthy API endpoints',
      async () => {
        await tester.testHealthEndpoints()
      },
      config.timeout
    )
  })

  describe('Authentication', () => {
    test(
      'should handle authentication flow correctly',
      async () => {
        await tester.testAuthenticationEndpoints()
      },
      config.timeout
    )
  })

  describe('User Management', () => {
    test(
      'should handle user operations correctly',
      async () => {
        await tester.testUserEndpoints()
      },
      config.timeout
    )
  })

  describe('Business Ideas', () => {
    test(
      'should handle business idea CRUD operations',
      async () => {
        await tester.testBusinessIdeasEndpoints()
      },
      config.timeout
    )
  })

  describe('Evaluations', () => {
    test(
      'should handle evaluation lifecycle',
      async () => {
        await tester.testEvaluationEndpoints()
      },
      config.timeout
    )
  })

  describe('Error Handling', () => {
    test(
      'should handle errors gracefully',
      async () => {
        await tester.testErrorHandling()
      },
      config.timeout
    )
  })

  describe('Security', () => {
    test(
      'should have security features enabled',
      async () => {
        await tester.testSecurityFeatures()
      },
      config.timeout
    )
  })

  describe('Performance', () => {
    test(
      'should meet performance requirements',
      async () => {
        await tester.testApiPerformance()
      },
      config.timeout
    )
  })
})

export default ApiIntegrationTester
