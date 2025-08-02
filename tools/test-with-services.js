#!/usr/bin/env node

/**
 * Integration Test with Mock Services
 * Starts mock services, runs integration tests, then cleans up
 */

const { MockServiceManager } = require('../packages/shared/dist/mocks/mock-service-manager.js');
const { spawn } = require('child_process');

const mockConfig = {
  openai: {
    port: 3001,
    rateLimits: { requestsPerMinute: 1000, tokensPerMinute: 100000 }
  },
  anthropic: {
    port: 3002,
    rateLimits: { requestsPerMinute: 500, tokensPerMinute: 50000 }
  },
  localstack: {
    endpoint: 'http://localhost:4566',
    services: ['s3', 'secretsmanager', 'iam', 'sts']
  }
};

async function runTestsWithServices() {
  console.log('🚀 Starting Integration Tests with Mock Services\n');

  const manager = new MockServiceManager(mockConfig);
  
  try {
    // Start mock services
    console.log('1️⃣ Starting mock services...');
    await manager.startAll();
    
    // Wait for services to be ready
    console.log('2️⃣ Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Validate services are running
    console.log('3️⃣ Validating service readiness...');
    const isReady = await manager.validateServices();
    
    if (!isReady) {
      console.error('❌ Mock services are not ready');
      process.exit(1);
    }
    
    console.log('✅ Mock services are ready\n');
    
    // Run integration tests
    console.log('4️⃣ Running integration tests...');
    const testProcess = spawn('node', ['tools/run-integration-tests.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        USE_MOCK_SERVICES: 'true'
      }
    });
    
    const exitCode = await new Promise((resolve) => {
      testProcess.on('close', resolve);
    });
    
    console.log(`\n5️⃣ Integration tests completed with exit code: ${exitCode}`);
    
    if (exitCode === 0) {
      console.log('✅ All integration tests passed!');
    } else {
      console.log(`❌ ${exitCode > 0 ? 'Some tests failed' : 'Tests were interrupted'}`);
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Error running tests with services:', error.message);
    process.exit(1);
  } finally {
    // Clean up services
    console.log('\n🧹 Cleaning up mock services...');
    await manager.stopAll();
    console.log('✅ Cleanup complete');
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Test terminated, cleaning up...');
  process.exit(143);
});

// Run tests
runTestsWithServices().catch(error => {
  console.error('❌ Failed to run tests:', error);
  process.exit(1);
});