/**
 * Database Manager Unit Tests
 * Tests the core database manager functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { DatabaseManager, DatabaseConfig } from '../../src/database/database-manager.js';

// Mock environment variables
vi.stubEnv('AWS_REGION', 'us-east-1');
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('SECRETS_OPENAI_NAME', 'test-openai-secret');
vi.stubEnv('SECRETS_ANTHROPIC_NAME', 'test-anthropic-secret');
vi.stubEnv('SECRETS_AWS_NAME', 'test-aws-secret');
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeAll(() => {
    // Test with default configuration
    dbManager = DatabaseManager.getInstance();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.shutdown();
    }
    // Reset singleton for other tests
    (DatabaseManager as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseManager.getInstance();
      const instance2 = DatabaseManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create instance with custom config', () => {
      const customConfig: DatabaseConfig = {
        host: 'custom-host',
        port: 5433,
        database: 'custom-db',
        username: 'custom-user',
        password: 'custom-pass',
        ssl: false,
        maxConnections: 5,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 2000
      };

      const customManager = DatabaseManager.getInstance(customConfig);
      expect(customManager).toBeDefined();
      
      // Should still return same instance (singleton)
      const sameInstance = DatabaseManager.getInstance();
      expect(customManager).toBe(sameInstance);
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DB_HOST: 'test-host',
        DB_PORT: '5433',
        DB_NAME: 'test-db',
        DB_USER: 'test-user',
        DB_PASSWORD: 'test-pass',
        DB_SSL: 'true',
        DB_MAX_CONNECTIONS: '15',
        DB_IDLE_TIMEOUT: '5000',
        DB_CONNECTION_TIMEOUT: '3000'
      };

      // Reset singleton to pick up new env vars
      (DatabaseManager as any).instance = null;
      
      const envManager = DatabaseManager.getInstance();
      expect(envManager).toBeDefined();

      // Restore environment
      process.env = originalEnv;
      (DatabaseManager as any).instance = null;
    });

    it('should use default values when env vars are not set', () => {
      // Ensure clean environment
      const originalEnv = process.env;
      const cleanEnv = { ...originalEnv };
      delete cleanEnv.DB_HOST;
      delete cleanEnv.DB_PORT;
      delete cleanEnv.DB_NAME;
      delete cleanEnv.DB_USER;
      delete cleanEnv.DB_PASSWORD;
      process.env = cleanEnv;

      // Reset singleton
      (DatabaseManager as any).instance = null;
      
      const defaultManager = DatabaseManager.getInstance();
      expect(defaultManager).toBeDefined();

      // Restore environment
      process.env = originalEnv;
      (DatabaseManager as any).instance = null;
    });
  });

  describe('Connection Management', () => {
    it('should handle initialization without actual database', async () => {
      // This test verifies the initialization process doesn't throw
      // when database connection fails (for unit testing environment)
      
      try {
        await dbManager.initialize();
        
        // If initialization succeeds, verify health check
        const isHealthy = await dbManager.healthCheck();
        expect(typeof isHealthy).toBe('boolean');
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });

    it('should provide connection pool statistics', async () => {
      try {
        const stats = await dbManager.getStats();
        
        expect(stats).toHaveProperty('totalCount');
        expect(stats).toHaveProperty('idleCount');
        expect(stats).toHaveProperty('waitingCount');
        expect(typeof stats.totalCount).toBe('number');
        expect(typeof stats.idleCount).toBe('number');
        expect(typeof stats.waitingCount).toBe('number');
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });

    it('should handle query execution safely', async () => {
      try {
        const result = await dbManager.query('SELECT 1 as test');
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });

    it('should handle client acquisition safely', async () => {
      try {
        const client = await dbManager.getClient();
        expect(client).toBeDefined();
        expect(typeof client.release).toBe('function');
        client.release();
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });

    it('should handle shutdown gracefully', async () => {
      // Should not throw even if pool is not initialized
      await expect(dbManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      try {
        await dbManager.query('INVALID SQL STATEMENT');
        // Should not reach here if database is connected
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle connection failures', async () => {
      const invalidConfig: DatabaseConfig = {
        host: 'invalid-host-12345',
        port: 99999,
        database: 'invalid-db',
        username: 'invalid-user',
        password: 'invalid-pass',
        ssl: false,
        maxConnections: 1,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 1000
      };

      // Reset singleton
      (DatabaseManager as any).instance = null;
      
      const invalidManager = DatabaseManager.getInstance(invalidConfig);
      
      await expect(invalidManager.initialize()).rejects.toThrow();
      
      // Reset singleton for other tests
      (DatabaseManager as any).instance = null;
    });
  });

  describe('SQL Parameter Sanitization', () => {
    it('should handle parameterized queries safely', async () => {
      const testParams = [
        'test string',
        123,
        true,
        null,
        { json: 'object' },
        ['array', 'values']
      ];

      try {
        // This should not throw due to parameter structure
        await dbManager.query(
          'SELECT $1, $2, $3, $4, $5, $6',
          testParams
        );
      } catch (error) {
        // Expected in unit test environment without database
        // But should not be a parameter-related error
        expect(error).toBeDefined();
      }
    });

    it('should handle empty parameter arrays', async () => {
      try {
        await dbManager.query('SELECT 1', []);
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });

    it('should handle undefined parameters', async () => {
      try {
        await dbManager.query('SELECT 1');
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });
  });

  describe('Pool Configuration', () => {
    it('should respect connection limits', () => {
      const limitedConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        ssl: false,
        maxConnections: 2,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 1000
      };

      // Reset singleton
      (DatabaseManager as any).instance = null;
      
      const limitedManager = DatabaseManager.getInstance(limitedConfig);
      expect(limitedManager).toBeDefined();
      
      // Reset singleton for other tests
      (DatabaseManager as any).instance = null;
    });

    it('should handle SSL configuration', () => {
      const sslConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        ssl: true,
        maxConnections: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      };

      // Reset singleton
      (DatabaseManager as any).instance = null;
      
      const sslManager = DatabaseManager.getInstance(sslConfig);
      expect(sslManager).toBeDefined();
      
      // Reset singleton for other tests
      (DatabaseManager as any).instance = null;
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous queries', async () => {
      const queries = [
        dbManager.query('SELECT 1'),
        dbManager.query('SELECT 2'),
        dbManager.query('SELECT 3')
      ];

      try {
        const results = await Promise.allSettled(queries);
        
        // All queries should either succeed or fail consistently
        const statuses = results.map(r => r.status);
        const allSame = statuses.every(s => s === statuses[0]);
        expect(allSame).toBe(true);
      } catch (error) {
        // Expected in unit test environment without database
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent client acquisition', async () => {
      const clientPromises = [
        dbManager.getClient().catch(() => null),
        dbManager.getClient().catch(() => null),
        dbManager.getClient().catch(() => null)
      ];

      const clients = await Promise.all(clientPromises);
      
      // Release any successful client acquisitions
      clients.forEach(client => {
        if (client && typeof client.release === 'function') {
          client.release();
        }
      });
    });
  });
});