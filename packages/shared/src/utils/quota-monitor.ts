/**
 * Quota Monitoring and Alerting System
 * Tracks API usage quotas and implements alerting
 */

export interface QuotaConfig {
  dailyLimit?: number
  monthlyLimit?: number
  costLimit?: number
  alertThresholds: number[] // Percentage thresholds (e.g., [50, 75, 90])
  alertCallback?: (alert: QuotaAlert) => void
}

export interface QuotaAlert {
  service: string
  type: 'usage' | 'cost' | 'rate_limit'
  threshold: number
  current: number
  limit: number
  message: string
  timestamp: Date
  severity: 'warning' | 'critical'
}

export interface UsageMetrics {
  requests: number
  tokens: number
  cost: number
  errors: number
  lastRequest: Date
}

export class QuotaMonitor {
  private usage: Map<string, UsageMetrics> = new Map()
  private configs: Map<string, QuotaConfig> = new Map()
  private alertHistory: Map<string, Date[]> = new Map()

  /**
   * Configure quota monitoring for a service
   */
  configure(service: string, config: QuotaConfig): void {
    this.configs.set(service, config)

    if (!this.usage.has(service)) {
      this.usage.set(service, {
        requests: 0,
        tokens: 0,
        cost: 0,
        errors: 0,
        lastRequest: new Date(),
      })
    }
  }

  /**
   * Record API usage
   */
  recordUsage(service: string, tokens: number, cost: number = 0, isError: boolean = false): void {
    const metrics = this.usage.get(service) || {
      requests: 0,
      tokens: 0,
      cost: 0,
      errors: 0,
      lastRequest: new Date(),
    }

    metrics.requests += 1
    metrics.tokens += tokens
    metrics.cost += cost
    if (isError) metrics.errors += 1
    metrics.lastRequest = new Date()

    this.usage.set(service, metrics)
    this.checkThresholds(service)
  }

  /**
   * Get current usage metrics
   */
  getUsage(service: string): UsageMetrics | null {
    return this.usage.get(service) || null
  }

  /**
   * Get quota status
   */
  getQuotaStatus(service: string): {
    requests: QuotaStatus
    tokens: QuotaStatus
    cost: QuotaStatus
  } | null {
    const config = this.configs.get(service)
    const usage = this.usage.get(service)

    if (!config || !usage) return null

    return {
      requests: {
        used: usage.requests,
        limit: config.dailyLimit || 0,
        resetTime: this.getNextResetTime(),
        percentageUsed: config.dailyLimit ? (usage.requests / config.dailyLimit) * 100 : 0,
      },
      tokens: {
        used: usage.tokens,
        limit: config.monthlyLimit || 0,
        resetTime: this.getNextMonthlyReset(),
        percentageUsed: config.monthlyLimit ? (usage.tokens / config.monthlyLimit) * 100 : 0,
      },
      cost: {
        used: usage.cost,
        limit: config.costLimit || 0,
        resetTime: this.getNextMonthlyReset(),
        percentageUsed: config.costLimit ? (usage.cost / config.costLimit) * 100 : 0,
      },
    }
  }

  /**
   * Check if service usage is within limits
   */
  isWithinLimits(service: string): boolean {
    const config = this.configs.get(service)
    const usage = this.usage.get(service)

    if (!config || !usage) return true

    // Check daily request limit
    if (config.dailyLimit && usage.requests >= config.dailyLimit) {
      return false
    }

    // Check monthly token limit
    if (config.monthlyLimit && usage.tokens >= config.monthlyLimit) {
      return false
    }

    // Check cost limit
    if (config.costLimit && usage.cost >= config.costLimit) {
      return false
    }

    return true
  }

  /**
   * Get fallback strategy recommendations
   */
  getFallbackStrategy(service: string): {
    canSwitch: boolean
    alternatives: string[]
    recommendations: string[]
  } {
    const config = this.configs.get(service)
    const usage = this.usage.get(service)

    if (!config || !usage) {
      return {
        canSwitch: false,
        alternatives: [],
        recommendations: ['Configure quota monitoring first'],
      }
    }

    const status = this.getQuotaStatus(service)
    if (!status) {
      return {
        canSwitch: false,
        alternatives: [],
        recommendations: ['Unable to determine quota status'],
      }
    }

    const recommendations: string[] = []
    const alternatives: string[] = []

    // Check if we're near limits
    if (status.requests.percentageUsed > 80) {
      recommendations.push('Request quota approaching limit - consider rate limiting')

      if (service === 'openai') {
        alternatives.push('anthropic')
        recommendations.push('Switch to Anthropic API as fallback')
      } else if (service === 'anthropic') {
        alternatives.push('openai')
        recommendations.push('Switch to OpenAI API as fallback')
      }
    }

    if (status.cost.percentageUsed > 90) {
      recommendations.push('Cost limit critical - enable mock services')
      alternatives.push('mock-services')
    }

    return {
      canSwitch: alternatives.length > 0,
      alternatives,
      recommendations,
    }
  }

