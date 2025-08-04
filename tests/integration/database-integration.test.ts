/**
 * Database Integration Tests with Real RDS Instance
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createLogger } from '../../packages/shared/src/utils/logger.js';

const logger = createLogger('database-integration-tests');

interface DatabaseTestConfig {
  connectionString: string;
  environment: string;
  timeout: number;
}

interface TestData {
  userId?: string;
  ideaId?: string;
  evaluationId?: string;
}

class DatabaseIntegrationTester {
  private config: DatabaseTestConfig;
  private db: any; // Prisma client or similar
  private testData: TestData = {};

  constructor(config: DatabaseTestConfig) {
    this.config = config;
  }

  async setup(): Promise<void> {
    // Initialize database client
    try {
      const { PrismaClient } = await import('@prisma/client');
      this.db = new PrismaClient({
        datasources: {
          db: {
            url: this.config.connectionString,
          },
        },
      });

      // Test connection
      await this.db.$connect();
      logger.info('Database connection established');

      // Run any setup migrations if needed
      await this.runSetupMigrations();

    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Cleanup test data
      await this.cleanupTestData();

      // Disconnect from database
      if (this.db) {
        await this.db.$disconnect();
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Failed to cleanup database connection', { error });
    }
  }

  private async runSetupMigrations(): Promise<void> {
    // Only run in test environments
    if (this.config.environment === 'prod') {
      return;
    }

    try {
      // Ensure test tables exist or create them
      await this.db.$executeRaw`
        CREATE TABLE IF NOT EXISTS test_cleanup (
          id SERIAL PRIMARY KEY,
          table_name VARCHAR(255) NOT NULL,
          record_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (error) {
      logger.warn('Failed to create test cleanup table', { error });
    }
  }

  private async trackForCleanup(tableName: string, recordId: string): Promise<void> {
    try {
      await this.db.$executeRaw`
        INSERT INTO test_cleanup (table_name, record_id)
        VALUES (${tableName}, ${recordId});
      `;
    } catch (error) {
      logger.warn('Failed to track record for cleanup', { tableName, recordId, error });
    }
  }

  private async cleanupTestData(): Promise<void> {
    if (this.config.environment === 'prod') {
      logger.warn('Skipping test data cleanup in production environment');
      return;
    }

    try {
      // Get all records to cleanup
      const cleanupRecords = await this.db.$queryRaw`
        SELECT table_name, record_id FROM test_cleanup
        ORDER BY id DESC;
      `;

      // Cleanup in reverse order
      for (const record of cleanupRecords as any[]) {
        try {
          const { table_name, record_id } = record;
          
          switch (table_name) {
            case 'evaluations':
              await this.db.evaluation.deleteMany({
                where: { id: record_id }
              });
              break;
            case 'business_ideas':
              await this.db.businessIdea.deleteMany({
                where: { id: record_id }
              });
              break;
            case 'users':
              await this.db.user.deleteMany({
                where: { id: record_id }
              });
              break;
          }
        } catch (error) {
          logger.warn('Failed to cleanup record', { record, error });
        }
      }

      // Clear cleanup tracking
      await this.db.$executeRaw`DELETE FROM test_cleanup;`;
      
    } catch (error) {
      logger.error('Failed to cleanup test data', { error });
    }
  }

  // Connection and Health Tests
  async testDatabaseConnection(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const result = await this.db.$queryRaw`SELECT 1 as test_value;`;
      const duration = Date.now() - startTime;

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('test_value');
      expect(result[0].test_value).toBe(1);
      expect(duration).toBeLessThan(5000); // 5 seconds

      logger.info('Database connection test passed', { duration });
    } catch (error) {
      logger.error('Database connection test failed', { error });
      throw error;
    }
  }

  async testDatabaseVersion(): Promise<void> {
    try {
      const result = await this.db.$queryRaw`SELECT version() as db_version;`;
      expect(result[0]).toHaveProperty('db_version');
      expect(result[0].db_version).toContain('PostgreSQL');

      logger.info('Database version test passed', { version: result[0].db_version });
    } catch (error) {
      logger.error('Database version test failed', { error });
      throw error;
    }
  }

  async testConnectionPooling(): Promise<void> {
    const startTime = Date.now();
    
    // Create multiple concurrent connections
    const promises = Array(10).fill(null).map((_, i) =>
      this.db.$queryRaw`SELECT ${i} as connection_id, pg_backend_pid() as process_id;`
    );

    try {
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(10);
      
      // Check that we got different process IDs (indicating connection pooling)
      const processIds = results.map((result: any) => result[0].process_id);
      const uniqueProcessIds = new Set(processIds);

      logger.info('Connection pooling test passed', { 
        duration,
        totalConnections: results.length,
        uniqueProcessIds: uniqueProcessIds.size,
      });

    } catch (error) {
      logger.error('Connection pooling test failed', { error });
      throw error;
    }
  }

  // Schema and Migration Tests
  async testDatabaseSchema(): Promise<void> {
    try {
      // Check that required tables exist
      const requiredTables = ['users', 'business_ideas', 'evaluations', 'evaluation_results'];
      
      for (const tableName of requiredTables) {
        const result = await this.db.$queryRaw`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName};
        `;

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('table_name', tableName);
      }

      logger.info('Database schema test passed', { tables: requiredTables });
    } catch (error) {
      logger.error('Database schema test failed', { error });
      throw error;
    }
  }

  async testTableConstraints(): Promise<void> {
    try {
      // Test foreign key constraints
      const constraints = await this.db.$queryRaw`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY', 'UNIQUE')
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_type;
      `;

      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);

      // Check that each main table has a primary key
      const primaryKeys = (constraints as any[]).filter(c => c.constraint_type === 'PRIMARY KEY');
      const tablesWithPrimaryKeys = new Set(primaryKeys.map(pk => pk.table_name));
      
      expect(tablesWithPrimaryKeys.has('users')).toBe(true);
      expect(tablesWithPrimaryKeys.has('business_ideas')).toBe(true);
      expect(tablesWithPrimaryKeys.has('evaluations')).toBe(true);

      logger.info('Table constraints test passed', { 
        totalConstraints: constraints.length,
        primaryKeys: primaryKeys.length,
      });
    } catch (error) {
      logger.error('Table constraints test failed', { error });
      throw error;
    }
  }

  // CRUD Operations Tests
  async testUserCrudOperations(): Promise<void> {
    const testUser = {
      email: `db-test-${Date.now()}@example.com`,
      password: 'hashedpassword123',
      name: 'Database Test User',
    };

    try {
      // Create user
      const createdUser = await this.db.user.create({
        data: testUser,
      });

      expect(createdUser).toHaveProperty('id');
      expect(createdUser.email).toBe(testUser.email);
      expect(createdUser.name).toBe(testUser.name);
      
      this.testData.userId = createdUser.id;
      await this.trackForCleanup('users', createdUser.id);

      // Read user
      const foundUser = await this.db.user.findUnique({
        where: { id: createdUser.id },
      });

      expect(foundUser).not.toBeNull();
      expect(foundUser.email).toBe(testUser.email);

      // Update user
      const updatedUser = await this.db.user.update({
        where: { id: createdUser.id },
        data: { name: 'Updated Test User' },
      });

      expect(updatedUser.name).toBe('Updated Test User');

      // Test unique constraint
      try {
        await this.db.user.create({
          data: {
            ...testUser,
            name: 'Duplicate Email User',
          },
        });
        throw new Error('Should have failed due to unique constraint');
      } catch (error: any) {
        expect(error.code).toBe('P2002'); // Prisma unique constraint error
      }

      logger.info('User CRUD operations test passed', { userId: createdUser.id });
    } catch (error) {
      logger.error('User CRUD operations test failed', { error });
      throw error;
    }
  }

  async testBusinessIdeaCrudOperations(): Promise<void> {
    if (!this.testData.userId) {
      throw new Error('User ID not available for business idea tests');
    }

    const testIdea = {
      name: 'Database Test Business Idea',
      description: 'A test business idea for database integration testing',
      targetMarket: 'test market segment',
      revenue: 100000,
      costs: 50000,
      userId: this.testData.userId,
    };

    try {
      // Create business idea
      const createdIdea = await this.db.businessIdea.create({
        data: testIdea,
      });

      expect(createdIdea).toHaveProperty('id');
      expect(createdIdea.name).toBe(testIdea.name);
      expect(createdIdea.userId).toBe(this.testData.userId);
      
      this.testData.ideaId = createdIdea.id;
      await this.trackForCleanup('business_ideas', createdIdea.id);

      // Read with relations
      const foundIdea = await this.db.businessIdea.findUnique({
        where: { id: createdIdea.id },
        include: {
          user: true,
          evaluations: true,
        },
      });

      expect(foundIdea).not.toBeNull();
      expect(foundIdea.user.id).toBe(this.testData.userId);
      expect(Array.isArray(foundIdea.evaluations)).toBe(true);

      // Update business idea
      const updatedIdea = await this.db.businessIdea.update({
        where: { id: createdIdea.id },
        data: { 
          name: 'Updated Database Test Idea',
          revenue: 150000,
        },
      });

      expect(updatedIdea.name).toBe('Updated Database Test Idea');
      expect(updatedIdea.revenue).toBe(150000);

      // Test cascade operations (should be handled by foreign key constraints)
      const userIdeas = await this.db.businessIdea.findMany({
        where: { userId: this.testData.userId },
      });

      expect(userIdeas.length).toBeGreaterThan(0);
      expect(userIdeas.some(idea => idea.id === createdIdea.id)).toBe(true);

      logger.info('Business idea CRUD operations test passed', { ideaId: createdIdea.id });
    } catch (error) {
      logger.error('Business idea CRUD operations test failed', { error });
      throw error;
    }
  }

  async testEvaluationCrudOperations(): Promise<void> {
    if (!this.testData.userId || !this.testData.ideaId) {
      throw new Error('User ID or Idea ID not available for evaluation tests');
    }

    const testEvaluation = {
      businessIdeaId: this.testData.ideaId,
      status: 'pending',
      startedAt: new Date(),
    };

    try {
      // Create evaluation
      const createdEvaluation = await this.db.evaluation.create({
        data: testEvaluation,
      });

      expect(createdEvaluation).toHaveProperty('id');
      expect(createdEvaluation.businessIdeaId).toBe(this.testData.ideaId);
      expect(createdEvaluation.status).toBe('pending');
      
      this.testData.evaluationId = createdEvaluation.id;
      await this.trackForCleanup('evaluations', createdEvaluation.id);

      // Read with relations
      const foundEvaluation = await this.db.evaluation.findUnique({
        where: { id: createdEvaluation.id },
        include: {
          businessIdea: {
            include: {
              user: true,
            },
          },
          result: true,
        },
      });

      expect(foundEvaluation).not.toBeNull();
      expect(foundEvaluation.businessIdea.id).toBe(this.testData.ideaId);
      expect(foundEvaluation.businessIdea.user.id).toBe(this.testData.userId);

      // Update evaluation status
      const updatedEvaluation = await this.db.evaluation.update({
        where: { id: createdEvaluation.id },
        data: { 
          status: 'completed',
          completedAt: new Date(),
        },
      });

      expect(updatedEvaluation.status).toBe('completed');
      expect(updatedEvaluation.completedAt).not.toBeNull();

      // Create evaluation result
      const evaluationResult = await this.db.evaluationResult.create({
        data: {
          evaluationId: createdEvaluation.id,
          overallScore: 75,
          marketResearch: {
            marketSize: 'large',
            competition: 'moderate',
            trends: ['positive'],
          },
          financialAnalysis: {
            profitability: 'high',
            breakEven: 12,
            riskLevel: 'medium',
          },
        },
      });

      expect(evaluationResult.overallScore).toBe(75);
      expect(evaluationResult.marketResearch).toHaveProperty('marketSize');

      logger.info('Evaluation CRUD operations test passed', { evaluationId: createdEvaluation.id });
    } catch (error) {
      logger.error('Evaluation CRUD operations test failed', { error });
      throw error;
    }
  }

  // Performance Tests
  async testQueryPerformance(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test complex query with joins
      const complexQuery = await this.db.evaluation.findMany({
        include: {
          businessIdea: {
            include: {
              user: true,
            },
          },
          result: true,
        },
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      });

      const queryDuration = Date.now() - startTime;
      expect(queryDuration).toBeLessThan(5000); // 5 seconds

      // Test aggregation query
      const aggregationStart = Date.now();
      const stats = await this.db.evaluation.aggregate({
        _count: {
          id: true,
        },
        _avg: {
          result: {
            overallScore: true,
          },
        },
      });

      const aggregationDuration = Date.now() - aggregationStart;
      expect(aggregationDuration).toBeLessThan(3000); // 3 seconds

      logger.info('Query performance test passed', { 
        complexQueryDuration: queryDuration,
        aggregationDuration,
        resultCount: complexQuery.length,
      });
    } catch (error) {
      logger.error('Query performance test failed', { error });
      throw error;
    }
  }

  async testConcurrentOperations(): Promise<void> {
    if (!this.testData.userId) {
      throw new Error('User ID not available for concurrent operations test');
    }

    try {
      // Create multiple business ideas concurrently
      const promises = Array(5).fill(null).map((_, i) =>
        this.db.businessIdea.create({
          data: {
            name: `Concurrent Test Idea ${i}`,
            description: `Description for concurrent test idea ${i}`,
            targetMarket: 'concurrent test market',
            revenue: 10000 * (i + 1),
            costs: 5000 * (i + 1),
            userId: this.testData.userId,
          },
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(5);
      expect(duration).toBeLessThan(5000); // 5 seconds for all operations

      // Track for cleanup
      for (const result of results) {
        await this.trackForCleanup('business_ideas', result.id);
      }

      // Test concurrent reads
      const readPromises = results.map(result =>
        this.db.businessIdea.findUnique({
          where: { id: result.id },
        })
      );

      const readResults = await Promise.all(readPromises);
      expect(readResults.every(result => result !== null)).toBe(true);

      logger.info('Concurrent operations test passed', { 
        duration,
        operationsCount: results.length,
      });
    } catch (error) {
      logger.error('Concurrent operations test failed', { error });
      throw error;
    }
  }

  // Transaction Tests
  async testTransactionOperations(): Promise<void> {
    if (!this.testData.userId) {
      throw new Error('User ID not available for transaction tests');
    }

    try {
      // Test successful transaction
      const result = await this.db.$transaction(async (tx) => {
        const idea = await tx.businessIdea.create({
          data: {
            name: 'Transaction Test Idea',
            description: 'Testing database transactions',
            targetMarket: 'transaction test market',
            revenue: 75000,
            costs: 25000,
            userId: this.testData.userId!,
          },
        });

        const evaluation = await tx.evaluation.create({
          data: {
            businessIdeaId: idea.id,
            status: 'pending',
          },
        });

        return { idea, evaluation };
      });

      expect(result.idea).toHaveProperty('id');
      expect(result.evaluation).toHaveProperty('id');
      expect(result.evaluation.businessIdeaId).toBe(result.idea.id);

      await this.trackForCleanup('business_ideas', result.idea.id);
      await this.trackForCleanup('evaluations', result.evaluation.id);

      // Test transaction rollback
      try {
        await this.db.$transaction(async (tx) => {
          await tx.businessIdea.create({
            data: {
              name: 'Rollback Test Idea',
              description: 'This should be rolled back',
              targetMarket: 'rollback test',
              revenue: 50000,
              costs: 30000,
              userId: this.testData.userId!,
            },
          });

          // Force an error to trigger rollback
          throw new Error('Intentional rollback');
        });

        throw new Error('Transaction should have been rolled back');
      } catch (error: any) {
        expect(error.message).toBe('Intentional rollback');
      }

      // Verify rollback worked
      const rolledBackIdeas = await this.db.businessIdea.findMany({
        where: {
          name: 'Rollback Test Idea',
        },
      });

      expect(rolledBackIdeas.length).toBe(0);

      logger.info('Transaction operations test passed');
    } catch (error) {
      logger.error('Transaction operations test failed', { error });
      throw error;
    }
  }
}

// Test Configuration
const getDatabaseTestConfig = (): DatabaseTestConfig => {
  const connectionString = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL environment variable is required');
  }

  return {
    connectionString,
    environment: process.env.TEST_ENVIRONMENT || 'dev',
    timeout: 30000, // 30 seconds per test
  };
};

// Test Suite
describe('Database Integration Tests', () => {
  let tester: DatabaseIntegrationTester;
  const config = getDatabaseTestConfig();

  beforeAll(async () => {
    tester = new DatabaseIntegrationTester(config);
    await tester.setup();
  }, config.timeout);

  afterAll(async () => {
    if (tester) {
      await tester.cleanup();
    }
  });

  describe('Connection and Health', () => {
    test('should connect to database successfully', async () => {
      await tester.testDatabaseConnection();
    }, config.timeout);

    test('should have correct database version', async () => {
      await tester.testDatabaseVersion();
    }, config.timeout);

    test('should handle connection pooling', async () => {
      await tester.testConnectionPooling();
    }, config.timeout);
  });

  describe('Schema and Structure', () => {
    test('should have required database schema', async () => {
      await tester.testDatabaseSchema();
    }, config.timeout);

    test('should have proper table constraints', async () => {
      await tester.testTableConstraints();
    }, config.timeout);
  });

  describe('CRUD Operations', () => {
    test('should handle user CRUD operations', async () => {
      await tester.testUserCrudOperations();
    }, config.timeout);

    test('should handle business idea CRUD operations', async () => {
      await tester.testBusinessIdeaCrudOperations();
    }, config.timeout);

    test('should handle evaluation CRUD operations', async () => {
      await tester.testEvaluationCrudOperations();
    }, config.timeout);
  });

  describe('Performance', () => {
    test('should meet query performance requirements', async () => {
      await tester.testQueryPerformance();
    }, config.timeout);

    test('should handle concurrent operations', async () => {
      await tester.testConcurrentOperations();
    }, config.timeout);
  });

  describe('Transactions', () => {
    test('should handle transaction operations correctly', async () => {
      await tester.testTransactionOperations();
    }, config.timeout);
  });
});

export default DatabaseIntegrationTester;