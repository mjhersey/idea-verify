/**
 * Database Module Exports
 */

// Repository classes
export { EvaluationRepository } from './evaluation-repository.js'
export { AgentResultRepository } from './agent-result-repository.js'
export { PostgresEvaluationRepository } from './postgres-evaluation-repository.js'
export { PostgresAgentResultRepository } from './postgres-agent-result-repository.js'

// Database management
export { DatabaseManager } from './database-manager.js'
export type { RepositoryInstances } from './database-factory.js'

// Dynamic import function for DatabaseFactory to avoid cross-package issues
export async function getDatabaseFactory() {
  try {
    const { DatabaseFactory } = await import('./database-factory.js')
    return DatabaseFactory
  } catch (error) {
    throw new Error('DatabaseFactory not available in this context')
  }
}

// Internal variables for initialization
let databaseFactory: any

// Export a function to get repositories (async initialization)
export async function getRepositories() {
  if (!databaseFactory) {
    // Try to initialize if not already done
    try {
      const DatabaseFactory = await getDatabaseFactory()
      databaseFactory = DatabaseFactory.getInstance()
      await databaseFactory.initialize()
    } catch (error) {
      throw new Error(
        'DatabaseFactory not available. Make sure to import this from the correct package context.'
      )
    }
  }

  if (!databaseFactory.isInitialized) {
    await databaseFactory.initialize()
  }

  return databaseFactory.getRepositories()
}

// For backwards compatibility, create repository instances
let repositoryInstances: any = null

async function initializeRepositories() {
  if (!repositoryInstances) {
    try {
      repositoryInstances = await getRepositories()
    } catch (error) {
      console.warn('Failed to initialize repositories:', error)
      throw error
    }
  }
  return repositoryInstances
}

// Export lazy-loaded repository instances
export const evaluationRepository = new Proxy({} as any, {
  get(target, prop) {
    if (!repositoryInstances) {
      throw new Error(
        'Repositories not initialized. Call getRepositories() first or ensure OrchestratorService is properly initialized.'
      )
    }
    return repositoryInstances.evaluationRepository[prop]
  },
})

export const agentResultRepository = new Proxy({} as any, {
  get(target, prop) {
    if (!repositoryInstances) {
      throw new Error(
        'Repositories not initialized. Call getRepositories() first or ensure OrchestratorService is properly initialized.'
      )
    }
    return repositoryInstances.agentResultRepository[prop]
  },
})

// Initialize repositories immediately for backwards compatibility (but only in production)
// Skip initialization if we're in a test environment or in cross-package context
if (
  databaseFactory &&
  typeof global !== 'undefined' &&
  !global.__TESTING__ &&
  process.env.NODE_ENV !== 'test' &&
  process.env.PACKAGE_CONTEXT !== 'api'
) {
  initializeRepositories().catch(error => {
    console.error('Failed to initialize repositories:', error)
  })
}
