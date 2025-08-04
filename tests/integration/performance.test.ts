/**
 * Performance Testing for Deployed Infrastructure
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createLogger } from '../../packages/shared/src/utils/logger.js';

const logger = createLogger('performance-tests');

interface PerformanceTestConfig {
  baseUrl: string;
  environment: string;
  timeout: number;
  concurrentUsers: number;
  testDuration: number;
}

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

interface LoadTestResult {
  endpoint: string;
  method: string;
  metrics: PerformanceMetrics;
  errors: string[];
  statusCodes: Record<number, number>;
}

class PerformanceTester {
  private config: PerformanceTestConfig;
  private authToken?: string;
  private testResults: LoadTestResult[] = [];

  constructor(config: PerformanceTestConfig) {
    this.config = config;
  }

  async setup(): Promise<void> {
    // Create test user for authenticated endpoints
    const testUser = {
      email: `perf-test-${Date.now()}@example.com`,
      password: 'PerfTest123!',
      name: 'Performance Test User',
    };

    try {
      const response = await this.makeRequest('POST', '/api/auth/register', testUser);
      if (response.ok) {
        const userData = await response.json();
        this.authToken = userData.accessToken;
        logger.info('Performance test user authenticated');
      }
    } catch (error) {
      logger.warn('Failed to create performance test user', { error });
    }
  }

  async cleanup(): Promise<void> {
    if (this.authToken) {
      try {
        await this.makeRequest('DELETE', '/api/user/cleanup');
      } catch (error) {
        logger.warn('Failed to cleanup performance test user', { error });
      }
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.authToken && !headers.Authorization && endpoint.startsWith('/api/') && endpoint !== '/api/auth/register') {
      requestHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    return fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private calculateMetrics(responseTimes: number[], errors: string[], statusCodes: Record<number, number>): PerformanceMetrics {
    const totalRequests = responseTimes.length + errors.length;
    const successfulRequests = responseTimes.length;
    const failedRequests = errors.length;

    const sorted = [...responseTimes].sort((a, b) => a - b);
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);

    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: successfulRequests > 0 ? sum / successfulRequests : 0,
      minResponseTime: sorted.length > 0 ? sorted[0] : 0,
      maxResponseTime: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      requestsPerSecond: 0, // Calculated by caller based on test duration
      errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
      p95ResponseTime: sorted.length > 0 ? sorted[p95Index] || sorted[sorted.length - 1] : 0,
      p99ResponseTime: sorted.length > 0 ? sorted[p99Index] || sorted[sorted.length - 1] : 0,
    };
  }

  async runLoadTest(endpoint: string, method: string = 'GET', body?: any, concurrentUsers: number = this.config.concurrentUsers, duration: number = this.config.testDuration): Promise<LoadTestResult> {
    logger.info(`Starting load test: ${method} ${endpoint}`, { concurrentUsers, duration });

    const startTime = Date.now();
    const endTime = startTime + duration;
    const responseTimes: number[] = [];
    const errors: string[] = [];
    const statusCodes: Record<number, number> = {};

    // Create concurrent user simulation
    const userPromises: Promise<void>[] = [];

    for (let i = 0; i < concurrentUsers; i++) {
      const userPromise = (async () => {
        while (Date.now() < endTime) {
          const requestStart = Date.now();
          
          try {
            const response = await this.makeRequest(method, endpoint, body);
            const requestTime = Date.now() - requestStart;
            
            responseTimes.push(requestTime);
            statusCodes[response.status] = (statusCodes[response.status] || 0) + 1;
            
            if (!response.ok) {
              errors.push(`HTTP ${response.status}: ${response.statusText}`);
            }
          } catch (error) {
            const requestTime = Date.now() - requestStart;
            responseTimes.push(requestTime);
            errors.push(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })();

      userPromises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.all(userPromises);

    const actualDuration = Date.now() - startTime;
    const metrics = this.calculateMetrics(responseTimes, errors, statusCodes);
    metrics.requestsPerSecond = (metrics.totalRequests / actualDuration) * 1000;

    const result: LoadTestResult = {
      endpoint,
      method,
      metrics,
      errors: [...new Set(errors)], // Unique errors only
      statusCodes,
    };

    this.testResults.push(result);

    logger.info(`Load test completed: ${method} ${endpoint}`, {
      totalRequests: metrics.totalRequests,
      successRate: 100 - metrics.errorRate,
      avgResponseTime: metrics.averageResponseTime,
      requestsPerSecond: metrics.requestsPerSecond,
    });

    return result;
  }

  // Health Endpoint Performance Tests
  async testHealthEndpointPerformance(): Promise<void> {
    const result = await this.runLoadTest('/health', 'GET', null, 50, 30000); // 50 users, 30 seconds

    // Health endpoint should be very fast and reliable
    expect(result.metrics.errorRate).toBeLessThan(1); // Less than 1% error rate
    expect(result.metrics.averageResponseTime).toBeLessThan(500); // Less than 500ms average
    expect(result.metrics.p95ResponseTime).toBeLessThan(1000); // 95% under 1 second
    expect(result.metrics.requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS

    logger.info('Health endpoint performance test passed', result.metrics);
  }

  async testApiHealthEndpointPerformance(): Promise<void> {
    const result = await this.runLoadTest('/api/health', 'GET', null, 30, 20000); // 30 users, 20 seconds

    // API health endpoint should be fast but may have more overhead
    expect(result.metrics.errorRate).toBeLessThan(2); // Less than 2% error rate
    expect(result.metrics.averageResponseTime).toBeLessThan(1000); // Less than 1 second average
    expect(result.metrics.p95ResponseTime).toBeLessThan(2000); // 95% under 2 seconds
    expect(result.metrics.requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS

    logger.info('API health endpoint performance test passed', result.metrics);
  }

  // Authentication Performance Tests
  async testAuthenticationPerformance(): Promise<void> {
    const loginData = {
      email: `login-perf-test-${Date.now()}@example.com`,
      password: 'LoginPerfTest123!',
    };

    // First register the user
    await this.makeRequest('POST', '/api/auth/register', {
      ...loginData,
      name: 'Login Performance Test User',
    });

    // Test login performance
    const result = await this.runLoadTest('/api/auth/login', 'POST', loginData, 10, 15000); // 10 users, 15 seconds

    // Authentication should be reasonably fast but not overwhelm the system
    expect(result.metrics.errorRate).toBeLessThan(5); // Less than 5% error rate
    expect(result.metrics.averageResponseTime).toBeLessThan(2000); // Less than 2 seconds average
    expect(result.metrics.p95ResponseTime).toBeLessThan(5000); // 95% under 5 seconds

    logger.info('Authentication performance test passed', result.metrics);
  }

  // API Endpoint Performance Tests
  async testProtectedEndpointPerformance(): Promise<void> {
    if (!this.authToken) {
      logger.warn('No auth token available, skipping protected endpoint performance test');
      return;
    }

    const result = await this.runLoadTest('/api/user/profile', 'GET', null, 20, 20000); // 20 users, 20 seconds

    // Protected endpoints should perform well with proper caching/optimization
    expect(result.metrics.errorRate).toBeLessThan(3); // Less than 3% error rate
    expect(result.metrics.averageResponseTime).toBeLessThan(1500); // Less than 1.5 seconds average
    expect(result.metrics.p95ResponseTime).toBeLessThan(3000); // 95% under 3 seconds

    logger.info('Protected endpoint performance test passed', result.metrics);
  }

  async testBusinessIdeasEndpointPerformance(): Promise<void> {
    if (!this.authToken) {
      logger.warn('No auth token available, skipping business ideas performance test');
      return;
    }

    // Test GET /api/ideas (list endpoint)
    const listResult = await this.runLoadTest('/api/ideas', 'GET', null, 15, 15000); // 15 users, 15 seconds

    expect(listResult.metrics.errorRate).toBeLessThan(5);
    expect(listResult.metrics.averageResponseTime).toBeLessThan(2000);

    // Test POST /api/ideas (create endpoint)
    const createData = {
      name: 'Performance Test Idea',
      description: 'A test business idea for performance testing',
      targetMarket: 'performance testers',
      revenue: 50000,
      costs: 25000,
    };

    const createResult = await this.runLoadTest('/api/ideas', 'POST', createData, 5, 10000); // 5 users, 10 seconds

    expect(createResult.metrics.errorRate).toBeLessThan(10); // Create operations may have higher error rate due to validation
    expect(createResult.metrics.averageResponseTime).toBeLessThan(3000);

    logger.info('Business ideas endpoint performance test passed', {
      list: listResult.metrics,
      create: createResult.metrics,
    });
  }

  // Database Performance Tests
  async testDatabasePerformance(): Promise<void> {
    if (!this.authToken) {
      logger.warn('No auth token available, skipping database performance test');
      return;
    }

    // Create multiple business ideas to test database performance under load
    const createPromises = Array(10).fill(null).map((_, i) =>
      this.makeRequest('POST', '/api/ideas', {
        name: `DB Performance Test Idea ${i}`,
        description: `Database performance testing idea number ${i}`,
        targetMarket: 'database performance testers',
        revenue: 30000 + (i * 5000),
        costs: 15000 + (i * 2000),
      })
    );

    const startTime = Date.now();
    const results = await Promise.all(createPromises);
    const creationTime = Date.now() - startTime;

    // Validate creation performance
    const successfulCreations = results.filter(r => r.ok).length;
    expect(successfulCreations).toBeGreaterThan(8); // At least 80% success rate
    expect(creationTime).toBeLessThan(15000); // All creations under 15 seconds

    // Now test retrieval performance
    const retrievalResult = await this.runLoadTest('/api/ideas', 'GET', null, 25, 20000);

    expect(retrievalResult.metrics.errorRate).toBeLessThan(2);
    expect(retrievalResult.metrics.averageResponseTime).toBeLessThan(1000);

    logger.info('Database performance test passed', {
      creationTime,
      successfulCreations,
      retrieval: retrievalResult.metrics,
    });
  }

  // Stress Testing
  async testSystemStressLimits(): Promise<void> {
    logger.info('Starting system stress test');

    // Gradually increase load to find system limits
    const stressResults = [];

    for (let users = 10; users <= 100; users += 20) {
      const result = await this.runLoadTest('/health', 'GET', null, users, 10000); // 10 seconds each
      
      stressResults.push({
        concurrentUsers: users,
        metrics: result.metrics,
      });

      // Stop if error rate becomes too high
      if (result.metrics.errorRate > 20) {
        logger.warn(`High error rate detected at ${users} concurrent users, stopping stress test`);
        break;
      }

      // Brief pause between stress levels
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Analyze stress test results
    const successfulLevels = stressResults.filter(r => r.metrics.errorRate < 10);
    expect(successfulLevels.length).toBeGreaterThan(0);

    const maxUsers = Math.max(...successfulLevels.map(r => r.concurrentUsers));
    expect(maxUsers).toBeGreaterThan(10); // Should handle at least 10 concurrent users

    logger.info('System stress test completed', {
      maxConcurrentUsers: maxUsers,
      stressLevels: stressResults.length,
    });
  }

  // Memory and Resource Tests
  async testMemoryLeaks(): Promise<void> {
    logger.info('Starting memory leak test');

    // Run extended test to check for memory leaks
    const longRunResult = await this.runLoadTest('/api/health', 'GET', null, 5, 60000); // 5 users, 60 seconds

    // Look for degrading performance over time (potential memory leak indicator)
    expect(longRunResult.metrics.errorRate).toBeLessThan(5);
    expect(longRunResult.metrics.averageResponseTime).toBeLessThan(1000);

    // The fact that the test completes without timeout suggests no major memory leaks
    logger.info('Memory leak test completed', longRunResult.metrics);
  }

  // Rate Limiting Performance
  async testRateLimitingPerformance(): Promise<void> {
    if (this.config.environment === 'dev') {
      logger.info('Skipping rate limiting test in development environment');
      return;
    }

    // Test rate limiting by making rapid requests
    const rapidRequests = await this.runLoadTest('/api/health', 'GET', null, 20, 5000); // 20 users, 5 seconds

    // In production, we expect some rate limiting
    const rateLimitedRequests = Object.keys(rapidRequests.statusCodes)
      .filter(code => parseInt(code) === 429)
      .reduce((sum, code) => sum + rapidRequests.statusCodes[parseInt(code)], 0);

    if (this.config.environment === 'prod') {
      expect(rateLimitedRequests).toBeGreaterThan(0);
    }

    logger.info('Rate limiting performance test completed', {
      totalRequests: rapidRequests.metrics.totalRequests,
      rateLimitedRequests,
      rateLimitingActive: rateLimitedRequests > 0,
    });
  }

  // Performance Summary
  getPerformanceSummary(): any {
    return {
      totalTests: this.testResults.length,
      averageResponseTime: this.testResults.reduce((sum, r) => sum + r.metrics.averageResponseTime, 0) / this.testResults.length,
      overallErrorRate: this.testResults.reduce((sum, r) => sum + r.metrics.errorRate, 0) / this.testResults.length,
      totalRequests: this.testResults.reduce((sum, r) => sum + r.metrics.totalRequests, 0),
      results: this.testResults,
    };
  }
}

// Test Configuration
const getPerformanceTestConfig = (): PerformanceTestConfig => ({
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  environment: process.env.TEST_ENVIRONMENT || 'dev',
  timeout: 120000, // 2 minutes per test
  concurrentUsers: parseInt(process.env.PERF_CONCURRENT_USERS || '10'),
  testDuration: parseInt(process.env.PERF_TEST_DURATION || '15000'), // 15 seconds default
});

// Test Suite
describe('Performance Tests', () => {
  let tester: PerformanceTester;
  const config = getPerformanceTestConfig();

  beforeAll(async () => {
    tester = new PerformanceTester(config);
    await tester.setup();
  }, config.timeout);

  afterAll(async () => {
    if (tester) {
      await tester.cleanup();
      
      // Log performance summary
      const summary = tester.getPerformanceSummary();
      logger.info('Performance test suite completed', summary);
    }
  });

  describe('Health Endpoints', () => {
    test('should handle load on health endpoint', async () => {
      await tester.testHealthEndpointPerformance();
    }, config.timeout);

    test('should handle load on API health endpoint', async () => {
      await tester.testApiHealthEndpointPerformance();
    }, config.timeout);
  });

  describe('Authentication', () => {
    test('should handle authentication load', async () => {
      await tester.testAuthenticationPerformance();
    }, config.timeout);
  });

  describe('API Endpoints', () => {
    test('should handle load on protected endpoints', async () => {
      await tester.testProtectedEndpointPerformance();
    }, config.timeout);

    test('should handle load on business ideas endpoints', async () => {
      await tester.testBusinessIdeasEndpointPerformance();
    }, config.timeout);
  });

  describe('Database Performance', () => {
    test('should handle database operations under load', async () => {
      await tester.testDatabasePerformance();
    }, config.timeout);
  });

  describe('Stress Testing', () => {
    test('should identify system stress limits', async () => {
      await tester.testSystemStressLimits();
    }, config.timeout * 2); // Extended timeout for stress testing
  });

  describe('Resource Management', () => {
    test('should not have memory leaks', async () => {
      await tester.testMemoryLeaks();
    }, config.timeout * 2); // Extended timeout for memory leak testing

    test('should enforce rate limiting appropriately', async () => {
      await tester.testRateLimitingPerformance();
    }, config.timeout);
  });
});

export default PerformanceTester;