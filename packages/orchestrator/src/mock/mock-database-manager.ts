/**
 * Mock Database Manager for Offline Development
 * Provides in-memory database simulation without PostgreSQL dependency
 */

import { EventEmitter } from 'events';
import { DatabaseManager as IDatabaseManager, DatabaseConfig } from '../database/database-manager.js';

export interface MockDatabaseConfig extends Partial<DatabaseConfig> {
  simulateLatency?: boolean;
  latencyRange?: [number, number]; // [min, max] in milliseconds
  failureRate?: number; // 0-1, probability of failure
  maxConnections?: number;
}

export class MockDatabaseManager extends EventEmitter implements IDatabaseManager {
  private static instance: MockDatabaseManager;
  private config: MockDatabaseConfig;
  private isInitialized = false;
  private connectionCount = 0;
  private queryCount = 0;
  private tables = new Map<string, Map<string, any>>();

  private constructor(config: MockDatabaseConfig = {}) {
    super();
    this.config = {
      simulateLatency: true,
      latencyRange: [10, 100],
      failureRate: 0,
      maxConnections: 10,
      ...config
    };

    // Initialize mock tables
    this.initializeTables();
  }

  static getInstance(config?: MockDatabaseConfig): MockDatabaseManager {
    if (!MockDatabaseManager.instance) {
      MockDatabaseManager.instance = new MockDatabaseManager(config);
    }
    return MockDatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[MockDatabaseManager] Initializing mock database...');
    await this.simulateDelay();
    
    this.isInitialized = true;
    this.emit('connect');
    
    console.log('[MockDatabaseManager] Mock database initialized');
  }

  async shutdown(): Promise<void> {
    console.log('[MockDatabaseManager] Shutting down mock database...');
    
    this.isInitialized = false;
    this.connectionCount = 0;
    this.queryCount = 0;
    
    this.emit('disconnect');
    this.removeAllListeners();
    
    console.log('[MockDatabaseManager] Mock database shutdown complete');
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    await this.simulateDelay();
    this.maybeSimulateFailure();
    
    this.queryCount++;
    console.log(`[MockDatabaseManager] Executed query { text: '${text.slice(0, 50)}${text.length > 50 ? '...' : ''}', duration: '${Math.random() * 100}ms', rows: ${Math.floor(Math.random() * 10)} }`);

    // Parse the SQL query and simulate result
    const result = this.simulateQuery(text, params);
    return result as T[];
  }

  async getClient(): Promise<{
    query: <T = any>(text: string, params?: any[]) => Promise<{ rows: T[] }>;
    release: () => void;
  }> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    if (this.connectionCount >= this.config.maxConnections!) {
      throw new Error('Connection pool exhausted');
    }

    this.connectionCount++;
    console.log(`[MockDatabaseManager] Database client connected`);

    return {
      query: async <T = any>(text: string, params?: any[]) => {
        const rows = await this.query<T>(text, params);
        return { rows };
      },
      release: () => {
        this.connectionCount--;
        console.log(`[MockDatabaseManager] Database client disconnected`);
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.config.maxConnections!,
      idleCount: this.config.maxConnections! - this.connectionCount,
      waitingCount: 0
    };
  }

  // Configuration methods for testing

  setLatencyRange(min: number, max: number): void {
    this.config.latencyRange = [Math.max(0, min), Math.max(min, max)];
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }

  setMaxConnections(max: number): void {
    this.config.maxConnections = Math.max(1, max);
  }

  // Test utilities

  getQueryCount(): number {
    return this.queryCount;
  }

  resetQueryCount(): void {
    this.queryCount = 0;
  }

  getConnectionCount(): number {
    return this.connectionCount;
  }

  clearTables(): void {
    for (const table of this.tables.values()) {
      table.clear();
    }
    console.log('[MockDatabaseManager] Cleared all tables');
  }

  getTableData(tableName: string): any[] {
    const table = this.tables.get(tableName);
    return table ? Array.from(table.values()) : [];
  }

