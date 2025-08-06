/**
 * API Router Implementation
 * Handles HTTP endpoints for evaluation management and system monitoring
 */

import { Router, Request, Response, NextFunction } from 'express'
import { OrchestratorService } from '../orchestrator/orchestrator-service.js'
import { ServiceFactory } from '../config/service-factory.js'
import { RequestValidator } from './request-validator.js'
import { ErrorHandler } from './error-handler.js'
import { formatEvaluationResponse, formatAgentResultResponse } from './utils.js'
import {
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
  EvaluationQueryParams,
  AgentQueryParams,
  HTTP_STATUS,
  ERROR_CODES,
  API_ROUTES,
} from './types.js'

export class APIRouter {
  private router: Router
  private orchestrator: OrchestratorService
  private serviceFactory: ServiceFactory
  private validator: RequestValidator
  private errorHandler: ErrorHandler

  constructor() {
    this.router = Router()
    this.orchestrator = OrchestratorService.getInstance()
    this.serviceFactory = ServiceFactory.getInstance()
    this.validator = new RequestValidator()
    this.errorHandler = new ErrorHandler()
    this.setupRoutes()
  }

  getRouter(): Router {
    return this.router
  }

  private setupRoutes(): void {
    // Add request ID middleware
    this.router.use(this.addRequestId)

    // Evaluation endpoints
    this.router.post('/api/evaluations', this.createEvaluation.bind(this))
    this.router.get('/api/evaluations/:id', this.getEvaluation.bind(this))
    this.router.put('/api/evaluations/:id', this.updateEvaluation.bind(this))
    this.router.delete('/api/evaluations/:id', this.deleteEvaluation.bind(this))
    this.router.get('/api/evaluations', this.listEvaluations.bind(this))
    this.router.get('/api/evaluations/:id/result', this.getEvaluationResult.bind(this))

    // Agent endpoints
    this.router.get('/api/agents/results', this.listAgentResults.bind(this))
    this.router.get('/api/agents/results/:id', this.getAgentResult.bind(this))

    // System endpoints
    this.router.get('/api/health', this.healthCheck.bind(this))
    this.router.get('/api/status', this.systemStatus.bind(this))
    this.router.get('/api/metrics', this.getMetrics.bind(this))

    // Development endpoints
    this.router.post('/api/dev/mock-services', this.toggleMockServices.bind(this))
    this.router.post('/api/dev/reset', this.resetSystem.bind(this))

    // Error handling
    this.router.use(this.errorHandler.handle.bind(this.errorHandler))
  }

  private addRequestId(req: Request, res: Response, next: NextFunction): void {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    res.locals.requestId = requestId
    res.setHeader('X-Request-ID', requestId)
    next()
  }

  // Evaluation endpoints

  private async createEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedRequest = this.validator.validateCreateEvaluationRequest(req.body)

      const evaluationId = await this.orchestrator.submitEvaluationRequest({
        businessIdeaId: validatedRequest.businessIdeaId,
        businessIdeaTitle: validatedRequest.businessIdeaTitle,
        businessIdeaDescription: validatedRequest.businessIdeaDescription,
        agentTypes: validatedRequest.agentTypes || [],
        priority: validatedRequest.priority,
      })

      const progress = this.orchestrator.getEvaluationProgress(evaluationId)
      const response = formatEvaluationResponse(progress)

      res.status(HTTP_STATUS.CREATED).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async getEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const progress = this.orchestrator.getEvaluationProgress(id)
      if (!progress) {
        return next(
          this.errorHandler.createError(
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.EVALUATION_NOT_FOUND,
            `Evaluation with ID ${id} not found`
          )
        )
      }

      const response = formatEvaluationResponse(progress)
      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async updateEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const validatedRequest = this.validator.validateUpdateEvaluationRequest(req.body)

      const progress = this.orchestrator.getEvaluationProgress(id)
      if (!progress) {
        return next(
          this.errorHandler.createError(
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.EVALUATION_NOT_FOUND,
            `Evaluation with ID ${id} not found`
          )
        )
      }

