/**
 * Mock Queue Manager for Offline Development
 * Provides in-memory queue simulation without Redis dependency
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  QueueManager as IQueueManager,
  JobProcessor,
  JobOptions,
  QueueStats,
  JobStatus,
  Job,
  JobPriority
} from '../queue/types.js';
import { 
  EvaluationRequestJobData,
  AgentTaskJobData,
  ResultProcessingJobData
} from '../queue/types.js';

interface MockJob<T = any> extends Job<T> {
  processedOn?: Date;
  failedReason?: string;
  attemptsMade: number;
  delay?: number;
  priority: JobPriority;
}

export class MockQueueManager extends EventEmitter implements IQueueManager {
  private static instance: MockQueueManager;
  private isInitialized = false;
  
  // In-memory job storage
  private evaluationJobs = new Map<string, MockJob<EvaluationRequestJobData>>();
  private agentJobs = new Map<string, MockJob<AgentTaskJobData>>();
  private resultJobs = new Map<string, MockJob<ResultProcessingJobData>>();
  
  // Processors
  private evaluationProcessor?: JobProcessor<EvaluationRequestJobData>;
  private agentProcessor?: JobProcessor<AgentTaskJobData>;
  private resultProcessor?: JobProcessor<ResultProcessingJobData>;
  
  // Processing state
  private processingIntervals = new Map<string, NodeJS.Timeout>();
  private isProcessing = false;
  private processDelay = 100; // milliseconds between job processing cycles
  private maxConcurrentJobs = 5;
  private currentlyProcessing = new Set<string>();
  
  // Configuration
  private config = {
    simulateProcessingTime: true,
    processingTimeRange: [500, 2000], // [min, max] in milliseconds
    failureRate: 0, // 0-1, probability of job failure
    retryDelayMs: 1000,
    maxRetries: 3
  };

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): MockQueueManager {
    if (!MockQueueManager.instance) {
      MockQueueManager.instance = new MockQueueManager();
    }
    return MockQueueManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[MockQueueManager] Initializing mock queue manager...');
    this.isInitialized = true;
    this.startProcessing();
    console.log('[MockQueueManager] Mock queue manager initialized');
  }

  async shutdown(): Promise<void> {
    console.log('[MockQueueManager] Shutting down mock queue manager...');
    
    this.stopProcessing();
    
    // Clear all job storage
    this.evaluationJobs.clear();
    this.agentJobs.clear();
    this.resultJobs.clear();
    
    // Clear processors
    this.evaluationProcessor = undefined;
    this.agentProcessor = undefined;
    this.resultProcessor = undefined;
    
    this.isInitialized = false;
    this.removeAllListeners();
    
    console.log('[MockQueueManager] Mock queue manager shutdown complete');
  }

  setupEvaluationProcessor(processor: JobProcessor<EvaluationRequestJobData>): void {
    this.evaluationProcessor = processor;
    console.log('[MockQueueManager] Evaluation processor registered');
  }

  setupAgentProcessor(processor: JobProcessor<AgentTaskJobData>): void {
    this.agentProcessor = processor;
    console.log('[MockQueueManager] Agent processor registered');
  }

  setupResultProcessor(processor: JobProcessor<ResultProcessingJobData>): void {
    this.resultProcessor = processor;
    console.log('[MockQueueManager] Result processor registered');
  }

  async addEvaluationJob(
    data: EvaluationRequestJobData,
    options: JobOptions = {}
  ): Promise<string> {
    const job = this.createJob(data, options);
    this.evaluationJobs.set(job.id, job);
    
    console.log(`[MockQueueManager] Added evaluation job: ${job.id}`);
    this.emit('job-added', { queueName: 'evaluation', jobId: job.id });
    
    return job.id;
  }

  async addAgentJob(
    data: AgentTaskJobData,
    options: JobOptions = {}
  ): Promise<string> {
    const job = this.createJob(data, options);
    this.agentJobs.set(job.id, job);
    
    console.log(`[MockQueueManager] Added agent job: ${job.id}`);
    this.emit('job-added', { queueName: 'agent', jobId: job.id });
    
    return job.id;
  }

  async addResultProcessingJob(
    data: ResultProcessingJobData,
    options: JobOptions = {}
  ): Promise<string> {
    const job = this.createJob(data, options);
    this.resultJobs.set(job.id, job);
    
    console.log(`[MockQueueManager] Added result processing job: ${job.id}`);
    this.emit('job-added', { queueName: 'result', jobId: job.id });
    
    return job.id;
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.findJob(jobId);
    return job ? job.status : null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.findJob(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'waiting' || job.status === 'delayed') {
      job.status = 'failed';
      job.failedReason = 'Job cancelled';
      
      console.log(`[MockQueueManager] Cancelled job: ${jobId}`);
      this.emit('job-cancelled', { jobId });
      return true;
    }

    return false;
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = this.findJob(jobId);
    if (!job || job.status !== 'failed') {
      return false;
    }

    if (job.attemptsMade < this.config.maxRetries) {
      job.status = 'waiting';
      job.processedOn = undefined;
      job.failedReason = undefined;
      
      console.log(`[MockQueueManager] Retrying job: ${jobId}`);
      this.emit('job-retried', { jobId });
      return true;
    }

    return false;
  }

  async getQueueStats(): Promise<{
    evaluation: QueueStats;
    agent: QueueStats;
    result: QueueStats;
  }> {
    return {
      evaluation: this.getStatsForJobs(this.evaluationJobs),
      agent: this.getStatsForJobs(this.agentJobs),
      result: this.getStatsForJobs(this.resultJobs)
    };
  }

  async pauseQueues(): Promise<void> {
    this.stopProcessing();
    console.log('[MockQueueManager] Queues paused');
  }

  async resumeQueues(): Promise<void> {
    this.startProcessing();
    console.log('[MockQueueManager] Queues resumed');
  }

  async healthCheck(): Promise<boolean> {
    return this.isInitialized;
  }

  // Configuration methods for testing

  setProcessingTimeRange(min: number, max: number): void {
    this.config.processingTimeRange = [Math.max(0, min), Math.max(min, max)];
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }

  setMaxConcurrentJobs(max: number): void {
    this.maxConcurrentJobs = Math.max(1, max);
  }

  setProcessDelay(delay: number): void {
    this.processDelay = Math.max(10, delay);
  }

  // Test utilities

  getJobsInQueue(queueName: 'evaluation' | 'agent' | 'result'): MockJob[] {
    switch (queueName) {
      case 'evaluation':
        return Array.from(this.evaluationJobs.values());
      case 'agent':
        return Array.from(this.agentJobs.values());
      case 'result':
        return Array.from(this.resultJobs.values());
    }
  }

  getAllJobs(): MockJob[] {
    return [
      ...this.evaluationJobs.values(),
      ...this.agentJobs.values(),
      ...this.resultJobs.values()
    ];
  }

  clearAllJobs(): void {
    this.evaluationJobs.clear();
    this.agentJobs.clear();
    this.resultJobs.clear();
    this.currentlyProcessing.clear();
    console.log('[MockQueueManager] Cleared all jobs');
  }

  resetState(): void {
    this.stopProcessing();
    this.clearAllJobs();
    this.currentlyProcessing.clear();
    
    if (this.isInitialized) {
      this.startProcessing();
    }
  }

  static resetInstance(): void {
    if (MockQueueManager.instance) {
      MockQueueManager.instance.shutdown();
    }
    MockQueueManager.instance = null as any;
  }

  // Private methods

  private createJob<T>(data: T, options: JobOptions): MockJob<T> {
    const job: MockJob<T> = {
      id: uuidv4(),
      data,
      status: options.delay ? 'delayed' : 'waiting',
      createdAt: new Date(),
      updatedAt: new Date(),
      attemptsMade: 0,
      delay: options.delay,
      priority: options.priority || JobPriority.NORMAL
    };

    return job;
  }

  private findJob(jobId: string): MockJob | undefined {
    return this.evaluationJobs.get(jobId) || 
           this.agentJobs.get(jobId) || 
           this.resultJobs.get(jobId);
  }

  private getStatsForJobs(jobs: Map<string, MockJob>): QueueStats {
    const jobArray = Array.from(jobs.values());
    
    return {
      waiting: jobArray.filter(j => j.status === 'waiting').length,
      active: jobArray.filter(j => j.status === 'active').length,
      completed: jobArray.filter(j => j.status === 'completed').length,
      failed: jobArray.filter(j => j.status === 'failed').length,
      delayed: jobArray.filter(j => j.status === 'delayed').length,
      total: jobArray.length
    };
  }

  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.scheduleProcessing();
    console.log('[MockQueueManager] Started job processing');
  }

  private stopProcessing(): void {
    this.isProcessing = false;
    
    // Clear all processing intervals
    for (const interval of this.processingIntervals.values()) {
      clearTimeout(interval);
    }
    this.processingIntervals.clear();
    
    console.log('[MockQueueManager] Stopped job processing');
  }

  private scheduleProcessing(): void {
    if (!this.isProcessing) {
      return;
    }

    const timeout = setTimeout(() => {
      this.processNextJobs().finally(() => {
        this.scheduleProcessing();
      });
    }, this.processDelay);

    this.processingIntervals.set('main', timeout);
  }

  private async processNextJobs(): Promise<void> {
    if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return;
    }

    // Process jobs in priority order
    const readyJobs = this.getReadyJobs()
      .sort((a, b) => this.comparePriority(a.priority, b.priority))
      .slice(0, this.maxConcurrentJobs - this.currentlyProcessing.size);

    for (const job of readyJobs) {
      if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
        break;
      }

      this.processJob(job);
    }
  }

  private getReadyJobs(): MockJob[] {
    const now = new Date();
    const allJobs = this.getAllJobs();
    
    return allJobs.filter(job => {
      // Check if job is ready to process
      if (job.status !== 'waiting' && job.status !== 'delayed') {
        return false;
      }

      // Check if job is already being processed
      if (this.currentlyProcessing.has(job.id)) {
        return false;
      }

      // Check delay
      if (job.delay && job.createdAt.getTime() + job.delay > now.getTime()) {
        return false;
      }

      return true;
    });
  }

  private comparePriority(a: JobPriority, b: JobPriority): number {
    const priorityValues = {
      [JobPriority.HIGH]: 3,
      [JobPriority.NORMAL]: 2,
      [JobPriority.LOW]: 1
    };

    return priorityValues[b] - priorityValues[a]; // Higher priority first
  }

  private async processJob(job: MockJob): Promise<void> {
    if (this.currentlyProcessing.has(job.id)) {
      return;
    }

    this.currentlyProcessing.add(job.id);
    job.status = 'active';
    job.processedOn = new Date();
    job.updatedAt = new Date();

    console.log(`[MockQueueManager] Processing job: ${job.id}`);
    this.emit('job-started', { jobId: job.id });

    try {
      // Simulate processing time
      if (this.config.simulateProcessingTime) {
        const [min, max] = this.config.processingTimeRange;
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Simulate potential failure
      if (Math.random() < this.config.failureRate) {
        throw new Error('Simulated job processing failure');
      }

      // Execute the appropriate processor
      await this.executeProcessor(job);

      job.status = 'completed';
      job.updatedAt = new Date();

      console.log(`[MockQueueManager] Job completed: ${job.id}`);
      this.emit('job-completed', { jobId: job.id });

    } catch (error) {
      job.status = 'failed';
      job.failedReason = error instanceof Error ? error.message : 'Unknown error';
      job.attemptsMade++;
      job.updatedAt = new Date();

      console.error(`[MockQueueManager] Job failed: ${job.id}`, error);
      this.emit('job-failed', { jobId: job.id, error: job.failedReason });

      // Schedule retry if attempts are available
      if (job.attemptsMade < this.config.maxRetries) {
        setTimeout(() => {
          if (job.status === 'failed') {
            job.status = 'waiting';
            job.processedOn = undefined;
            job.delay = this.config.retryDelayMs;
            console.log(`[MockQueueManager] Scheduling retry for job: ${job.id}`);
            // Restart processing to pick up the retried job
            this.processJobs();
          }
        }, this.config.retryDelayMs);
      }

    } finally {
      this.currentlyProcessing.delete(job.id);
    }
  }

  private async executeProcessor(job: MockJob): Promise<void> {
    // Determine which processor to use based on job type
    if (this.evaluationJobs.has(job.id) && this.evaluationProcessor) {
      await this.evaluationProcessor(job.data as EvaluationRequestJobData);
    } else if (this.agentJobs.has(job.id) && this.agentProcessor) {
      await this.agentProcessor(job.data as AgentTaskJobData);
    } else if (this.resultJobs.has(job.id) && this.resultProcessor) {
      await this.resultProcessor(job.data as ResultProcessingJobData);
    } else {
      throw new Error(`No processor found for job: ${job.id}`);
    }
  }
}