  insertTestData(tableName: string, data: any[]): void {
    const table = this.tables.get(tableName);
    if (table) {
      data.forEach((item, index) => {
        const id = item.id || `test-${index}`;
        table.set(id, { ...item, id });
      });
    }
  }

  static resetInstance(): void {
    if (MockDatabaseManager.instance) {
      MockDatabaseManager.instance.shutdown();
    }
    MockDatabaseManager.instance = null as any;
  }

  // Private methods

  private async simulateDelay(): Promise<void> {
    if (!this.config.simulateLatency) return;

    const [min, max] = this.config.latencyRange!;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private maybeSimulateFailure(): void {
    if (Math.random() < this.config.failureRate!) {
      throw new Error('Simulated database failure');
    }
  }

  private initializeTables(): void {
    // Initialize tables that match the database schema
    this.tables.set('users', new Map());
    this.tables.set('business_ideas', new Map());
    this.tables.set('evaluations', new Map());
    this.tables.set('agent_results', new Map());

    // Add some sample data
    this.insertSampleData();
  }

  private insertSampleData(): void {
    // Sample users
    const users = [
      {
        id: 'user-1',
        email: 'john.doe@example.com',
        password_hash: '$2b$12$...',
        name: 'John Doe',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'user-2',
        email: 'jane.smith@example.com',
        password_hash: '$2b$12$...',
        name: 'Jane Smith',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Sample business ideas
    const businessIdeas = [
      {
        id: 'idea-1',
        user_id: 'user-1',
        title: 'AI-Powered Fitness Tracking App',
        description: 'A mobile app that uses AI to provide personalized fitness recommendations and workout plans based on user goals, progress, and preferences.',
        status: 'submitted',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'idea-2',
        user_id: 'user-2',
        title: 'Sustainable E-commerce Packaging Platform',
        description: 'A platform that connects e-commerce businesses with sustainable packaging suppliers, reducing environmental impact while maintaining cost-effectiveness.',
        status: 'submitted',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    this.insertTestData('users', users);
    this.insertTestData('business_ideas', businessIdeas);
  }

  private simulateQuery(sql: string, params: any[] = []): any[] {
    const normalizedSql = sql.toLowerCase().trim();

    // Handle different types of queries
    if (normalizedSql.startsWith('select')) {
      return this.handleSelectQuery(sql, params);
    } else if (normalizedSql.startsWith('insert')) {
      return this.handleInsertQuery(sql, params);
    } else if (normalizedSql.startsWith('update')) {
      return this.handleUpdateQuery(sql, params);
    } else if (normalizedSql.startsWith('delete')) {
      return this.handleDeleteQuery(sql, params);
    } else {
      // For other queries (CREATE, DROP, etc.), return empty result
      return [];
    }
  }

  private handleSelectQuery(sql: string, params: any[]): any[] {
    // Extract table name and basic conditions
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) {
      return [];
    }

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }

    let results = Array.from(table.values());

    // Handle WHERE clauses (basic implementation)
    if (sql.includes('WHERE') || sql.includes('where')) {
      results = this.filterByWhereClause(results, sql, params);
    }

    // Handle LIMIT
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      results = results.slice(0, limit);
    }

    // Handle specific SELECT operations
    if (sql.includes('COUNT(*)')) {
      return [{ count: results.length.toString(), total: results.length.toString() }];
    }

    // Handle aggregate functions
    if (sql.includes('AVG(') || sql.includes('SUM(') || sql.includes('MAX(') || sql.includes('MIN(')) {
      return this.handleAggregateQuery(sql, results);
    }

    return results;
  }

  private handleInsertQuery(sql: string, params: any[]): any[] {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) {
      return [];
    }

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }

    // Generate a new record
    const newRecord = this.generateRecordFromInsert(sql, params, tableName);
    table.set(newRecord.id, newRecord);

    // Return the inserted record (simulating RETURNING *)
    return [newRecord];
  }

