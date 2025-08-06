/**
 * Mock Service Manager
 * Manages all mock services for local development
 */

import { MockOpenAIService } from './openai/mock-openai-service.js'
import { MockAnthropicService } from './anthropic/mock-anthropic-service.js'

export interface MockServicesConfig {
  openai: {
    port: number
    rateLimits?: {
      requestsPerMinute: number
      tokensPerMinute: number
    }
  }
  anthropic: {
    port: number
    rateLimits?: {
      requestsPerMinute: number
      tokensPerMinute: number
    }
  }
  localstack: {
    endpoint: string
    services: string[]
  }
}

export class MockServiceManager {
  private openaiService: MockOpenAIService
  private anthropicService: MockAnthropicService
  private config: MockServicesConfig
  private isRunning = false

  constructor(config: MockServicesConfig) {
    this.config = config
    this.openaiService = new MockOpenAIService(config.openai)
    this.anthropicService = new MockAnthropicService(config.anthropic)
  }

  /**
   * Start all mock services
   */
  async startAll(): Promise<void> {
    if (this.isRunning) {
      console.log('Mock services are already running')
      return
    }

    console.log('🔧 Starting mock services...')

    try {
      // Start services in parallel
      await Promise.all([this.openaiService.start(), this.anthropicService.start()])

      this.isRunning = true
      console.log('✅ All mock services started successfully')
      console.log(`   - OpenAI API: http://localhost:${this.config.openai.port}`)
      console.log(`   - Anthropic API: http://localhost:${this.config.anthropic.port}`)
      console.log(`   - LocalStack: ${this.config.localstack.endpoint}`)
    } catch (error) {
      console.error('❌ Failed to start mock services:', error)
      await this.stopAll()
      throw error
    }
  }

  /**
   * Stop all mock services
   */
  async stopAll(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping mock services...')

    try {
      await Promise.all([this.openaiService.stop(), this.anthropicService.stop()])

      this.isRunning = false
      console.log('✅ All mock services stopped')
    } catch (error) {
      console.error('❌ Error stopping mock services:', error)
      throw error
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean
    services: {
      openai: { port: number; url: string; healthCheck: string }
      anthropic: { port: number; url: string; healthCheck: string }
      localstack: { endpoint: string; services: string[] }
    }
  } {
    return {
      isRunning: this.isRunning,
      services: {
        openai: {
          port: this.config.openai.port,
          url: `http://localhost:${this.config.openai.port}`,
          healthCheck: `http://localhost:${this.config.openai.port}/health`,
        },
        anthropic: {
          port: this.config.anthropic.port,
          url: `http://localhost:${this.config.anthropic.port}`,
          healthCheck: `http://localhost:${this.config.anthropic.port}/health`,
        },
        localstack: {
          endpoint: this.config.localstack.endpoint,
          services: this.config.localstack.services,
        },
      },
    }
  }

  /**
   * Validate all mock services are responding
   */
  async validateServices(): Promise<boolean> {
    if (!this.isRunning) {
      return false
    }

    try {
      const status = this.getStatus()

      // Test OpenAI mock
      const openaiResponse = await fetch(status.services.openai.healthCheck)
      if (!openaiResponse.ok) {
        throw new Error(`OpenAI mock service not responding: ${openaiResponse.status}`)
      }

      // Test Anthropic mock (health endpoint on different port)
      const anthropicHealthResponse = await fetch(status.services.anthropic.healthCheck)
      if (!anthropicHealthResponse.ok) {
        throw new Error(`Anthropic mock service not responding: ${anthropicHealthResponse.status}`)
      }

      // Test LocalStack (basic health check)
      try {
        const localstackResponse = await fetch(`${this.config.localstack.endpoint}/health`)
        if (!localstackResponse.ok) {
          console.warn('LocalStack health check failed - may need to start with Docker Compose')
        }
      } catch (error) {
        console.warn('LocalStack not accessible - may need to start with Docker Compose')
      }

      console.log('✅ All mock services validated successfully')
      return true
    } catch (error) {
      console.error('❌ Mock service validation failed:', error)
      return false
    }
  }
}
