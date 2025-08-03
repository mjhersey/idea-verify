/**
 * Service Factory for Environment-based Service Creation
 * Switches between real and mock services based on configuration
 */

import { getEnvironmentConfig } from '@ai-validation/shared';
import { LLMProviderFactory } from '../llm/llm-provider-factory.js';
import { QueueManager } from '../queue/queue-manager.js';
import { DatabaseManager } from '../database/database-manager.js';
import { MockServiceFactory } from '../mock/index.js';
import type { LLMProvider } from '../llm/types.js';

export interface ServiceInstances {
  llmProvider: LLMProvider;
  queueManager: any; // QueueManager interface
  databaseManager: any; // DatabaseManager interface
}

export class ServiceFactory {
  private static instance: ServiceFactory;
  private services: ServiceInstances | null = null;
  private useMockServices: boolean;

  private constructor() {
    const config = getEnvironmentConfig();
    this.useMockServices = config.development.useMockServices;
    console.log(`[ServiceFactory] Using ${this.useMockServices ? 'mock' : 'real'} services`);
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  async initialize(): Promise<ServiceInstances> {
    if (this.services) {
      return this.services;
    }

    console.log('[ServiceFactory] Initializing services...');

    if (this.useMockServices) {
      this.services = await this.createMockServices();
    } else {
      this.services = await this.createRealServices();
    }

    console.log('[ServiceFactory] Services initialized successfully');
    return this.services;
  }

  getServices(): ServiceInstances {
    if (!this.services) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    return this.services;
  }

  isUsingMockServices(): boolean {
    return this.useMockServices;
  }

  async shutdown(): Promise<void> {
    if (!this.services) {
      return;
    }

    console.log('[ServiceFactory] Shutting down services...');

    try {
      // Shutdown services in reverse order
      if (this.services.queueManager && typeof this.services.queueManager.shutdown === 'function') {
        await this.services.queueManager.shutdown();
      }

      if (this.services.databaseManager && typeof this.services.databaseManager.shutdown === 'function') {
        await this.services.databaseManager.shutdown();
      }

      this.services = null;
      console.log('[ServiceFactory] Services shutdown complete');
    } catch (error) {
      console.error('[ServiceFactory] Error during shutdown:', error);
      throw error;
    }
  }

  // Health check for all services
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      llm: boolean;
      queue: boolean;
      database: boolean;
    };
    usingMockServices: boolean;
  }> {
    if (!this.services) {
      return {
        status: 'unhealthy',
        services: { llm: false, queue: false, database: false },
        usingMockServices: this.useMockServices
      };
    }

    const services = {
      llm: false,
      queue: false,
      database: false
    };

    try {
      // Check LLM provider
      if (this.services.llmProvider && typeof this.services.llmProvider.isHealthy === 'function') {
        services.llm = await this.services.llmProvider.isHealthy();
      }

      // Check queue manager
      if (this.services.queueManager && typeof this.services.queueManager.healthCheck === 'function') {
        services.queue = await this.services.queueManager.healthCheck();
      }

      // Check database manager
      if (this.services.databaseManager && typeof this.services.databaseManager.healthCheck === 'function') {
        services.database = await this.services.databaseManager.healthCheck();
      }

      const healthyCount = Object.values(services).filter(Boolean).length;
      const totalCount = Object.keys(services).length;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (healthyCount === 0) {
        status = 'unhealthy';
      } else if (healthyCount < totalCount) {
        status = 'degraded';
      }

      return {
        status,
        services,
        usingMockServices: this.useMockServices
      };
    } catch (error) {
      console.error('[ServiceFactory] Health check failed:', error);
      return {
        status: 'unhealthy',
        services,
        usingMockServices: this.useMockServices
      };
    }
  }

  // Development utilities
  async switchToMockServices(): Promise<void> {
    if (this.useMockServices) {
      console.log('[ServiceFactory] Already using mock services');
      return;
    }

    console.log('[ServiceFactory] Switching to mock services...');
    
    // Shutdown current services
    await this.shutdown();
    
    // Switch mode and reinitialize
    this.useMockServices = true;
    await this.initialize();
    
    console.log('[ServiceFactory] Switched to mock services');
  }

  async switchToRealServices(): Promise<void> {
    if (!this.useMockServices) {
      console.log('[ServiceFactory] Already using real services');
      return;
    }

    console.log('[ServiceFactory] Switching to real services...');
    
    // Shutdown current services
    await this.shutdown();
    
    // Switch mode and reinitialize
    this.useMockServices = false;
    await this.initialize();
    
    console.log('[ServiceFactory] Switched to real services');
  }

  // Test utilities
  static resetInstance(): void {
    if (ServiceFactory.instance) {
      ServiceFactory.instance.shutdown();
    }
    ServiceFactory.instance = null as any;
  }

  // Private methods

  private async createMockServices(): Promise<ServiceInstances> {
    console.log('[ServiceFactory] Creating mock services...');

    // Create mock environment with test scenarios
    const scenarios = MockServiceFactory.createTestScenarios();
    const mockEnv = await MockServiceFactory.createMockEnvironment({
      predefinedResponses: scenarios,
      llm: {
        defaultScore: 75,
        simulateLatency: true,
        latencyRange: [100, 500], // Faster for development
        failureRate: 0.02 // 2% failure rate for testing
      },
      queue: {
        processingTimeRange: [200, 800], // Faster processing
        maxConcurrentJobs: 3
      },
      database: {
        simulateLatency: true,
        latencyRange: [5, 50], // Very fast for development
        failureRate: 0.01 // 1% failure rate
      }
    });

    // Populate with demo data
    const demoData = MockServiceFactory.createDemoData();
    mockEnv.databaseManager.insertTestData('users', demoData.users);
    mockEnv.databaseManager.insertTestData('business_ideas', demoData.businessIdeas);
    mockEnv.databaseManager.insertTestData('evaluations', demoData.evaluations);
    mockEnv.databaseManager.insertTestData('agent_results', demoData.agentResults);

    return {
      llmProvider: mockEnv.llmProvider,
      queueManager: mockEnv.queueManager,
      databaseManager: mockEnv.databaseManager
    };
  }

  private async createRealServices(): Promise<ServiceInstances> {
    console.log('[ServiceFactory] Creating real services...');

    // Create real LLM provider
    const llmProvider = LLMProviderFactory.getProvider();

    // Create real queue manager
    const queueManager = QueueManager.getInstance();
    await queueManager.initialize();

    // Create real database manager
    const databaseManager = DatabaseManager.getInstance();
    await databaseManager.initialize();

    return {
      llmProvider,
      queueManager,
      databaseManager
    };
  }

  // Configuration presets for different environments

  static getDevelopmentConfig(): any {
    return {
      useMockServices: true,
      llm: {
        simulateLatency: true,
        latencyRange: [100, 300],
        failureRate: 0.01,
        defaultScore: 80
      },
      queue: {
        processingTimeRange: [200, 500],
        maxConcurrentJobs: 2,
        failureRate: 0.01
      },
      database: {
        simulateLatency: true,
        latencyRange: [5, 25],
        failureRate: 0.005
      }
    };
  }

  static getTestingConfig(): any {
    return {
      useMockServices: true,
      llm: {
        simulateLatency: false,
        failureRate: 0,
        defaultScore: 75
      },
      queue: {
        processingTimeRange: [10, 50],
        maxConcurrentJobs: 10,
        failureRate: 0
      },
      database: {
        simulateLatency: false,
        failureRate: 0
      }
    };
  }

  static getProductionConfig(): any {
    return {
      useMockServices: false
    };
  }

  // Service-specific factories with configuration

  static async createLLMProvider(useMock: boolean = false): Promise<LLMProvider> {
    if (useMock) {
      return MockServiceFactory.createLLMProvider(ServiceFactory.getDevelopmentConfig().llm);
    } else {
      return LLMProviderFactory.getProvider();
    }
  }

  static async createQueueManager(useMock: boolean = false): Promise<any> {
    if (useMock) {
      const mockQueue = MockServiceFactory.createQueueManager();
      await mockQueue.initialize();
      return mockQueue;
    } else {
      const realQueue = QueueManager.getInstance();
      await realQueue.initialize();
      return realQueue;
    }
  }

  static async createDatabaseManager(useMock: boolean = false): Promise<any> {
    if (useMock) {
      const mockDb = MockServiceFactory.createDatabaseManager(ServiceFactory.getDevelopmentConfig().database);
      await mockDb.initialize();
      return mockDb;
    } else {
      const realDb = DatabaseManager.getInstance();
      await realDb.initialize();
      return realDb;
    }
  }
}