/**
 * Service Client with Rate Limiting and Quota Management
 * Integrates rate limiting, quota monitoring, and fallback strategies
 */
import { RateLimitConfig, RateLimitStatus } from './rate-limiter.js';
import { QuotaConfig, QuotaStatus } from './quota-monitor.js';
export interface ServiceClientConfig {
    rateLimiting: RateLimitConfig;
    quotaMonitoring: QuotaConfig;
    fallbackEnabled: boolean;
    fallbackServices?: string[];
}
export interface RequestOptions {
    estimatedTokens?: number;
    estimatedCost?: number;
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
}
export declare class ServiceClient {
    private rateLimiter;
    private quotaMonitor;
    private config;
    private serviceName;
    constructor(serviceName: string, config: ServiceClientConfig);
    /**
     * Execute a request with full rate limiting and quota management
     */
    executeRequest<T>(requestFn: () => Promise<T>, options?: RequestOptions): Promise<T>;
    /**
     * Get current service status
     */
    getStatus(): {
        rateLimitStatus: RateLimitStatus | null;
        quotaStatus: {
            requests: QuotaStatus;
            tokens: QuotaStatus;
            cost: QuotaStatus;
        } | null;
        fallbackRecommendations: {
            canSwitch: boolean;
            alternatives: string[];
            recommendations: string[];
        };
    };
    /**
     * Handle quota alerts
     */
    private handleQuotaAlert;
    /**
     * Check if fallback should be used based on error
     */
    private shouldUseFallback;
    /**
     * Get recommended fallback service
     */
    private getFallbackService;
    /**
     * Reset quota counters (for testing or manual reset)
     */
    resetQuotas(type?: 'daily' | 'monthly' | 'all'): void;
}
//# sourceMappingURL=service-client.d.ts.map