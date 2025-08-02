/**
 * Database seeding script with realistic development data
 * Creates sample users, business ideas, evaluations, and agent results
 */

import { getPrismaClient } from './index.js';
import type { 
  CreateUserInput, 
  CreateBusinessIdeaInput,
  AgentType,
  BusinessIdeaStatus,
  EvaluationStatus,
  AgentResultStatus
} from '@ai-validation/shared';

const prisma = getPrismaClient();

// Sample users for development
const seedUsers: CreateUserInput[] = [
  {
    email: 'john.doe@example.com',
    password_hash: '$2b$10$rO7V1Wz8Y1qT5Q6N9X3K2eJ8fH7sL4nM6vP9dR2sW5nM8xY1qT5Q6N', // hashed "password123"
    name: 'John Doe'
  },
  {
    email: 'jane.smith@example.com', 
    password_hash: '$2b$10$sP8W2Xz9Z2rU6R7O0Y4L3fK9gI8tM5oN7wQ0eS3tX6oN9yZ2rU6R7O', // hashed "password123"
    name: 'Jane Smith'
  },
  {
    email: 'bob.wilson@example.com',
    password_hash: '$2b$10$tQ9X3Ya0A3sV7S8P1Z5M4gL0hJ9uN6pO8xR1fT4uY7pO0aA3sV7S8P', // hashed "password123"
    name: 'Bob Wilson'
  }
];

// Sample business ideas covering different industries and complexity levels
const seedBusinessIdeas: (Omit<CreateBusinessIdeaInput, 'user_id'> & { userEmail: string })[] = [
  {
    userEmail: 'john.doe@example.com',
    title: 'AI-Powered Recipe Recommendation App',
    description: 'A mobile application that uses artificial intelligence to recommend personalized recipes based on dietary preferences, available ingredients, and nutritional goals. Users can scan their pantry items, set dietary restrictions (vegan, keto, gluten-free), and receive daily meal suggestions with integrated grocery shopping lists.',
    status: 'completed' as BusinessIdeaStatus
  },
  {
    userEmail: 'john.doe@example.com',
    title: 'Smart Home Energy Optimization System',
    description: 'An IoT-based platform that automatically optimizes home energy consumption by learning usage patterns, weather forecasts, and utility pricing. The system controls smart appliances, HVAC systems, and solar panels to minimize energy costs while maintaining comfort.',
    status: 'evaluating' as BusinessIdeaStatus
  },
  {
    userEmail: 'jane.smith@example.com',
    title: 'Virtual Reality Fitness Platform',
    description: 'A comprehensive VR fitness ecosystem offering immersive workout experiences from home. Users can participate in virtual fitness classes, compete with friends in gamified exercises, and track their progress with AI-powered form analysis and personalized coaching.',
    status: 'submitted' as BusinessIdeaStatus
  },
  {
    userEmail: 'jane.smith@example.com',
    title: 'Sustainable Fashion Marketplace',
    description: 'An online marketplace that connects consumers with sustainable fashion brands and promotes circular economy practices. Features include authenticity verification, sustainability scoring, clothing rental options, and a take-back program for end-of-life garments.',
    status: 'draft' as BusinessIdeaStatus
  },
  {
    userEmail: 'bob.wilson@example.com',
    title: 'Automated Urban Farming System',
    description: 'A scalable indoor farming solution using hydroponics, LED grow lights, and AI-controlled environment management. Target markets include restaurants, grocery stores, and urban communities seeking fresh, locally-grown produce year-round.',
    status: 'completed' as BusinessIdeaStatus
  },
  {
    userEmail: 'bob.wilson@example.com',
    title: 'Blockchain-Based Digital Identity Platform',
    description: 'A decentralized identity management system that gives users complete control over their personal data. Businesses can verify customer identities without storing sensitive information, reducing data breach risks and improving privacy compliance.',
    status: 'evaluating' as BusinessIdeaStatus
  }
];

