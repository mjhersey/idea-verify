/**
 * WebSocket Performance Tests
 * Advanced performance validation for WebSocket connections
 * including load testing, throughput measurement, and scalability validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';
import type {
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent
} from '../../packages/shared/src/types/websocket.js';

// Performance test configuration
const TEST_SERVER_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = 'test-performance-token';
const LOAD_TEST_TIMEOUT = 60000; // 60 seconds for load tests
const MAX_CONCURRENT_CONNECTIONS = 50;
const MESSAGE_THROUGHPUT_COUNT = 1000;

interface PerformanceMetrics {
  connectionTime: number;
  messageLatency: number[];
  throughputPerSecond: number;
  memoryUsageMB: number;
  connectionFailures: number;
  reconnectionTime: number;
}

describe('WebSocket Performance Tests', () => {
  const activeSockets: Socket[] = [];
  
  beforeAll(async () => {
    // Ensure test server is running
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup all connections
    activeSockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    activeSockets.length = 0;
  });

  beforeEach(() => {
    // Clear metrics
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    // Cleanup connections created in test
    activeSockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    activeSockets.length = 0;
  });

  describe('Connection Performance', () => {
    it('should establish connections within acceptable time limits', async () => {
      const connectionCount = 25;
      const maxConnectionTime = 5000; // 5 seconds max
      const connectionTimes: number[] = [];

      const connectionPromises = Array.from({ length: connectionCount }, async (_, index) => {
        const startTime = performance.now();
        
        return new Promise<number>((resolve, reject) => {
          const socket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
            auth: { token: `${TEST_AUTH_TOKEN}-perf-${index}` },
            transports: ['websocket'],
            timeout: 10000
          });

          activeSockets.push(socket);

          const timeout = setTimeout(() => {
            reject(new Error(`Connection ${index} timeout`));
          }, 10000);

          socket.on('connect', () => {
            clearTimeout(timeout);
            const connectionTime = performance.now() - startTime;
            connectionTimes.push(connectionTime);
            resolve(connectionTime);
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      });

      const results = await Promise.all(connectionPromises);
      
      // Verify all connections succeeded
      expect(results.length).toBe(connectionCount);
      
      // Calculate performance metrics
      const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      const maxConnectionTimeActual = Math.max(...connectionTimes);
      const minConnectionTime = Math.min(...connectionTimes);

      console.log('Connection Performance Metrics:');
      console.log(`- Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
      console.log(`- Max connection time: ${maxConnectionTimeActual.toFixed(2)}ms`);
      console.log(`- Min connection time: ${minConnectionTime.toFixed(2)}ms`);
      console.log(`- Total connections: ${connectionCount}`);

      // Performance assertions
      expect(avgConnectionTime).toBeLessThan(2000); // Average < 2 seconds
      expect(maxConnectionTimeActual).toBeLessThan(maxConnectionTime); // Max < 5 seconds
      expect(activeSockets.every(socket => socket.connected)).toBe(true);
    }, LOAD_TEST_TIMEOUT);

    it('should handle connection spikes without degradation', async () => {
      const spikeBatches = [5, 10, 15, 20, 25];
      const batchResults: { batchSize: number; avgTime: number; maxTime: number }[] = [];

      for (const batchSize of spikeBatches) {
        const startTime = performance.now();
        const batchTimes: number[] = [];

        const batchPromises = Array.from({ length: batchSize }, async (_, index) => {
          const connectionStart = performance.now();
          
          return new Promise<void>((resolve, reject) => {
            const socket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
              auth: { token: `${TEST_AUTH_TOKEN}-spike-${batchSize}-${index}` },
              transports: ['websocket']
            });

            activeSockets.push(socket);

            const timeout = setTimeout(() => {
              reject(new Error(`Spike connection ${index} timeout`));
            }, 10000);

            socket.on('connect', () => {
              clearTimeout(timeout);
              const connectionTime = performance.now() - connectionStart;
              batchTimes.push(connectionTime);
              resolve();
            });

            socket.on('connect_error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });
        });

        await Promise.all(batchPromises);
        
        const avgTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
        const maxTime = Math.max(...batchTimes);
        
        batchResults.push({ batchSize, avgTime, maxTime });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Disconnect batch to prepare for next spike
        activeSockets.forEach(socket => socket.disconnect());
        activeSockets.length = 0;
      }

      // Analyze degradation
      console.log('Connection Spike Results:');
      batchResults.forEach(result => {
        console.log(`- Batch ${result.batchSize}: avg=${result.avgTime.toFixed(2)}ms, max=${result.maxTime.toFixed(2)}ms`);
      });

      // Performance should not degrade significantly with larger batches
      const firstBatchAvg = batchResults[0].avgTime;
      const lastBatchAvg = batchResults[batchResults.length - 1].avgTime;
      const degradation = (lastBatchAvg - firstBatchAvg) / firstBatchAvg;

      expect(degradation).toBeLessThan(2.0); // Less than 200% degradation
    }, LOAD_TEST_TIMEOUT);
  });

  describe('Message Throughput Performance', () => {
    it('should maintain high message throughput under load', async () => {
      const messageCount = MESSAGE_THROUGHPUT_COUNT;
      const testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
        auth: { token: `${TEST_AUTH_TOKEN}-throughput` },
        transports: ['websocket']
      });

      activeSockets.push(testSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        testSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        testSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Subscribe to evaluation
      testSocket.emit('subscribe', 'throughput-test-eval');

      let receivedCount = 0;
      const startTime = performance.now();
      const messageTimes: number[] = [];

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Throughput test timeout. Received ${receivedCount}/${messageCount} messages`));
        }, 30000);

        testSocket.on('agent:progress', (data: AgentProgressEvent & { sentAt?: number }) => {
          receivedCount++;
          
          if (data.sentAt) {
            const latency = performance.now() - data.sentAt;
            messageTimes.push(latency);
          }

          if (receivedCount >= messageCount) {
            clearTimeout(timeout);
            
            const totalTime = performance.now() - startTime;
            const throughput = (messageCount / totalTime) * 1000; // messages per second
            const avgLatency = messageTimes.reduce((a, b) => a + b, 0) / messageTimes.length;
            const maxLatency = Math.max(...messageTimes);

            console.log('Message Throughput Metrics:');
            console.log(`- Messages processed: ${receivedCount}`);
            console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
            console.log(`- Throughput: ${throughput.toFixed(2)} messages/second`);
            console.log(`- Average latency: ${avgLatency.toFixed(2)}ms`);
            console.log(`- Max latency: ${maxLatency.toFixed(2)}ms`);

            // Performance assertions
            expect(throughput).toBeGreaterThan(50); // At least 50 messages/second
            expect(avgLatency).toBeLessThan(100); // Average latency < 100ms
            expect(maxLatency).toBeLessThan(1000); // Max latency < 1 second

            resolve();
          }
        });

        // Send messages rapidly
        for (let i = 0; i < messageCount; i++) {
          const progressEvent: AgentProgressEvent & { sentAt?: number } = {
            agentType: 'performance-test',
            status: 'running',
            progressPercentage: (i / messageCount) * 100,
            timestamp: new Date(),
            sentAt: performance.now()
          };

          testSocket.emit('test:agent-progress', progressEvent);

          // Small delay to prevent overwhelming the server
          if (i % 100 === 0) {
            setTimeout(() => {}, 1);
          }
        }
      });
    }, LOAD_TEST_TIMEOUT);

    it('should handle message bursts without loss', async () => {
      const burstSize = 100;
      const burstCount = 5;
      const testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
        auth: { token: `${TEST_AUTH_TOKEN}-burst` },
        transports: ['websocket']
      });

      activeSockets.push(testSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        testSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      testSocket.emit('subscribe', 'burst-test-eval');

      let totalSent = 0;
      let totalReceived = 0;
      const messageIds = new Set<string>();

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Message loss detected. Sent: ${totalSent}, Received: ${totalReceived}`));
        }, 30000);

        testSocket.on('agent:progress', (data: AgentProgressEvent & { messageId?: string }) => {
          if (data.messageId && !messageIds.has(data.messageId)) {
            messageIds.add(data.messageId);
            totalReceived++;
          }

          if (totalReceived >= totalSent && totalSent === burstSize * burstCount) {
            clearTimeout(timeout);
            
            console.log('Message Burst Results:');
            console.log(`- Total sent: ${totalSent}`);
            console.log(`- Total received: ${totalReceived}`);
            console.log(`- Message loss rate: ${((totalSent - totalReceived) / totalSent * 100).toFixed(2)}%`);

            expect(totalReceived).toBe(totalSent);
            resolve();
          }
        });

        // Send bursts with delays between them
        for (let burst = 0; burst < burstCount; burst++) {
          setTimeout(() => {
            for (let i = 0; i < burstSize; i++) {
              const messageId = `burst-${burst}-${i}`;
              const progressEvent: AgentProgressEvent & { messageId?: string } = {
                agentType: 'burst-test',
                status: 'running',
                progressPercentage: Math.random() * 100,
                timestamp: new Date(),
                messageId
              };

              testSocket.emit('test:agent-progress', progressEvent);
              totalSent++;
            }
          }, burst * 1000); // 1 second between bursts
        }
      });
    }, LOAD_TEST_TIMEOUT);
  });

  describe('Resource Utilization', () => {
    it('should maintain stable memory usage under sustained load', async () => {
      const testDuration = 15000; // 15 seconds
      const messageInterval = 100; // Every 100ms
      const memorySnapshots: number[] = [];

      const testSocket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
        auth: { token: `${TEST_AUTH_TOKEN}-memory` },
        transports: ['websocket']
      });

      activeSockets.push(testSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        testSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      testSocket.emit('subscribe', 'memory-test-eval');

      // Take initial memory snapshot
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      memorySnapshots.push(initialMemory);

      return new Promise<void>((resolve) => {
        let messageCounter = 0;
        
        // Send messages periodically and monitor memory
        const messageTimer = setInterval(() => {
          const progressEvent: AgentProgressEvent = {
            agentType: 'memory-test',
            status: 'running',
            progressPercentage: Math.random() * 100,
            timestamp: new Date()
          };

          testSocket.emit('test:agent-progress', progressEvent);
          messageCounter++;

          // Take memory snapshot every 50 messages
          if (messageCounter % 50 === 0) {
            const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
            memorySnapshots.push(currentMemory);
          }
        }, messageInterval);

        // Stop test after duration
        setTimeout(() => {
          clearInterval(messageTimer);
          
          const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
          const memoryIncrease = finalMemory - initialMemory;
          const maxMemory = Math.max(...memorySnapshots);
          const avgMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;

          console.log('Memory Usage Metrics:');
          console.log(`- Initial memory: ${initialMemory.toFixed(2)}MB`);
          console.log(`- Final memory: ${finalMemory.toFixed(2)}MB`);
          console.log(`- Memory increase: ${memoryIncrease.toFixed(2)}MB`);
          console.log(`- Max memory: ${maxMemory.toFixed(2)}MB`);
          console.log(`- Average memory: ${avgMemory.toFixed(2)}MB`);
          console.log(`- Messages sent: ${messageCounter}`);

          // Memory increase should be reasonable
          expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
          expect(maxMemory - initialMemory).toBeLessThan(100); // Max increase < 100MB

          resolve();
        }, testDuration);
      });
    }, LOAD_TEST_TIMEOUT);
  });

  describe('Scalability Validation', () => {
    it('should handle maximum concurrent connections', async () => {
      const maxConnections = MAX_CONCURRENT_CONNECTIONS;
      const connectionPromises: Promise<Socket>[] = [];

      // Create maximum concurrent connections
      for (let i = 0; i < maxConnections; i++) {
        const promise = new Promise<Socket>((resolve, reject) => {
          const socket = io(`${TEST_SERVER_URL}/evaluation-progress`, {
            auth: { token: `${TEST_AUTH_TOKEN}-scale-${i}` },
            transports: ['websocket']
          });

          const timeout = setTimeout(() => {
            reject(new Error(`Scalability connection ${i} timeout`));
          }, 15000);

          socket.on('connect', () => {
            clearTimeout(timeout);
            resolve(socket);
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        connectionPromises.push(promise);
      }

      const sockets = await Promise.all(connectionPromises);
      activeSockets.push(...sockets);

      // Verify all connections are established
      expect(sockets.length).toBe(maxConnections);
      expect(sockets.every(socket => socket.connected)).toBe(true);

      // Test message distribution across all connections
      const messagePromises = sockets.map((socket, index) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Message test timeout for connection ${index}`));
          }, 10000);

          socket.emit('subscribe', `scale-test-${index}`);

          socket.on('agent:progress', (data: AgentProgressEvent) => {
            clearTimeout(timeout);
            expect(data.agentType).toBe(`scale-test-${index}`);
            resolve();
          });

          // Send test message
          setTimeout(() => {
            const progressEvent: AgentProgressEvent = {
              agentType: `scale-test-${index}`,
              status: 'running',
              progressPercentage: 100,
              timestamp: new Date()
            };
            socket.emit('test:agent-progress', progressEvent);
          }, 100);
        });
      });

      await Promise.all(messagePromises);

      console.log(`Successfully handled ${maxConnections} concurrent connections with message distribution`);
    }, LOAD_TEST_TIMEOUT);
  });
});