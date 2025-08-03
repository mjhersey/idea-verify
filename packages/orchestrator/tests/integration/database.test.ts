/**
 * Database Integration Tests
 * Tests PostgreSQL repositories and database manager functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from '../../src/database/database-manager.js';
import { DatabaseFactory } from '../../src/database/database-factory.js';
import { PostgresEvaluationRepository } from '../../src/database/postgres-evaluation-repository.js';
import { PostgresAgentResultRepository } from '../../src/database/postgres-agent-result-repository.js';
import { 
  CreateEvaluationInput, 
  CreateAgentResultInput,
  AgentType,
  EvaluationStatus,
  AgentResultStatus 
} from '@ai-validation/shared';

describe('Database Integration Tests', () => {
  let dbManager: DatabaseManager;
  let databaseFactory: DatabaseFactory;
  let evaluationRepo: PostgresEvaluationRepository;
  let agentResultRepo: PostgresAgentResultRepository;

  beforeAll(async () => {
    // Skip tests if not using database
    databaseFactory = DatabaseFactory.getInstance();
    if (!databaseFactory.isUsingDatabase()) {
      console.log('Skipping database integration tests - using in-memory storage');
      return;
    }

    // Initialize database
    await databaseFactory.initialize();
    await databaseFactory.setupDatabase();
    
    dbManager = DatabaseManager.getInstance();
    evaluationRepo = new PostgresEvaluationRepository();
    agentResultRepo = new PostgresAgentResultRepository();
  });

  afterAll(async () => {
    if (databaseFactory && databaseFactory.isUsingDatabase()) {
      await databaseFactory.shutdown();
    }
  });

  beforeEach(async () => {
    if (!databaseFactory.isUsingDatabase()) {
      return;
    }
    
    // Clean up test data
    await agentResultRepo.resetState();
    await evaluationRepo.resetState();
  });

  describe('DatabaseManager', () => {
    it('should establish database connection', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const isHealthy = await dbManager.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should execute queries successfully', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const result = await dbManager.query('SELECT 1 as test');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ test: 1 });
    });

    it('should handle transactions', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const client = await dbManager.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Create a test table
        await client.query(`
          CREATE TEMPORARY TABLE test_transaction (
            id SERIAL PRIMARY KEY,
            value TEXT
          )
        `);
        
        await client.query("INSERT INTO test_transaction (value) VALUES ('test')");
        
        const result = await client.query('SELECT * FROM test_transaction');
        expect(result.rows).toHaveLength(1);
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    it('should provide connection pool stats', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const stats = await dbManager.getStats();
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
      expect(typeof stats.totalCount).toBe('number');
    });
  });

  describe('PostgresEvaluationRepository', () => {
    const sampleBusinessIdeaId = '550e8400-e29b-41d4-a716-446655440000';

    it('should create and retrieve evaluations', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const input: CreateEvaluationInput = {
        business_idea_id: sampleBusinessIdeaId,
        priority: 'high'
      };

      const created = await evaluationRepo.create(input);
      
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.business_idea_id).toBe(sampleBusinessIdeaId);
      expect(created.priority).toBe('high');
      expect(created.status).toBe('pending');
      expect(created.created_at).toBeDefined();

      const retrieved = await evaluationRepo.findById(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should update evaluation status', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const input: CreateEvaluationInput = {
        business_idea_id: sampleBusinessIdeaId,
        priority: 'normal'
      };

      const created = await evaluationRepo.create(input);
      
      const updated = await evaluationRepo.update(created.id, {
        status: 'analyzing' as EvaluationStatus,
        started_at: new Date()
      });

      expect(updated.status).toBe('analyzing');
      expect(updated.started_at).toBeDefined();
    });

    it('should find evaluations by business idea ID', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const input1: CreateEvaluationInput = {
        business_idea_id: sampleBusinessIdeaId,
        priority: 'high'
      };
      
      const input2: CreateEvaluationInput = {
        business_idea_id: sampleBusinessIdeaId,
        priority: 'normal'
      };

      await evaluationRepo.create(input1);
      await evaluationRepo.create(input2);

      const evaluations = await evaluationRepo.findByBusinessIdeaId(sampleBusinessIdeaId);
      expect(evaluations).toHaveLength(2);
      expect(evaluations.every(e => e.business_idea_id === sampleBusinessIdeaId)).toBe(true);
    });

    it('should paginate evaluation results', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      // Create multiple evaluations
      for (let i = 0; i < 5; i++) {
        await evaluationRepo.create({
          business_idea_id: sampleBusinessIdeaId,
          priority: 'normal'
        });
      }

      const page1 = await evaluationRepo.findMany({}, { page: 1, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.total).toBe(5);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.hasNext).toBe(true);

      const page2 = await evaluationRepo.findMany({}, { page: 2, limit: 2 });
      expect(page2.data).toHaveLength(2);
      expect(page2.pagination.hasNext).toBe(true);
    });

    it('should filter evaluations by status', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const eval1 = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'normal'
      });
      
      const eval2 = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'high'
      });

      await evaluationRepo.update(eval2.id, { status: 'analyzing' as EvaluationStatus });

      const pending = await evaluationRepo.findMany({ status: 'pending' as EvaluationStatus });
      expect(pending.data).toHaveLength(1);
      expect(pending.data[0].id).toBe(eval1.id);

      const analyzing = await evaluationRepo.findMany({ status: 'analyzing' as EvaluationStatus });
      expect(analyzing.data).toHaveLength(1);
      expect(analyzing.data[0].id).toBe(eval2.id);
    });

    it('should generate evaluation statistics', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      // Create evaluations with different statuses
      const eval1 = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'normal'
      });
      
      const eval2 = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'high'
      });

      await evaluationRepo.update(eval1.id, { 
        status: 'completed' as EvaluationStatus,
        started_at: new Date(Date.now() - 60000),
        completed_at: new Date()
      });

      await evaluationRepo.update(eval2.id, { status: 'failed' as EvaluationStatus });

      const stats = await evaluationRepo.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should get priority queue correctly ordered', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const highPriority = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'high'
      });
      
      const normalPriority = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'normal'
      });
      
      const lowPriority = await evaluationRepo.create({
        business_idea_id: sampleBusinessIdeaId,
        priority: 'low'
      });

      const queue = await evaluationRepo.getPriorityQueue(5);
      expect(queue).toHaveLength(3);
      expect(queue[0].priority).toBe('high');
      expect(queue[1].priority).toBe('normal');
      expect(queue[2].priority).toBe('low');
    });
  });

  describe('PostgresAgentResultRepository', () => {
    let evaluationId: string;

    beforeEach(async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      // Create an evaluation for agent results
      const evaluation = await evaluationRepo.create({
        business_idea_id: '550e8400-e29b-41d4-a716-446655440000',
        priority: 'normal'
      });
      evaluationId = evaluation.id;
    });

    it('should create and retrieve agent results', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const input: CreateAgentResultInput = {
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test market research' }
      };

      const created = await agentResultRepo.create(input);
      
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.evaluation_id).toBe(evaluationId);
      expect(created.agent_type).toBe('market-research');
      expect(created.status).toBe('pending');

      const retrieved = await agentResultRepo.findById(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should update agent result with output data', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const input: CreateAgentResultInput = {
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test' }
      };

      const created = await agentResultRepo.create(input);
      
      const updated = await agentResultRepo.update(created.id, {
        status: 'completed' as AgentResultStatus,
        output_data: { analysis: 'market analysis results' },
        score: 85,
        insights: { key_findings: ['finding 1', 'finding 2'] },
        completed_at: new Date()
      });

      expect(updated.status).toBe('completed');
      expect(updated.score).toBe(85);
      expect(updated.output_data).toBeDefined();
      expect(updated.insights).toBeDefined();
    });

    it('should find agent results by evaluation ID', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 1' }
      });
      
      await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'competitive-analysis' as AgentType,
        input_data: { query: 'test 2' }
      });

      const results = await agentResultRepo.findByEvaluationId(evaluationId);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.evaluation_id === evaluationId)).toBe(true);
    });

    it('should find agent results by type', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 1' }
      });
      
      await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 2' }
      });

      const results = await agentResultRepo.findByAgentType('market-research' as AgentType);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.agent_type === 'market-research')).toBe(true);
    });

    it('should find specific agent result by evaluation and type', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const created = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test' }
      });

      const found = await agentResultRepo.findByEvaluationAndAgent(
        evaluationId, 
        'market-research' as AgentType
      );
      
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should paginate agent results with filters', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      // Create multiple agent results
      for (let i = 0; i < 5; i++) {
        await agentResultRepo.create({
          evaluation_id: evaluationId,
          agent_type: 'market-research' as AgentType,
          input_data: { query: `test ${i}` }
        });
      }

      const page1 = await agentResultRepo.findMany(
        { evaluation_id: evaluationId }, 
        { page: 1, limit: 2 }
      );
      
      expect(page1.data).toHaveLength(2);
      expect(page1.pagination.total).toBe(5);
    });

    it('should calculate success rates by agent type', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      // Create successful agent result
      const success1 = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 1' }
      });
      
      await agentResultRepo.update(success1.id, { 
        status: 'completed' as AgentResultStatus 
      });

      // Create failed agent result
      const failed1 = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 2' }
      });
      
      await agentResultRepo.update(failed1.id, { 
        status: 'failed' as AgentResultStatus 
      });

      const successRates = await agentResultRepo.getSuccessRates();
      expect(successRates['market-research']).toBeDefined();
      expect(successRates['market-research'].total).toBe(2);
      expect(successRates['market-research'].success).toBe(1);
      expect(successRates['market-research'].rate).toBe(50);
    });

    it('should calculate average scores by agent type', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const result1 = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 1' }
      });
      
      const result2 = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 2' }
      });

      await agentResultRepo.update(result1.id, { 
        status: 'completed' as AgentResultStatus,
        score: 80
      });
      
      await agentResultRepo.update(result2.id, { 
        status: 'completed' as AgentResultStatus,
        score: 90
      });

      const averages = await agentResultRepo.getAverageScoresByAgent();
      expect(averages['market-research']).toBe(85);
    });

    it('should generate comprehensive statistics', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const result1 = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 1' }
      });
      
      const result2 = await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'competitive-analysis' as AgentType,
        input_data: { query: 'test 2' }
      });

      await agentResultRepo.update(result1.id, { 
        status: 'completed' as AgentResultStatus,
        score: 85
      });
      
      await agentResultRepo.update(result2.id, { 
        status: 'failed' as AgentResultStatus
      });

      const stats = await agentResultRepo.getStats();
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.averageScore).toBe(85);
      expect(stats.successRate).toBe(50);
    });

    it('should delete agent results by evaluation ID', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test 1' }
      });
      
      await agentResultRepo.create({
        evaluation_id: evaluationId,
        agent_type: 'competitive-analysis' as AgentType,
        input_data: { query: 'test 2' }
      });

      const deletedCount = await agentResultRepo.deleteByEvaluationId(evaluationId);
      expect(deletedCount).toBe(2);

      const remaining = await agentResultRepo.findByEvaluationId(evaluationId);
      expect(remaining).toHaveLength(0);
    });
  });

  describe('DatabaseFactory', () => {
    it('should provide health check information', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const health = await databaseFactory.healthCheck();
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('repositories');
      expect(health).toHaveProperty('type');
      expect(health.type).toBe('postgres');
      expect(health.repositories).toBe(true);
    });

    it('should provide database statistics', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const stats = await databaseFactory.getDatabaseStats();
      expect(stats).toHaveProperty('totalCount');
      expect(typeof stats.totalCount).toBe('number');
    });

    it('should reset repository state for testing', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      // Create some test data
      const evaluation = await evaluationRepo.create({
        business_idea_id: '550e8400-e29b-41d4-a716-446655440000',
        priority: 'normal'
      });
      
      await agentResultRepo.create({
        evaluation_id: evaluation.id,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test' }
      });

      // Reset state
      await databaseFactory.resetRepositories();

      // Verify data is cleared
      const evaluations = await evaluationRepo.findMany({});
      const agentResults = await agentResultRepo.findMany({});
      
      expect(evaluations.data).toHaveLength(0);
      expect(agentResults.data).toHaveLength(0);
    });
  });

  describe('Schema and Views', () => {
    it('should query evaluation summary view', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const evaluation = await evaluationRepo.create({
        business_idea_id: '550e8400-e29b-41d4-a716-446655440000',
        priority: 'high'
      });

      const summary = await evaluationRepo.getEvaluationSummary(evaluation.id);
      expect(summary).toBeDefined();
      expect(summary.id).toBe(evaluation.id);
      expect(summary.priority).toBe('high');
    });

    it('should query agent performance view', async () => {
      if (!databaseFactory.isUsingDatabase()) return;
      
      const evaluation = await evaluationRepo.create({
        business_idea_id: '550e8400-e29b-41d4-a716-446655440000',
        priority: 'normal'
      });

      const agentResult = await agentResultRepo.create({
        evaluation_id: evaluation.id,
        agent_type: 'market-research' as AgentType,
        input_data: { query: 'test' }
      });

      await agentResultRepo.update(agentResult.id, {
        status: 'completed' as AgentResultStatus,
        score: 85,
        started_at: new Date(Date.now() - 5000),
        completed_at: new Date()
      });

      const performance = await agentResultRepo.getAgentPerformance();
      expect(performance).toBeDefined();
      expect(Array.isArray(performance)).toBe(true);
    });
  });
});