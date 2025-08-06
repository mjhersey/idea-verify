/**
 * Service Client with Rate Limiting and Quota Management
 * Integrates rate limiting, quota monitoring, and fallback strategies
 */

import { RateLimiter, RateLimitConfig, RateLimitStatus } from './rate-limiter.js'
import { QuotaMonitor, QuotaConfig, QuotaAlert, QuotaStatus } from './quota-monitor.js'

export interface ServiceClientConfig {
  rateLimiting: RateLimitConfig
  quotaMonitoring: QuotaConfig
  fallbackEnabled: boolean
  fallbackServices?: string[]
}

export interface RequestOptions {
  estimatedTokens?: number
  estimatedCost?: number
  timeout?: number
  priority?: 'low' | 'normal' | 'high'
}

export class ServiceClient {
  private rateLimiter: RateLimiter
  private quotaMonitor: QuotaMonitor
  private config: ServiceClientConfig
  private serviceName: string

  constructor(serviceName: string, config: ServiceClientConfig) {
    this.serviceName = serviceName
    this.config = config
    this.rateLimiter = new RateLimiter(config.rateLimiting)
    this.quotaMonitor = new QuotaMonitor()

    // Configure quota monitoring with alert callback
    this.quotaMonitor.configure(serviceName, {
      ...config.quotaMonitoring,
      alertCallback: this.handleQuotaAlert.bind(this),
    })
  }

  /**
   * Execute a request with full rate limiting and quota management
   */
  async executeRequest<T>(requestFn: () => Promise<T>, options: RequestOptions = {}): Promise<T> {
    const { estimatedTokens = 0, estimatedCost = 0 } = options

    // Check quota limits before attempting request
    if (!this.quotaMonitor.isWithinLimits(this.serviceName)) {
      throw new Error(`Service ${this.serviceName} has exceeded quota limits`)
    }

    try {
      // Execute with rate limiting and retry
      const result = await this.rateLimiter.executeWithRetry(
        this.serviceName,
        requestFn,
        estimatedTokens
      )

      // Record successful usage
      this.quotaMonitor.recordUsage(this.serviceName, estimatedTokens, estimatedCost, false)

      return result
    } catch (error) {
      // Record failed usage
      this.quotaMonitor.recordUsage(this.serviceName, 0, 0, true)

      // Check if we should attempt fallback
      if (
        this.config.fallbackEnabled &&
        this.shouldUseFallback(error as Error & { status?: number; code?: string })
      ) {
        const fallback = this.getFallbackService()
        if (fallback) {
          console.warn(`Service ${this.serviceName} failed, attempting fallback to ${fallback}`)
          // This would require fallback service clients to be configured
          // For now, we'll throw the original error
        }
      }

      throw error
    }
  }

  /**
   * Get current service status
   */
  getStatus(): {
    rateLimitStatus: RateLimitStatus | null
    quotaStatus: { requests: QuotaStatus; tokens: QuotaStatus; cost: QuotaStatus } | null
    fallbackRecommendations: {
      canSwitch: boolean
      alternatives: string[]
      recommendations: string[]
    }
  } {
    return {
      rateLimitStatus: this.rateLimiter.getRateLimitStatus(this.serviceName),
      quotaStatus: this.quotaMonitor.getQuotaStatus(this.serviceName),
      fallbackRecommendations: this.quotaMonitor.getFallbackStrategy(this.serviceName),
    }
  }

  /**
   * Handle quota alerts
   */
  private handleQuotaAlert(alert: QuotaAlert): void {
    console.warn(`🚨 Quota Alert for ${alert.service}:`, {
      type: alert.type,
      threshold: alert.threshold,
      current: alert.current,
      limit: alert.limit,
      message: alert.message,
      severity: alert.severity,
    })

    // If critical, consider automatic fallback
    if (alert.severity === 'critical' && this.config.fallbackEnabled) {
      console.warn(`Critical quota alert - fallback strategies may be activated`)
    }
  }

  /**
   * Check if fallback should be used based on error
   */
  private shouldUseFallback(error: Error & { status?: number; code?: string }): boolean {
    // Use fallback for quota exceeded errors
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return true
    }

    // Use fallback for persistent service errors
    if (error.status && error.status >= 500) {
      return true
    }

    return false
  }

  /**
   * Get recommended fallback service
   */
  private getFallbackService(): string | null {
    const strategy = this.quotaMonitor.getFallbackStrategy(this.serviceName)
    return strategy.alternatives.length > 0 ? strategy.alternatives[0] : null
  }

  /**
   * Reset quota counters (for testing or manual reset)
   */
  resetQuotas(type: 'daily' | 'monthly' | 'all' = 'all'): void {
    this.quotaMonitor.resetUsage(this.serviceName, type)
  }
}
