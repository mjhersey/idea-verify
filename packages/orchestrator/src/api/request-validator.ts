/**
 * Request Validator
 * Validates incoming API requests and query parameters
 */

import { AgentType } from '@ai-validation/shared'
import {
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
  EvaluationQueryParams,
  AgentQueryParams,
  ERROR_CODES,
} from './types.js'

export class ValidationError extends Error {
  public code: string
  public field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ValidationError'
    this.code = ERROR_CODES.VALIDATION_ERROR
    this.field = field
  }
}

export class RequestValidator {
  validateCreateEvaluationRequest(data: any): CreateEvaluationRequest {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Request body must be an object')
    }

    const {
      businessIdeaId,
      businessIdeaTitle,
      businessIdeaDescription,
      agentTypes,
      priority,
      userId,
    } = data

    // Required fields
    if (!businessIdeaId || typeof businessIdeaId !== 'string') {
      throw new ValidationError('businessIdeaId is required and must be a string', 'businessIdeaId')
    }

    if (!businessIdeaTitle || typeof businessIdeaTitle !== 'string') {
      throw new ValidationError(
        'businessIdeaTitle is required and must be a string',
        'businessIdeaTitle'
      )
    }

    if (!businessIdeaDescription || typeof businessIdeaDescription !== 'string') {
      throw new ValidationError(
        'businessIdeaDescription is required and must be a string',
        'businessIdeaDescription'
      )
    }

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('userId is required and must be a string', 'userId')
    }

    // Validate string lengths
    if (businessIdeaTitle.length > 200) {
      throw new ValidationError(
        'businessIdeaTitle must be 200 characters or less',
        'businessIdeaTitle'
      )
    }

    if (businessIdeaDescription.length > 2000) {
      throw new ValidationError(
        'businessIdeaDescription must be 2000 characters or less',
        'businessIdeaDescription'
      )
    }

    // Optional fields
    const validatedRequest: CreateEvaluationRequest = {
      businessIdeaId,
      businessIdeaTitle,
      businessIdeaDescription,
      userId,
    }

    // Validate agentTypes if provided
    if (agentTypes !== undefined) {
      if (!Array.isArray(agentTypes)) {
        throw new ValidationError('agentTypes must be an array', 'agentTypes')
      }

      const validAgentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis',
      ]

      for (const agentType of agentTypes) {
        if (!validAgentTypes.includes(agentType)) {
          throw new ValidationError(
            `Invalid agent type: ${agentType}. Valid types are: ${validAgentTypes.join(', ')}`,
            'agentTypes'
          )
        }
      }

      validatedRequest.agentTypes = agentTypes
    }

    // Validate priority if provided
    if (priority !== undefined) {
      const validPriorities = ['low', 'normal', 'high']
      if (!validPriorities.includes(priority)) {
        throw new ValidationError(
          `Invalid priority: ${priority}. Valid priorities are: ${validPriorities.join(', ')}`,
          'priority'
        )
      }
      validatedRequest.priority = priority
    }

    return validatedRequest
  }

  validateUpdateEvaluationRequest(data: any): UpdateEvaluationRequest {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Request body must be an object')
    }

    const { priority, agentTypes } = data
    const validatedRequest: UpdateEvaluationRequest = {}

    // Validate priority if provided
    if (priority !== undefined) {
      const validPriorities = ['low', 'normal', 'high']
      if (!validPriorities.includes(priority)) {
        throw new ValidationError(
          `Invalid priority: ${priority}. Valid priorities are: ${validPriorities.join(', ')}`,
          'priority'
        )
      }
      validatedRequest.priority = priority
    }

    // Validate agentTypes if provided
    if (agentTypes !== undefined) {
      if (!Array.isArray(agentTypes)) {
        throw new ValidationError('agentTypes must be an array', 'agentTypes')
      }

      const validAgentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis',
      ]

      for (const agentType of agentTypes) {
        if (!validAgentTypes.includes(agentType)) {
          throw new ValidationError(
            `Invalid agent type: ${agentType}. Valid types are: ${validAgentTypes.join(', ')}`,
            'agentTypes'
          )
        }
      }

      validatedRequest.agentTypes = agentTypes
    }

    return validatedRequest
  }

  validateEvaluationQueryParams(query: any): EvaluationQueryParams {
    const validatedParams: EvaluationQueryParams = {}

    // Validate page
    if (query.page !== undefined) {
      const page = parseInt(query.page, 10)
      if (isNaN(page) || page < 1) {
        throw new ValidationError('page must be a positive integer', 'page')
      }
      validatedParams.page = page
    }

    // Validate limit
    if (query.limit !== undefined) {
      const limit = parseInt(query.limit, 10)
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('limit must be an integer between 1 and 100', 'limit')
      }
      validatedParams.limit = limit
    }

    // Validate status
    if (query.status !== undefined) {
      const validStatuses = ['pending', 'analyzing', 'completed', 'failed']
      if (!validStatuses.includes(query.status)) {
        throw new ValidationError(
          `Invalid status: ${query.status}. Valid statuses are: ${validStatuses.join(', ')}`,
          'status'
        )
      }
      validatedParams.status = query.status
    }

    // Validate userId
    if (query.userId !== undefined) {
      if (typeof query.userId !== 'string' || query.userId.trim().length === 0) {
        throw new ValidationError('userId must be a non-empty string', 'userId')
      }
      validatedParams.userId = query.userId
    }

    // Validate sortBy
    if (query.sortBy !== undefined) {
      const validSortFields = ['createdAt', 'updatedAt', 'priority']
      if (!validSortFields.includes(query.sortBy)) {
        throw new ValidationError(
          `Invalid sortBy field: ${query.sortBy}. Valid fields are: ${validSortFields.join(', ')}`,
          'sortBy'
        )
      }
      validatedParams.sortBy = query.sortBy
    }

    // Validate sortOrder
    if (query.sortOrder !== undefined) {
      const validSortOrders = ['asc', 'desc']
      if (!validSortOrders.includes(query.sortOrder)) {
        throw new ValidationError(
          `Invalid sortOrder: ${query.sortOrder}. Valid orders are: ${validSortOrders.join(', ')}`,
          'sortOrder'
        )
      }
      validatedParams.sortOrder = query.sortOrder
    }

    return validatedParams
  }

  validateAgentQueryParams(query: any): AgentQueryParams {
    const validatedParams: AgentQueryParams = {}

    // Validate evaluationId
    if (query.evaluationId !== undefined) {
      if (typeof query.evaluationId !== 'string' || query.evaluationId.trim().length === 0) {
        throw new ValidationError('evaluationId must be a non-empty string', 'evaluationId')
      }
      validatedParams.evaluationId = query.evaluationId
    }

    // Validate agentType
    if (query.agentType !== undefined) {
      const validAgentTypes: AgentType[] = [
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis',
      ]
      if (!validAgentTypes.includes(query.agentType)) {
        throw new ValidationError(
          `Invalid agent type: ${query.agentType}. Valid types are: ${validAgentTypes.join(', ')}`,
          'agentType'
        )
      }
      validatedParams.agentType = query.agentType
    }

    // Validate status
    if (query.status !== undefined) {
      const validStatuses = ['pending', 'running', 'completed', 'failed']
      if (!validStatuses.includes(query.status)) {
        throw new ValidationError(
          `Invalid status: ${query.status}. Valid statuses are: ${validStatuses.join(', ')}`,
          'status'
        )
      }
      validatedParams.status = query.status
    }

    // Validate page
    if (query.page !== undefined) {
      const page = parseInt(query.page, 10)
      if (isNaN(page) || page < 1) {
        throw new ValidationError('page must be a positive integer', 'page')
      }
      validatedParams.page = page
    }

    // Validate limit
    if (query.limit !== undefined) {
      const limit = parseInt(query.limit, 10)
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('limit must be an integer between 1 and 100', 'limit')
      }
      validatedParams.limit = limit
    }

    return validatedParams
  }

  validateId(id: string, fieldName: string = 'id'): string {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName)
    }

    if (id.trim().length === 0) {
      throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName)
    }

    // Additional ID format validation could go here
    // e.g., UUID format validation, length constraints, etc.

    return id.trim()
  }

  validateBoolean(value: any, fieldName: string): boolean {
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be a boolean`, fieldName)
    }
    return value
  }

  validateOptionalString(value: any, fieldName: string, maxLength?: number): string | undefined {
    if (value === undefined || value === null) {
      return undefined
    }

    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName)
    }

    if (maxLength && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`, fieldName)
    }

    return value
  }

  validateRequiredString(value: any, fieldName: string, maxLength?: number): string {
    if (!value || typeof value !== 'string') {
      throw new ValidationError(`${fieldName} is required and must be a string`, fieldName)
    }

    if (value.trim().length === 0) {
      throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName)
    }

    if (maxLength && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`, fieldName)
    }

    return value.trim()
  }
}