  private handleUpdateQuery(sql: string, params: any[]): any[] {
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (!tableMatch) {
      return [];
    }

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }

    // Find records to update based on WHERE clause
    let records = Array.from(table.values());
    if (sql.includes('WHERE') || sql.includes('where')) {
      records = this.filterByWhereClause(records, sql, params);
    }

    // Update the records
    const updatedRecords = records.map(record => {
      const updated = { ...record, updated_at: new Date() };
      this.applyUpdateValues(updated, sql, params);
      table.set(updated.id, updated);
      return updated;
    });

    return updatedRecords;
  }

  private handleDeleteQuery(sql: string, params: any[]): any[] {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (!tableMatch) {
      return [];
    }

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }

    // Find records to delete
    let records = Array.from(table.values());
    if (sql.includes('WHERE') || sql.includes('where')) {
      records = this.filterByWhereClause(records, sql, params);
    }

    // Delete the records
    records.forEach(record => {
      table.delete(record.id);
    });

    return [];
  }

  private filterByWhereClause(records: any[], sql: string, params: any[]): any[] {
    // Simple WHERE clause parsing (basic implementation)
    if (params.length > 0) {
      // For UPDATE queries, the ID is typically the last parameter
      if (sql.toLowerCase().includes('update')) {
        const idParam = params[params.length - 1];
        return records.filter(record => record.id === idParam);
      }
      // For other queries, assume first parameter is ID
      const idParam = params[0];
      return records.filter(record => record.id === idParam);
    }

    return records;
  }

  private generateRecordFromInsert(sql: string, params: any[], tableName: string): any {
    const now = new Date();
    const id = `${tableName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const baseRecord = {
      id,
      created_at: now,
      updated_at: now
    };

    // Map parameters to common field patterns
    if (tableName === 'evaluations' && params.length >= 2) {
      return {
        ...baseRecord,
        business_idea_id: params[0],
        priority: params[1] || 'normal',
        status: 'pending'
      };
    }

    if (tableName === 'agent_results' && params.length >= 3) {
      return {
        ...baseRecord,
        evaluation_id: params[0],
        agent_type: params[1],
        input_data: params[2],
        status: 'pending'
      };
    }

    // Default: include all parameters as numbered fields
    params.forEach((param, index) => {
      (baseRecord as any)[`field_${index}`] = param;
    });

    return baseRecord;
  }

  private applyUpdateValues(record: any, sql: string, params: any[]): void {
    // Simple SET clause parsing - in real implementation this would be more sophisticated
    if (params.length > 0) {
      const setMatch = sql.match(/set\s+(.+?)\s+where/i);
      if (setMatch) {
        const setClause = setMatch[1];
        
        // Common field mappings
        if (setClause.includes('status')) {
          record.status = params.find(p => typeof p === 'string' && ['pending', 'analyzing', 'completed', 'failed', 'running'].includes(p)) || record.status;
        }
        
        if (setClause.includes('score')) {
          record.score = params.find(p => typeof p === 'number' && p >= 0 && p <= 100) || record.score;
        }

        if (setClause.includes('started_at')) {
          record.started_at = params.find(p => p instanceof Date) || new Date();
        }

        if (setClause.includes('completed_at')) {
          record.completed_at = params.find(p => p instanceof Date) || new Date();
        }
      }
    }
  }

  private handleAggregateQuery(sql: string, records: any[]): any[] {
    if (sql.includes('AVG(')) {
      const field = this.extractFieldFromAggregate(sql, 'AVG');
      const values = records.map(r => r[field]).filter(v => typeof v === 'number');
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return [{ [field]: avg.toString(), average_score: avg.toString() }];
    }

    if (sql.includes('COUNT(')) {
      return [{ count: records.length.toString() }];
    }

    return [{ result: records.length }];
  }

  private extractFieldFromAggregate(sql: string, func: string): string {
    const regex = new RegExp(`${func}\\(([^)]+)\\)`, 'i');
    const match = sql.match(regex);
    return match ? match[1].trim() : 'score';
  }
}