// Agent result templates for realistic evaluation data
const getAgentResultTemplates = (agentType: AgentType) => {
  const templates = {
    'market-research': {
      score: 75,
      insights: {
        market_size: '$2.5B globally by 2027',
        growth_rate: '12% CAGR',
        key_trends: ['AI/ML adoption', 'Mobile-first consumption', 'Personalization demand'],
        target_demographics: 'Millennials and Gen Z (25-40 years old)',
        competition_level: 'Medium-High'
      },
      output_data: {
        total_addressable_market: 2500000000,
        serviceable_available_market: 150000000,
        competitors_analyzed: 15,
        market_readiness_score: 7.5
      }
    },
    'competitive-analysis': {
      score: 68,
      insights: {
        main_competitors: ['CompetitorA', 'CompetitorB', 'CompetitorC'],
        competitive_advantages: ['Unique AI algorithm', 'Better user experience', 'Lower cost'],
        threats: ['Established market leaders', 'High marketing costs', 'Network effects'],
        differentiation_score: 6.8
      },
      output_data: {
        competitors_count: 8,
        market_leaders: 3,
        differentiation_opportunities: 5,
        competitive_intensity: 'high'
      }
    },
    'customer-research': {
      score: 82,
      insights: {
        primary_personas: ['Tech-savvy millennials', 'Health-conscious professionals', 'Early adopters'],
        pain_points: ['Time constraints', 'Information overload', 'High costs'],
        willingness_to_pay: '$15-25/month',
        adoption_barriers: ['Privacy concerns', 'Learning curve', 'Integration complexity']
      },
      output_data: {
        survey_responses: 500,
        interview_participants: 25,
        conversion_intent: 0.35,
        customer_acquisition_cost: 45
      }
    },
    'technical-feasibility': {
      score: 71,
      insights: {
        technology_stack: ['React Native', 'Node.js', 'PostgreSQL', 'TensorFlow'],
        development_timeline: '8-12 months',
        technical_challenges: ['Scalability', 'Real-time processing', 'Data accuracy'],
        infrastructure_requirements: 'Cloud-native with auto-scaling'
      },
      output_data: {
        complexity_score: 7.1,
        development_months: 10,
        team_size_needed: 6,
        technology_readiness_level: 8
      }
    },
    'financial-analysis': {
      score: 65,
      insights: {
        revenue_model: 'Subscription + Transaction fees',
        break_even_timeline: '18 months',
        funding_required: '$1.2M seed round',
        key_financial_risks: ['Customer acquisition cost', 'Churn rate', 'Market timing']
      },
      output_data: {
        initial_investment: 1200000,
        monthly_burn_rate: 45000,
        projected_mrr_year_1: 25000,
        unit_economics_score: 6.5
      }
    }
  };
  
  return templates[agentType];
};

/**
 * Main seeding function
 */
