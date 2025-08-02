"use strict";
/**
 * Rate Limiting and Quota Management
 * Implements retry logic with exponential backoff and quota monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    requestCounts = new Map();
    tokenCounts = new Map();
    resetTimes = new Map();
    // Hourly tracking
    hourlyRequestCounts = new Map();
    hourlyTokenCounts = new Map();
    hourlyResetTimes = new Map();
    // Daily tracking
    dailyRequestCounts = new Map();
    dailyTokenCounts = new Map();
    dailyResetTimes = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if request is allowed under rate limits
     */
    isRequestAllowed(service, tokenCount = 0) {
        const now = new Date();
        // Reset counters if time windows have passed
        this.resetExpiredCounters(service, now);
        const currentRequests = this.requestCounts.get(service) || 0;
        const currentTokens = this.tokenCounts.get(service) || 0;
        const currentHourlyRequests = this.hourlyRequestCounts.get(service) || 0;
        const currentHourlyTokens = this.hourlyTokenCounts.get(service) || 0;
        const currentDailyRequests = this.dailyRequestCounts.get(service) || 0;
        const currentDailyTokens = this.dailyTokenCounts.get(service) || 0;
        // Check minute limits
        if (currentRequests >= this.config.requestsPerMinute) {
            return false;
        }
        if (this.config.tokensPerMinute && (currentTokens + tokenCount) > this.config.tokensPerMinute) {
            return false;
        }
        // Check hourly limits
        if (this.config.requestsPerHour && currentHourlyRequests >= this.config.requestsPerHour) {
            return false;
        }
        if (this.config.tokensPerHour && (currentHourlyTokens + tokenCount) > this.config.tokensPerHour) {
            return false;
        }
        // Check daily limits
        if (this.config.requestsPerDay && currentDailyRequests >= this.config.requestsPerDay) {
            return false;
        }
        if (this.config.tokensPerDay && (currentDailyTokens + tokenCount) > this.config.tokensPerDay) {
            return false;
        }
        return true;
    }
    /**
     * Record a request and token usage
     */
    recordRequest(service, tokenCount = 0) {
        // Update minute counters
        const currentRequests = this.requestCounts.get(service) || 0;
        const currentTokens = this.tokenCounts.get(service) || 0;
        this.requestCounts.set(service, currentRequests + 1);
        this.tokenCounts.set(service, currentTokens + tokenCount);
        // Update hourly counters
        const currentHourlyRequests = this.hourlyRequestCounts.get(service) || 0;
        const currentHourlyTokens = this.hourlyTokenCounts.get(service) || 0;
        this.hourlyRequestCounts.set(service, currentHourlyRequests + 1);
        this.hourlyTokenCounts.set(service, currentHourlyTokens + tokenCount);
        // Update daily counters
        const currentDailyRequests = this.dailyRequestCounts.get(service) || 0;
        const currentDailyTokens = this.dailyTokenCounts.get(service) || 0;
        this.dailyRequestCounts.set(service, currentDailyRequests + 1);
        this.dailyTokenCounts.set(service, currentDailyTokens + tokenCount);
        // Set reset times if not already set
        const now = Date.now();
        if (!this.resetTimes.has(service)) {
            this.resetTimes.set(service, new Date(now + 60000)); // 1 minute from now
        }
        if (!this.hourlyResetTimes.has(service)) {
            this.hourlyResetTimes.set(service, new Date(now + 3600000)); // 1 hour from now
        }
        if (!this.dailyResetTimes.has(service)) {
            this.dailyResetTimes.set(service, new Date(now + 86400000)); // 1 day from now
        }
    }
    /**
     * Get current rate limit status
     */
    getRateLimitStatus(service) {
        const currentRequests = this.requestCounts.get(service) || 0;
        const resetTime = this.resetTimes.get(service) || new Date(Date.now() + 60000);
        const remaining = Math.max(0, this.config.requestsPerMinute - currentRequests);
        const status = {
            remaining,
            resetTime,
            retryAfter: remaining === 0 ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : undefined
        };
        // Add hourly status if configured
        if (this.config.requestsPerHour) {
            const currentHourlyRequests = this.hourlyRequestCounts.get(service) || 0;
            const hourlyResetTime = this.hourlyResetTimes.get(service) || new Date(Date.now() + 3600000);
            status.hourly = {
                remaining: Math.max(0, this.config.requestsPerHour - currentHourlyRequests),
                resetTime: hourlyResetTime
            };
        }
        // Add daily status if configured
        if (this.config.requestsPerDay) {
            const currentDailyRequests = this.dailyRequestCounts.get(service) || 0;
            const dailyResetTime = this.dailyResetTimes.get(service) || new Date(Date.now() + 86400000);
            status.daily = {
                remaining: Math.max(0, this.config.requestsPerDay - currentDailyRequests),
                resetTime: dailyResetTime
            };
        }
        return status;
    }
    /**
     * Reset expired counters for a service
     */
    resetExpiredCounters(service, now) {
        // Check minute window
        const minuteResetTime = this.resetTimes.get(service);
        if (!minuteResetTime || now >= minuteResetTime) {
            this.requestCounts.set(service, 0);
            this.tokenCounts.set(service, 0);
            this.resetTimes.set(service, new Date(now.getTime() + 60000));
        }
        // Check hourly window
        const hourlyResetTime = this.hourlyResetTimes.get(service);
        if (!hourlyResetTime || now >= hourlyResetTime) {
            this.hourlyRequestCounts.set(service, 0);
            this.hourlyTokenCounts.set(service, 0);
            this.hourlyResetTimes.set(service, new Date(now.getTime() + 3600000));
        }
        // Check daily window
        const dailyResetTime = this.dailyResetTimes.get(service);
        if (!dailyResetTime || now >= dailyResetTime) {
            this.dailyRequestCounts.set(service, 0);
            this.dailyTokenCounts.set(service, 0);
            this.dailyResetTimes.set(service, new Date(now.getTime() + 86400000));
        }
    }
    /**
     * Execute request with exponential backoff retry logic
     */
    async executeWithRetry(service, requestFn, estimatedTokens = 0) {
        let attempt = 0;
        let lastError;
        while (attempt <= this.config.maxRetries) {
            try {
                // Check rate limits before attempting
                if (!this.isRequestAllowed(service, estimatedTokens)) {
                    const status = this.getRateLimitStatus(service);
                    if (status.retryAfter) {
                        await this.delay(status.retryAfter * 1000);
                        continue;
                    }
                }
                // Execute the request
                const result = await requestFn();
                // Record successful request
                this.recordRequest(service, estimatedTokens);
                return result;
            }
            catch (error) {
                lastError = error;
                attempt++;
                // Check if it's a rate limit error
                if (this.isRateLimitError(error)) {
                    const retryAfter = this.extractRetryAfter(error);
                    if (retryAfter) {
                        await this.delay(retryAfter * 1000);
                        continue;
                    }
                }
                // Don't retry on non-retryable errors
                if (!this.isRetryableError(error)) {
                    throw error;
                }
                // Calculate backoff delay (only if we haven't exceeded max retries)
                if (attempt < this.config.maxRetries) {
                    const delay = this.calculateBackoffDelay(attempt);
                    await this.delay(delay);
                }
            }
        }
        throw new Error(`Request failed after ${this.config.maxRetries} retries. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    /**
     * Calculate exponential backoff delay with jitter
     */
    calculateBackoffDelay(attempt) {
        const exponentialDelay = Math.min(this.config.baseDelayMs * Math.pow(2, attempt - 1), this.config.maxDelayMs);
        if (this.config.jitterEnabled) {
            // Add jitter (±25% of the delay)
            const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
            return Math.max(0, exponentialDelay + jitter);
        }
        return exponentialDelay;
    }
    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        if (error.status === 429)
            return true;
        if (error.code === 'rate_limit_exceeded')
            return true;
        if (error.message?.toLowerCase().includes('rate limit'))
            return true;
        return false;
    }
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        // Rate limit errors are retryable
        if (this.isRateLimitError(error))
            return true;
        // Network errors are retryable
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')
            return true;
        if (error.message?.toLowerCase().includes('network'))
            return true;
        if (error.message?.toLowerCase().includes('persistent'))
            return true;
        // 5xx server errors are retryable
        if (error.status && error.status >= 500 && error.status < 600)
            return true;
        // 408 Request Timeout is retryable
        if (error.status === 408)
            return true;
        return false;
    }
    /**
     * Extract retry-after header value
     */
    extractRetryAfter(error) {
        if (error.headers?.['retry-after']) {
            return parseInt(error.headers['retry-after'], 10);
        }
        if (error.response?.headers?.['retry-after']) {
            return parseInt(error.response.headers['retry-after'], 10);
        }
        return null;
    }
    /**
     * Sleep for specified milliseconds
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map