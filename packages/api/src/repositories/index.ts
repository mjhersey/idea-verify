/**
 * Repository exports for data access layer
 */

export { UserRepository } from './user-repository.js'
export { BusinessIdeaRepository } from './business-idea-repository.js'

// Repository instances for dependency injection
import { UserRepository } from './user-repository.js'
import { BusinessIdeaRepository } from './business-idea-repository.js'

export const userRepository = new UserRepository()
export const businessIdeaRepository = new BusinessIdeaRepository()

// Repository container for easy access
export const repositories = {
  user: userRepository,
  businessIdea: businessIdeaRepository,
} as const

export type RepositoryContainer = typeof repositories