async function seed() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Clear existing data (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Clearing existing data...');
      await prisma.agentResult.deleteMany();
      await prisma.evaluation.deleteMany();
      await prisma.businessIdea.deleteMany();
      await prisma.user.deleteMany();
    }
    
    // Create users
    console.log('👥 Creating users...');
    const users = [];
    for (const userData of seedUsers) {
      const user = await prisma.user.create({ data: userData });
      users.push(user);
      console.log(`  ✅ Created user: ${user.name} (${user.email})`);
    }
    
    // Create business ideas
    console.log('💡 Creating business ideas...');
    const businessIdeas = [];
    for (const ideaData of seedBusinessIdeas) {
      const user = users.find(u => u.email === ideaData.userEmail);
      if (!user) continue;
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userEmail, ...ideaInput } = ideaData;
      const businessIdea = await prisma.businessIdea.create({
        data: {
          ...ideaInput,
          user_id: user.id
        }
      });
      businessIdeas.push(businessIdea);
      console.log(`  ✅ Created idea: ${businessIdea.title}`);
    }
    
    // Create evaluations for submitted and completed business ideas
    console.log('📊 Creating evaluations...');
    const evaluations = [];
    for (const idea of businessIdeas) {
      if (idea.status === 'submitted' || idea.status === 'evaluating' || idea.status === 'completed') {
        const evaluation = await prisma.evaluation.create({
          data: {
            business_idea_id: idea.id,
            status: idea.status === 'completed' ? 'completed' as EvaluationStatus : 
                   idea.status === 'evaluating' ? 'analyzing' as EvaluationStatus : 'pending' as EvaluationStatus,
            priority: 'normal',
            started_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
            completed_at: idea.status === 'completed' ? new Date() : null,
            results: idea.status === 'completed' ? {
              overall_score: 72,
              recommendation: 'Proceed with MVP development',
              confidence_level: 0.85,
              next_steps: ['Conduct user interviews', 'Build prototype', 'Secure initial funding']
            } : null
          }
        });
        evaluations.push(evaluation);
        console.log(`  ✅ Created evaluation for: ${idea.title}`);
      }
    }
    
    // Create agent results for completed evaluations
    console.log('🤖 Creating agent results...');
    const agentTypes: AgentType[] = ['market-research', 'competitive-analysis', 'customer-research', 'technical-feasibility', 'financial-analysis'];
    
    for (const evaluation of evaluations) {
      for (const agentType of agentTypes) {
        const template = getAgentResultTemplates(agentType);
        const isCompleted = evaluation.status === 'completed';
        const isRunning = evaluation.status === 'analyzing' && Math.random() > 0.3;
        
        const agentResult = await prisma.agentResult.create({
          data: {
            evaluation_id: evaluation.id,
            agent_type: agentType,
            status: isCompleted ? 'completed' as AgentResultStatus : 
                   isRunning ? 'running' as AgentResultStatus : 'pending' as AgentResultStatus,
            input_data: {
              business_idea_text: 'Sample business idea input',
              analysis_depth: 'comprehensive',
              market_focus: 'north_america'
            },
            output_data: isCompleted || isRunning ? template.output_data : null,
            score: isCompleted ? template.score + (Math.random() * 20 - 10) : null, // Add some variance
            insights: isCompleted ? template.insights : null,
            started_at: isCompleted || isRunning ? new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000) : null,
            completed_at: isCompleted ? new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000) : null
          }
        });
        
        console.log(`    ✅ Created ${agentType} result (${agentResult.status})`);
      }
    }
    
    // Generate summary
    const summary = await generateSeedSummary();
    console.log('\n📈 Seeding Summary:');
    console.log(`  Users: ${summary.users}`);
    console.log(`  Business Ideas: ${summary.businessIdeas}`);
    console.log(`  Evaluations: ${summary.evaluations}`);
    console.log(`  Agent Results: ${summary.agentResults}`);
    
    console.log('\n✅ Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate seeding summary
 */
async function generateSeedSummary() {
  const [users, businessIdeas, evaluations, agentResults] = await Promise.all([
    prisma.user.count(),
    prisma.businessIdea.count(),
    prisma.evaluation.count(),
    prisma.agentResult.count()
  ]);
  
  return { users, businessIdeas, evaluations, agentResults };
}

/**
 * Reset database and reseed
 */
export async function resetAndSeed() {
  console.log('🔄 Resetting database and reseeding...');
  
  await prisma.agentResult.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.businessIdea.deleteMany();
  await prisma.user.deleteMany();
  
  await seed();
}

/**
 * Validate seed data integrity
 */
export async function validateSeedData(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    // Check that all business ideas have users
    const orphanedIdeas = await prisma.businessIdea.count({
      where: {
        user: null
      }
    });
    
    if (orphanedIdeas > 0) {
      issues.push(`Found ${orphanedIdeas} business ideas without users`);
    }
    
    // Check that evaluations have business ideas
    const orphanedEvaluations = await prisma.evaluation.count({
      where: {
        business_idea: null
      }
    });
    
    if (orphanedEvaluations > 0) {
      issues.push(`Found ${orphanedEvaluations} evaluations without business ideas`);
    }
    
    // Check that agent results have evaluations
    const orphanedResults = await prisma.agentResult.count({
      where: {
        evaluation: null
      }
    });
    
    if (orphanedResults > 0) {
      issues.push(`Found ${orphanedResults} agent results without evaluations`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`Seed data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}