/**
 * Rate Limiting Configurations for External Services
 * Defines rate limits and quota settings for each service
 */

import { RateLimitConfig } from '../utils/rate-limiter.js';
import { QuotaConfig } from '../utils/quota-monitor.js';
import { ServiceClientConfig } from '../utils/service-client.js';

/**
 * OpenAI API Rate Limits (as of 2024)
 * Based on tier and model usage
 */
export const OPENAI_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 500,    // Tier 1 default
  requestsPerHour: 10000,
  requestsPerDay: 200000,
  tokensPerMinute: 30000,    // Tier 1 default for GPT-4
  tokensPerHour: 1000000,
  tokensPerDay: 10000000,
  maxRetries: 3,
  baseDelayMs: 1000,         // 1 second base delay
  maxDelayMs: 60000,         // Max 60 seconds
  jitterEnabled: true
};

export const OPENAI_QUOTA_CONFIG: QuotaConfig = {
  dailyLimit: 200000,        // Daily request limit
  monthlyLimit: 10000000,    // Monthly token limit
  costLimit: 100,            // $100 monthly cost limit
  alertThresholds: [50, 75, 90, 95], // Alert at these percentages
};

/**
 * Anthropic Claude API Rate Limits
 * Based on tier and model usage
 */
export const ANTHROPIC_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 100,    // Default tier
  requestsPerHour: 5000,
  requestsPerDay: 100000,
  tokensPerMinute: 10000,    // Input + output tokens
  tokensPerHour: 500000,
  tokensPerDay: 5000000,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  jitterEnabled: true
};

export const ANTHROPIC_QUOTA_CONFIG: QuotaConfig = {
  dailyLimit: 100000,
  monthlyLimit: 5000000,
  costLimit: 100,
  alertThresholds: [50, 75, 90, 95],
};

/**
 * AWS Services Rate Limits
 * Conservative limits for development
 */
export const AWS_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 1000,   // Secrets Manager has high limits
  requestsPerHour: 50000,
  requestsPerDay: 1000000,
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30000,
  jitterEnabled: true
};

export const AWS_QUOTA_CONFIG: QuotaConfig = {
  dailyLimit: 1000000,
  monthlyLimit: 30000000,
  costLimit: 50,             // $50 monthly AWS costs
  alertThresholds: [60, 80, 95],
};

/**
 * Mock Services Configuration (for development)
 */
export const MOCK_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 1000,   // High limits for development
  tokensPerMinute: 100000,
  maxRetries: 1,             // Don't retry much in mock mode
  baseDelayMs: 100,
  maxDelayMs: 1000,
  jitterEnabled: false       // No jitter needed for mocks
};

export const MOCK_QUOTA_CONFIG: QuotaConfig = {
  dailyLimit: 100000,
  monthlyLimit: 1000000,
  costLimit: 0,              // No cost for mock services
  alertThresholds: [90],     // Only alert at 90% for mocks
};

/**
 * Service Client Configurations
 */
export const SERVICE_CONFIGS: Record<string, ServiceClientConfig> = {
  openai: {
    rateLimiting: OPENAI_RATE_LIMITS,
    quotaMonitoring: OPENAI_QUOTA_CONFIG,
    fallbackEnabled: true,
    fallbackServices: ['anthropic', 'mock-openai']
  },
  
  anthropic: {
    rateLimiting: ANTHROPIC_RATE_LIMITS,
    quotaMonitoring: ANTHROPIC_QUOTA_CONFIG,
    fallbackEnabled: true,
    fallbackServices: ['openai', 'mock-anthropic']
  },
  
  aws: {
    rateLimiting: AWS_RATE_LIMITS,
    quotaMonitoring: AWS_QUOTA_CONFIG,
    fallbackEnabled: false,    // No fallback for AWS services
    fallbackServices: []
  },
  
  'mock-openai': {
    rateLimiting: MOCK_RATE_LIMITS,
    quotaMonitoring: MOCK_QUOTA_CONFIG,
    fallbackEnabled: false,
    fallbackServices: []
  },
  
  'mock-anthropic': {
    rateLimiting: MOCK_RATE_LIMITS,
    quotaMonitoring: MOCK_QUOTA_CONFIG,
    fallbackEnabled: false,
    fallbackServices: []
  }
};

/**
 * Get configuration for a service with environment-based overrides
 */
export function getServiceConfig(serviceName: string): ServiceClientConfig {
  const baseConfig = SERVICE_CONFIGS[serviceName];
  
  if (!baseConfig) {
    throw new Error(`No configuration found for service: ${serviceName}`);
  }

  // Override with mock configurations in development
  if (process.env.USE_MOCK_SERVICES === 'true') {
    return {
      ...baseConfig,
      rateLimiting: MOCK_RATE_LIMITS,
      quotaMonitoring: MOCK_QUOTA_CONFIG
    };
  }

  return baseConfig;
}

/**
 * Rate limit documentation for each service
 */
export const RATE_LIMIT_DOCS = {
  openai: {
    description: 'OpenAI API rate limits vary by tier and model',
    tiers: {
      'Tier 1': { rpm: 500, tpm: 30000 },
      'Tier 2': { rpm: 5000, tpm: 450000 },
      'Tier 3': { rpm: 5000, tpm: 1000000 }
    },
    upgradeInfo: 'Upgrade tier by spending $100+ and waiting 7+ days',
    documentation: 'https://platform.openai.com/docs/guides/rate-limits'
  },
  
  anthropic: {
    description: 'Anthropic Claude API rate limits based on usage tier',
    tiers: {
      'Developer': { rpm: 100, tpm: 10000 },
      'Build': { rpm: 1000, tpm: 40000 },
      'Scale': { rpm: 2000, tpm: 100000 }
    },
    upgradeInfo: 'Contact Anthropic for tier upgrades',
    documentation: 'https://docs.anthropic.com/claude/reference/rate-limits'
  },
  
  aws: {
    description: 'AWS service limits vary by service and region',
    services: {
      'Secrets Manager': { rpm: 5000, burst: 10000 },
      'S3': { rpm: 3500, burst: 5500 },
      'IAM': { rpm: 1000, burst: 2000 }
    },
    upgradeInfo: 'Request limit increases through AWS Support',
    documentation: 'https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html'
  }
};