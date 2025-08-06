/**
 * Communication Module Exports
 */

// Message types and interfaces
export * from './message-types.js'

// Message bus implementation
export { MessageBus } from './message-bus.js'

// Agent coordination
export { AgentCoordinator } from './agent-coordinator.js'
export type { AgentDependency, AgentWorkflow, AgentExecutionState } from './agent-coordinator.js'