  /**
   * Reset usage counters (typically called daily/monthly)
   */
  resetUsage(service: string, type: 'daily' | 'monthly' | 'all' = 'all'): void {
    const usage = this.usage.get(service)
    if (!usage) return

    if (type === 'daily' || type === 'all') {
      usage.requests = 0
      usage.errors = 0
    }

    if (type === 'monthly' || type === 'all') {
      usage.tokens = 0
      usage.cost = 0
    }

    this.usage.set(service, usage)
  }

  /**
   * Check usage against thresholds and trigger alerts
   */
  private checkThresholds(service: string): void {
    const config = this.configs.get(service)
    const status = this.getQuotaStatus(service)

    if (!config || !status) return

    // Check request thresholds
    for (const threshold of config.alertThresholds) {
      if (
        status.requests.percentageUsed >= threshold &&
        !this.wasAlertSentRecently(service, `requests_${threshold}`)
      ) {
        this.sendAlert({
          service,
          type: 'usage',
          threshold,
          current: status.requests.used,
          limit: status.requests.limit,
          message: `Request quota at ${threshold}% (${status.requests.used}/${status.requests.limit})`,
          timestamp: new Date(),
          severity: threshold >= 90 ? 'critical' : 'warning',
        })
        this.recordAlert(service, `requests_${threshold}`)
      }
    }

    // Check cost thresholds
    for (const threshold of config.alertThresholds) {
      if (
        status.cost.percentageUsed >= threshold &&
        !this.wasAlertSentRecently(service, `cost_${threshold}`)
      ) {
        this.sendAlert({
          service,
          type: 'cost',
          threshold,
          current: status.cost.used,
          limit: status.cost.limit,
          message: `Cost quota at ${threshold}% ($${status.cost.used.toFixed(2)}/$${status.cost.limit.toFixed(2)})`,
          timestamp: new Date(),
          severity: threshold >= 90 ? 'critical' : 'warning',
        })
        this.recordAlert(service, `cost_${threshold}`)
      }
    }
  }

  /**
   * Send alert notification
   */
  private sendAlert(alert: QuotaAlert): void {
    const config = this.configs.get(alert.service)

    // Call configured callback
    if (config?.alertCallback) {
      config.alertCallback(alert)
    }

    // Log alert
    console.warn(`🚨 Quota Alert [${alert.service}]: ${alert.message}`)
  }

  /**
   * Check if alert was sent recently (prevent spam)
   */
  private wasAlertSentRecently(service: string, alertKey: string): boolean {
    const key = `${service}_${alertKey}`
    const alerts = this.alertHistory.get(key) || []
    const recentThreshold = Date.now() - 60 * 60 * 1000 // 1 hour

    return alerts.some(alertTime => alertTime.getTime() > recentThreshold)
  }

  /**
   * Record alert in history
   */
  private recordAlert(service: string, alertKey: string): void {
    const key = `${service}_${alertKey}`
    const alerts = this.alertHistory.get(key) || []
    alerts.push(new Date())

    // Keep only last 10 alerts
    if (alerts.length > 10) {
      alerts.splice(0, alerts.length - 10)
    }

    this.alertHistory.set(key, alerts)
  }

  /**
   * Get next daily reset time (midnight UTC)
   */
  private getNextResetTime(): Date {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)
    return tomorrow
  }

  /**
   * Get next monthly reset time (first day of next month)
   */
  private getNextMonthlyReset(): Date {
    const nextMonth = new Date()
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    nextMonth.setUTCDate(1)
    nextMonth.setUTCHours(0, 0, 0, 0)
    return nextMonth
  }
}

export interface QuotaStatus {
  used: number
  limit: number
  resetTime: Date
  percentageUsed: number
}
