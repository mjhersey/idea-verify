import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'

interface EvaluationRequest {
  description: string
  urgency?: 'low' | 'medium' | 'high'
  industry?: string
  targetMarket?: string
}

interface Evaluation {
  id: string
  description: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  results?: any
}

// In-memory storage for now (will be replaced with database in future story)
const evaluations: Evaluation[] = []

export const createEvaluation = async (
  req: Request<{}, {}, EvaluationRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { description, urgency, industry, targetMarket } = req.body

    const evaluation: Evaluation = {
      id: crypto.randomUUID(),
      description,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    evaluations.push(evaluation)

    res.status(201).json({
      success: true,
      data: evaluation
    })
  } catch (error) {
    next(error)
  }
}

export const getEvaluations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({
      success: true,
      data: evaluations
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
    const evaluation = evaluations.find(e => e.id === id)

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      })
    }

    res.json({
      success: true,
      data: evaluation
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
        error: 'Evaluation not found'
      })
    }

    evaluations.splice(index, 1)

    res.json({
      success: true,
      message: 'Evaluation deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}