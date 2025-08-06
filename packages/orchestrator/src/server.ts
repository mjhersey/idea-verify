/**
 * Orchestrator HTTP Server
 * Provides health check endpoints and API interface for the orchestrator service
 */

import express from 'express'
import cors from 'cors'
import { initializeOrchestrator, checkOrchestratorHealth } from './index.js'
import healthCheckRouter from './health/health-check.js'

const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// Health check routes
app.use('/health', healthCheckRouter)

// API routes
const apiRouter = express.Router()

// Evaluation status endpoint
apiRouter.get('/evaluations/:id/status', async (req, res) => {
  try {
    const { orchestrator } = await initializeOrchestrator()
    const progress = orchestrator.getEvaluationProgress(req.params.id)

    if (!progress) {
      return res.status(404).json({ error: 'Evaluation not found' })
    }

    res.json(progress)
  } catch (error) {
    console.error('Error getting evaluation status:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Evaluation result endpoint
apiRouter.get('/evaluations/:id/result', async (req, res) => {
  try {
    const { orchestrator } = await initializeOrchestrator()
    const result = orchestrator.getEvaluationResult(req.params.id)

    if (!result) {
      return res.status(404).json({ error: 'Evaluation result not found' })
    }

    res.json(result)
  } catch (error) {
    console.error('Error getting evaluation result:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Service status endpoint
apiRouter.get('/status', async (req, res) => {
  try {
    const health = await checkOrchestratorHealth()
    res.status(health.status === 'healthy' ? 200 : 503).json(health)
  } catch (error) {
    console.error('Error checking orchestrator health:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.use('/api', apiRouter)

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Initialize and start server
async function startServer() {
  try {
    console.log('[Orchestrator Server] Initializing orchestrator...')

    // Initialize the orchestrator service
    const config = {
      useMockServices: process.env.NODE_ENV === 'development' && !process.env.REDIS_URL,
    }

    const { orchestrator, services, shutdown } = await initializeOrchestrator(config)

    // Store references for cleanup
    app.locals.orchestrator = orchestrator
    app.locals.services = services
    app.locals.shutdown = shutdown

    // Start HTTP server
    const server = app.listen(port, () => {
      console.log(`[Orchestrator Server] Server running on port ${port}`)
      console.log(`[Orchestrator Server] Health check: http://localhost:${port}/health`)
      console.log(`[Orchestrator Server] Detailed health: http://localhost:${port}/health/detailed`)
      console.log(`[Orchestrator Server] Service status: http://localhost:${port}/api/status`)
    })

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`[Orchestrator Server] Received ${signal}, shutting down gracefully...`)

      server.close(async () => {
        try {
          if (app.locals.shutdown) {
            await app.locals.shutdown()
          }
          console.log('[Orchestrator Server] Server closed')
          process.exit(0)
        } catch (error) {
          console.error('[Orchestrator Server] Error during shutdown:', error)
          process.exit(1)
        }
      })

      // Force close after 10 seconds
      setTimeout(() => {
        console.error(
          '[Orchestrator Server] Could not close connections in time, forcefully shutting down'
        )
        process.exit(1)
      }, 10000)
    }

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

    return server
  } catch (error) {
    console.error('[Orchestrator Server] Failed to start server:', error)
    process.exit(1)
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('[Orchestrator Server] Startup error:', error)
    process.exit(1)
  })
}

export { app, startServer }
export default app
