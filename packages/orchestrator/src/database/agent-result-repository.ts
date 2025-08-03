/**
 * Agent Result Repository for Database Operations
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

export class AgentResultRepository {
  private agentResults: Map<string, AgentResult> = new Map();
  private idCounter = 1;

  async create(data: CreateAgentResultInput): Promise<AgentResult> {
    const agentResult: AgentResult = {
      id: `agent_result_${this.idCounter++}`,
      evaluation_id: data.evaluation_id,
      agent_type: data.agent_type,
      status: 'pending',
      input_data: data.input_data || null,
      output_data: null,
      score: null,
      insights: null,
      started_at: null,
      completed_at: null,
      error_message: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.agentResults.set(agentResult.id, agentResult);
    console.log(`Created agent result: ${agentResult.id} for evaluation: ${data.evaluation_id}, agent: ${data.agent_type}`);
    
    return agentResult;
  }

  async findById(id: string): Promise<AgentResult | null> {
    const agentResult = this.agentResults.get(id);
    return agentResult || null;
  }

  async findByEvaluationId(evaluationId: string): Promise<AgentResult[]> {
    return Array.from(this.agentResults.values())
      .filter(result => result.evaluation_id === evaluationId);
  }

  async findByAgentType(agentType: AgentType): Promise<AgentResult[]> {
    return Array.from(this.agentResults.values())
      .filter(result => result.agent_type === agentType);
  }

  async findByEvaluationAndAgent(evaluationId: string, agentType: AgentType): Promise<AgentResult | null> {
    const results = Array.from(this.agentResults.values());
    const result = results.find(r => 
      r.evaluation_id === evaluationId && r.agent_type === agentType
    );
    return result || null;
  }

  async update(id: string, data: UpdateAgentResultInput): Promise<AgentResult> {
    const agentResult = this.agentResults.get(id);
    if (!agentResult) {
      throw new Error(`Agent result not found: ${id}`);
    }

    const updated: AgentResult = {
      ...agentResult,
      ...data,
      updated_at: new Date()
    };

    this.agentResults.set(id, updated);
    console.log(`Updated agent result: ${id} with status: ${updated.status}`);
    
    return updated;
  }

  async delete(id: string): Promise<void> {
    const agentResult = this.agentResults.get(id);
    if (!agentResult) {
      throw new Error(`Agent result not found: ${id}`);
    }

    this.agentResults.delete(id);
    console.log(`Deleted agent result: ${id}`);
  }

  async deleteByEvaluationId(evaluationId: string): Promise<number> {
    const results = this.findByEvaluationId(evaluationId);
    let deletedCount = 0;

    for (const result of await results) {
      this.agentResults.delete(result.id);
      deletedCount++;
    }

    console.log(`Deleted ${deletedCount} agent results for evaluation: ${evaluationId}`);
    return deletedCount;
  }

  async findMany(
    filters: AgentResultFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<AgentResult>> {
    let agentResults = Array.from(this.agentResults.values());

    // Apply filters
    if (filters.evaluation_id) {
      agentResults = agentResults.filter(r => r.evaluation_id === filters.evaluation_id);
    }
    if (filters.agent_type) {
      agentResults = agentResults.filter(r => r.agent_type === filters.agent_type);
    }
    if (filters.status) {
      agentResults = agentResults.filter(r => r.status === filters.status);
    }
    if (filters.created_after) {
      agentResults = agentResults.filter(r => r.created_at >= filters.created_after!);
    }
    if (filters.created_before) {
      agentResults = agentResults.filter(r => r.created_at <= filters.created_before!);
    }

    // Apply sorting
    const sortBy = pagination.sortBy || 'created_at';
    const sortOrder = pagination.sortOrder || 'desc';
    
    agentResults.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Apply pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const offset = (page - 1) * limit;
    
    const total = agentResults.length;
    const paginatedResults = agentResults.slice(offset, offset + limit);

    return {
      data: paginatedResults,
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
    const results = Array.from(this.agentResults.values());
    const rates: Record<string, { total: number; success: number; rate: number }> = {};

    for (const result of results) {
      const agentType = result.agent_type;
      
      if (!rates[agentType]) {
        rates[agentType] = { total: 0, success: 0, rate: 0 };
      }
      
      rates[agentType].total++;
      if (result.status === 'completed') {
        rates[agentType].success++;
      }
    }

    // Calculate rates
    for (const agentType in rates) {
      const data = rates[agentType];
      data.rate = data.total > 0 ? (data.success / data.total) * 100 : 0;
    }

    return rates as Record<AgentType, { total: number; success: number; rate: number }>;
  }

  async getAverageScoresByAgent(): Promise<Record<AgentType, number>> {
    const results = Array.from(this.agentResults.values());
    const scores: Record<string, number[]> = {};

    for (const result of results) {
      if (result.status === 'completed' && result.score !== null) {
        const agentType = result.agent_type;
        
        if (!scores[agentType]) {
          scores[agentType] = [];
        }
        
        scores[agentType].push(result.score);
      }
    }

    const averages: Record<string, number> = {};
    for (const agentType in scores) {
      const agentScores = scores[agentType];
      averages[agentType] = agentScores.length > 0 
        ? agentScores.reduce((sum, score) => sum + score, 0) / agentScores.length
        : 0;
    }

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
    const results = Array.from(this.agentResults.values());
    
    const stats = {
      total: results.length,
      pending: results.filter(r => r.status === 'pending').length,
      running: results.filter(r => r.status === 'running').length,
      completed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      averageScore: 0,
      successRate: 0
    };

    // Calculate average score for completed results
    const completedResults = results.filter(r => r.status === 'completed' && r.score !== null);
    if (completedResults.length > 0) {
      const totalScore = completedResults.reduce((sum, r) => sum + (r.score || 0), 0);
      stats.averageScore = totalScore / completedResults.length;
    }

    // Calculate success rate
    if (stats.total > 0) {
      stats.successRate = (stats.completed / stats.total) * 100;
    }

    return stats;
  }

  async exists(id: string): Promise<boolean> {
    return this.agentResults.has(id);
  }

  // Test utility method to reset state
  resetState(): void {
    this.agentResults.clear();
    this.idCounter = 1;
  }
}