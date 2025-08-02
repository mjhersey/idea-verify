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
export declare const OPENAI_RATE_LIMITS: RateLimitConfig;
export declare const OPENAI_QUOTA_CONFIG: QuotaConfig;
/**
 * Anthropic Claude API Rate Limits
 * Based on tier and model usage
 */
export declare const ANTHROPIC_RATE_LIMITS: RateLimitConfig;
export declare const ANTHROPIC_QUOTA_CONFIG: QuotaConfig;
/**
 * AWS Services Rate Limits
 * Conservative limits for development
 */
export declare const AWS_RATE_LIMITS: RateLimitConfig;
export declare const AWS_QUOTA_CONFIG: QuotaConfig;
/**
 * Mock Services Configuration (for development)
 */
export declare const MOCK_RATE_LIMITS: RateLimitConfig;
export declare const MOCK_QUOTA_CONFIG: QuotaConfig;
/**
 * Service Client Configurations
 */
export declare const SERVICE_CONFIGS: Record<string, ServiceClientConfig>;
/**
 * Get configuration for a service with environment-based overrides
 */
export declare function getServiceConfig(serviceName: string): ServiceClientConfig;
/**
 * Rate limit documentation for each service
 */
export declare const RATE_LIMIT_DOCS: {
    openai: {
        description: string;
        tiers: {
            'Tier 1': {
                rpm: number;
                tpm: number;
            };
            'Tier 2': {
                rpm: number;
                tpm: number;
            };
            'Tier 3': {
                rpm: number;
                tpm: number;
            };
        };
        upgradeInfo: string;
        documentation: string;
    };
    anthropic: {
        description: string;
        tiers: {
            Developer: {
                rpm: number;
                tpm: number;
            };
            Build: {
                rpm: number;
                tpm: number;
            };
            Scale: {
                rpm: number;
                tpm: number;
            };
        };
        upgradeInfo: string;
        documentation: string;
    };
    aws: {
        description: string;
        services: {
            'Secrets Manager': {
                rpm: number;
                burst: number;
            };
            S3: {
                rpm: number;
                burst: number;
            };
            IAM: {
                rpm: number;
                burst: number;
            };
        };
        upgradeInfo: string;
        documentation: string;
    };
};
//# sourceMappingURL=rate-limit-configs.d.ts.map