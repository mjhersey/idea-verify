/**
 * Database Manager - Handles PostgreSQL connections and transactions
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { getEnvironmentConfig } from '@ai-validation/shared';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  private constructor(config?: Partial<DatabaseConfig>) {
    this.config = this.buildConfig(config);
  }

  static getInstance(config?: Partial<DatabaseConfig>): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  private buildConfig(customConfig?: Partial<DatabaseConfig>): DatabaseConfig {
    // Get environment configuration
    const envConfig = getEnvironmentConfig();
    
    // Default configuration for development
    const defaultConfig: DatabaseConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_validation_platform',
      username: process.env.DB_USER || 'dev_user',
      password: process.env.DB_PASSWORD || 'dev_password',
      ssl: process.env.NODE_ENV === 'production',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000')
    };

    return {
      ...defaultConfig,
      ...customConfig
    };
  }

  async initialize(): Promise<void> {
    if (this.pool) {
      console.log('Database pool already initialized');
      return;
    }

    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      // Application-specific settings
      application_name: 'ai-validation-orchestrator',
      statement_timeout: 30000, // 30 seconds
      query_timeout: 30000
    };

    this.pool = new Pool(poolConfig);

    // Handle pool events
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', (client) => {
      console.log('Database client connected');
    });

    this.pool.on('remove', (client) => {
      console.log('Database client disconnected');
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool.connect();
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      console.log('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return result.rows;
    } catch (error) {
      console.error('Database query error:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  getStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      console.log('Shutting down database connections...');
      await this.pool.end();
      this.pool = null;
      console.log('Database connections closed');
    }
  }

  // Test utility method to reset for testing
  static resetInstance(): void {
    if (DatabaseManager.instance?.pool) {
      DatabaseManager.instance.pool.end();
    }
    DatabaseManager.instance = null as any;
  }
}