/**
 * Database Module Exports
 */

// Repository classes
export { EvaluationRepository } from './evaluation-repository.js';
export { AgentResultRepository } from './agent-result-repository.js';
export { PostgresEvaluationRepository } from './postgres-evaluation-repository.js';
export { PostgresAgentResultRepository } from './postgres-agent-result-repository.js';

// Database management
export { DatabaseManager } from './database-manager.js';
export { DatabaseFactory } from './database-factory.js';
export type { RepositoryInstances } from './database-factory.js';

// Initialize database factory and get repository instances
const databaseFactory = DatabaseFactory.getInstance();

// Export a function to get repositories (async initialization)
export async function getRepositories() {
  await databaseFactory.initialize();
  return databaseFactory.getRepositories();
}

// For backwards compatibility, create repository instances
// These will be initialized based on environment configuration
let repositoryInstances: any = null;

async function initializeRepositories() {
  if (!repositoryInstances) {
    repositoryInstances = await getRepositories();
  }
  return repositoryInstances;
}

// Export lazy-loaded repository instances
export const evaluationRepository = new Proxy({} as any, {
  get(target, prop) {
    if (!repositoryInstances) {
      throw new Error('Repositories not initialized. Call getRepositories() first.');
    }
    return repositoryInstances.evaluationRepository[prop];
  }
});

export const agentResultRepository = new Proxy({} as any, {
  get(target, prop) {
    if (!repositoryInstances) {
      throw new Error('Repositories not initialized. Call getRepositories() first.');
    }
    return repositoryInstances.agentResultRepository[prop];
  }
});

// Initialize repositories immediately for backwards compatibility
initializeRepositories().catch(error => {
  console.error('Failed to initialize repositories:', error);
});