/**
 * Quota Monitoring and Alerting System
 * Tracks API usage quotas and implements alerting
 */
export interface QuotaConfig {
    dailyLimit?: number;
    monthlyLimit?: number;
    costLimit?: number;
    alertThresholds: number[];
    alertCallback?: (alert: QuotaAlert) => void;
}
export interface QuotaAlert {
    service: string;
    type: 'usage' | 'cost' | 'rate_limit';
    threshold: number;
    current: number;
    limit: number;
    message: string;
    timestamp: Date;
    severity: 'warning' | 'critical';
}
export interface UsageMetrics {
    requests: number;
    tokens: number;
    cost: number;
    errors: number;
    lastRequest: Date;
}
export declare class QuotaMonitor {
    private usage;
    private configs;
    private alertHistory;
    /**
     * Configure quota monitoring for a service
     */
    configure(service: string, config: QuotaConfig): void;
    /**
     * Record API usage
     */
    recordUsage(service: string, tokens: number, cost?: number, isError?: boolean): void;
    /**
     * Get current usage metrics
     */
    getUsage(service: string): UsageMetrics | null;
    /**
     * Get quota status
     */
    getQuotaStatus(service: string): {
        requests: QuotaStatus;
        tokens: QuotaStatus;
        cost: QuotaStatus;
    } | null;
    /**
     * Check if service usage is within limits
     */
    isWithinLimits(service: string): boolean;
    /**
     * Get fallback strategy recommendations
     */
    getFallbackStrategy(service: string): {
        canSwitch: boolean;
        alternatives: string[];
        recommendations: string[];
    };
    /**
     * Reset usage counters (typically called daily/monthly)
     */
    resetUsage(service: string, type?: 'daily' | 'monthly' | 'all'): void;
    /**
     * Check usage against thresholds and trigger alerts
     */
    private checkThresholds;
    /**
     * Send alert notification
     */
    private sendAlert;
    /**
     * Check if alert was sent recently (prevent spam)
     */
    private wasAlertSentRecently;
    /**
     * Record alert in history
     */
    private recordAlert;
    /**
     * Get next daily reset time (midnight UTC)
     */
    private getNextResetTime;
    /**
     * Get next monthly reset time (first day of next month)
     */
    private getNextMonthlyReset;
}
export interface QuotaStatus {
    used: number;
    limit: number;
    resetTime: Date;
    percentageUsed: number;
}
//# sourceMappingURL=quota-monitor.d.ts.map