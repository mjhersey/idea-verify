/**
 * Queue Factory for Creating Queue Instances
 */

import { getEnvironmentConfig } from '@ai-validation/shared';
import { BaseQueue } from './base-queue.js';
import { BullMQQueue } from './bullmq-queue.js';
import { MockQueue } from './mock-queue.js';
import { QueueConfig } from './types.js';

export class QueueFactory {
  private static queues: Map<string, BaseQueue> = new Map();

  static async createQueue(name: string, config?: Partial<QueueConfig>): Promise<BaseQueue> {
    // Return existing queue if already created
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const envConfig = getEnvironmentConfig();
    const useMockServices = envConfig.development.useMockServices;

    const queueConfig: QueueConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 50
      },
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '1'),
      maxStalledCount: 1,
      stalledInterval: 30000,
      useMockQueue: useMockServices || config?.useMockQueue,
      ...config
    };

    let queue: BaseQueue;

    if (queueConfig.useMockQueue) {
      console.log(`Creating mock queue: ${name}`);
      queue = new MockQueue(name);
    } else {
      try {
        console.log(`Creating BullMQ queue: ${name}`);
        queue = new BullMQQueue(name, queueConfig);
      } catch (error) {
        console.error(`Failed to create BullMQ queue, falling back to mock queue:`, error);
        queue = new MockQueue(name);
      }
    }

    this.queues.set(name, queue);
    return queue;
  }

  static getQueue(name: string): BaseQueue | undefined {
    return this.queues.get(name);
  }

  static async closeAllQueues(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();
  }

  static getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  static async getQueueMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const [name, queue] of this.queues) {
      metrics[name] = await queue.getMetrics();
    }
    
    return metrics;
  }
}