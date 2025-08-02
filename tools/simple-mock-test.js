#!/usr/bin/env node

/**
 * Simple Mock Service Test
 * Quick test of mock services functionality
 */

const { MockOpenAIService } = require('../packages/shared/dist/mocks/openai/mock-openai-service.js');
const { MockAnthropicService } = require('../packages/shared/dist/mocks/anthropic/mock-anthropic-service.js');

async function testMockServices() {
  console.log('🧪 Simple Mock Service Test\n');

  const openaiService = new MockOpenAIService({ port: 3001 });
  const anthropicService = new MockAnthropicService({ port: 3002 });

  try {
    // Start services
    console.log('1️⃣ Starting OpenAI mock service...');
    await openaiService.start();
    console.log('✅ OpenAI mock started on port 3001');

    console.log('2️⃣ Starting Anthropic mock service...');
    await anthropicService.start();
    console.log('✅ Anthropic mock started on port 3002');

    // Wait a moment for services to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test health endpoints
    console.log('\n3️⃣ Testing health endpoints...');
    
    const openaiHealth = await fetch('http://localhost:3001/health');
    console.log(`OpenAI health: ${openaiHealth.status} ${openaiHealth.ok ? '✅' : '❌'}`);
    
    const anthropicHealth = await fetch('http://localhost:3002/health');
    console.log(`Anthropic health: ${anthropicHealth.status} ${anthropicHealth.ok ? '✅' : '❌'}`);

    // Test API endpoints
    console.log('\n4️⃣ Testing API endpoints...');
    
    // Test OpenAI API
    const openaiResponse = await fetch('http://localhost:3001/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test message' }],
        max_tokens: 10
      })
    });
    
    console.log(`OpenAI API: ${openaiResponse.status} ${openaiResponse.ok ? '✅' : '❌'}`);
    if (openaiResponse.ok) {
      const data = await openaiResponse.json();
      console.log(`  Response: ${data.choices[0].message.content.substring(0, 50)}...`);
    }

    // Test Anthropic API
    const anthropicResponse = await fetch('http://localhost:3002/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sk-ant-test',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test message' }]
      })
    });
    
    console.log(`Anthropic API: ${anthropicResponse.status} ${anthropicResponse.ok ? '✅' : '❌'}`);
    if (anthropicResponse.ok) {
      const data = await anthropicResponse.json();
      console.log(`  Response: ${data.content[0].text.substring(0, 50)}...`);
    }

    console.log('\n🎉 Mock services test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await openaiService.stop();
    await anthropicService.stop();
    console.log('✅ Services stopped');
  }
}

testMockServices();