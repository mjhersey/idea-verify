/**
 * PostgreSQL Agent Result Repository Implementation
 */

import { 
  AgentResult,
  CreateAgentResultInput,
  UpdateAgentResultInput,
  AgentResultFilters,
  PaginationOptions,
  PaginatedResponse,
  AgentType
} from '@ai-validation/shared';
import { DatabaseManager } from './database-manager.js';

export class PostgresAgentResultRepository {
  private db: DatabaseManager;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  async create(data: CreateAgentResultInput): Promise<AgentResult> {
    const query = `
      INSERT INTO agent_results (evaluation_id, agent_type, input_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [
      data.evaluation_id,
      data.agent_type,
      JSON.stringify(data.input_data || null)
    ];

    const rows = await this.db.query<AgentResult>(query, values);
    
    if (rows.length === 0) {
      throw new Error('Failed to create agent result');
    }

    console.log(`Created agent result: ${rows[0].id} for evaluation: ${data.evaluation_id}, agent: ${data.agent_type}`);
    return rows[0];
  }

  async findById(id: string): Promise<AgentResult | null> {
    const query = `
      SELECT * FROM agent_results 
      WHERE id = $1
    `;
    
    const rows = await this.db.query<AgentResult>(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByEvaluationId(evaluationId: string): Promise<AgentResult[]> {
    const query = `
      SELECT * FROM agent_results 
      WHERE evaluation_id = $1
      ORDER BY created_at ASC
    `;
    
    return this.db.query<AgentResult>(query, [evaluationId]);
  }

  async findByAgentType(agentType: AgentType): Promise<AgentResult[]> {
    const query = `
      SELECT * FROM agent_results 
      WHERE agent_type = $1
      ORDER BY created_at DESC
    `;
    
    return this.db.query<AgentResult>(query, [agentType]);
  }

  async findByEvaluationAndAgent(evaluationId: string, agentType: AgentType): Promise<AgentResult | null> {
    const query = `
      SELECT * FROM agent_results 
      WHERE evaluation_id = $1 AND agent_type = $2
      LIMIT 1
    `;
    
    const rows = await this.db.query<AgentResult>(query, [evaluationId, agentType]);
    return rows.length > 0 ? rows[0] : null;
  }

  async update(id: string, data: UpdateAgentResultInput): Promise<AgentResult> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic UPDATE query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'input_data' || key === 'output_data' || key === 'insights') {
          // JSON fields
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add the ID parameter
    values.push(id);

    const query = `
      UPDATE agent_results 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const rows = await this.db.query<AgentResult>(query, values);
    
    if (rows.length === 0) {
      throw new Error(`Agent result not found: ${id}`);
    }

    console.log(`Updated agent result: ${id} with status: ${data.status || 'unchanged'}`);
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    const query = `
      DELETE FROM agent_results 
      WHERE id = $1
    `;
    
    await this.db.query(query, [id]);
    console.log(`Deleted agent result: ${id}`);
  }

  async deleteByEvaluationId(evaluationId: string): Promise<number> {
    const query = `
      DELETE FROM agent_results 
      WHERE evaluation_id = $1
    `;
    
    const result = await this.db.query(query, [evaluationId]);
    const deletedCount = (result as any).rowCount || 0;
    
    console.log(`Deleted ${deletedCount} agent results for evaluation: ${evaluationId}`);
    return deletedCount;
  }

