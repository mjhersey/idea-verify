/**
 * Test data factories for database testing
 */

import type { 
  CreateUserInput, 
  CreateBusinessIdeaInput, 
  CreateEvaluationInput,
  CreateAgentResultInput,
  BusinessIdeaStatus,
  EvaluationStatus,
  AgentType
} from '@ai-validation/shared';

/**
 * User factory
 */
export class UserFactory {
  static create(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
    const timestamp = Date.now();
    return {
      email: `test.user.${timestamp}@example.com`,
      password_hash: `$2b$10$${timestamp.toString(36)}abcdefghijklmnopqrstuvwxyz123456`,
      name: `Test User ${timestamp}`,
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<CreateUserInput> = {}): CreateUserInput[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({ 
        ...overrides,
        email: overrides.email ? `${index}.${overrides.email}` : undefined,
        name: overrides.name ? `${overrides.name} ${index}` : undefined
      })
    );
  }
}

/**
 * Business Idea factory
 */
export class BusinessIdeaFactory {
  static create(overrides: Partial<CreateBusinessIdeaInput> = {}): CreateBusinessIdeaInput {
    const timestamp = Date.now();
    const ideas = [
      {
        title: 'AI-Powered Task Management App',
        description: 'A smart task management application that uses artificial intelligence to prioritize tasks, suggest optimal scheduling, and provide productivity insights based on user behavior patterns and historical data.'
      },
      {
        title: 'Virtual Reality Fitness Platform',
        description: 'An immersive VR fitness platform that gamifies workouts by placing users in virtual environments where they complete fitness challenges, compete with friends, and track progress through engaging storylines.'
      },
      {
        title: 'Sustainable Supply Chain Tracker',
        description: 'A blockchain-based platform that provides transparent tracking of products through the entire supply chain, helping consumers make informed decisions about sustainability and ethical sourcing.'
      },
      {
        title: 'Smart Home Energy Optimizer',
        description: 'An IoT-enabled system that automatically optimizes home energy consumption by learning usage patterns, weather forecasts, and utility pricing to minimize costs while maintaining comfort preferences.'
      },
      {
        title: 'Personalized Learning Assistant',
        description: 'An AI-driven educational platform that adapts to individual learning styles, creates personalized study plans, and provides real-time feedback to improve learning outcomes for students of all ages.'
      }
    ];

    const randomIdea = ideas[Math.floor(Math.random() * ideas.length)];
    const statuses: BusinessIdeaStatus[] = ['draft', 'submitted', 'evaluating', 'completed'];
    
    return {
      user_id: 'placeholder-user-id',
      title: `${randomIdea.title} ${timestamp}`,
      description: randomIdea.description,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<CreateBusinessIdeaInput> = {}): CreateBusinessIdeaInput[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({ 
        ...overrides,
        title: overrides.title ? `${overrides.title} ${index}` : undefined
      })
    );
  }
}

/**
 * Evaluation factory
 */
