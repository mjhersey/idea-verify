/**
 * Database Factory - Creates repository instances based on environment
 */

import { getEnvironmentConfig } from '@ai-validation/shared'
import { DatabaseManager } from './database-manager.js'

// In-memory implementations
import { EvaluationRepository } from './evaluation-repository.js'
import { AgentResultRepository } from './agent-result-repository.js'

// PostgreSQL implementations
import { PostgresEvaluationRepository } from './postgres-evaluation-repository.js'
import { PostgresAgentResultRepository } from './postgres-agent-result-repository.js'

export interface RepositoryInstances {
  evaluationRepository: EvaluationRepository | PostgresEvaluationRepository
  agentResultRepository: AgentResultRepository | PostgresAgentResultRepository
}

export class DatabaseFactory {
  private static instance: DatabaseFactory
  private repositories: RepositoryInstances | null = null
  private useDatabase: boolean

  private constructor() {
    const config = getEnvironmentConfig()
    this.useDatabase = !config.development.useMockServices
  }

  static getInstance(): DatabaseFactory {
    if (!DatabaseFactory.instance) {
      DatabaseFactory.instance = new DatabaseFactory()
    }
    return DatabaseFactory.instance
  }

  async initialize(): Promise<void> {
    if (this.useDatabase) {
      console.log('Initializing PostgreSQL database connection...')
      const dbManager = DatabaseManager.getInstance()
      await dbManager.initialize()

      // Create PostgreSQL repositories
      this.repositories = {
        evaluationRepository: new PostgresEvaluationRepository(),
        agentResultRepository: new PostgresAgentResultRepository(),
      }

      console.log('Database repositories initialized with PostgreSQL')
    } else {
      console.log('Using in-memory repositories for development')

      // Create in-memory repositories
      this.repositories = {
        evaluationRepository: new EvaluationRepository(),
        agentResultRepository: new AgentResultRepository(),
      }

      console.log('Database repositories initialized with in-memory storage')
    }
  }

  getRepositories(): RepositoryInstances {
    if (!this.repositories) {
      throw new Error('Database factory not initialized. Call initialize() first.')
    }
    return this.repositories
  }

  async healthCheck(): Promise<{
    database: boolean
    repositories: boolean
    type: 'postgres' | 'memory'
  }> {
    const health = {
      database: true,
      repositories: !!this.repositories,
      type: this.useDatabase ? ('postgres' as const) : ('memory' as const),
    }

    if (this.useDatabase) {
      try {
        const dbManager = DatabaseManager.getInstance()
        health.database = await dbManager.healthCheck()
      } catch (error) {
        health.database = false
      }
    }

    return health
  }

  async getDatabaseStats(): Promise<any> {
    if (this.useDatabase) {
      const dbManager = DatabaseManager.getInstance()
      return dbManager.getStats()
    } else {
      return {
        type: 'memory',
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.useDatabase) {
      console.log('Shutting down database connections...')
      const dbManager = DatabaseManager.getInstance()
      await dbManager.shutdown()
    }

    this.repositories = null
    console.log('Database factory shutdown complete')
  }

  // Test utility methods
  isUsingDatabase(): boolean {
    return this.useDatabase
  }

  async resetRepositories(): Promise<void> {
    if (!this.repositories) {
      return
    }

    // Reset state for testing
    if ('resetState' in this.repositories.evaluationRepository) {
      await (this.repositories.evaluationRepository as any).resetState()
    }

    if ('resetState' in this.repositories.agentResultRepository) {
      await (this.repositories.agentResultRepository as any).resetState()
    }

    console.log('Repository state reset for testing')
  }

  static resetInstance(): void {
    if (DatabaseFactory.instance) {
      DatabaseFactory.instance.shutdown()
    }
    DatabaseFactory.instance = null as any
  }

  // Development utility: run database migrations/setup
  async setupDatabase(): Promise<void> {
    if (!this.useDatabase) {
      console.log('Skipping database setup - using in-memory storage')
      return
    }

    console.log('Setting up database schema...')
    const dbManager = DatabaseManager.getInstance()

    try {
      // Read and execute the schema file
      const fs = await import('fs')
      const path = await import('path')
      const { fileURLToPath } = await import('url')

      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const schemaPath = path.join(__dirname, 'schema.sql')

      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8')

        // Split by semicolon and execute each statement
        const statements = schema
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0)

        for (const statement of statements) {
          if (
            statement.toLowerCase().includes('select') ||
            statement.toLowerCase().includes('insert')
          ) {
            // Skip SELECT statements and sample data in production
            continue
          }
          await dbManager.query(statement)
        }

        console.log('Database schema setup completed')
      } else {
        console.warn('Schema file not found, skipping database setup')
      }
    } catch (error) {
      console.error('Failed to setup database schema:', error)
      throw error
    }
  }
}
