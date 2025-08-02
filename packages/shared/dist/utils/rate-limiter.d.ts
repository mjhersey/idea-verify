/**
 * Rate Limiting and Quota Management
 * Implements retry logic with exponential backoff and quota monitoring
 */
export interface RateLimitConfig {
    requestsPerMinute: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
    tokensPerMinute?: number;
    tokensPerHour?: number;
    tokensPerDay?: number;
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterEnabled: boolean;
}
export interface RateLimitStatus {
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
    hourly?: {
        remaining: number;
        resetTime: Date;
    };
    daily?: {
        remaining: number;
        resetTime: Date;
    };
}
export declare class RateLimiter {
    private requestCounts;
    private tokenCounts;
    private resetTimes;
    private hourlyRequestCounts;
    private hourlyTokenCounts;
    private hourlyResetTimes;
    private dailyRequestCounts;
    private dailyTokenCounts;
    private dailyResetTimes;
    private config;
    constructor(config: RateLimitConfig);
    /**
     * Check if request is allowed under rate limits
     */
    isRequestAllowed(service: string, tokenCount?: number): boolean;
    /**
     * Record a request and token usage
     */
    recordRequest(service: string, tokenCount?: number): void;
    /**
     * Get current rate limit status
     */
    getRateLimitStatus(service: string): RateLimitStatus;
    /**
     * Reset expired counters for a service
     */
    private resetExpiredCounters;
    /**
     * Execute request with exponential backoff retry logic
     */
    executeWithRetry<T>(service: string, requestFn: () => Promise<T>, estimatedTokens?: number): Promise<T>;
    /**
     * Calculate exponential backoff delay with jitter
     */
    private calculateBackoffDelay;
    /**
     * Check if error is rate limit related
     */
    private isRateLimitError;
    /**
     * Check if error is retryable
     */
    private isRetryableError;
    /**
     * Extract retry-after header value
     */
    private extractRetryAfter;
    /**
     * Sleep for specified milliseconds
     */
    private delay;
}
//# sourceMappingURL=rate-limiter.d.ts.map