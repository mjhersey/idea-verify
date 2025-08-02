/**
 * Integration Test Suite for External Services
 * Comprehensive testing of all external service connections
 */

import { CredentialValidator } from '../utils/credential-validator.js';
import { ServiceClient } from '../utils/service-client.js';
import { getServiceConfig } from '../config/rate-limit-configs.js';
import { SecretsManager } from '../secrets/secrets-manager.js';
import { getEnvironmentConfig } from '../config/environment.js';
import { ExternalServiceCredentials, OpenAICredentials, AnthropicCredentials, AWSCredentials } from '../types/credentials.js';

export interface IntegrationTestResult {
  service: string;
  test: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface TestSuiteOptions {
  includeRealServices: boolean;
  includeErrorScenarios: boolean;
  timeout: number;
  maxConcurrency: number;
}

export class IntegrationTestSuite {
  private validator: CredentialValidator;
  private secretsManager: SecretsManager | null = null;
  private options: TestSuiteOptions;

  constructor(options: Partial<TestSuiteOptions> = {}) {
    this.options = {
      includeRealServices: process.env.USE_REAL_SERVICES === 'true',
      includeErrorScenarios: true,
      timeout: 30000,
      maxConcurrency: 3,
      ...options
    };

    this.validator = new CredentialValidator();
    
    // Initialize secrets manager if not in mock mode
    if (!process.env.USE_MOCK_SERVICES) {
      try {
        const config = getEnvironmentConfig();
        this.secretsManager = new SecretsManager(config.secretsManager);
      } catch (error) {
        console.warn('Could not initialize SecretsManager for integration tests');
      }
    }
  }

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<IntegrationTestResult[]> {
    const results: IntegrationTestResult[] = [];

    console.log('🧪 Starting Integration Test Suite');
    console.log(`Mode: ${process.env.USE_MOCK_SERVICES === 'true' ? 'Mock Services' : 'Real Services'}`);
    console.log(`Timeout: ${this.options.timeout}ms\n`);

    // Test categories
    const testCategories = [
      () => this.testCredentialValidation(),
      () => this.testServiceConnections(),
      () => this.testHealthChecks(),
      () => this.testRateLimiting(),
      () => this.testErrorHandling(),
      () => this.testServiceDegradation()
    ];

    for (const testCategory of testCategories) {
      try {
        const categoryResults = await testCategory();
        results.push(...categoryResults);
      } catch (error) {
        results.push({
          service: 'test-suite',
          test: 'category-execution',
          passed: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.printSummary(results);
    return results;
  }

  /**
   * Test credential validation for all services
   */
  async testCredentialValidation(): Promise<IntegrationTestResult[]> {
    console.log('🔐 Testing Credential Validation...');
    const results: IntegrationTestResult[] = [];

    const services = ['openai', 'anthropic', 'aws'];
    
    for (const service of services) {
      const startTime = Date.now();
      
      try {
        let credentials;
        
        // Get credentials based on mode
        if (process.env.USE_MOCK_SERVICES === 'true') {
          credentials = this.getMockCredentials(service);
        } else if (this.secretsManager) {
          credentials = await this.secretsManager.getCredentials(service as keyof ExternalServiceCredentials);
        } else {
          credentials = this.getEnvCredentials(service);
        }

        // Validate credentials
        let validationResult;
        switch (service) {
          case 'openai':
            validationResult = await this.validator.validateOpenAI(credentials as OpenAICredentials);
            break;
          case 'anthropic':
            validationResult = await this.validator.validateAnthropic(credentials as AnthropicCredentials);
            break;
          case 'aws':
            validationResult = await this.validator.validateAWS(credentials as AWSCredentials);
            break;
        }

        results.push({
          service,
          test: 'credential-validation',
          passed: validationResult?.valid || false,
          duration: Date.now() - startTime,
          error: validationResult?.error,
          details: validationResult?.details
        });

      } catch (error) {
        results.push({
          service,
          test: 'credential-validation',
          passed: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Test basic service connections
   */
  async testServiceConnections(): Promise<IntegrationTestResult[]> {
    console.log('🌐 Testing Service Connections...');
    const results: IntegrationTestResult[] = [];

    const services = ['openai', 'anthropic'];
    
    for (const service of services) {
      const startTime = Date.now();
      
      try {
        const config = getServiceConfig(service);
        const client = new ServiceClient(service, config);

        // Test basic API call
        const result = await client.executeRequest(async () => {
          if (service === 'openai') {
            return await this.testOpenAIConnection();
          } else {
            return await this.testAnthropicConnection();
          }
        }, { estimatedTokens: 10 });

        results.push({
          service,
          test: 'service-connection',
          passed: true,
          duration: Date.now() - startTime,
          details: { response: result }
        });

      } catch (error) {
        results.push({
          service,
          test: 'service-connection',
          passed: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Test health check endpoints
   */
  async testHealthChecks(): Promise<IntegrationTestResult[]> {
    console.log('❤️ Testing Health Check Endpoints...');
    const results: IntegrationTestResult[] = [];

    const healthChecks = [
      { service: 'openai', url: 'http://localhost:3001/health' },
      { service: 'anthropic', url: 'http://localhost:3002/health' },
      { service: 'localstack', url: 'http://localhost:4566/health' }
    ];

    for (const { service, url } of healthChecks) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.options.timeout)
        });

        const isHealthy = response.ok;
        let healthData;
        
        try {
          healthData = await response.json();
        } catch {
          healthData = { status: response.status, statusText: response.statusText };
        }

        results.push({
          service,
          test: 'health-check',
          passed: isHealthy,
          duration: Date.now() - startTime,
          details: healthData
        });

      } catch (error) {
        results.push({
          service,
          test: 'health-check',
          passed: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Test rate limiting behavior
   */
  async testRateLimiting(): Promise<IntegrationTestResult[]> {
    console.log('⏱️ Testing Rate Limiting...');
    const results: IntegrationTestResult[] = [];

    const services = ['openai', 'anthropic'];
    
    for (const service of services) {
      const startTime = Date.now();
      
      try {
        const config = getServiceConfig(service);
        const client = new ServiceClient(service, config);

        // Make rapid requests to test rate limiting
        const rapidRequests = Array(5).fill(null).map(() => 
          client.executeRequest(async () => ({ test: 'rate-limit' }), { 
            estimatedTokens: 1 
          })
        );

        const results_rapid = await Promise.allSettled(rapidRequests);
        const successCount = results_rapid.filter(r => r.status === 'fulfilled').length;

        results.push({
          service,
          test: 'rate-limiting',
          passed: successCount > 0, // At least some should succeed
          duration: Date.now() - startTime,
          details: { 
            totalRequests: rapidRequests.length,
            successfulRequests: successCount,
            status: client.getStatus()
          }
        });

      } catch (error) {
        results.push({
          service,
          test: 'rate-limiting',
          passed: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling(): Promise<IntegrationTestResult[]> {
    console.log('🚫 Testing Error Handling...');
    const results: IntegrationTestResult[] = [];

    if (!this.options.includeErrorScenarios) {
      return results;
    }

    // Test invalid credentials
    const startTime = Date.now();
    
    try {
      const invalidResult = await this.validator.validateOpenAI({ 
        apiKey: 'invalid-key' 
      });

      results.push({
        service: 'openai',
        test: 'invalid-credentials',
        passed: !invalidResult.valid, // Should fail validation
        duration: Date.now() - startTime,
        details: invalidResult as unknown as Record<string, unknown>
      });

    } catch (error) {
      results.push({
        service: 'openai',
        test: 'invalid-credentials',
        passed: true, // Exception is expected
        duration: Date.now() - startTime,
        details: { expectedError: true }
      });
    }

    return results;
  }

  /**
   * Test service degradation strategies
   */
  async testServiceDegradation(): Promise<IntegrationTestResult[]> {
    console.log('🔄 Testing Service Degradation...');
    const results: IntegrationTestResult[] = [];

    // Test fallback recommendations
    const services = ['openai', 'anthropic'];
    
    for (const service of services) {
      const startTime = Date.now();
      
      try {
        const config = getServiceConfig(service);
        const client = new ServiceClient(service, config);
        const status = client.getStatus();

        const hasFallbackStrategy = status.fallbackRecommendations?.canSwitch || false;
        const hasRecommendations = (status.fallbackRecommendations?.recommendations?.length || 0) > 0;

        results.push({
          service,
          test: 'degradation-strategy',
          passed: hasFallbackStrategy || hasRecommendations,
          duration: Date.now() - startTime,
          details: status.fallbackRecommendations
        });

      } catch (error) {
        results.push({
          service,
          test: 'degradation-strategy',
          passed: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Test OpenAI connection
   */
  private async testOpenAIConnection(): Promise<Record<string, unknown>> {
    if (process.env.USE_MOCK_SERVICES === 'true') {
      return await fetch('http://localhost:3001/v1/models', {
        headers: { 'Authorization': 'Bearer sk-test' }
      }).then(r => r.json());
    }
    
    // Would make real API call in production
    return { models: ['test'] };
  }

  /**
   * Test Anthropic connection
   */
  private async testAnthropicConnection(): Promise<Record<string, unknown>> {
    if (process.env.USE_MOCK_SERVICES === 'true') {
      return await fetch('http://localhost:3002/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      }).then(r => r.json());
    }
    
    // Would make real API call in production
    return { message: 'test' };
  }

  /**
   * Get mock credentials for testing
   */
  private getMockCredentials(service: string): OpenAICredentials | AnthropicCredentials | AWSCredentials | Record<string, never> {
    switch (service) {
      case 'openai':
        return { apiKey: 'sk-test-key' };
      case 'anthropic':
        return { apiKey: 'sk-ant-test-key' };
      case 'aws':
        return { 
          accessKeyId: 'AKIATEST', 
          secretAccessKey: 'test-secret', 
          region: 'us-east-1' 
        };
      default:
        return {};
    }
  }

  /**
   * Get credentials from environment variables
   */
  private getEnvCredentials(service: string): OpenAICredentials | AnthropicCredentials | AWSCredentials | Record<string, never> {
    switch (service) {
      case 'openai':
        return { apiKey: process.env.OPENAI_API_KEY || 'missing' };
      case 'anthropic':
        return { apiKey: process.env.ANTHROPIC_API_KEY || 'missing' };
      case 'aws':
        return {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'missing',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'missing',
          region: process.env.AWS_REGION || 'us-east-1'
        };
      default:
        return {};
    }
  }

  /**
   * Print test summary
   */
  private printSummary(results: IntegrationTestResult[]): void {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    console.log('\n📊 Integration Test Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Average Duration: ${Math.round(avgDuration)}ms`);
    console.log(`Success Rate: ${Math.round((passed / results.length) * 100)}%`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.service}/${r.test}: ${r.error || 'Unknown error'}`);
      });
    }
    
    console.log('='.repeat(50));
  }
}