/**
 * Health check endpoints for Orchestrator service
 */

import { Router, Request, Response } from 'express'

const router = Router()

// Basic health check endpoint
router.get('/', (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    service: 'orchestrator'
  }

  res.status(200).json(health)
})

// Detailed health check endpoint with agent and queue status
router.get('/detailed', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    service: 'orchestrator',
    status: 'healthy',
    services: {}
  }

  let overallStatus = 'healthy'

  // Database connection check
  try {
    // Import database manager dynamically
    const { DatabaseManager } = await import('../database/database-manager.js')
    const dbManager = new DatabaseManager()
    await dbManager.testConnection()
    
    checks.services.database = {
      status: 'healthy',
      connection: 'active'
    }
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      connection: 'failed'
    }
    overallStatus = 'degraded'
  }

  // Redis/Queue health check
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis')
      const redis = createClient({ url: process.env.REDIS_URL })
      
      const startTime = Date.now()
      await redis.connect()
      await redis.ping()
      const responseTime = Date.now() - startTime
      await redis.quit()
      
      checks.services.queue = {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        connection: 'active',
        type: 'redis'
      }
    } catch (error) {
      checks.services.queue = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        connection: 'failed',
        type: 'redis'
      }
      overallStatus = 'degraded'
    }
  } else {
    checks.services.queue = {
      status: 'configured',
      type: 'mock',
      message: 'Using mock queue implementation'
    }
  }

  // LLM Provider checks
  const llmProviders = []
  
  if (process.env.OPENAI_API_KEY) {
    llmProviders.push('openai')
    checks.services.openai = {
      status: 'configured',
      configured: true
    }
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    llmProviders.push('anthropic')
    checks.services.anthropic = {
      status: 'configured',
      configured: true
    }
  }

  if (llmProviders.length === 0) {
    checks.services.llm_providers = {
      status: 'warning',
      message: 'No LLM providers configured, using mock services',
      available: ['mock']
    }
    if (overallStatus === 'healthy') {
      overallStatus = 'warning'
    }
  } else {
    checks.services.llm_providers = {
      status: 'healthy',
      configured: llmProviders,
      count: llmProviders.length
    }
  }

  // Agent availability check
  try {
    const { AgentService } = await import('../agents/agent-service.js')
    const agentService = new AgentService()
    const availableAgents = agentService.getAvailableAgents()
    
    checks.services.agents = {
      status: 'healthy',
      available: availableAgents,
      count: availableAgents.length
    }
  } catch (error) {
    checks.services.agents = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown agent error'
    }
    overallStatus = 'degraded'
  }

  // Memory usage check
  const memUsage = process.memoryUsage()
  checks.services.memory = {
    status: 'healthy',
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
  }

  checks.status = overallStatus

  // Return appropriate status code based on health
  const responseStatusCode = overallStatus === 'healthy' ? 200 : 
                            overallStatus === 'warning' ? 200 : 503

  res.status(responseStatusCode).json(checks)
})

// Agent-specific health check
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const { AgentService } = await import('../agents/agent-service.js')
    const agentService = new AgentService()
    const availableAgents = agentService.getAvailableAgents()
    
    const agentStatus: Record<string, any> = {}
    
    // Check each agent type
    for (const agentType of availableAgents) {
      try {
        const agent = agentService.createAgent(agentType, {})
        agentStatus[agentType] = {
          status: 'healthy',
          available: true
        }
      } catch (error) {
        agentStatus[agentType] = {
          status: 'unhealthy',
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      component: 'agents',
      agents: agentStatus,
      total: availableAgents.length
    })
  } catch (error) {
    res.status(503).json({
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      component: 'agents',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Queue health check
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const { QueueManager } = await import('../queue/queue-manager.js')
    const queueManager = new QueueManager()
    
    // Get queue statistics if available
    const queueStats = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      type: process.env.REDIS_URL ? 'redis' : 'mock'
    }
    
    res.status(200).json({
      ...queueStats,
      service: 'orchestrator',
      component: 'queue'
    })
  } catch (error) {
    res.status(503).json({
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      component: 'queue',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Liveness probe endpoint (simple)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    service: 'orchestrator'
  })
})

// Readiness probe endpoint (checks critical dependencies)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const { DatabaseManager } = await import('../database/database-manager.js')
    const dbManager = new DatabaseManager()
    await dbManager.testConnection()
    
    // Check agent service initialization
    const { AgentService } = await import('../agents/agent-service.js')
    const agentService = new AgentService()
    const availableAgents = agentService.getAvailableAgents()
    
    res.status(200).json({ 
      status: 'ready', 
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      database: 'connected',
      agents: availableAgents.length
    })
  } catch (error) {
    res.status(503).json({ 
      status: 'not_ready', 
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router