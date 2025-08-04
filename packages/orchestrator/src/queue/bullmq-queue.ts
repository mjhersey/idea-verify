/**
 * BullMQ Queue Implementation
 */

import { Queue, Worker, Job as BullJob } from 'bullmq';
import IORedis from 'ioredis';
import { BaseQueue, Job } from './base-queue.js';
import { JobType, JobData, JobOptions, QueueMetrics, JobStatus, QueueConfig } from './types.js';

export class BullMQQueue extends BaseQueue {
  private queue: Queue;
  private worker: Worker | null = null;
  private connection: IORedis;
  private config: QueueConfig;

  constructor(name: string, config: QueueConfig) {
    super(name);
    this.config = config;
    
    if (!config.redis) {
      throw new Error('Redis configuration is required for BullMQ');
    }

    this.connection = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest ?? 3,
      lazyConnect: true
    });

    this.queue = new Queue(name, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: config.defaultJobOptions?.removeOnComplete ?? 10,
        removeOnFail: config.defaultJobOptions?.removeOnFail ?? 50,
        attempts: config.defaultJobOptions?.attempts ?? 3,
        backoff: config.defaultJobOptions?.backoff ?? {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queue.on('error', (error) => {
      console.error(`Queue ${this.name} error:`, error);
      this.emit('error', error);
    });

    this.queue.on('waiting', (job) => {
      this.updateMetrics(this.convertBullJobToJob(job), JobStatus.WAITING);
      this.emit('waiting', job.id);
    });

    this.queue.on('active' as any, (job: any) => {
      this.updateMetrics(this.convertBullJobToJob(job), JobStatus.ACTIVE);
      this.emit('active', job.id);
    });

    this.queue.on('completed' as any, (job: any) => {
      this.updateMetrics(this.convertBullJobToJob(job), JobStatus.COMPLETED);
      this.emit('completed', job.id, job.returnvalue);
    });

    this.queue.on('failed' as any, (job: any, err: any) => {
      if (job) {
        this.updateMetrics(this.convertBullJobToJob(job), JobStatus.FAILED);
        this.emit('failed', job.id, err);
      }
    });

    this.queue.on('stalled' as any, (job: any) => {
      console.warn(`Job ${job.id} stalled in queue ${this.name}`);
      this.emit('stalled', job.id);
    });
  }

  async add(jobType: JobType, data: JobData, opts?: JobOptions): Promise<Job> {
    const backoffOptions = opts?.backoff ? {
      type: opts.backoff.type,
      delay: opts.backoff.delay
    } : this.config.defaultJobOptions?.backoff;

    const jobOptions: any = {
      priority: opts?.priority ?? this.config.defaultJobOptions?.priority,
      delay: opts?.delay ?? this.config.defaultJobOptions?.delay,
      attempts: opts?.attempts ?? this.config.defaultJobOptions?.attempts,
      backoff: backoffOptions,
      removeOnComplete: opts?.removeOnComplete ?? this.config.defaultJobOptions?.removeOnComplete,
      removeOnFail: opts?.removeOnFail ?? this.config.defaultJobOptions?.removeOnFail
    };

    const bullJob = await this.queue.add(jobType, data, jobOptions);
    return this.convertBullJobToJob(bullJob);
  }

  process(jobType: JobType, processor: (job: Job) => Promise<any>): void {
    if (this.worker) {
      throw new Error('Worker already initialized for this queue');
    }

    this.worker = new Worker(
      this.name,
      async (bullJob: BullJob) => {
        if (bullJob.name === jobType) {
          const job = this.convertBullJobToJob(bullJob);
          return await processor(job);
        }
      },
      {
        connection: this.connection,
        concurrency: this.config.concurrency ?? 1,
        maxStalledCount: this.config.maxStalledCount ?? 1,
        stalledInterval: this.config.stalledInterval ?? 30000
      }
    );

    this.worker.on('error', (error) => {
      console.error(`Worker error in queue ${this.name}:`, error);
      this.emit('worker-error', error);
    });

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed in queue ${this.name}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed in queue ${this.name}:`, err);
    });
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    const bullJob = await this.queue.getJob(jobId);
    return bullJob ? this.convertBullJobToJob(bullJob) : undefined;
  }

  async getJobs(status: JobStatus[], start = 0, end = -1): Promise<Job[]> {
    const bullJobs = await this.queue.getJobs(status, start, end);
    return bullJobs.map(job => this.convertBullJobToJob(job));
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    if (this.worker) {
      await this.worker.pause();
    }
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    if (this.worker) {
      await this.worker.resume();
    }
  }

  async clean(grace: number, limit = 0, type?: JobStatus): Promise<string[]> {
    const statusMap = {
      [JobStatus.COMPLETED]: 'completed',
      [JobStatus.FAILED]: 'failed',
      [JobStatus.ACTIVE]: 'active',
      [JobStatus.DELAYED]: 'delayed',
      [JobStatus.PAUSED]: 'paused',
      [JobStatus.WAITING]: 'wait'
    };
    const bullStatus = type ? statusMap[type] as any : undefined;
    return await this.queue.clean(grace, limit, bullStatus);
  }

  async obliterate(opts?: { force?: boolean }): Promise<void> {
    await this.queue.obliterate(opts);
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
    await this.connection.quit();
  }

  async getMetrics(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    
    return {
      ...this.metrics,
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0
    };
  }

  private convertBullJobToJob(bullJob: BullJob): Job {
    return {
      id: bullJob.id || this.generateJobId(),
      name: bullJob.name,
      data: bullJob.data,
      opts: bullJob.opts,
      progress: bullJob.progress,
      timestamp: bullJob.timestamp,
      attemptsMade: bullJob.attemptsMade,
      finishedOn: bullJob.finishedOn,
      processedOn: bullJob.processedOn,
      failedReason: bullJob.failedReason,
      returnvalue: bullJob.returnvalue,
      stacktrace: bullJob.stacktrace
    };
  }
}