/**
 * PostgreSQL Evaluation Repository Implementation
 */

import {
  Evaluation,
  CreateEvaluationInput,
  UpdateEvaluationInput,
  EvaluationFilters,
  PaginationOptions,
  PaginatedResponse,
} from '@ai-validation/shared'
import { DatabaseManager } from './database-manager.js'

export class PostgresEvaluationRepository {
  private db: DatabaseManager

  constructor() {
    this.db = DatabaseManager.getInstance()
  }

  async create(data: CreateEvaluationInput): Promise<Evaluation> {
    const query = `
      INSERT INTO evaluations (business_idea_id, priority)
      VALUES ($1, $2)
      RETURNING *
    `

    const values = [data.business_idea_id, data.priority || 'normal']

    const rows = await this.db.query<Evaluation>(query, values)

    if (rows.length === 0) {
      throw new Error('Failed to create evaluation')
    }

    console.log(`Created evaluation: ${rows[0].id} for business idea: ${data.business_idea_id}`)
    return rows[0]
  }

  async findById(id: string): Promise<Evaluation | null> {
    const query = `
      SELECT * FROM evaluations 
      WHERE id = $1
    `

    const rows = await this.db.query<Evaluation>(query, [id])
    return rows.length > 0 ? rows[0] : null
  }

  async findByBusinessIdeaId(businessIdeaId: string): Promise<Evaluation[]> {
    const query = `
      SELECT * FROM evaluations 
      WHERE business_idea_id = $1
      ORDER BY created_at DESC
    `

    return this.db.query<Evaluation>(query, [businessIdeaId])
  }

  async update(id: string, data: UpdateEvaluationInput): Promise<Evaluation> {
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    // Build dynamic UPDATE query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`)
        values.push(value)
        paramCount++
      }
    })

    if (fields.length === 0) {
      throw new Error('No fields to update')
    }

    // Add the ID parameter
    values.push(id)

    const query = `
      UPDATE evaluations 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const rows = await this.db.query<Evaluation>(query, values)

    if (rows.length === 0) {
      throw new Error(`Evaluation not found: ${id}`)
    }

    console.log(`Updated evaluation: ${id} with status: ${data.status || 'unchanged'}`)
    return rows[0]
  }

  async delete(id: string): Promise<void> {
    const query = `
      DELETE FROM evaluations 
      WHERE id = $1
    `

    const rows = await this.db.query(query, [id])
    console.log(`Deleted evaluation: ${id}`)
  }

  async findMany(
    filters: EvaluationFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<Evaluation>> {
    let whereClause = ''
    const whereParams: any[] = []
    let paramCount = 1

    // Build WHERE clause
    const conditions: string[] = []

    if (filters.business_idea_id) {
      conditions.push(`business_idea_id = $${paramCount}`)
      whereParams.push(filters.business_idea_id)
      paramCount++
    }

    if (filters.status) {
      conditions.push(`status = $${paramCount}`)
      whereParams.push(filters.status)
      paramCount++
    }

    if (filters.priority) {
      conditions.push(`priority = $${paramCount}`)
      whereParams.push(filters.priority)
      paramCount++
    }

    if (filters.created_after) {
      conditions.push(`created_at >= $${paramCount}`)
      whereParams.push(filters.created_after)
      paramCount++
    }

    if (filters.created_before) {
      conditions.push(`created_at <= $${paramCount}`)
      whereParams.push(filters.created_before)
      paramCount++
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`
    }

    // Sorting
    const sortBy = pagination.sortBy || 'created_at'
    const sortOrder = pagination.sortOrder || 'desc'
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM evaluations
      ${whereClause}
    `

    const countRows = await this.db.query<{ total: string }>(countQuery, whereParams)
    const total = parseInt(countRows[0]?.total || '0')

    // Pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 10
    const offset = (page - 1) * limit

    // Main query
    const dataQuery = `
      SELECT *
      FROM evaluations
      ${whereClause}
      ${orderClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

    const dataParams = [...whereParams, limit, offset]
    const evaluations = await this.db.query<Evaluation>(dataQuery, dataParams)

    return {
      data: evaluations,
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
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'analyzing' THEN 1 END) as analyzing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(
          CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))
            ELSE NULL 
          END
        ) as avg_processing_time_seconds
      FROM evaluations
    `

    const rows = await this.db.query<{
      total: string
      pending: string
      analyzing: string
      completed: string
      failed: string
      avg_processing_time_seconds: string | null
    }>(query)

    const result = rows[0]

    return {
      total: parseInt(result?.total || '0'),
      pending: parseInt(result?.pending || '0'),
      analyzing: parseInt(result?.analyzing || '0'),
      completed: parseInt(result?.completed || '0'),
      failed: parseInt(result?.failed || '0'),
      averageProcessingTime: parseFloat(result?.avg_processing_time_seconds || '0') * 1000, // Convert to milliseconds
    }
  }

  async exists(id: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM evaluations 
      WHERE id = $1
      LIMIT 1
    `

    const rows = await this.db.query(query, [id])
    return rows.length > 0
  }

  async getPriorityQueue(limit: number = 10): Promise<Evaluation[]> {
    const query = `
      SELECT * FROM evaluations 
      WHERE status = 'pending'
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'normal' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at ASC
      LIMIT $1
    `

    return this.db.query<Evaluation>(query, [limit])
  }

  async getEvaluationSummary(id: string): Promise<any> {
    const query = `
      SELECT * FROM evaluation_summary 
      WHERE id = $1
    `

    const rows = await this.db.query(query, [id])
    return rows.length > 0 ? rows[0] : null
  }

  // Test utility method to reset state
  async resetState(): Promise<void> {
    await this.db.query('DELETE FROM evaluations')
    console.log('Reset evaluations table')
  }
}
