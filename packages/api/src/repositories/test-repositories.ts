/**
 * Test repository operations
 */

import { userRepository, businessIdeaRepository } from './index.js';
import { disconnectDatabase } from '../database/index.js';

async function testRepositories() {
  try {
    console.log('🧪 Testing repository operations...');
    
    // Test User Repository
    console.log('\n👥 Testing User Repository:');
    
    // Find all users
    const users = await userRepository.findMany();
    console.log(`  ✅ Found ${users.data.length} users`);
    
    // Find user by email
    if (users.data.length > 0) {
      const user = await userRepository.findByEmail(users.data[0].email);
      console.log(`  ✅ Found user by email: ${user?.name}`);
      
      // Find user with business ideas
      const userWithIdeas = await userRepository.findByIdWithBusinessIdeas(users.data[0].id);
      console.log(`  ✅ User has ${userWithIdeas?.business_ideas.length} business ideas`);
    }
    
    // Get user statistics
    const userStats = await userRepository.getStats();
    console.log(`  ✅ User stats:`, userStats);
    
    // Test BusinessIdea Repository
    console.log('\n💡 Testing BusinessIdea Repository:');
    
    // Find all business ideas
    const ideas = await businessIdeaRepository.findMany();
    console.log(`  ✅ Found ${ideas.data.length} business ideas`);
    
    // Find ideas by status
    const draftIdeas = await businessIdeaRepository.findByStatus('draft');
    console.log(`  ✅ Found ${draftIdeas.data.length} draft ideas`);
    
    // Search business ideas
    const searchResults = await businessIdeaRepository.search('AI');
    console.log(`  ✅ Found ${searchResults.data.length} ideas matching "AI"`);
    
    if (ideas.data.length > 0) {
      // Find business idea with complete data
      const completeIdea = await businessIdeaRepository.findByIdComplete(ideas.data[0].id);
      console.log(`  ✅ Complete idea has ${completeIdea?.evaluations.length} evaluations`);
    }
    
    // Get business idea statistics
    const ideaStats = await businessIdeaRepository.getStats();
    console.log(`  ✅ Business idea stats:`, ideaStats);
    
    console.log('\n✅ Repository tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Repository tests failed:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

testRepositories();