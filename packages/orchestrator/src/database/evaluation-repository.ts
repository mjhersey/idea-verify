/**
 * Evaluation Repository for Database Operations
 */

import {
  Evaluation,
  CreateEvaluationInput,
  UpdateEvaluationInput,
  EvaluationFilters,
  PaginationOptions,
  PaginatedResponse,
} from '@ai-validation/shared'

export class EvaluationRepository {
  private evaluations: Map<string, Evaluation> = new Map()
  private idCounter = 1

  async create(data: CreateEvaluationInput): Promise<Evaluation> {
    const evaluation: Evaluation = {
      id: `eval_${this.idCounter++}`,
      business_idea_id: data.business_idea_id,
      status: 'pending',
      priority: data.priority || 'normal',
      started_at: null,
      completed_at: null,
      results: null,
      error_message: null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    this.evaluations.set(evaluation.id, evaluation)
    console.log(`Created evaluation: ${evaluation.id} for business idea: ${data.business_idea_id}`)

    return evaluation
  }

  async findById(id: string): Promise<Evaluation | null> {
    const evaluation = this.evaluations.get(id)
    return evaluation || null
  }

  async findByBusinessIdeaId(businessIdeaId: string): Promise<Evaluation[]> {
    return Array.from(this.evaluations.values()).filter(
      evaluation => evaluation.business_idea_id === businessIdeaId
    )
  }

  async update(id: string, data: UpdateEvaluationInput): Promise<Evaluation> {
    const evaluation = this.evaluations.get(id)
    if (!evaluation) {
      throw new Error(`Evaluation not found: ${id}`)
    }

    const updated: Evaluation = {
      ...evaluation,
      ...data,
      updated_at: new Date(),
    }

    this.evaluations.set(id, updated)
    console.log(`Updated evaluation: ${id} with status: ${updated.status}`)

    return updated
  }

  async delete(id: string): Promise<void> {
    const evaluation = this.evaluations.get(id)
    if (!evaluation) {
      throw new Error(`Evaluation not found: ${id}`)
    }

    this.evaluations.delete(id)
    console.log(`Deleted evaluation: ${id}`)
  }

  async findMany(
    filters: EvaluationFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<Evaluation>> {
    let evaluations = Array.from(this.evaluations.values())

    // Apply filters
    if (filters.business_idea_id) {
      evaluations = evaluations.filter(e => e.business_idea_id === filters.business_idea_id)
    }
    if (filters.status) {
      evaluations = evaluations.filter(e => e.status === filters.status)
    }
    if (filters.priority) {
      evaluations = evaluations.filter(e => e.priority === filters.priority)
    }
    if (filters.created_after) {
      evaluations = evaluations.filter(e => e.created_at >= filters.created_after!)
    }
    if (filters.created_before) {
      evaluations = evaluations.filter(e => e.created_at <= filters.created_before!)
    }

    // Apply sorting
    const sortBy = pagination.sortBy || 'created_at'
    const sortOrder = pagination.sortOrder || 'desc'

    evaluations.sort((a, b) => {
      const aVal = (a as any)[sortBy]
      const bVal = (b as any)[sortBy]

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    // Apply pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 10
    const offset = (page - 1) * limit

    const total = evaluations.length
    const paginatedEvaluations = evaluations.slice(offset, offset + limit)

    return {
      data: paginatedEvaluations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrevious: page > 1,
      },
    }
  }

  async getStats(): Promise<{
    total: number
    pending: number
    analyzing: number
    completed: number
    failed: number
    averageProcessingTime: number
  }> {
    const evaluations = Array.from(this.evaluations.values())

    const stats = {
      total: evaluations.length,
      pending: evaluations.filter(e => e.status === 'pending').length,
      analyzing: evaluations.filter(e => e.status === 'analyzing').length,
      completed: evaluations.filter(e => e.status === 'completed').length,
      failed: evaluations.filter(e => e.status === 'failed').length,
      averageProcessingTime: 0,
    }

    // Calculate average processing time for completed evaluations
    const completedEvaluations = evaluations.filter(
      e => e.status === 'completed' && e.started_at && e.completed_at
    )

    if (completedEvaluations.length > 0) {
      const totalProcessingTime = completedEvaluations.reduce((sum, e) => {
        const processingTime = e.completed_at!.getTime() - e.started_at!.getTime()
        return sum + processingTime
      }, 0)

      stats.averageProcessingTime = totalProcessingTime / completedEvaluations.length
    }

    return stats
  }

  async exists(id: string): Promise<boolean> {
    return this.evaluations.has(id)
  }

  // Test utility method to reset state
  resetState(): void {
    this.evaluations.clear()
    this.idCounter = 1
  }
}
