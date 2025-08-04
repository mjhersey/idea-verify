/**
 * Agent Health Monitor - Real-time monitoring and observability for multi-agent systems
 */

import { AgentType } from '@ai-validation/shared';
import { EventEmitter } from 'events';
import { AgentRegistry } from '../agents/agent-registry.js';
import { AgentMetadata } from '../agents/types.js';

export interface HealthCheckResult {
  agentType: AgentType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: Date;
  metrics: {
    cpu: number;
    memory: number;
    errorRate: number;
    successRate: number;
    averageResponseTime: number;
  };
  issues: string[];
  lastError?: {
    message: string;
    timestamp: Date;
    category: string;
  };
}

export interface PerformanceMetrics {
  agentType: AgentType;
  timestamp: Date;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  queueDepth: number;
  throughput: number;
  errorCount: number;
  successCount: number;
  retryCount: number;
}

export interface SystemMetrics {
  timestamp: Date;
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  unhealthyAgents: number;
  totalExecutions: number;
  failedExecutions: number;
  averageResponseTime: number;
  systemLoad: number;
  memoryUtilization: number;
  queueBacklog: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: PerformanceMetrics | SystemMetrics) => boolean;
  severity: 'info' | 'warning' | 'critical';
  cooldown: number; // Minutes before same alert can fire again
  enabled: boolean;
  notificationChannels: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  agentType?: AgentType;
  timestamp: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface HealthThresholds {
  responseTime: {
    healthy: number;
    degraded: number;
  };
  errorRate: {
    healthy: number;
    degraded: number;
  };
  memoryUsage: {
    healthy: number;
    degraded: number;
  };
  cpuUsage: {
    healthy: number;
    degraded: number;
  };
}

export class AgentHealthMonitor extends EventEmitter {
  private static instance: AgentHealthMonitor;
  
  private agentRegistry: AgentRegistry;
  private healthHistory: Map<AgentType, HealthCheckResult[]> = new Map();
  private performanceMetrics: Map<AgentType, PerformanceMetrics[]> = new Map();
  private systemMetricsHistory: SystemMetrics[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  
  private thresholds: HealthThresholds = {
    responseTime: { healthy: 5000, degraded: 10000 },
    errorRate: { healthy: 0.05, degraded: 0.15 },
    memoryUsage: { healthy: 0.7, degraded: 0.85 },
    cpuUsage: { healthy: 0.7, degraded: 0.85 }
  };

  private constructor() {
    super();
    this.agentRegistry = AgentRegistry.getInstance();
    this.initializeDefaultAlertRules();
  }

  static getInstance(): AgentHealthMonitor {
    if (!AgentHealthMonitor.instance) {
      AgentHealthMonitor.instance = new AgentHealthMonitor();
    }
    return AgentHealthMonitor.instance;
  }

  private initializeDefaultAlertRules(): void {
    // High error rate alert
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Agent has high error rate indicating potential issues',
      condition: (metrics) => {
        if ('agentType' in metrics) {
          const pm = metrics as PerformanceMetrics;
          const total = pm.errorCount + pm.successCount;
          return total > 0 && (pm.errorCount / total) > this.thresholds.errorRate.degraded;
        }
        return false;
      },
      severity: 'warning',
      cooldown: 15,
      enabled: true,
      notificationChannels: ['console', 'webhook']
    });

    // High response time alert
    this.addAlertRule({
      id: 'high-response-time',
      name: 'High Response Time',
      description: 'Agent response time exceeds acceptable thresholds',
      condition: (metrics) => {
        if ('agentType' in metrics) {
          const pm = metrics as PerformanceMetrics;
          return pm.executionTime > this.thresholds.responseTime.degraded;
        }
        return false;
      },
      severity: 'warning',
      cooldown: 10,
      enabled: true,
      notificationChannels: ['console']
    });