      // For now, updating is limited - in a full implementation this would update the database
      const response = formatEvaluationResponse(progress)
      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async deleteEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const progress = this.orchestrator.getEvaluationProgress(id)
      if (!progress) {
        return next(
          this.errorHandler.createError(
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.EVALUATION_NOT_FOUND,
            `Evaluation with ID ${id} not found`
          )
        )
      }

      // Cancel the evaluation if it's still running
      if (progress.status === 'analyzing') {
        await this.orchestrator.cancelEvaluation(id)
      }

      res.status(HTTP_STATUS.NO_CONTENT).send()
    } catch (error) {
      next(error)
    }
  }

  private async listEvaluations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryParams = this.validator.validateEvaluationQueryParams(req.query)

      // In a full implementation, this would query the database with pagination
      // For now, return empty list since we don't have a full repository implementation
      const response = {
        evaluations: [],
        pagination: {
          page: queryParams.page || 1,
          limit: queryParams.limit || 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        },
      }

      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async getEvaluationResult(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const result = this.orchestrator.getEvaluationResult(id)
      if (!result) {
        return next(
          this.errorHandler.createError(
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.EVALUATION_NOT_FOUND,
            `Evaluation result for ID ${id} not found`
          )
        )
      }

      res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      next(error)
    }
  }

  // Agent endpoints

  private async listAgentResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryParams = this.validator.validateAgentQueryParams(req.query)

      // In a full implementation, this would query the database
      // For now, return empty list
      res.status(HTTP_STATUS.OK).json([])
    } catch (error) {
      next(error)
    }
  }

  private async getAgentResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      // In a full implementation, this would query the database
      // For now, return not found
      return next(
        this.errorHandler.createError(
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.EVALUATION_NOT_FOUND,
          `Agent result with ID ${id} not found`
        )
      )
    } catch (error) {
      next(error)
    }
  }

  // System endpoints

  private async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isHealthy = await this.orchestrator.healthCheck()

      const response = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          orchestrator: isHealthy,
          llm: true, // This would check actual LLM service
          queue: true, // This would check actual queue service
          database: true, // This would check actual database service
        },
        usingMockServices: this.serviceFactory.isUsingMockServices(),
      }

      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async systemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.serviceFactory.healthCheck()

      const response = {
        status: health.status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: health.services,
        usingMockServices: health.usingMockServices,
        metrics: {
          totalEvaluations: 0,
          activeEvaluations: 0,
          completedEvaluations: 0,
          failedEvaluations: 0,
          averageProcessingTime: 0,
          averageScore: 0,
        },
      }

      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // In a full implementation, this would gather metrics from database and services
      const metrics = {
        totalEvaluations: 0,
        activeEvaluations: 0,
        completedEvaluations: 0,
        failedEvaluations: 0,
        averageProcessingTime: 0,
        averageScore: 0,
        queueStats: {
          pending: 0,
          active: 0,
          completed: 0,
          failed: 0,
        },
        systemHealth: {
          cpuUsage: process.cpuUsage(),
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        },
      }

      res.status(HTTP_STATUS.OK).json(metrics)
    } catch (error) {
      next(error)
    }
  }

  // Development endpoints

  private async toggleMockServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enabled } = req.body

      if (typeof enabled !== 'boolean') {
        return next(
          this.errorHandler.createError(
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR,
            'enabled field must be a boolean'
          )
        )
      }

      if (enabled && !this.serviceFactory.isUsingMockServices()) {
        await this.serviceFactory.switchToMockServices()
      } else if (!enabled && this.serviceFactory.isUsingMockServices()) {
        await this.serviceFactory.switchToRealServices()
      }

      const response = {
        mockServicesEnabled: this.serviceFactory.isUsingMockServices(),
        timestamp: new Date().toISOString(),
      }

      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }

  private async resetSystem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Reset orchestrator state
      await this.orchestrator.resetState()

      // Reset service factory if using mocks
      if (this.serviceFactory.isUsingMockServices()) {
        await this.serviceFactory.shutdown()
        await this.serviceFactory.initialize()
      }

      const response = {
        message: 'System reset completed',
        timestamp: new Date().toISOString(),
        usingMockServices: this.serviceFactory.isUsingMockServices(),
      }

      res.status(HTTP_STATUS.OK).json(response)
    } catch (error) {
      next(error)
    }
  }
}
