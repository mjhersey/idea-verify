"use strict";
/**
 * Health Monitor for External Services
 * Continuous monitoring and alerting for service health
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceHealthMonitors = exports.HealthMonitor = void 0;
class HealthMonitor {
    statuses = new Map();
    intervals = new Map();
    configs = new Map();
    alertConfig = {};
    startTimes = new Map();
    /**
     * Register a service for health monitoring
     */
    registerService(serviceName, healthCheckFn, config = {}, alertConfig = {}) {
        const fullConfig = {
            interval: 60000, // 1 minute
            timeout: 10000, // 10 seconds
            retries: 3,
            degradedThreshold: 2000, // 2 seconds
            unhealthyThreshold: 3, // 3 consecutive failures
            ...config
        };
        this.configs.set(serviceName, fullConfig);
        this.alertConfig = { ...this.alertConfig, ...alertConfig };
        this.startTimes.set(serviceName, new Date());
        // Initialize status
        this.statuses.set(serviceName, {
            service: serviceName,
            status: 'healthy',
            lastCheck: new Date(),
            responseTime: 0,
            uptime: 0,
            consecutiveFailures: 0
        });
        // Start monitoring
        this.startMonitoring(serviceName, healthCheckFn);
    }
    /**
     * Unregister a service from monitoring
     */
    unregisterService(serviceName) {
        const interval = this.intervals.get(serviceName);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(serviceName);
        }
        this.statuses.delete(serviceName);
        this.configs.delete(serviceName);
        this.startTimes.delete(serviceName);
    }
    /**
     * Get current health status for a service
     */
    getHealthStatus(serviceName) {
        return this.statuses.get(serviceName) || null;
    }
    /**
     * Get health status for all monitored services
     */
    getAllHealthStatuses() {
        return Array.from(this.statuses.values());
    }
    /**
     * Get overall system health
     */
    getSystemHealth() {
        const services = this.getAllHealthStatuses();
        const summary = {
            total: services.length,
            healthy: services.filter(s => s.status === 'healthy').length,
            degraded: services.filter(s => s.status === 'degraded').length,
            unhealthy: services.filter(s => s.status === 'unhealthy').length
        };
        let systemStatus = 'healthy';
        if (summary.unhealthy > 0) {
            systemStatus = 'unhealthy';
        }
        else if (summary.degraded > 0) {
            systemStatus = 'degraded';
        }
        return {
            status: systemStatus,
            services,
            summary
        };
    }
    /**
     * Force a health check for a specific service
     */
    async forceHealthCheck(serviceName) {
        const service = this.getMonitoredService(serviceName);
        if (!service) {
            return null;
        }
        return await this.performHealthCheck(serviceName, service.healthCheckFn);
    }
    /**
     * Stop all monitoring
     */
    stopAllMonitoring() {
        for (const serviceName of this.intervals.keys()) {
            this.unregisterService(serviceName);
        }
    }
    /**
     * Start monitoring for a service
     */
    startMonitoring(serviceName, healthCheckFn) {
        const config = this.configs.get(serviceName);
        // Store the health check function
        this.monitoredServices.set(serviceName, { healthCheckFn });
        // Perform initial check
        this.performHealthCheck(serviceName, healthCheckFn);
        // Schedule regular checks
        const interval = setInterval(() => {
            this.performHealthCheck(serviceName, healthCheckFn);
        }, config.interval);
        this.intervals.set(serviceName, interval);
    }
    monitoredServices = new Map();
    getMonitoredService(serviceName) {
        return this.monitoredServices.get(serviceName);
    }
    /**
     * Perform a health check for a service
     */
    async performHealthCheck(serviceName, healthCheckFn) {
        const config = this.configs.get(serviceName);
        const currentStatus = this.statuses.get(serviceName);
        const startTime = Date.now();
        let newStatus = { ...currentStatus };
        newStatus.lastCheck = new Date();
        try {
            // Execute health check with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
            });
            const healthCheckPromise = healthCheckFn();
            const result = await Promise.race([healthCheckPromise, timeoutPromise]);
            const responseTime = Date.now() - startTime;
            newStatus.responseTime = responseTime;
            newStatus.consecutiveFailures = 0;
            // Calculate uptime
            const startTimeStamp = this.startTimes.get(serviceName);
            newStatus.uptime = Date.now() - startTimeStamp.getTime();
            // Determine status based on response time
            if (responseTime > config.degradedThreshold) {
                newStatus.status = 'degraded';
                newStatus.details = { reason: 'Slow response time', responseTime };
            }
            else {
                newStatus.status = 'healthy';
                newStatus.details = { result };
            }
        }
        catch (error) {
            newStatus.consecutiveFailures = currentStatus.consecutiveFailures + 1;
            newStatus.responseTime = Date.now() - startTime;
            // Determine if service is unhealthy
            if (newStatus.consecutiveFailures >= config.unhealthyThreshold) {
                newStatus.status = 'unhealthy';
            }
            else {
                newStatus.status = 'degraded';
            }
            newStatus.details = {
                error: error instanceof Error ? error.message : String(error),
                consecutiveFailures: newStatus.consecutiveFailures
            };
        }
        // Check for status changes and trigger alerts
        if (currentStatus.status !== newStatus.status) {
            this.handleStatusChange(currentStatus, newStatus);
        }
        this.statuses.set(serviceName, newStatus);
        return newStatus;
    }
    /**
     * Handle status changes and trigger appropriate alerts
     */
    handleStatusChange(oldStatus, newStatus) {
        // Call general status change callback
        if (this.alertConfig.onStatusChange) {
            this.alertConfig.onStatusChange(oldStatus, newStatus);
        }
        // Call specific callbacks
        if (newStatus.status === 'unhealthy' && this.alertConfig.onUnhealthy) {
            this.alertConfig.onUnhealthy(newStatus);
        }
        if (oldStatus.status === 'unhealthy' && newStatus.status !== 'unhealthy' && this.alertConfig.onRecovered) {
            this.alertConfig.onRecovered(newStatus);
        }
        // Log status change
        console.log(`🏥 Health Status Change: ${newStatus.service} ${oldStatus.status} → ${newStatus.status}`);
    }
}
exports.HealthMonitor = HealthMonitor;
/**
 * Pre-configured health monitors for common services
 */
