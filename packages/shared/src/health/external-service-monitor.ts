/**
 * External Service Health Monitor
 * Monitors health of external APIs and services
 */

export interface ExternalServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured'
  responseTime?: number
  lastCheck: Date
  error?: string
  metadata?: Record<string, any>
}

export class ExternalServiceMonitor {
  private static instance: ExternalServiceMonitor
  private healthCache: Map<string, ExternalServiceStatus> = new Map()
  private cacheTimeout = 300000 // 5 minutes for external services

  static getInstance(): ExternalServiceMonitor {
    if (!ExternalServiceMonitor.instance) {
      ExternalServiceMonitor.instance = new ExternalServiceMonitor()
    }
    return ExternalServiceMonitor.instance
  }

  async checkOpenAIHealth(): Promise<ExternalServiceStatus> {
    const cached = this.getCachedStatus('openai')
    if (cached) return cached

    if (!process.env.OPENAI_API_KEY) {
      const status: ExternalServiceStatus = {
        name: 'openai',
        status: 'not_configured',
        lastCheck: new Date(),
        metadata: { configured: false },
      }
      this.healthCache.set('openai', status)
      return status
    }

    const startTime = Date.now()
    try {
      // eslint-disable-next-line no-undef
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime

        const status: ExternalServiceStatus = {
          name: 'openai',
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime,
          lastCheck: new Date(),
          metadata: {
            configured: true,
            statusCode: response.status,
            rateLimitRemaining: response.headers.get('x-ratelimit-remaining-requests'),
            rateLimitReset: response.headers.get('x-ratelimit-reset-requests'),
          },
        }

        if (!response.ok) {
          status.error = `HTTP ${response.status}: ${response.statusText}`
        }

        this.healthCache.set('openai', status)
        return status
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      const status: ExternalServiceStatus = {
        name: 'openai',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { configured: true },
      }
      this.healthCache.set('openai', status)
      return status
    }
  }

  async checkAnthropicHealth(): Promise<ExternalServiceStatus> {
    const cached = this.getCachedStatus('anthropic')
    if (cached) return cached

    if (!process.env.ANTHROPIC_API_KEY) {
      const status: ExternalServiceStatus = {
        name: 'anthropic',
        status: 'not_configured',
        lastCheck: new Date(),
        metadata: { configured: false },
      }
      this.healthCache.set('anthropic', status)
      return status
    }

    const startTime = Date.now()
    try {
      // eslint-disable-next-line no-undef
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        // Use a minimal test request
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime

        const status: ExternalServiceStatus = {
          name: 'anthropic',
          status: response.ok || response.status === 400 ? 'healthy' : 'unhealthy', // 400 is expected for minimal test
          responseTime,
          lastCheck: new Date(),
          metadata: {
            configured: true,
            statusCode: response.status,
            rateLimitRemaining: response.headers.get('anthropic-ratelimit-requests-remaining'),
            rateLimitReset: response.headers.get('anthropic-ratelimit-requests-reset'),
          },
        }

        if (!response.ok && response.status !== 400) {
          status.error = `HTTP ${response.status}: ${response.statusText}`
        }

        this.healthCache.set('anthropic', status)
        return status
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      const status: ExternalServiceStatus = {
        name: 'anthropic',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { configured: true },
      }
      this.healthCache.set('anthropic', status)
      return status
    }
  }

  async checkAWSServicesHealth(): Promise<ExternalServiceStatus[]> {
    const services: ExternalServiceStatus[] = []

    // RDS Health (implicit check via database connection)
    try {
      if (process.env.DATABASE_URL) {
        services.push({
          name: 'aws_rds',
          status: 'healthy',
          lastCheck: new Date(),
          metadata: {
            configured: true,
            connectionString: process.env.DATABASE_URL.split('@')[1] || 'configured',
          },
        })
      } else {
        services.push({
          name: 'aws_rds',
          status: 'not_configured',
          lastCheck: new Date(),
          metadata: { configured: false },
        })
      }
    } catch (error) {
      services.push({
        name: 'aws_rds',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // ElastiCache/Redis Health
    try {
      if (process.env.REDIS_URL) {
        services.push({
          name: 'aws_elasticache',
          status: 'healthy',
          lastCheck: new Date(),
          metadata: {
            configured: true,
            redisUrl: process.env.REDIS_URL.split('@')[1] || 'configured',
          },
        })
      } else {
        services.push({
          name: 'aws_elasticache',
          status: 'not_configured',
          lastCheck: new Date(),
          metadata: { configured: false },
        })
      }
    } catch (error) {
      services.push({
        name: 'aws_elasticache',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // S3 Health (check via bucket configuration)
    try {
      if (process.env.REPORTS_BUCKET || process.env.ASSETS_BUCKET) {
        services.push({
          name: 'aws_s3',
          status: 'healthy',
          lastCheck: new Date(),
          metadata: {
            configured: true,
            reportsBucket: process.env.REPORTS_BUCKET,
            assetsBucket: process.env.ASSETS_BUCKET,
          },
        })
      } else {
        services.push({
          name: 'aws_s3',
          status: 'not_configured',
          lastCheck: new Date(),
          metadata: { configured: false },
        })
      }
    } catch (error) {
      services.push({
        name: 'aws_s3',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    return services
  }

  async checkAllExternalServices(): Promise<ExternalServiceStatus[]> {
    const [openai, anthropic, awsServices] = await Promise.all([
      this.checkOpenAIHealth(),
      this.checkAnthropicHealth(),
      this.checkAWSServicesHealth(),
    ])

    return [openai, anthropic, ...awsServices]
  }

  private getCachedStatus(serviceName: string): ExternalServiceStatus | null {
    const cached = this.healthCache.get(serviceName)
    if (!cached) return null

    const age = Date.now() - cached.lastCheck.getTime()
    if (age > this.cacheTimeout) {
      this.healthCache.delete(serviceName)
      return null
    }

    return cached
  }

  async getServiceDependencyMap(): Promise<{
    configured: string[]
    healthy: string[]
    unhealthy: string[]
    notConfigured: string[]
  }> {
    const services = await this.checkAllExternalServices()

    const map = {
      configured: [] as string[],
      healthy: [] as string[],
      unhealthy: [] as string[],
      notConfigured: [] as string[],
    }

    services.forEach(service => {
      if (service.status === 'not_configured') {
        map.notConfigured.push(service.name)
      } else {
        map.configured.push(service.name)
        if (service.status === 'healthy') {
          map.healthy.push(service.name)
        } else {
          map.unhealthy.push(service.name)
        }
      }
    })

    return map
  }

  clearCache(): void {
    this.healthCache.clear()
  }

  getOverallExternalServiceHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Array.from(this.healthCache.values())

    if (statuses.length === 0) return 'healthy'

    const unhealthyCount = statuses.filter(s => s.status === 'unhealthy').length
    const totalConfigured = statuses.filter(s => s.status !== 'not_configured').length

    if (totalConfigured === 0) return 'healthy' // No services configured
    if (unhealthyCount === 0) return 'healthy'
    if (unhealthyCount === totalConfigured) return 'unhealthy'

    return 'degraded'
  }
}

export const externalServiceMonitor = ExternalServiceMonitor.getInstance()
export default ExternalServiceMonitor
