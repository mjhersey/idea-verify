/**
 * Queue Types and Interfaces
 */

export enum JobType {
  EVALUATION_REQUEST = 'evaluation-request',
  AGENT_TASK = 'agent-task',
  RESULT_PROCESSING = 'result-processing',
}

export enum JobPriority {
  HIGH = 1,
  NORMAL = 5,
  LOW = 10,
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

export interface BaseJobData {
  correlationId: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface EvaluationRequestJobData extends BaseJobData {
  businessIdeaId: string
  userId: string
  priority: JobPriority
}

export interface AgentTaskJobData extends BaseJobData {
  evaluationId: string
  agentType: string
  businessIdea: {
    id: string
    title: string
    description: string
  }
  analysisType: string
  timeout?: number
}

export interface ResultProcessingJobData extends BaseJobData {
  evaluationId: string
  agentResults: Array<{
    agentType: string
    score: number
    insights: string[]
    rawData: any
  }>
}

export type JobData =
  | EvaluationRequestJobData
  | AgentTaskJobData
  | ResultProcessingJobData
  | Record<string, any>

export interface JobOptions {
  priority?: JobPriority
  delay?: number
  attempts?: number
  backoff?: {
    type: 'exponential' | 'fixed'
    delay: number
  }
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
}

export interface QueueMetrics {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  jobCounts: Record<JobType, number>
  processingTimes: {
    average: number
    min: number
    max: number
  }
  errorRate: number
  throughput: number
}

export interface QueueConfig {
  redis?: {
    host: string
    port: number
    password?: string
    maxRetriesPerRequest?: number
  }
  defaultJobOptions?: JobOptions
  concurrency?: number
  maxStalledCount?: number
  stalledInterval?: number
  useMockQueue?: boolean
}
