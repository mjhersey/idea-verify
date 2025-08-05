/**
 * Mock Services Module Exports
 * Provides mock implementations for offline development and testing
 */

// Mock implementations
export { MockLLMProvider } from './mock-llm-provider.js';
export type { MockResponse, MockLLMProviderConfig } from './mock-llm-provider.js';

export { MockQueueManager } from './mock-queue-manager.js';
export { MockDatabaseManager } from './mock-database-manager.js';
export type { MockDatabaseConfig } from './mock-database-manager.js';

// Imports for internal use
import { MockLLMProvider } from './mock-llm-provider.js';
import { MockQueueManager } from './mock-queue-manager.js';
import { MockDatabaseManager } from './mock-database-manager.js';

// Mock factory for creating configured instances
export class MockServiceFactory {
  static createLLMProvider(config: any = {}): MockLLMProvider {
    return new MockLLMProvider({
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
      retries: 3,
      defaultScore: 75,
      simulateLatency: true,
      latencyRange: [500, 2000],
      failureRate: 0,
      ...config
    });
  }

  static createQueueManager(): MockQueueManager {
    return MockQueueManager.getInstance();
  }

  static createDatabaseManager(config: any = {}): MockDatabaseManager {
    return MockDatabaseManager.getInstance({
      simulateLatency: true,
      latencyRange: [10, 100],
      failureRate: 0,
      maxConnections: 10,
      ...config
    });
  }

  // Create a complete mock environment
  static async createMockEnvironment(config: {
    llm?: any;
    queue?: any;
    database?: any;
    predefinedResponses?: Record<string, any>;
  } = {}): Promise<{
    llmProvider: any;
    queueManager: any;
    databaseManager: any;
  }> {
    const llmProvider = this.createLLMProvider({
      ...config.llm,
      responses: config.predefinedResponses
    });

    const queueManager = this.createQueueManager();
    await queueManager.initialize();

    const databaseManager = this.createDatabaseManager(config.database);
    await databaseManager.initialize();

    return {
      llmProvider,
      queueManager,
      databaseManager
    };
  }

  // Helper to create realistic test scenarios
  static createTestScenarios(): Record<string, any> {
    return {
      // Market research responses
      'market_fitness_app': {
        content: 'Comprehensive market analysis for fitness tracking application',
        marketSize: 4500,
        competitionLevel: 'high',
        marketTrends: [
          'Wearable device integration',
          'AI-powered personalization',
          'Social fitness communities',
          'Corporate wellness programs'
        ],
        opportunities: [
          'Underserved demographic segments',
          'Integration with healthcare providers',
          'Corporate B2B market expansion'
        ],
        threats: [
          'Established competitors',
          'Privacy concerns',
          'Market saturation'
        ],
        score: 78
      },

      'market_sustainable_packaging': {
        content: 'Market research for sustainable packaging platform',
        marketSize: 2100,
        competitionLevel: 'medium',
        marketTrends: [
          'Environmental consciousness growth',
          'Regulatory pressure increase',
          'Consumer preference shift',
          'Supply chain transparency'
        ],
        opportunities: [
          'Government incentive programs',
          'Brand differentiation value',
          'Cost reduction potential'
        ],
        threats: [
          'Higher initial costs',
          'Supply chain complexity',
          'Market education needs'
        ],
        score: 82
      },

      // Competitive analysis responses
      'competitive_analysis': {
        content: 'Detailed competitive landscape analysis reveals moderate competition with opportunities for differentiation',
        score: 75
      },

      // Customer research responses
      'customer_research': {
        content: 'Customer validation shows strong demand in target demographics with willingness to pay premium for quality solution',
        score: 80
      },

      // Technical feasibility responses
      'technical_feasibility': {
        content: 'Technical assessment indicates feasible implementation with existing technologies and reasonable development timeline',
        score: 85
      },

      // Financial analysis responses
      'financial_analysis': {
        content: 'Financial projections show positive ROI with break-even expected within 24 months under conservative assumptions',
        score: 77
      }
    };
  }

  // Create demo data for development
  static createDemoData(): {
    users: any[];
    businessIdeas: any[];
    evaluations: any[];
    agentResults: any[];
  } {
    const users = [
      {
        id: 'demo-user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const businessIdeas = [
      {
        id: 'demo-idea-1',
        user_id: 'demo-user-1',
        title: 'Smart Home Energy Management System',
        description: 'An AI-powered system that optimizes home energy consumption by learning usage patterns and automatically adjusting smart devices to reduce costs and environmental impact.',
        status: 'submitted',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'demo-idea-2',
        user_id: 'demo-user-1',
        title: 'Virtual Reality Therapy Platform',
        description: 'A VR platform that provides immersive therapy sessions for anxiety, phobias, and PTSD treatment, guided by licensed therapists and backed by clinical research.',
        status: 'evaluating',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const evaluations = [
      {
        id: 'demo-eval-1',
        business_idea_id: 'demo-idea-1',
        status: 'completed',
        priority: 'normal',
        started_at: new Date(Date.now() - 3600000), // 1 hour ago
        completed_at: new Date(Date.now() - 1800000), // 30 minutes ago
        created_at: new Date(Date.now() - 3600000),
        updated_at: new Date(Date.now() - 1800000)
      }
    ];

    const agentResults = [
      {
        id: 'demo-result-1',
        evaluation_id: 'demo-eval-1',
        agent_type: 'market-research',
        status: 'completed',
        score: 82,
        confidence: 'high',
        insights: {
          marketSize: '$2.3B',
          growthRate: '15% annually',
          keyFactors: ['Smart home adoption', 'Energy cost concerns', 'Environmental awareness']
        },
        completed_at: new Date(Date.now() - 1800000),
        created_at: new Date(Date.now() - 3600000),
        updated_at: new Date(Date.now() - 1800000)
      }
    ];

    return {
      users,
      businessIdeas,
      evaluations,
      agentResults
    };
  }
}