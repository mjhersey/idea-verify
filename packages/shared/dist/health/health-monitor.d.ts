/**
 * Health Monitor for External Services
 * Continuous monitoring and alerting for service health
 */
export interface HealthStatus {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    responseTime: number;
    uptime: number;
    consecutiveFailures: number;
    details?: Record<string, unknown>;
}
export interface HealthCheckConfig {
    interval: number;
    timeout: number;
    retries: number;
    degradedThreshold: number;
    unhealthyThreshold: number;
}
export interface AlertConfig {
    onStatusChange?: (oldStatus: HealthStatus, newStatus: HealthStatus) => void;
    onUnhealthy?: (status: HealthStatus) => void;
    onRecovered?: (status: HealthStatus) => void;
}
export declare class HealthMonitor {
    private statuses;
    private intervals;
    private configs;
    private alertConfig;
    private startTimes;
    /**
     * Register a service for health monitoring
     */
    registerService(serviceName: string, healthCheckFn: () => Promise<Record<string, unknown>>, config?: Partial<HealthCheckConfig>, alertConfig?: AlertConfig): void;
    /**
     * Unregister a service from monitoring
     */
    unregisterService(serviceName: string): void;
    /**
     * Get current health status for a service
     */
    getHealthStatus(serviceName: string): HealthStatus | null;
    /**
     * Get health status for all monitored services
     */
    getAllHealthStatuses(): HealthStatus[];
    /**
     * Get overall system health
     */
    getSystemHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: HealthStatus[];
        summary: {
            total: number;
            healthy: number;
            degraded: number;
            unhealthy: number;
        };
    };
    /**
     * Force a health check for a specific service
     */
    forceHealthCheck(serviceName: string): Promise<HealthStatus | null>;
    /**
     * Stop all monitoring
     */
    stopAllMonitoring(): void;
    /**
     * Start monitoring for a service
     */
    private startMonitoring;
    private monitoredServices;
    private getMonitoredService;
    /**
     * Perform a health check for a service
     */
    private performHealthCheck;
    /**
     * Handle status changes and trigger appropriate alerts
     */
    private handleStatusChange;
}
/**
 * Pre-configured health monitors for common services
 */
export declare class ServiceHealthMonitors {
    private monitor;
    constructor();
    /**
     * Set up monitoring for OpenAI service
     */
    monitorOpenAI(config?: Partial<HealthCheckConfig>): void;
    /**
     * Set up monitoring for Anthropic service
     */
    monitorAnthropic(config?: Partial<HealthCheckConfig>): void;
    /**
     * Set up monitoring for LocalStack service
     */
    monitorLocalStack(config?: Partial<HealthCheckConfig>): void;
    /**
     * Start monitoring all configured services
     */
    startAllMonitoring(): void;
    /**
     * Get the underlying health monitor
     */
    getMonitor(): HealthMonitor;
    /**
     * Stop all monitoring
     */
    stopAllMonitoring(): void;
}
//# sourceMappingURL=health-monitor.d.ts.map