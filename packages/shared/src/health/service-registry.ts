/**
 * Service Registry for Health Checks and Service Discovery
 */

export interface ServiceEndpoint {
  name: string
  url: string
  healthPath: string
  timeout?: number
  retries?: number
}

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  responseTime?: number
  lastCheck: Date
  error?: string
  metadata?: Record<string, any>
}

export interface ExternalServiceConfig {
  name: string
  baseUrl: string
  apiKey?: string
  timeout?: number
  retries?: number
}

export class ServiceRegistry {
  private services: Map<string, ServiceEndpoint> = new Map()
  private healthCache: Map<string, ServiceHealth> = new Map()
  private cacheTimeout = 30000 // 30 seconds

  constructor() {
    this.initializeDefaultServices()
  }

  private initializeDefaultServices() {
    // Register internal services
    this.registerService({
      name: 'api',
      url: process.env.API_SERVICE_URL || 'http://localhost:3000',
      healthPath: '/health',
    })

    this.registerService({
      name: 'orchestrator',
      url: process.env.ORCHESTRATOR_SERVICE_URL || 'http://localhost:3001',
      healthPath: '/health',
    })

    this.registerService({
      name: 'web',
      url: process.env.WEB_SERVICE_URL || 'http://localhost:8080',
      healthPath: '/health',
    })
  }

  registerService(service: ServiceEndpoint): void {
    this.services.set(service.name, {
      timeout: 5000,
      retries: 2,
      ...service,
    })
  }

  unregisterService(name: string): void {
    this.services.delete(name)
    this.healthCache.delete(name)
  }

  async checkServiceHealth(name: string, forceRefresh = false): Promise<ServiceHealth> {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not registered`)
    }

    // Check cache first
    const cached = this.healthCache.get(name)
    if (!forceRefresh && cached && Date.now() - cached.lastCheck.getTime() < this.cacheTimeout) {
      return cached
    }

    const startTime = Date.now()
    let health: ServiceHealth

    try {
      const response = await this.makeHealthRequest(service)
      const responseTime = Date.now() - startTime

      health = {
        name,
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        metadata: response.data,
      }

      if (!response.ok) {
        health.error = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error) {
      health = {
        name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    this.healthCache.set(name, health)
    return health
  }

  private async makeHealthRequest(service: ServiceEndpoint): Promise<{
    ok: boolean
    status: number
    statusText: string
    data?: any
  }> {
    const url = `${service.url}${service.healthPath}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), service.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ServiceRegistry/1.0',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      let data
      try {
        data = await response.json()
      } catch {
        // Response might not be JSON
        data = { status: response.ok ? 'healthy' : 'unhealthy' }
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async checkAllServices(forceRefresh = false): Promise<ServiceHealth[]> {
    const serviceNames = Array.from(this.services.keys())
    const promises = serviceNames.map(name =>
      this.checkServiceHealth(name, forceRefresh).catch(error => ({
        name,
        status: 'unknown' as const,
        lastCheck: new Date(),
        error: error.message,
      }))
    )

    return Promise.all(promises)
  }

  async checkExternalServices(): Promise<ServiceHealth[]> {
    const externalServices: ExternalServiceConfig[] = []

    // OpenAI API check
    if (process.env.OPENAI_API_KEY) {
      externalServices.push({
        name: 'openai',
        baseUrl: 'https://api.openai.com',
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 10000,
      })
    }

    // Anthropic API check
    if (process.env.ANTHROPIC_API_KEY) {
      externalServices.push({
        name: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: process.env.ANTHROPIC_API_KEY,
        timeout: 10000,
      })
    }

    const healthChecks = externalServices.map(service => this.checkExternalService(service))

    return Promise.all(healthChecks)
  }

  private async checkExternalService(config: ExternalServiceConfig): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      let testEndpoint = ''
      let headers: Record<string, string> = {}

      if (config.name === 'openai') {
        testEndpoint = '/v1/models'
        headers = {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        }
      } else if (config.name === 'anthropic') {
        testEndpoint = '/v1/messages'
        headers = {
          'x-api-key': config.apiKey!,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      try {
        const response = await fetch(`${config.baseUrl}${testEndpoint}`, {
          method: config.name === 'anthropic' ? 'POST' : 'GET',
          headers,
          body:
            config.name === 'anthropic'
              ? JSON.stringify({
                  model: 'claude-3-haiku-20240307',
                  max_tokens: 1,
                  messages: [{ role: 'user', content: 'test' }],
                })
              : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime

        return {
          name: config.name,
          status: response.ok || response.status === 400 ? 'healthy' : 'unhealthy', // 400 is ok for test calls
          responseTime,
          lastCheck: new Date(),
          metadata: {
            statusCode: response.status,
            configured: true,
          },
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      return {
        name: config.name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { configured: true },
      }
    }
  }

  getRegisteredServices(): string[] {
    return Array.from(this.services.keys())
  }

  getServiceEndpoint(name: string): ServiceEndpoint | undefined {
    return this.services.get(name)
  }

  getCachedHealth(name: string): ServiceHealth | undefined {
    return this.healthCache.get(name)
  }

  clearHealthCache(): void {
    this.healthCache.clear()
  }

  async getServiceMap(): Promise<Record<string, ServiceHealth>> {
    const allHealth = await this.checkAllServices()
    const externalHealth = await this.checkExternalServices()

    const serviceMap: Record<string, ServiceHealth> = {}

    const combinedHealth = allHealth.concat(externalHealth)
    combinedHealth.forEach(health => {
      serviceMap[health.name] = health
    })

    return serviceMap
  }
}

// Singleton instance
let serviceRegistryInstance: ServiceRegistry | null = null

export function getServiceRegistry(): ServiceRegistry {
  if (!serviceRegistryInstance) {
    serviceRegistryInstance = new ServiceRegistry()
  }
  return serviceRegistryInstance
}

export default ServiceRegistry
