import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import { OrchestratorService } from '@ai-validation/orchestrator'

interface EvaluationRequest {
  businessIdeaId: string
  businessIdeaTitle: string
  businessIdeaDescription: string
  agentTypes?: string[]
  priority?: 'low' | 'normal' | 'high'
}

interface Evaluation {
  id: string
  description: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  results?: Record<string, unknown>
}

// In-memory storage for now (will be replaced with database in future story)
const evaluations: Evaluation[] = []

export const createEvaluation = async (
  req: Request<Record<string, never>, Record<string, never>, EvaluationRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const {
      businessIdeaId,
      businessIdeaTitle,
      businessIdeaDescription,
      agentTypes = ['market-research'], // Default to market research agent
      priority = 'normal',
    } = req.body

    // Get orchestrator service instance
    const orchestrator = OrchestratorService.getInstance()

    // Submit evaluation request to orchestrator
    const evaluationId = await orchestrator.submitEvaluationRequest({
      businessIdeaId,
      businessIdeaTitle,
      businessIdeaDescription,
      agentTypes: agentTypes as any[], // Cast to AgentType[]
      priority: priority as any, // Cast to EvaluationPriority
    })

    // Get current progress
    const progress = orchestrator.getEvaluationProgress(evaluationId)

    const evaluation: Evaluation = {
      id: evaluationId,
      description: businessIdeaDescription,
      status: progress?.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      results: progress?.results || undefined,
    }

    // Store in memory for API compatibility (will be replaced with database lookup)
    evaluations.push(evaluation)

    res.status(201).json({
      success: true,
      data: evaluation,
      progress: progress,
    })
  } catch (error) {
    console.error('Error creating evaluation:', error)
    next(error)
  }
}

export const getEvaluations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: evaluations,
    })
  } catch (error) {
    next(error)
  }
}

export const getEvaluation = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params

    // Get orchestrator service instance
    const orchestrator = OrchestratorService.getInstance()

    // Get current progress from orchestrator
    const progress = orchestrator.getEvaluationProgress(id)

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found',
      })
    }

    // Try to find in memory first (for API compatibility)
    let evaluation = evaluations.find(e => e.id === id)

    if (!evaluation) {
      // Create evaluation object from orchestrator progress
      evaluation = {
        id: progress.evaluationId,
        description: `Business idea evaluation: ${id}`,
        status: progress.status,
        createdAt: new Date(), // This would come from database in real implementation
        updatedAt: new Date(),
        results: progress.results,
      }
    } else {
      // Update status from orchestrator
      evaluation.status = progress.status
      evaluation.results = progress.results
      evaluation.updatedAt = new Date()
    }

    res.json({
      success: true,
      data: evaluation,
      progress: progress,
    })
  } catch (error) {
    next(error)
  }
}

export const deleteEvaluation = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params
    const index = evaluations.findIndex(e => e.id === id)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found',
      })
    }

    evaluations.splice(index, 1)

    res.json({
      success: true,
      message: 'Evaluation deleted successfully',
    })
  } catch (error) {
    next(error)
  }
}