class ServiceHealthMonitors {
    monitor;
    constructor() {
        this.monitor = new HealthMonitor();
    }
    /**
     * Set up monitoring for OpenAI service
     */
    monitorOpenAI(config = {}) {
        this.monitor.registerService('openai', async () => {
            const url = process.env.USE_MOCK_SERVICES === 'true'
                ? 'http://localhost:3001/health'
                : 'https://api.openai.com/v1/models';
            const headers = {};
            if (process.env.USE_MOCK_SERVICES !== 'true') {
                headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
            }
            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        }, config, {
            onUnhealthy: (status) => console.warn(`🚨 OpenAI service unhealthy: ${status.details?.error}`),
            onRecovered: (status) => console.log(`✅ OpenAI service recovered`)
        });
    }
    /**
     * Set up monitoring for Anthropic service
     */
    monitorAnthropic(config = {}) {
        this.monitor.registerService('anthropic', async () => {
            const url = process.env.USE_MOCK_SERVICES === 'true'
                ? 'http://localhost:3002/health'
                : 'https://api.anthropic.com/v1/messages';
            if (process.env.USE_MOCK_SERVICES === 'true') {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            }
            else {
                // For real service, we'd make a minimal API call
                // This is a placeholder - would need actual implementation
                return { status: 'healthy' };
            }
        }, config, {
            onUnhealthy: (status) => console.warn(`🚨 Anthropic service unhealthy: ${status.details?.error}`),
            onRecovered: (status) => console.log(`✅ Anthropic service recovered`)
        });
    }
    /**
     * Set up monitoring for LocalStack service
     */
    monitorLocalStack(config = {}) {
        this.monitor.registerService('localstack', async () => {
            const response = await fetch('http://localhost:4566/health');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        }, config, {
            onUnhealthy: (status) => console.warn(`🚨 LocalStack service unhealthy: ${status.details?.error}`),
            onRecovered: (status) => console.log(`✅ LocalStack service recovered`)
        });
    }
    /**
     * Start monitoring all configured services
     */
    startAllMonitoring() {
        console.log('🏥 Starting health monitoring for all services...');
        this.monitorOpenAI();
        this.monitorAnthropic();
        if (process.env.USE_MOCK_SERVICES === 'true') {
            this.monitorLocalStack();
        }
        console.log('✅ Health monitoring started');
    }
    /**
     * Get the underlying health monitor
     */
    getMonitor() {
        return this.monitor;
    }
    /**
     * Stop all monitoring
     */
    stopAllMonitoring() {
        this.monitor.stopAllMonitoring();
        console.log('🛑 Health monitoring stopped');
    }
}
exports.ServiceHealthMonitors = ServiceHealthMonitors;
//# sourceMappingURL=health-monitor.js.map