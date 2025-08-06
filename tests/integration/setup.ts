/**
 * Integration Test Setup
 */

import { beforeAll, afterAll } from 'vitest';
import { createLogger } from '../../packages/shared/src/utils/logger.js';
import { io, Socket } from 'socket.io-client';

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
  logger.info('Starting integration test suite');
  
  // Validate required environment variables
  const requiredEnvVars = ['TEST_BASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.warn('Missing environment variables: ' + missingVars.join(', '));
  }
  
  // Wait for services to be ready (basic connectivity check)
  await waitForServices();
  
  // Check WebSocket service availability
  try {
    await waitForWebSocketService();
  } catch (error) {
    logger.warn('WebSocket service not available, some tests may be skipped');
  }
}, testConfig.timeout);

// Global cleanup
afterAll(async () => {
  logger.info('Integration test suite completed');
  
  // Cleanup WebSocket connections
  wsTestHelper.disconnectAll();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

async function waitForServices(maxAttempts: number = 10): Promise<void> {
  logger.info(`Waiting for services to be ready at ${testConfig.baseUrl}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${testConfig.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        logger.info(`Services are ready (attempt ${attempt})`);
        return;
      }
      
      logger.warn(`Health check failed (attempt ${attempt}, status: ${response.status})`);
    } catch (error) {
      logger.warn(`Health check error (attempt ${attempt}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
  }
  
  throw new Error(`Services not ready after ${maxAttempts} attempts`);
}

// WebSocket test utilities
export class WebSocketTestHelper {
  private sockets: Socket[] = [];

  async createSocket(token: string, options: any = {}): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${testConfig.baseUrl}/evaluation-progress`, {
        auth: { token },
        transports: ['websocket'],
        timeout: 10000,
        ...options
      });

      this.sockets.push(socket);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 15000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  disconnectAll(): void {
    this.sockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    this.sockets.length = 0;
  }

  getActiveSocketCount(): number {
    return this.sockets.filter(socket => socket.connected).length;
  }
}

// Export test utilities
export { testConfig };

// Global WebSocket test helper instance
export const wsTestHelper = new WebSocketTestHelper();

// Make fetch available globally if needed
if (typeof globalThis.fetch === 'undefined') {
  // @ts-ignore - Node.js 18+ has native fetch
  globalThis.fetch = globalThis.fetch || require('node-fetch');
}

// Add WebSocket service readiness check
async function waitForWebSocketService(): Promise<void> {
  logger.info('Checking WebSocket service availability');
  
  try {
    const testSocket = await wsTestHelper.createSocket('health-check-token');
    testSocket.disconnect();
    logger.info('WebSocket service is ready');
  } catch (error) {
    logger.warn('WebSocket service check failed:', error);
    throw new Error('WebSocket service not available');
  }
}