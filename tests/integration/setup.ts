/**
 * Integration Test Setup
 */

import { beforeAll, afterAll } from 'vitest';
import { createLogger } from '../../packages/shared/src/utils/logger.js';

const logger = createLogger('integration-test-setup');

// Global test configuration
const testConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  environment: process.env.TEST_ENVIRONMENT || 'dev',
  timeout: parseInt(process.env.TEST_TIMEOUT || '60000'),
  maxRetries: parseInt(process.env.TEST_MAX_RETRIES || '3'),
};

// Global setup
beforeAll(async () => {
  logger.info('Starting integration test suite', testConfig);
  
  // Validate required environment variables
  const requiredEnvVars = ['TEST_BASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.warn('Missing environment variables', { missingVars });
  }
  
  // Wait for services to be ready (basic connectivity check)
  await waitForServices();
}, testConfig.timeout);

// Global cleanup
afterAll(async () => {
  logger.info('Integration test suite completed');
});

async function waitForServices(maxAttempts: number = 10): Promise<void> {
  logger.info('Waiting for services to be ready', { baseUrl: testConfig.baseUrl });
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${testConfig.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        logger.info('Services are ready', { attempt });
        return;
      }
      
      logger.warn('Health check failed', { attempt, status: response.status });
    } catch (error) {
      logger.warn('Health check error', { attempt, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
  }
  
  throw new Error(`Services not ready after ${maxAttempts} attempts`);
}

// Export test utilities
export { testConfig };

// Make fetch available globally if needed
if (typeof globalThis.fetch === 'undefined') {
  const { fetch } = await import('node-fetch');
  globalThis.fetch = fetch as any;
}