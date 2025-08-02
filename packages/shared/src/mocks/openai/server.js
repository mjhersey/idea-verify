#!/usr/bin/env node

/**
 * Standalone OpenAI Mock Server
 */

const { MockOpenAIService } = require('../../dist/mocks/openai/mock-openai-service.js');

const port = parseInt(process.env.PORT || '3001', 10);

const mockService = new MockOpenAIService({
  port,
  rateLimits: {
    requestsPerMinute: 1000,
    tokensPerMinute: 100000
  }
});

async function startServer() {
  try {
    await mockService.start();
    console.log(`Mock OpenAI API server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/v1/models`);
  } catch (error) {
    console.error('Failed to start mock OpenAI server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await mockService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await mockService.stop();
  process.exit(0);
});

startServer();