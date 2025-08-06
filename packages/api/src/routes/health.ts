import { Router, Request, Response } from 'express'
import { PrismaClient } from '../generated/prisma/index.js'

const router = Router()
const prisma = new PrismaClient()

// Basic health check endpoint
router.get('/', (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  }

  res.status(200).json(health)
})

// Detailed health check endpoint with dependency checks
router.get('/detailed', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    status: 'healthy',
    services: {},
  }

  let overallStatus = 'healthy'
  const statusCode = 200

  // Database health check
  try {
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1 as health_check`
    const responseTime = Date.now() - startTime

    checks.services.database = {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      connection: 'active',
    }
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      connection: 'failed',
    }
    overallStatus = 'degraded'
  }

  // Redis health check (if Redis URL is configured)
  if (process.env.REDIS_URL) {
    try {
      // Import Redis dynamically to avoid issues if not installed
      const { createClient } = await import('redis')
      const redis = createClient({ url: process.env.REDIS_URL })

      const startTime = Date.now()
      await redis.connect()
      await redis.ping()
      const responseTime = Date.now() - startTime
      await redis.quit()

      checks.services.redis = {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        connection: 'active',
      }
    } catch (error) {
      checks.services.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        connection: 'failed',
      }
      overallStatus = 'degraded'
    }
  } else {
    checks.services.redis = {
      status: 'not_configured',
      message: 'Redis URL not provided',
    }
  }

  // External services health check (LLM providers)
  try {
    const { ExternalServiceMonitor } = await import('@ai-validation/shared')
    const monitor = ExternalServiceMonitor.getInstance()
    const externalServices = await monitor.checkAllExternalServices()

    externalServices.forEach(service => {
      checks.services[service.name] = {
        status: service.status,
        responseTime: service.responseTime ? `${service.responseTime}ms` : undefined,
        configured: service.metadata?.configured || false,
        error: service.error,
        lastCheck: service.lastCheck.toISOString(),
      }

      if (service.status === 'unhealthy' && overallStatus === 'healthy') {
        overallStatus = 'degraded'
      }
    })
  } catch (error) {
    checks.services.external_monitor = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Failed to check external services',
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
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
  }

  // Disk space check (basic)
  try {
    const fs = await import('fs')
    const stats = await fs.promises.statfs('/')
    const freeSpace = stats.bavail * stats.bsize
    const totalSpace = stats.blocks * stats.bsize
    const usedPercent = ((totalSpace - freeSpace) / totalSpace) * 100

    checks.services.disk = {
      status: usedPercent > 90 ? 'warning' : 'healthy',
      freeSpace: `${Math.round(freeSpace / 1024 / 1024 / 1024)}GB`,
      totalSpace: `${Math.round(totalSpace / 1024 / 1024 / 1024)}GB`,
      usedPercent: `${Math.round(usedPercent)}%`,
    }

    if (usedPercent > 90 && overallStatus === 'healthy') {
      overallStatus = 'warning'
    }
  } catch (error) {
    checks.services.disk = {
      status: 'unknown',
      error: 'Could not check disk space',
    }
  }

  checks.status = overallStatus

  // Return appropriate status code based on health
  const responseStatusCode =
    overallStatus === 'healthy' ? 200 : overallStatus === 'warning' ? 200 : 503

  res.status(responseStatusCode).json(checks)
})

// Liveness probe endpoint (simple)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() })
})

// Readiness probe endpoint (checks critical dependencies)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1 as readiness_check`

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
    })
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