    // Memory usage alert
    this.addAlertRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      description: 'Agent memory usage is critically high',
      condition: (metrics) => {
        if ('agentType' in metrics) {
          const pm = metrics as PerformanceMetrics;
          return pm.memoryUsage > this.thresholds.memoryUsage.degraded;
        }
        return false;
      },
      severity: 'critical',
      cooldown: 5,
      enabled: true,
      notificationChannels: ['console', 'webhook', 'email']
    });

    // System overload alert
    this.addAlertRule({
      id: 'system-overload',
      name: 'System Overload',
      description: 'System is experiencing high load with queue backlog',
      condition: (metrics) => {
        if ('totalAgents' in metrics) {
          const sm = metrics as SystemMetrics;
          return sm.queueBacklog > 100 && sm.systemLoad > 0.9;
        }
        return false;
      },
      severity: 'critical',
      cooldown: 5,
      enabled: true,
      notificationChannels: ['console', 'webhook', 'email', 'sms']
    });

    // Agent unavailability alert
    this.addAlertRule({
      id: 'agent-unavailable',
      name: 'Agent Unavailable',
      description: 'Agent is completely unavailable and not responding',
      condition: (metrics) => {
        if ('agentType' in metrics) {
          const pm = metrics as PerformanceMetrics;
          return pm.successCount === 0 && pm.errorCount > 5;
        }
        return false;
      },
      severity: 'critical',
      cooldown: 1,
      enabled: true,
      notificationChannels: ['console', 'webhook', 'email', 'sms']
    });
  }

  async startMonitoring(options: {
    healthCheckInterval?: number;
    metricsInterval?: number;
    historyRetention?: number;
  } = {}): Promise<void> {
    if (this.isMonitoring) {
      console.log('[AgentHealthMonitor] Already monitoring');
      return;
    }

    const healthInterval = options.healthCheckInterval || 30000; // 30 seconds
    const metricsInterval = options.metricsInterval || 10000; // 10 seconds

    console.log('[AgentHealthMonitor] Starting health monitoring...');

    // Start health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('[AgentHealthMonitor] Health check error:', error);
      }
    }, healthInterval);

    // Start metrics collection
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.collectSystemMetrics();
        this.evaluateAlertRules();
      } catch (error) {
        console.error('[AgentHealthMonitor] Metrics collection error:', error);
      }
    }, metricsInterval);

    this.isMonitoring = true;
    this.emit('monitoringStarted');
    console.log('[AgentHealthMonitor] Health monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    console.log('[AgentHealthMonitor] Stopping health monitoring...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    this.isMonitoring = false;
    this.emit('monitoringStopped');
    console.log('[AgentHealthMonitor] Health monitoring stopped');
  }

  private async performHealthChecks(): Promise<void> {
    const registeredAgents = this.agentRegistry.getAllRegisteredAgents();

    const healthPromises = registeredAgents.map(async (agentType) => {
      try {
        const result = await this.checkAgentHealth(agentType);
        this.storeHealthResult(agentType, result);
        this.emit('healthCheckCompleted', result);
        return result;
      } catch (error) {
        console.error(`[AgentHealthMonitor] Health check failed for ${agentType}:`, error);
        const failedResult: HealthCheckResult = {
          agentType,
          status: 'unhealthy',
          responseTime: -1,
          timestamp: new Date(),
          metrics: {
            cpu: 0,
            memory: 0,
            errorRate: 1,
            successRate: 0,
            averageResponseTime: -1
          },
          issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        };
        this.storeHealthResult(agentType, failedResult);
        return failedResult;
      }
    });

    const results = await Promise.all(healthPromises);
    this.emit('healthCheckCycleCompleted', results);
  }

  private async checkAgentHealth(agentType: AgentType): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    // Get agent metadata from registry
    const metadata = this.agentRegistry.getAgentMetadata(agentType);
    if (!metadata) {
      throw new Error(`Agent ${agentType} not found in registry`);
    }

    // Perform health check
    await this.agentRegistry.performHealthCheck();
    const responseTime = Date.now() - startTime;

    // Get recent performance metrics
    const recentMetrics = this.getRecentMetrics(agentType, 5); // Last 5 metrics
    const issues: string[] = [];

    // Calculate health metrics
    const metrics = this.calculateHealthMetrics(agentType, recentMetrics, metadata);

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (responseTime > this.thresholds.responseTime.degraded) {
      status = 'unhealthy';
      issues.push(`Response time too high: ${responseTime}ms`);
    } else if (responseTime > this.thresholds.responseTime.healthy) {
      status = 'degraded';
      issues.push(`Response time elevated: ${responseTime}ms`);
    }

    if (metrics.errorRate > this.thresholds.errorRate.degraded) {
      status = 'unhealthy';
      issues.push(`Error rate too high: ${(metrics.errorRate * 100).toFixed(1)}%`);
    } else if (metrics.errorRate > this.thresholds.errorRate.healthy) {
      if (status === 'healthy') status = 'degraded';
      issues.push(`Error rate elevated: ${(metrics.errorRate * 100).toFixed(1)}%`);
    }

    if (metadata.healthStatus === 'unhealthy') {
      status = 'unhealthy';
      issues.push('Agent reported unhealthy status');
    } else if (metadata.healthStatus === 'degraded' && status === 'healthy') {
      status = 'degraded';
      issues.push('Agent reported degraded status');
    }

    return {
      agentType,
      status,
      responseTime,
      timestamp: new Date(),
      metrics,
      issues
    };
  }

  private calculateHealthMetrics(
    agentType: AgentType, 
    recentMetrics: PerformanceMetrics[], 
    metadata: AgentMetadata
  ): HealthCheckResult['metrics'] {
    if (recentMetrics.length === 0) {
      return {
        cpu: metadata.resourceUsage.cpu || 0,
        memory: metadata.resourceUsage.memory || 0,
        errorRate: 0,
        successRate: 1,
        averageResponseTime: metadata.resourceUsage.responseTime || 0
      };
    }

    const totalSuccess = recentMetrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalRequests = totalSuccess + totalErrors;
    
    return {
      cpu: recentMetrics[recentMetrics.length - 1]?.cpuUsage || 0,
      memory: recentMetrics[recentMetrics.length - 1]?.memoryUsage || 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      successRate: totalRequests > 0 ? totalSuccess / totalRequests : 1,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length
    };
  }

  private async collectMetrics(): Promise<void> {
    const registeredAgents = this.agentRegistry.getAllRegisteredAgents();

    for (const agentType of registeredAgents) {
      try {
        const metrics = await this.collectAgentMetrics(agentType);
        this.storePerformanceMetrics(agentType, metrics);
      } catch (error) {
        console.error(`[AgentHealthMonitor] Failed to collect metrics for ${agentType}:`, error);
      }
    }
  }

  private async collectAgentMetrics(agentType: AgentType): Promise<PerformanceMetrics> {
    const metadata = this.agentRegistry.getAgentMetadata(agentType);
    
    // In a real implementation, these would come from actual monitoring systems
    const metrics: PerformanceMetrics = {
      agentType,
      timestamp: new Date(),
      executionTime: metadata?.resourceUsage.responseTime || Math.random() * 5000,
      memoryUsage: metadata?.resourceUsage.memory || Math.random() * 0.8,
      cpuUsage: metadata?.resourceUsage.cpu || Math.random() * 0.6,
      queueDepth: Math.floor(Math.random() * 10),
      throughput: Math.floor(Math.random() * 50) + 10,
      errorCount: Math.floor(Math.random() * 3),
      successCount: Math.floor(Math.random() * 47) + 10,
      retryCount: Math.floor(Math.random() * 2)
    };

    return metrics;
  }

  private async collectSystemMetrics(): Promise<void> {
    const registeredAgents = this.agentRegistry.getAllRegisteredAgents();
    const healthResults = Array.from(this.healthHistory.values()).flat();
    const recentHealthResults = healthResults.filter(
      result => Date.now() - result.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const systemMetrics: SystemMetrics = {
      timestamp: new Date(),
      totalAgents: registeredAgents.length,
      healthyAgents: recentHealthResults.filter(r => r.status === 'healthy').length,
      degradedAgents: recentHealthResults.filter(r => r.status === 'degraded').length,
      unhealthyAgents: recentHealthResults.filter(r => r.status === 'unhealthy').length,
      totalExecutions: 0,
      failedExecutions: 0,
      averageResponseTime: 0,
      systemLoad: Math.random() * 0.8,
      memoryUtilization: Math.random() * 0.7,
      queueBacklog: Math.floor(Math.random() * 50)
    };

    // Calculate execution metrics from performance data
    const allMetrics = Array.from(this.performanceMetrics.values()).flat();
    const recentMetrics = allMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 300000 // Last 5 minutes
    );

    if (recentMetrics.length > 0) {
      systemMetrics.totalExecutions = recentMetrics.reduce((sum, m) => sum + m.successCount + m.errorCount, 0);
      systemMetrics.failedExecutions = recentMetrics.reduce((sum, m) => sum + m.errorCount, 0);
      systemMetrics.averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
    }

    this.systemMetricsHistory.push(systemMetrics);
    
    // Keep only recent system metrics (last 24 hours)
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    this.systemMetricsHistory = this.systemMetricsHistory.filter(m => m.timestamp.getTime() > cutoffTime);

    this.emit('systemMetricsCollected', systemMetrics);
  }

  private evaluateAlertRules(): void {
    const now = new Date();

    // Check performance metrics
    this.performanceMetrics.forEach((metricsList, agentType) => {
      const latestMetrics = metricsList[metricsList.length - 1];
      if (!latestMetrics) return;

      this.alertRules.forEach((rule) => {
        if (!rule.enabled) return;

        // Check cooldown
        const lastAlert = this.alertCooldowns.get(`${rule.id}-${agentType}`);
        if (lastAlert && (now.getTime() - lastAlert.getTime()) < rule.cooldown * 60000) {
          return;
        }

        if (rule.condition(latestMetrics)) {
          this.triggerAlert(rule, { agentType, metrics: latestMetrics });
          this.alertCooldowns.set(`${rule.id}-${agentType}`, now);
        }
      });
    });

    // Check system metrics
    const latestSystemMetrics = this.systemMetricsHistory[this.systemMetricsHistory.length - 1];
    if (latestSystemMetrics) {
      this.alertRules.forEach((rule) => {
        if (!rule.enabled) return;

        const lastAlert = this.alertCooldowns.get(`${rule.id}-system`);
        if (lastAlert && (now.getTime() - lastAlert.getTime()) < rule.cooldown * 60000) {
          return;
        }

        if (rule.condition(latestSystemMetrics)) {
          this.triggerAlert(rule, { metrics: latestSystemMetrics });
          this.alertCooldowns.set(`${rule.id}-system`, now);
        }
      });
    }
  }

  private triggerAlert(rule: AlertRule, context: { agentType?: AgentType; metrics: any }): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, context),
      agentType: context.agentType,
      timestamp: new Date(),
      metadata: {
        rule: rule.name,
        metrics: context.metrics
      }
    };

    this.activeAlerts.set(alert.id, alert);

    // Send notifications
    this.sendNotifications(alert, rule.notificationChannels);

    this.emit('alertTriggered', alert);
    console.log(`[AgentHealthMonitor] Alert triggered: ${alert.message}`);
  }

  private generateAlertMessage(rule: AlertRule, context: { agentType?: AgentType; metrics: any }): string {
    const agentInfo = context.agentType ? ` for agent ${context.agentType}` : '';
    return `${rule.name}${agentInfo}: ${rule.description}`;
  }

  private sendNotifications(alert: Alert, channels: string[]): void {
    channels.forEach(channel => {
      switch (channel) {
        case 'console':
          console.warn(`[ALERT ${alert.severity.toUpperCase()}] ${alert.message}`);
          break;
        case 'webhook':
          // Implementation would send HTTP webhook
          console.log(`[WebHook] Alert: ${alert.message}`);
          break;
        case 'email':
          // Implementation would send email
          console.log(`[Email] Alert: ${alert.message}`);
          break;
        case 'sms':
          // Implementation would send SMS
          console.log(`[SMS] Critical Alert: ${alert.message}`);
          break;
      }
    });
  }

  // Data storage methods
  private storeHealthResult(agentType: AgentType, result: HealthCheckResult): void {
    if (!this.healthHistory.has(agentType)) {
      this.healthHistory.set(agentType, []);
    }

    const history = this.healthHistory.get(agentType)!;
    history.push(result);

    // Keep only recent history (last 100 checks)
    if (history.length > 100) {
      history.shift();
    }
  }

  private storePerformanceMetrics(agentType: AgentType, metrics: PerformanceMetrics): void {
    if (!this.performanceMetrics.has(agentType)) {
      this.performanceMetrics.set(agentType, []);
    }

    const metricsList = this.performanceMetrics.get(agentType)!;
    metricsList.push(metrics);

    // Keep only recent metrics (last 24 hours)
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    this.performanceMetrics.set(agentType, 
      metricsList.filter(m => m.timestamp.getTime() > cutoffTime)
    );
  }

  // Public API methods
  getAgentHealth(agentType: AgentType): HealthCheckResult | undefined {
    const history = this.healthHistory.get(agentType);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  getAllAgentsHealth(): Map<AgentType, HealthCheckResult> {
    const result = new Map<AgentType, HealthCheckResult>();
    
    this.healthHistory.forEach((history, agentType) => {
      if (history.length > 0) {
        result.set(agentType, history[history.length - 1]);
      }
    });

    return result;
  }

  getRecentMetrics(agentType: AgentType, count: number = 10): PerformanceMetrics[] {
    const metrics = this.performanceMetrics.get(agentType) || [];
    return metrics.slice(-count);
  }

  getSystemHealth(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    details: SystemMetrics;
    agents: Map<AgentType, HealthCheckResult>;
  } {
    const agentHealth = this.getAllAgentsHealth();
    const latestSystemMetrics = this.systemMetricsHistory[this.systemMetricsHistory.length - 1];
    
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Determine overall health based on agent statuses
    const healthStatuses = Array.from(agentHealth.values()).map(h => h.status);
    const unhealthyCount = healthStatuses.filter(s => s === 'unhealthy').length;
    const degradedCount = healthStatuses.filter(s => s === 'degraded').length;
    
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > healthStatuses.length * 0.3) { // More than 30% degraded
      overall = 'degraded';
    }

    return {
      overall,
      details: latestSystemMetrics || this.getDefaultSystemMetrics(),
      agents: agentHealth
    };
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`[AgentHealthMonitor] Added alert rule: ${rule.name}`);
  }

  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      console.log(`[AgentHealthMonitor] Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledgedAt = new Date();
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  // Utility methods
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultSystemMetrics(): SystemMetrics {
    return {
      timestamp: new Date(),
      totalAgents: 0,
      healthyAgents: 0,
      degradedAgents: 0,
      unhealthyAgents: 0,
      totalExecutions: 0,
      failedExecutions: 0,
      averageResponseTime: 0,
      systemLoad: 0,
      memoryUtilization: 0,
      queueBacklog: 0
    };
  }

  async shutdown(): Promise<void> {
    console.log('[AgentHealthMonitor] Shutting down...');
    
    await this.stopMonitoring();
    
    // Clear data
    this.healthHistory.clear();
    this.performanceMetrics.clear();
    this.systemMetricsHistory = [];
    this.activeAlerts.clear();
    this.alertCooldowns.clear();
    
    this.removeAllListeners();
    console.log('[AgentHealthMonitor] Shutdown complete');
  }

  // Test utilities
  static resetInstance(): void {
    if (AgentHealthMonitor.instance) {
      AgentHealthMonitor.instance.shutdown();
    }
    AgentHealthMonitor.instance = null as any;
  }
}