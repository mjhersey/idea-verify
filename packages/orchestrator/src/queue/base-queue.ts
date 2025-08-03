/**
 * Base Queue Implementation
 */

import { EventEmitter } from 'events';
import { JobType, JobData, JobOptions, QueueMetrics, JobStatus } from './types.js';

export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  opts: JobOptions;
  progress: number;
  timestamp: number;
  attemptsMade: number;
  finishedOn?: number;
  processedOn?: number;
  failedReason?: string;
  returnvalue?: any;
  stacktrace?: string[];
}

export abstract class BaseQueue extends EventEmitter {
  protected name: string;
  protected metrics: QueueMetrics = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
    jobCounts: {
      [JobType.EVALUATION_REQUEST]: 0,
      [JobType.AGENT_TASK]: 0,
      [JobType.RESULT_PROCESSING]: 0
    },
    processingTimes: {
      average: 0,
      min: Infinity,
      max: 0
    },
    errorRate: 0,
    throughput: 0
  };

  constructor(name: string) {
    super();
    this.name = name;
  }

  abstract add(jobType: JobType, data: JobData, opts?: JobOptions): Promise<Job>;
  abstract process(jobType: JobType, processor: (job: Job) => Promise<any>): void;
  abstract getJob(jobId: string): Promise<Job | undefined>;
  abstract getJobs(status: JobStatus[], start?: number, end?: number): Promise<Job[]>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract clean(grace: number, limit?: number, type?: JobStatus): Promise<string[]>;
  abstract obliterate(opts?: { force?: boolean }): Promise<void>;
  abstract close(): Promise<void>;
  abstract getMetrics(): Promise<QueueMetrics>;

  protected updateMetrics(job: Job, status: JobStatus): void {
    // Update job counts
    if (job.name in JobType) {
      this.metrics.jobCounts[job.name as JobType]++;
    }

    // Update status counts
    switch (status) {
      case JobStatus.WAITING:
        this.metrics.waiting++;
        break;
      case JobStatus.ACTIVE:
        this.metrics.active++;
        this.metrics.waiting = Math.max(0, this.metrics.waiting - 1);
        break;
      case JobStatus.COMPLETED:
        this.metrics.completed++;
        this.metrics.active = Math.max(0, this.metrics.active - 1);
        this.updateProcessingTime(job);
        break;
      case JobStatus.FAILED:
        this.metrics.failed++;
        this.metrics.active = Math.max(0, this.metrics.active - 1);
        break;
      case JobStatus.DELAYED:
        this.metrics.delayed++;
        break;
    }

    // Update error rate
    const total = this.metrics.completed + this.metrics.failed;
    if (total > 0) {
      this.metrics.errorRate = this.metrics.failed / total;
    }

    // Update throughput (jobs per minute)
    this.updateThroughput();
  }

  private updateProcessingTime(job: Job): void {
    if (job.finishedOn && job.processedOn) {
      const processingTime = job.finishedOn - job.processedOn;
      
      // Update min/max
      this.metrics.processingTimes.min = Math.min(this.metrics.processingTimes.min, processingTime);
      this.metrics.processingTimes.max = Math.max(this.metrics.processingTimes.max, processingTime);
      
      // Update average (simple moving average)
      const completedCount = this.metrics.completed;
      if (completedCount === 1) {
        this.metrics.processingTimes.average = processingTime;
      } else {
        this.metrics.processingTimes.average = 
          (this.metrics.processingTimes.average * (completedCount - 1) + processingTime) / completedCount;
      }
    }
  }

  private throughputWindow: number[] = [];
  private updateThroughput(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Add current timestamp
    this.throughputWindow.push(now);
    
    // Remove old timestamps
    this.throughputWindow = this.throughputWindow.filter(ts => ts > oneMinuteAgo);
    
    // Calculate throughput
    this.metrics.throughput = this.throughputWindow.length;
  }

  protected generateJobId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}