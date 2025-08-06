#!/usr/bin/env node

/**
 * Standalone Anthropic Mock Server
 */

const { MockAnthropicService } = require('../../dist/mocks/anthropic/mock-anthropic-service.js')

const port = parseInt(process.env.PORT || '3002', 10)

const mockService = new MockAnthropicService({
  port,
  rateLimits: {
    requestsPerMinute: 500,
    tokensPerMinute: 50000,
  },
})

async function startServer() {
  try {
    await mockService.start()
    console.log(`Mock Anthropic API server running on port ${port}`)
    console.log(`Health check: http://localhost:${port}/health`)
  } catch (error) {
    console.error('Failed to start mock Anthropic server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  await mockService.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...')
  await mockService.stop()
  process.exit(0)
})

startServer()
