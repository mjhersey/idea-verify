#!/usr/bin/env node

/**
 * Mock Services Management CLI
 * Start, stop, and manage all mock services for development
 */

const { MockServiceManager } = require('../packages/shared/dist/mocks/mock-service-manager.js');

const DEFAULT_CONFIG = {
  openai: {
    port: 3001,
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000
    }
  },
  anthropic: {
    port: 3002,
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 50000
    }
  },
  localstack: {
    endpoint: 'http://localhost:4566',
    services: ['s3', 'secretsmanager', 'iam', 'sts']
  }
};

const manager = new MockServiceManager(DEFAULT_CONFIG);

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await handleStart();
      break;
    case 'stop':
      await handleStop();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'validate':
      await handleValidate();
      break;
    case 'restart':
      await handleRestart();
      break;
    default:
      showHelp();
      process.exit(1);
  }
}

async function handleStart() {
  try {
    console.log('🚀 Starting mock services...');
    await manager.startAll();
    
    // Keep the process running
    console.log('\n📋 Mock services are running. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down mock services...');
      await manager.stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down mock services...');
      await manager.stopAll();
      process.exit(0);
    });

    // Keep alive
    setInterval(() => {}, 1000);
  } catch (error) {
    console.error('❌ Failed to start services:', error.message);
    process.exit(1);
  }
}

async function handleStop() {
  try {
    await manager.stopAll();
    console.log('✅ Mock services stopped');
  } catch (error) {
    console.error('❌ Failed to stop services:', error.message);
    process.exit(1);
  }
}

async function handleStatus() {
  const status = manager.getStatus();
  
  console.log('📊 Mock Services Status\n');
  console.log(`Overall Status: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}\n`);
  
  if (status.isRunning) {
    console.log('Services:');
    console.log(`  🤖 OpenAI Mock:     ${status.services.openai.url}`);
    console.log(`  🧠 Anthropic Mock:  ${status.services.anthropic.url}`);
    console.log(`  ☁️  LocalStack:      ${status.services.localstack.endpoint}`);
    console.log('\nHealth Checks:');
    console.log(`  OpenAI:    GET ${status.services.openai.healthCheck}`);
    console.log(`  Anthropic: GET ${status.services.anthropic.healthCheck}`);
    console.log(`  LocalStack: GET ${status.services.localstack.endpoint}/health`);
  } else {
    console.log('All services are stopped.');
    console.log('Run "npm run mock:start" to start services.');
  }
}

async function handleValidate() {
  console.log('🔍 Validating mock services...');
  
  const isValid = await manager.validateServices();
  
  if (isValid) {
    console.log('✅ All mock services are responding correctly');
    process.exit(0);
  } else {
    console.log('❌ Some mock services are not responding');
    process.exit(1);
  }
}

async function handleRestart() {
  try {
    console.log('🔄 Restarting mock services...');
    await manager.stopAll();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await manager.startAll();
    console.log('✅ Mock services restarted successfully');
  } catch (error) {
    console.error('❌ Failed to restart services:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Mock Services Management CLI

Usage: npm run mock:<command>

Commands:
  start     Start all mock services (OpenAI, Anthropic, LocalStack)
  stop      Stop all mock services
  status    Show current status of all services
  validate  Test that all services are responding
  restart   Stop and start all services

Examples:
  npm run mock:start     # Start services and keep running
  npm run mock:status    # Check if services are running
  npm run mock:validate  # Test service connectivity
  npm run mock:stop      # Stop all services

For LocalStack (S3, Secrets Manager), also run:
  docker-compose up localstack

Mock Service Endpoints:
  OpenAI:    http://localhost:3001/v1/
  Anthropic: http://localhost:3002/v1/
  LocalStack: http://localhost:4566/
`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Run the CLI
main().catch(error => {
  console.error('❌ CLI Error:', error);
  process.exit(1);
});