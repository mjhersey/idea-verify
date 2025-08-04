/**
 * Test environment configurations for better environment separation
 */

export interface TestEnvironmentConfig {
  name: string;
  apiBaseUrl: string;
  webBaseUrl: string;
  databaseUrl?: string;
  redisUrl?: string;
  timeout: number;
  retryAttempts: number;
  authentication: {
    enabled: boolean;
    testUsers: {
      admin: { email: string; password: string };
      user: { email: string; password: string };
      readonly: { email: string; password: string };
    };
  };
  features: {
    enableDetailedLogging: boolean;
    enablePerformanceTesting: boolean;
    enableSecurityTesting: boolean;
    enableLoadTesting: boolean;
    skipSlowTests: boolean;
  };
  limits: {
    maxRequestsPerSecond: number;
    maxConcurrentUsers: number;
    testDataCleanupEnabled: boolean;
    cleanupDelayMs: number;
  };
  monitoring: {
    metricsEnabled: boolean;
    traceEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

const commonConfig = {
  retryAttempts: 3,
  authentication: {
    enabled: true,
    testUsers: {
      admin: { 
        email: 'admin@test.aivalidation.com', 
        password: 'TestAdmin123!' 
      },
      user: { 
        email: 'user@test.aivalidation.com', 
        password: 'TestUser123!' 
      },
      readonly: { 
        email: 'readonly@test.aivalidation.com', 
        password: 'TestReadonly123!' 
      },
    },
  },
};

export const testEnvironments: Record<string, TestEnvironmentConfig> = {
  local: {
    name: 'local',
    apiBaseUrl: 'http://localhost:3000',
    webBaseUrl: 'http://localhost:8080',
    databaseUrl: 'postgresql://aivalidation:password@localhost:5432/aivalidation_test',
    redisUrl: 'redis://localhost:6379/1',
    timeout: 10000,
    ...commonConfig,
    features: {
      enableDetailedLogging: true,
      enablePerformanceTesting: false,
      enableSecurityTesting: true,
      enableLoadTesting: false,
      skipSlowTests: false,
    },
    limits: {
      maxRequestsPerSecond: 10,
      maxConcurrentUsers: 5,
      testDataCleanupEnabled: true,
      cleanupDelayMs: 1000,
    },
    monitoring: {
      metricsEnabled: true,
      traceEnabled: true,
      logLevel: 'debug',
    },
  },
  
  dev: {
    name: 'dev',
    apiBaseUrl: 'https://dev.aivalidation.com',
    webBaseUrl: 'https://dev.aivalidation.com',
    timeout: 30000,
    ...commonConfig,
    features: {
      enableDetailedLogging: true,
      enablePerformanceTesting: true,
      enableSecurityTesting: true,
      enableLoadTesting: false,
      skipSlowTests: false,
    },
    limits: {
      maxRequestsPerSecond: 20,
      maxConcurrentUsers: 10,
      testDataCleanupEnabled: true,
      cleanupDelayMs: 2000,
    },
    monitoring: {
      metricsEnabled: true,
      traceEnabled: true,
      logLevel: 'info',
    },
  },
  
  staging: {
    name: 'staging',
    apiBaseUrl: 'https://staging.aivalidation.com',
    webBaseUrl: 'https://staging.aivalidation.com',
    timeout: 45000,
    ...commonConfig,
    authentication: {
      ...commonConfig.authentication,
      testUsers: {
        admin: { 
          email: 'admin@staging.aivalidation.com', 
          password: process.env.STAGING_ADMIN_PASSWORD || 'StagingAdmin123!' 
        },
        user: { 
          email: 'user@staging.aivalidation.com', 
          password: process.env.STAGING_USER_PASSWORD || 'StagingUser123!' 
        },
        readonly: { 
          email: 'readonly@staging.aivalidation.com', 
          password: process.env.STAGING_READONLY_PASSWORD || 'StagingReadonly123!' 
        },
      },
    },
    features: {
      enableDetailedLogging: true,
      enablePerformanceTesting: true,
      enableSecurityTesting: true,
      enableLoadTesting: true,
      skipSlowTests: false,
    },
    limits: {
      maxRequestsPerSecond: 50,
      maxConcurrentUsers: 25,
      testDataCleanupEnabled: true,
      cleanupDelayMs: 5000,
    },
    monitoring: {
      metricsEnabled: true,
      traceEnabled: false, // Reduce overhead in staging
      logLevel: 'info',
    },
  },
  
  prod: {
    name: 'prod',
    apiBaseUrl: 'https://aivalidation.com',
    webBaseUrl: 'https://aivalidation.com',
    timeout: 60000,
    retryAttempts: 5,
    authentication: {
      enabled: true,
      testUsers: {
        admin: { 
          email: process.env.PROD_ADMIN_EMAIL || 'admin@aivalidation.com', 
          password: process.env.PROD_ADMIN_PASSWORD || '' 
        },
        user: { 
          email: process.env.PROD_USER_EMAIL || 'user@aivalidation.com', 
          password: process.env.PROD_USER_PASSWORD || '' 
        },
        readonly: { 
          email: process.env.PROD_READONLY_EMAIL || 'readonly@aivalidation.com', 
          password: process.env.PROD_READONLY_PASSWORD || '' 
        },
      },
    },
    features: {
      enableDetailedLogging: false,
      enablePerformanceTesting: false, // Only run performance tests manually in prod
      enableSecurityTesting: false,    // Only run security tests manually in prod
      enableLoadTesting: false,        // Never run load tests in prod
      skipSlowTests: true,
    },
    limits: {
      maxRequestsPerSecond: 10,  // Conservative for production
      maxConcurrentUsers: 5,     // Limited concurrent tests in production
      testDataCleanupEnabled: true,
      cleanupDelayMs: 10000,     // Longer delays in production
    },
    monitoring: {
      metricsEnabled: false,     // Don't interfere with production metrics
      traceEnabled: false,
      logLevel: 'warn',
    },
  },
};

/**
 * Get test environment configuration
 */
export function getTestEnvironment(envName?: string): TestEnvironmentConfig {
  const environment = envName || process.env.TEST_ENVIRONMENT || 'local';
  
  const config = testEnvironments[environment];
  if (!config) {
    throw new Error(`Unknown test environment: ${environment}`);
  }
  
  // Validate required environment variables for production
  if (environment === 'prod') {
    const requiredEnvVars = [
      'PROD_ADMIN_EMAIL',
      'PROD_ADMIN_PASSWORD',
      'PROD_USER_EMAIL',
      'PROD_USER_PASSWORD',
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables for production testing: ${missingVars.join(', ')}`);
    }
  }
  
  return config;
}

/**
 * Check if a feature is enabled for the current environment
 */
export function isFeatureEnabled(feature: keyof TestEnvironmentConfig['features'], envName?: string): boolean {
  const config = getTestEnvironment(envName);
  return config.features[feature];
}

/**
 * Get test user credentials for authentication
 */
export function getTestUser(userType: 'admin' | 'user' | 'readonly', envName?: string) {
  const config = getTestEnvironment(envName);
  return config.authentication.testUsers[userType];
}

/**
 * Should skip slow tests based on environment configuration
 */
export function shouldSkipSlowTests(envName?: string): boolean {
  const config = getTestEnvironment(envName);
  return config.features.skipSlowTests;
}

/**
 * Get rate limiting configuration for tests
 */
export function getRateLimits(envName?: string) {
  const config = getTestEnvironment(envName);
  return {
    maxRequestsPerSecond: config.limits.maxRequestsPerSecond,
    maxConcurrentUsers: config.limits.maxConcurrentUsers,
  };
}

/**
 * Create a delay based on environment settings
 */
export function createEnvironmentDelay(envName?: string): Promise<void> {
  const config = getTestEnvironment(envName);
  return new Promise(resolve => {
    setTimeout(resolve, config.limits.cleanupDelayMs);
  });
}

/**
 * Get logging configuration for tests
 */
export function getLoggingConfig(envName?: string) {
  const config = getTestEnvironment(envName);
  return {
    level: config.monitoring.logLevel,
    enableMetrics: config.monitoring.metricsEnabled,
    enableTrace: config.monitoring.traceEnabled,
    enableDetailedLogging: config.features.enableDetailedLogging,
  };
}