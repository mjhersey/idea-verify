/**
 * Environment Validation and Smoke Tests
 */

import { HealthMonitor } from '../health/health-monitor.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('environment-validator')

export interface EnvironmentValidationResult {
  environment: string
  valid: boolean
  checks: ValidationCheck[]
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
}

export interface ValidationCheck {
  name: string
  category: 'infrastructure' | 'services' | 'configuration' | 'security'
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: Record<string, any>
  duration?: number
}

export class EnvironmentValidator {
  private environment: string
  private healthMonitor: HealthMonitor
  private baseUrl?: string

  constructor(environment: string, baseUrl?: string) {
    this.environment = environment
    this.baseUrl = baseUrl
    this.healthMonitor = new HealthMonitor()
  }

  /**
   * Run comprehensive environment validation
   */
  async validate(): Promise<EnvironmentValidationResult> {
    const startTime = Date.now()
    const checks: ValidationCheck[] = []

    logger.info('Starting environment validation', {
      environment: this.environment,
      baseUrl: this.baseUrl,
    })

    // Infrastructure checks
    checks.push(...(await this.validateInfrastructure()))

    // Service checks
    checks.push(...(await this.validateServices()))

    // Configuration checks
    checks.push(...(await this.validateConfiguration()))

    // Security checks
    checks.push(...(await this.validateSecurity()))

    const summary = this.calculateSummary(checks)
    const valid = summary.failed === 0

    const result: EnvironmentValidationResult = {
      environment: this.environment,
      valid,
      checks,
      summary,
    }

    const duration = Date.now() - startTime
    logger.info('Environment validation completed', {
      environment: this.environment,
      valid,
      duration,
      summary,
    })

    return result
  }

  private async validateInfrastructure(): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = []

    // Database connectivity
    checks.push(await this.checkDatabaseConnectivity())

    // Redis connectivity
    checks.push(await this.checkRedisConnectivity())

    // S3 buckets
    checks.push(await this.checkS3Buckets())

    // Load balancer
    checks.push(await this.checkLoadBalancer())