  async findMany(
    filters: AgentResultFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<AgentResult>> {
    let whereClause = '';
    const whereParams: any[] = [];
    let paramCount = 1;

    // Build WHERE clause
    const conditions: string[] = [];
    
    if (filters.evaluation_id) {
      conditions.push(`evaluation_id = $${paramCount}`);
      whereParams.push(filters.evaluation_id);
      paramCount++;
    }
    
    if (filters.agent_type) {
      conditions.push(`agent_type = $${paramCount}`);
      whereParams.push(filters.agent_type);
      paramCount++;
    }
    
    if (filters.status) {
      conditions.push(`status = $${paramCount}`);
      whereParams.push(filters.status);
      paramCount++;
    }
    
    if (filters.created_after) {
      conditions.push(`created_at >= $${paramCount}`);
      whereParams.push(filters.created_after);
      paramCount++;
    }
    
    if (filters.created_before) {
      conditions.push(`created_at <= $${paramCount}`);
      whereParams.push(filters.created_before);
      paramCount++;
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    // Sorting
    const sortBy = pagination.sortBy || 'created_at';
    const sortOrder = pagination.sortOrder || 'desc';
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM agent_results
      ${whereClause}
    `;
    
    const countRows = await this.db.query<{ total: string }>(countQuery, whereParams);
    const total = parseInt(countRows[0]?.total || '0');

    // Pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const offset = (page - 1) * limit;

    // Main query
    const dataQuery = `
      SELECT *
      FROM agent_results
      ${whereClause}
      ${orderClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    const dataParams = [...whereParams, limit, offset];
    const agentResults = await this.db.query<AgentResult>(dataQuery, dataParams);

    return {
      data: agentResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrevious: page > 1
      }
    };
  }

  async getSuccessRates(): Promise<Record<AgentType, { total: number; success: number; rate: number }>> {
    const query = `
      SELECT 
        agent_type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as success,
        ROUND(
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / 
          COUNT(*)::DECIMAL * 100, 2
        ) as rate
      FROM agent_results
      GROUP BY agent_type
    `;

    const rows = await this.db.query<{
      agent_type: AgentType;
      total: string;
      success: string;
      rate: string;
    }>(query);

    const rates: Record<string, { total: number; success: number; rate: number }> = {};
    
    rows.forEach(row => {
      rates[row.agent_type] = {
        total: parseInt(row.total),
        success: parseInt(row.success),
        rate: parseFloat(row.rate)
      };
    });

    return rates as Record<AgentType, { total: number; success: number; rate: number }>;
  }

  async getAverageScoresByAgent(): Promise<Record<AgentType, number>> {
    const query = `
      SELECT 
        agent_type,
        AVG(score) as average_score
      FROM agent_results
      WHERE status = 'completed' AND score IS NOT NULL
      GROUP BY agent_type
    `;

    const rows = await this.db.query<{
      agent_type: AgentType;
      average_score: string;
    }>(query);

    const averages: Record<string, number> = {};
    
    rows.forEach(row => {
      averages[row.agent_type] = parseFloat(row.average_score);
    });

    return averages as Record<AgentType, number>;
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    averageScore: number;
    successRate: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(score) as average_score,
        ROUND(
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / 
          COUNT(*)::DECIMAL * 100, 2
        ) as success_rate
      FROM agent_results
    `;

    const rows = await this.db.query<{
      total: string;
      pending: string;
      running: string;
      completed: string;
      failed: string;
      average_score: string | null;
      success_rate: string;
    }>(query);

    const result = rows[0];
    
    return {
      total: parseInt(result?.total || '0'),
      pending: parseInt(result?.pending || '0'),
      running: parseInt(result?.running || '0'),
      completed: parseInt(result?.completed || '0'),
      failed: parseInt(result?.failed || '0'),
      averageScore: parseFloat(result?.average_score || '0'),
      successRate: parseFloat(result?.success_rate || '0')
    };
  }

  async exists(id: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM agent_results 
      WHERE id = $1
      LIMIT 1
    `;
    
    const rows = await this.db.query(query, [id]);
    return rows.length > 0;
  }

  async getAgentPerformance(): Promise<any[]> {
    const query = `SELECT * FROM agent_performance`;
    return this.db.query(query);
  }

  // Test utility method to reset state
  async resetState(): Promise<void> {
    await this.db.query('DELETE FROM agent_results');
    console.log('Reset agent_results table');
  }
}