/**
 * Orchestrator Package Main Export
 * Entry point for the AI Validation Orchestrator
 */

// Core orchestrator
export { OrchestratorService } from './orchestrator/orchestrator-service.js'
export type * from './orchestrator/types.js'

// Service factory for environment-based configuration
export { ServiceFactory } from './config/service-factory.js'
export type { ServiceInstances } from './config/service-factory.js'

// Agent system
export * from './agents/index.js'

// Queue system
export * from './queue/index.js'

// Database system
export * from './database/index.js'

// LLM providers
export * from './llm/index.js'

// Communication system
export * from './communication/index.js'

// Mock services for development/testing
export * from './mock/index.js'

// Main orchestrator initialization
export async function initializeOrchestrator(config?: { useMockServices?: boolean }): Promise<{
  orchestrator: OrchestratorService
  services: ServiceInstances
  shutdown: () => Promise<void>
}> {
  console.log('[Orchestrator] Initializing AI Validation Orchestrator...')

  try {
    // Initialize service factory
    const serviceFactory = ServiceFactory.getInstance()

    // Override mock services setting if provided
    if (config?.useMockServices !== undefined) {
      if (config.useMockServices && !serviceFactory.isUsingMockServices()) {
        await serviceFactory.switchToMockServices()
      } else if (!config.useMockServices && serviceFactory.isUsingMockServices()) {
        await serviceFactory.switchToRealServices()
      }
    }

    // Initialize all services
    const services = await serviceFactory.initialize()

    // Initialize orchestrator
    const orchestrator = OrchestratorService.getInstance()
    await orchestrator.initialize()

    // Health check
    const health = await serviceFactory.healthCheck()
    console.log(
      `[Orchestrator] System health: ${health.status} (using ${health.usingMockServices ? 'mock' : 'real'} services)`
    )

    if (health.status === 'unhealthy') {
      console.warn('[Orchestrator] Warning: Some services are unhealthy')
    }

    // Shutdown function
    const shutdown = async () => {
      console.log('[Orchestrator] Shutting down...')
      try {
        await orchestrator.shutdown()
        await serviceFactory.shutdown()
        console.log('[Orchestrator] Shutdown complete')
      } catch (error) {
        console.error('[Orchestrator] Error during shutdown:', error)
        throw error
      }
    }

    console.log('[Orchestrator] Initialization complete')

    return {
      orchestrator,
      services,
      shutdown,
    }
  } catch (error) {
    console.error('[Orchestrator] Initialization failed:', error)
    throw error
  }
}

// Health check utility
export async function checkOrchestratorHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: any
}> {
  try {
    const serviceFactory = ServiceFactory.getInstance()
    const health = await serviceFactory.healthCheck()

    return {
      status: health.status,
      details: {
        services: health.services,
        usingMockServices: health.usingMockServices,
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    }
  }
}

// Development utilities
export const DevUtils = {
  async enableMockServices(): Promise<void> {
    const factory = ServiceFactory.getInstance()
    await factory.switchToMockServices()
  },

  async enableRealServices(): Promise<void> {
    const factory = ServiceFactory.getInstance()
    await factory.switchToRealServices()
  },

  async getServiceStatus(): Promise<any> {
    const factory = ServiceFactory.getInstance()
    return factory.healthCheck()
  },

  createMockEnvironment: ServiceFactory.createMockEnvironment,
  getDevelopmentConfig: ServiceFactory.getDevelopmentConfig,
  getTestingConfig: ServiceFactory.getTestingConfig,
}

// Example usage and demo
export async function runDemo(useMockServices: boolean = true): Promise<void> {
  console.log('[Demo] Starting orchestrator demo...')

  const { orchestrator, shutdown } = await initializeOrchestrator({
    useMockServices,
  })

  try {
    // Create a sample evaluation request
    const evaluationRequest = {
      businessIdeaId: 'demo-idea-1',
      businessIdeaTitle: 'Smart Home Energy Management',
      businessIdeaDescription: 'AI-powered home energy optimization system',
      agentTypes: ['market-research', 'technical-feasibility'],
      priority: 'normal' as const,
      userId: 'demo-user',
    }

    console.log('[Demo] Submitting evaluation request...')
    const evaluationId = await orchestrator.submitEvaluationRequest(evaluationRequest)

    console.log(`[Demo] Evaluation submitted with ID: ${evaluationId}`)

    // Monitor progress
    let completed = false
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const progress = orchestrator.getEvaluationProgress(evaluationId)
      if (progress) {
        console.log(`[Demo] Progress: ${progress.progress}% (${progress.status})`)

        if (progress.status === 'completed' || progress.status === 'failed') {
          completed = true

          if (progress.status === 'completed') {
            const result = orchestrator.getEvaluationResult(evaluationId)
            console.log('[Demo] Evaluation completed successfully!')
            console.log(`[Demo] Overall score: ${result?.overallScore}`)
            console.log(`[Demo] Agent results: ${result?.agentResults.length}`)
          } else {
            console.log('[Demo] Evaluation failed')
          }
        }
      }

      attempts++
    }

    if (!completed) {
      console.log('[Demo] Timeout waiting for evaluation completion')
    }
  } catch (error) {
    console.error('[Demo] Demo failed:', error)
  } finally {
    console.log('[Demo] Shutting down...')
    await shutdown()
    console.log('[Demo] Demo complete')
  }
}