    return checks
  }

  private async validateServices(): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = []

    if (!this.baseUrl) {
      checks.push({
        name: 'Service Health Checks',
        category: 'services',
        status: 'warning',
        message: 'Base URL not provided, skipping service health checks',
      })
      return checks
    }

    // API service health
    checks.push(await this.checkApiHealth())

    // Web service availability
    checks.push(await this.checkWebService())

    // Authentication endpoints
    checks.push(await this.checkAuthenticationEndpoints())

    // Business logic endpoints
    checks.push(await this.checkBusinessEndpoints())

    return checks
  }

  private async validateConfiguration(): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = []

    // Environment variables
    checks.push(await this.checkEnvironmentVariables())

    // Parameter Store values
    checks.push(await this.checkParameterStore())

    // Secrets Manager
    checks.push(await this.checkSecretsManager())

    // Feature flags
    checks.push(await this.checkFeatureFlags())

    return checks
  }

  private async validateSecurity(): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = []

    // HTTPS enforcement
    checks.push(await this.checkHttpsEnforcement())

    // CORS configuration
    checks.push(await this.checkCorsConfiguration())

    // Security headers
    checks.push(await this.checkSecurityHeaders())

    // Rate limiting
    checks.push(await this.checkRateLimiting())

    return checks
  }

  private async checkDatabaseConnectivity(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      const health = await this.healthMonitor.checkDatabaseHealth()
      const duration = Date.now() - startTime

      return {
        name: 'Database Connectivity',
        category: 'infrastructure',
        status: health.status === 'healthy' ? 'pass' : 'fail',
        message: health.message || 'Database health check completed',
        details: health.details,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Database Connectivity',
        category: 'infrastructure',
        status: 'fail',
        message: `Database connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkRedisConnectivity(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      const health = await this.healthMonitor.checkRedisHealth()
      const duration = Date.now() - startTime

      return {
        name: 'Redis Connectivity',
        category: 'infrastructure',
        status: health.status === 'healthy' ? 'pass' : 'fail',
        message: health.message || 'Redis health check completed',
        details: health.details,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Redis Connectivity',
        category: 'infrastructure',
        status: 'fail',
        message: `Redis connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkS3Buckets(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      // Check if S3 buckets are accessible
      const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3')
      const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })

      const buckets = [
        `ai-validation-reports-${this.environment}`,
        `ai-validation-assets-${this.environment}`,
      ]

      for (const bucketName of buckets) {
        const command = new HeadBucketCommand({ Bucket: bucketName })
        await client.send(command)
      }

      const duration = Date.now() - startTime
      return {
        name: 'S3 Bucket Access',
        category: 'infrastructure',
        status: 'pass',
        message: 'S3 buckets are accessible',
        details: { buckets },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'S3 Bucket Access',
        category: 'infrastructure',
        status: 'fail',
        message: `S3 bucket access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkLoadBalancer(): Promise<ValidationCheck> {
    const startTime = Date.now()

    if (!this.baseUrl) {
      return {
        name: 'Load Balancer Health',
        category: 'infrastructure',
        status: 'warning',
        message: 'Base URL not provided, cannot check load balancer',
        duration: Date.now() - startTime,
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`)
      const duration = Date.now() - startTime

      if (response.ok) {
        return {
          name: 'Load Balancer Health',
          category: 'infrastructure',
          status: 'pass',
          message: 'Load balancer is responding',
          details: { status: response.status, statusText: response.statusText },
          duration,
        }
      } else {
        return {
          name: 'Load Balancer Health',
          category: 'infrastructure',
          status: 'fail',
          message: `Load balancer returned ${response.status}: ${response.statusText}`,
          duration,
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Load Balancer Health',
        category: 'infrastructure',
        status: 'fail',
        message: `Load balancer check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkApiHealth(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/api/health/detailed`)
      const duration = Date.now() - startTime

      if (response.ok) {
        const healthData = await response.json()
        const hasUnhealthyServices = Object.values(healthData.services || {}).some(
          (service: any) => service.status !== 'healthy'
        )

        return {
          name: 'API Service Health',
          category: 'services',
          status: hasUnhealthyServices ? 'warning' : 'pass',
          message: hasUnhealthyServices
            ? 'Some services are unhealthy'
            : 'All API services are healthy',
          details: healthData,
          duration,
        }
      } else {
        return {
          name: 'API Service Health',
          category: 'services',
          status: 'fail',
          message: `API health check failed: ${response.status} ${response.statusText}`,
          duration,
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'API Service Health',
        category: 'services',
        status: 'fail',
        message: `API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkWebService(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/`)
      const duration = Date.now() - startTime

      if (response.ok) {
        return {
          name: 'Web Service Availability',
          category: 'services',
          status: 'pass',
          message: 'Web service is available',
          details: { status: response.status },
          duration,
        }
      } else {
        return {
          name: 'Web Service Availability',
          category: 'services',
          status: 'fail',
          message: `Web service returned ${response.status}: ${response.statusText}`,
          duration,
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Web Service Availability',
        category: 'services',
        status: 'fail',
        message: `Web service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkAuthenticationEndpoints(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      // Check auth endpoints without credentials (should return appropriate errors)
      const endpoints = ['/api/auth/register', '/api/auth/login', '/api/auth/refresh']
      const results = []

      for (const endpoint of endpoints) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        results.push({ endpoint, status: response.status })
      }

      const duration = Date.now() - startTime
      const allResponding = results.every(r => r.status >= 400 && r.status < 500)

      return {
        name: 'Authentication Endpoints',
        category: 'services',
        status: allResponding ? 'pass' : 'fail',
        message: allResponding
          ? 'Authentication endpoints are responding'
          : 'Some auth endpoints are not responding correctly',
        details: { endpoints: results },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Authentication Endpoints',
        category: 'services',
        status: 'fail',
        message: `Authentication endpoint check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkBusinessEndpoints(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      // Check key business endpoints (should return 401 without auth)
      const endpoints = ['/api/ideas', '/api/evaluations']
      const results = []

      for (const endpoint of endpoints) {
        const response = await fetch(`${this.baseUrl}${endpoint}`)
        results.push({ endpoint, status: response.status })
      }

      const duration = Date.now() - startTime
      const allResponding = results.every(r => r.status === 401)

      return {
        name: 'Business Endpoints',
        category: 'services',
        status: allResponding ? 'pass' : 'warning',
        message: allResponding
          ? 'Business endpoints require authentication'
          : 'Business endpoints may have issues',
        details: { endpoints: results },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Business Endpoints',
        category: 'services',
        status: 'fail',
        message: `Business endpoint check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkEnvironmentVariables(): Promise<ValidationCheck> {
    const requiredVars = ['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET']

    const missing = requiredVars.filter(varName => !process.env[varName])

    return {
      name: 'Environment Variables',
      category: 'configuration',
      status: missing.length === 0 ? 'pass' : 'fail',
      message:
        missing.length === 0
          ? 'All required environment variables are set'
          : `Missing variables: ${missing.join(', ')}`,
      details: { required: requiredVars, missing },
    }
  }

  private async checkParameterStore(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm')
      const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' })

      const parameterNames = [
        `/ai-validation/${this.environment}/database/name`,
        `/ai-validation/${this.environment}/app/node-env`,
        `/ai-validation/${this.environment}/features/enable-health-checks`,
      ]

      const command = new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: false,
      })

      const response = await client.send(command)
      const duration = Date.now() - startTime

      const foundParams = response.Parameters?.length || 0
      const expectedParams = parameterNames.length

      return {
        name: 'Parameter Store Configuration',
        category: 'configuration',
        status: foundParams === expectedParams ? 'pass' : 'warning',
        message: `Found ${foundParams}/${expectedParams} expected parameters`,
        details: { parameters: response.Parameters },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Parameter Store Configuration',
        category: 'configuration',
        status: 'fail',
        message: `Parameter Store check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkSecretsManager(): Promise<ValidationCheck> {
    const startTime = Date.now()

    try {
      const { SecretsManagerClient, DescribeSecretCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      )
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' })

      const secretNames = [
        `/ai-validation/${this.environment}/jwt/secret`,
        `/ai-validation/${this.environment}/external/openai-api-key`,
      ]

      let foundSecrets = 0
      for (const secretName of secretNames) {
        try {
          const command = new DescribeSecretCommand({ SecretId: secretName })
          await client.send(command)
          foundSecrets++
        } catch {
          // Secret not found or no access
        }
      }

      const duration = Date.now() - startTime

      return {
        name: 'Secrets Manager Configuration',
        category: 'configuration',
        status: foundSecrets > 0 ? 'pass' : 'warning',
        message: `Found ${foundSecrets}/${secretNames.length} expected secrets`,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Secrets Manager Configuration',
        category: 'configuration',
        status: 'fail',
        message: `Secrets Manager check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkFeatureFlags(): Promise<ValidationCheck> {
    const { FeatureFlagManager } = await import('../config/feature-flags.js')
    const flagManager = new FeatureFlagManager(this.environment)

    try {
      await flagManager.loadFromParameterStore()
      const flags = flagManager.getAllFlags()

      return {
        name: 'Feature Flags Configuration',
        category: 'configuration',
        status: 'pass',
        message: 'Feature flags loaded successfully',
        details: { flags },
      }
    } catch (error) {
      return {
        name: 'Feature Flags Configuration',
        category: 'configuration',
        status: 'warning',
        message: `Feature flags check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async checkHttpsEnforcement(): Promise<ValidationCheck> {
    if (!this.baseUrl) {
      return {
        name: 'HTTPS Enforcement',
        category: 'security',
        status: 'warning',
        message: 'Base URL not provided, cannot check HTTPS enforcement',
      }
    }

    const isHttps = this.baseUrl.startsWith('https://')

    return {
      name: 'HTTPS Enforcement',
      category: 'security',
      status: isHttps ? 'pass' : this.environment === 'prod' ? 'fail' : 'warning',
      message: isHttps ? 'HTTPS is enforced' : 'HTTPS is not enforced',
      details: { baseUrl: this.baseUrl, isHttps },
    }
  }

  private async checkCorsConfiguration(): Promise<ValidationCheck> {
    const startTime = Date.now()

    if (!this.baseUrl) {
      return {
        name: 'CORS Configuration',
        category: 'security',
        status: 'warning',
        message: 'Base URL not provided, cannot check CORS configuration',
        duration: Date.now() - startTime,
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'OPTIONS',
      })

      const duration = Date.now() - startTime
      const corsHeaders = {
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
      }

      const hasCorsHeaders = Object.values(corsHeaders).some(header => header !== null)

      return {
        name: 'CORS Configuration',
        category: 'security',
        status: hasCorsHeaders ? 'pass' : 'warning',
        message: hasCorsHeaders
          ? 'CORS headers are configured'
          : 'CORS headers may not be configured',
        details: { corsHeaders },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'CORS Configuration',
        category: 'security',
        status: 'warning',
        message: `CORS check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkSecurityHeaders(): Promise<ValidationCheck> {
    const startTime = Date.now()

    if (!this.baseUrl) {
      return {
        name: 'Security Headers',
        category: 'security',
        status: 'warning',
        message: 'Base URL not provided, cannot check security headers',
        duration: Date.now() - startTime,
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/`)
      const duration = Date.now() - startTime

      const securityHeaders = {
        'x-frame-options': response.headers.get('x-frame-options'),
        'x-content-type-options': response.headers.get('x-content-type-options'),
        'x-xss-protection': response.headers.get('x-xss-protection'),
        'strict-transport-security': response.headers.get('strict-transport-security'),
        'content-security-policy': response.headers.get('content-security-policy'),
      }

      const presentHeaders = Object.entries(securityHeaders).filter(
        ([_, value]) => value !== null
      ).length

      const status = presentHeaders >= 3 ? 'pass' : presentHeaders >= 1 ? 'warning' : 'fail'

      return {
        name: 'Security Headers',
        category: 'security',
        status,
        message: `${presentHeaders}/5 security headers present`,
        details: { securityHeaders },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Security Headers',
        category: 'security',
        status: 'warning',
        message: `Security headers check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private async checkRateLimiting(): Promise<ValidationCheck> {
    const startTime = Date.now()

    if (!this.baseUrl) {
      return {
        name: 'Rate Limiting',
        category: 'security',
        status: 'warning',
        message: 'Base URL not provided, cannot check rate limiting',
        duration: Date.now() - startTime,
      }
    }

    try {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(10)
        .fill(null)
        .map(() => fetch(`${this.baseUrl}/api/health`))

      const responses = await Promise.all(promises)
      const duration = Date.now() - startTime

      const rateLimitedResponses = responses.filter(r => r.status === 429).length
      const hasRateLimitHeaders = responses.some(
        r =>
          r.headers.get('x-ratelimit-limit') ||
          r.headers.get('x-ratelimit-remaining') ||
          r.headers.get('retry-after')
      )

      const status =
        rateLimitedResponses > 0 || hasRateLimitHeaders
          ? 'pass'
          : this.environment === 'prod'
            ? 'warning'
            : 'pass'

      return {
        name: 'Rate Limiting',
        category: 'security',
        status,
        message:
          rateLimitedResponses > 0
            ? `Rate limiting active (${rateLimitedResponses}/10 requests limited)`
            : hasRateLimitHeaders
              ? 'Rate limiting headers present'
              : 'No rate limiting detected',
        details: { rateLimitedResponses, hasRateLimitHeaders },
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Rate Limiting',
        category: 'security',
        status: 'warning',
        message: `Rate limiting check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
      }
    }
  }

  private calculateSummary(checks: ValidationCheck[]) {
    return {
      total: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      failed: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warning').length,
    }
  }
}

export default EnvironmentValidator
