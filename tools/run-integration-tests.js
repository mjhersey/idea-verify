#!/usr/bin/env node

/**
 * Integration Test Runner
 * Runs comprehensive integration tests for all external services
 */

const {
  IntegrationTestSuite,
} = require('../packages/shared/dist/testing/integration-test-suite.js')

async function runIntegrationTests() {
  console.log('🚀 Integration Test Runner')
  console.log('Testing external service integrations...\n')

  const options = {
    includeRealServices: process.env.USE_REAL_SERVICES === 'true',
    includeErrorScenarios: process.env.SKIP_ERROR_TESTS !== 'true',
    timeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10),
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '3', 10),
  }

  console.log('Configuration:')
  console.log(`  Real Services: ${options.includeRealServices ? 'Enabled' : 'Disabled'}`)
  console.log(`  Error Scenarios: ${options.includeErrorScenarios ? 'Enabled' : 'Disabled'}`)
  console.log(`  Timeout: ${options.timeout}ms`)
  console.log(`  Max Concurrency: ${options.maxConcurrency}\n`)

  try {
    const testSuite = new IntegrationTestSuite(options)
    const results = await testSuite.runAllTests()

    // Exit with appropriate code
    const failedTests = results.filter(r => !r.passed)
    if (failedTests.length > 0) {
      console.error(`\n❌ ${failedTests.length} test(s) failed`)
      process.exit(1)
    } else {
      console.log('\n✅ All integration tests passed!')
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ Integration test suite failed:', error.message)
    process.exit(1)
  }
}

// Handle command line arguments
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Integration Test Runner

Usage: npm run test:integration [options]

Options:
  --real-services    Use real external services instead of mocks
  --skip-errors      Skip error scenario testing
  --timeout=<ms>     Set timeout for individual tests (default: 30000)
  --concurrency=<n>  Set max concurrent tests (default: 3)

Environment Variables:
  USE_REAL_SERVICES=true     Enable real service testing
  USE_MOCK_SERVICES=true     Enable mock service mode (default)
  SKIP_ERROR_TESTS=true      Skip error scenario tests
  TEST_TIMEOUT=<ms>          Set test timeout
  MAX_CONCURRENCY=<n>        Set max concurrency

Examples:
  npm run test:integration                    # Run with mock services
  USE_REAL_SERVICES=true npm run test:integration  # Run with real services
  TEST_TIMEOUT=60000 npm run test:integration      # Extended timeout
`)
  process.exit(0)
}

// Parse command line arguments
if (args.includes('--real-services')) {
  process.env.USE_REAL_SERVICES = 'true'
}
if (args.includes('--skip-errors')) {
  process.env.SKIP_ERROR_TESTS = 'true'
}

const timeoutArg = args.find(arg => arg.startsWith('--timeout='))
if (timeoutArg) {
  process.env.TEST_TIMEOUT = timeoutArg.split('=')[1]
}

const concurrencyArg = args.find(arg => arg.startsWith('--concurrency='))
if (concurrencyArg) {
  process.env.MAX_CONCURRENCY = concurrencyArg.split('=')[1]
}

// Run the tests
runIntegrationTests()