export class EvaluationFactory {
  static create(overrides: Partial<CreateEvaluationInput> = {}): CreateEvaluationInput {
    const priorities = ['low', 'normal', 'high'] as const;
    
    return {
      business_idea_id: 'placeholder-business-idea-id',
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<CreateEvaluationInput> = {}): CreateEvaluationInput[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

/**
 * Agent Result factory
 */
export class AgentResultFactory {
  static create(overrides: Partial<CreateAgentResultInput> = {}): CreateAgentResultInput {
    const agentTypes: AgentType[] = [
      'market-research', 
      'competitive-analysis', 
      'customer-research', 
      'technical-feasibility', 
      'financial-analysis'
    ];
    
    const sampleInputData = {
      business_idea_text: 'Sample business idea for testing',
      analysis_depth: 'comprehensive',
      market_focus: 'north_america',
      target_audience: 'general_consumers'
    };

    return {
      evaluation_id: 'placeholder-evaluation-id',
      agent_type: agentTypes[Math.floor(Math.random() * agentTypes.length)],
      input_data: sampleInputData,
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<CreateAgentResultInput> = {}): CreateAgentResultInput[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createCompleteSet(evaluationId: string): CreateAgentResultInput[] {
    const agentTypes: AgentType[] = [
      'market-research', 
      'competitive-analysis', 
      'customer-research', 
      'technical-feasibility', 
      'financial-analysis'
    ];

    return agentTypes.map(agentType => this.create({
      evaluation_id: evaluationId,
      agent_type: agentType
    }));
  }
}

/**
 * Sample data sets for testing
 */
export class TestDataSets {
  /**
   * Create a complete user with business ideas and evaluations
   */
  static createUserWithData() {
    const user = UserFactory.create();
    const businessIdeas = BusinessIdeaFactory.createMany(3);
    const evaluations = EvaluationFactory.createMany(2);
    
    return {
      user,
      businessIdeas,
      evaluations
    };
  }

  /**
   * Create realistic test scenario data
   */
  static createRealisticScenario() {
    return {
      users: [
        UserFactory.create({ 
          name: 'John Entrepreneur',
          email: 'john.entrepreneur@startup.com' 
        }),
        UserFactory.create({ 
          name: 'Sarah Innovator',
          email: 'sarah.innovator@techcorp.com' 
        }),
        UserFactory.create({ 
          name: 'Mike Founder',
          email: 'mike.founder@venture.com' 
        })
      ],
      businessIdeas: [
        BusinessIdeaFactory.create({
          title: 'Revolutionary Fintech App',
          status: 'completed'
        }),
        BusinessIdeaFactory.create({
          title: 'Green Energy Marketplace',
          status: 'evaluating'
        }),
        BusinessIdeaFactory.create({
          title: 'Healthcare AI Assistant',
          status: 'submitted'
        }),
        BusinessIdeaFactory.create({
          title: 'Smart City Infrastructure',
          status: 'draft'
        })
      ]
    };
  }
}

/**
 * Database test utilities
 */
export class DatabaseTestUtils {
  /**
   * Clean up test data by pattern
   */
  static async cleanupTestData(prisma: any, patterns: {
    userEmails?: string[];
    businessIdeaTitles?: string[];
  } = {}) {
    try {
      // Clean agent results first (foreign key constraints)
      if (patterns.businessIdeaTitles) {
        await prisma.agentResult.deleteMany({
          where: {
            evaluation: {
              business_idea: {
                title: {
                  in: patterns.businessIdeaTitles
                }
              }
            }
          }
        });

        await prisma.evaluation.deleteMany({
          where: {
            business_idea: {
              title: {
                in: patterns.businessIdeaTitles
              }
            }
          }
        });

        await prisma.businessIdea.deleteMany({
          where: {
            title: {
              in: patterns.businessIdeaTitles
            }
          }
        });
      }

      // Clean users
      if (patterns.userEmails) {
        await prisma.user.deleteMany({
          where: {
            email: {
              in: patterns.userEmails
            }
          }
        });
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Verify database integrity after operations
   */
  static async verifyIntegrity(prisma: any): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check for orphaned business ideas
      const orphanedIdeas = await prisma.businessIdea.count({
        where: {
          user_id: {
            notIn: (await prisma.user.findMany({ select: { id: true } })).map((u: any) => u.id)
          }
        }
      });

      if (orphanedIdeas > 0) {
        issues.push(`Found ${orphanedIdeas} orphaned business ideas`);
      }

      // Check for orphaned evaluations
      const orphanedEvaluations = await prisma.evaluation.count({
        where: {
          business_idea_id: {
            notIn: (await prisma.businessIdea.findMany({ select: { id: true } })).map((bi: any) => bi.id)
          }
        }
      });

      if (orphanedEvaluations > 0) {
        issues.push(`Found ${orphanedEvaluations} orphaned evaluations`);
      }

      // Check for orphaned agent results
      const orphanedResults = await prisma.agentResult.count({
        where: {
          evaluation_id: {
            notIn: (await prisma.evaluation.findMany({ select: { id: true } })).map((e: any) => e.id)
          }
        }
      });

      if (orphanedResults > 0) {
        issues.push(`Found ${orphanedResults} orphaned agent results`);
      }

    } catch (error) {
      issues.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}