import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test files
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],

    // Environment
    environment: 'node',

    // Timeouts
    testTimeout: 60000, // 60 seconds per test
    hookTimeout: 30000, // 30 seconds per hook

    // Reporters
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: 'integration-test-results.xml',
    },

    // Coverage (optional for integration tests)
    coverage: {
      enabled: false, // Integration tests don't need coverage
    },

    // Globals
    globals: true,

    // Setup files
    setupFiles: ['tests/integration/setup.ts'],

    // Pool options for better resource management
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid resource conflicts
      },
    },

    // Retry failed tests
    retry: 1,

    // Bail after first failure in CI
    bail: process.env.CI ? 1 : 0,
  },
})
