"use strict";
/**
 * Service Client with Rate Limiting and Quota Management
 * Integrates rate limiting, quota monitoring, and fallback strategies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceClient = void 0;
const rate_limiter_js_1 = require("./rate-limiter.js");
const quota_monitor_js_1 = require("./quota-monitor.js");
class ServiceClient {
    rateLimiter;
    quotaMonitor;
    config;
    serviceName;
    constructor(serviceName, config) {
        this.serviceName = serviceName;
        this.config = config;
        this.rateLimiter = new rate_limiter_js_1.RateLimiter(config.rateLimiting);
        this.quotaMonitor = new quota_monitor_js_1.QuotaMonitor();
        // Configure quota monitoring with alert callback
        this.quotaMonitor.configure(serviceName, {
            ...config.quotaMonitoring,
            alertCallback: this.handleQuotaAlert.bind(this)
        });
    }
    /**
     * Execute a request with full rate limiting and quota management
     */
    async executeRequest(requestFn, options = {}) {
        const { estimatedTokens = 0, estimatedCost = 0 } = options;
        // Check quota limits before attempting request
        if (!this.quotaMonitor.isWithinLimits(this.serviceName)) {
            throw new Error(`Service ${this.serviceName} has exceeded quota limits`);
        }
        try {
            // Execute with rate limiting and retry
            const result = await this.rateLimiter.executeWithRetry(this.serviceName, requestFn, estimatedTokens);
            // Record successful usage
            this.quotaMonitor.recordUsage(this.serviceName, estimatedTokens, estimatedCost, false);
            return result;
        }
        catch (error) {
            // Record failed usage
            this.quotaMonitor.recordUsage(this.serviceName, 0, 0, true);
            // Check if we should attempt fallback
            if (this.config.fallbackEnabled && this.shouldUseFallback(error)) {
                const fallback = this.getFallbackService();
                if (fallback) {
                    console.warn(`Service ${this.serviceName} failed, attempting fallback to ${fallback}`);
                    // This would require fallback service clients to be configured
                    // For now, we'll throw the original error
                }
            }
            throw error;
        }
    }
    /**
     * Get current service status
     */
    getStatus() {
        return {
            rateLimitStatus: this.rateLimiter.getRateLimitStatus(this.serviceName),
            quotaStatus: this.quotaMonitor.getQuotaStatus(this.serviceName),
            fallbackRecommendations: this.quotaMonitor.getFallbackStrategy(this.serviceName)
        };
    }
    /**
     * Handle quota alerts
     */
    handleQuotaAlert(alert) {
        console.warn(`🚨 Quota Alert for ${alert.service}:`, {
            type: alert.type,
            threshold: alert.threshold,
            current: alert.current,
            limit: alert.limit,
            message: alert.message,
            severity: alert.severity
        });
        // If critical, consider automatic fallback
        if (alert.severity === 'critical' && this.config.fallbackEnabled) {
            console.warn(`Critical quota alert - fallback strategies may be activated`);
        }
    }
    /**
     * Check if fallback should be used based on error
     */
    shouldUseFallback(error) {
        // Use fallback for quota exceeded errors
        if (error.message?.includes('quota') || error.message?.includes('limit')) {
            return true;
        }
        // Use fallback for persistent service errors
        if (error.status && error.status >= 500) {
            return true;
        }
        return false;
    }
    /**
     * Get recommended fallback service
     */
    getFallbackService() {
        const strategy = this.quotaMonitor.getFallbackStrategy(this.serviceName);
        return strategy.alternatives.length > 0 ? strategy.alternatives[0] : null;
    }
    /**
     * Reset quota counters (for testing or manual reset)
     */
    resetQuotas(type = 'all') {
        this.quotaMonitor.resetUsage(this.serviceName, type);
    }
}
exports.ServiceClient = ServiceClient;
//# sourceMappingURL=service-client.js.map