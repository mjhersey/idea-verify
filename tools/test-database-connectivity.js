#!/usr/bin/env node

/**
 * Database and Redis Connectivity Test
 * Tests PostgreSQL and Redis connections for development environment
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

async function testPostgreSQLConnection() {
  console.log('🐘 Testing PostgreSQL connection...');
  
  try {
    const { Client } = require('pg');
    
    const client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: process.env.DATABASE_PORT || 5432,
      database: process.env.DATABASE_NAME || 'ai_validation_platform',
      user: process.env.DATABASE_USER || 'dev_user',
      password: process.env.DATABASE_PASSWORD || 'dev_password',
    });

    await client.connect();
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ PostgreSQL connection successful!');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   Version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    // Test tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`   Tables: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
    
    await client.end();
    return true;
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testRedisConnection() {
  console.log('🔴 Testing Redis connection...');
  
  try {
    const Redis = require('ioredis');
    
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Test basic operations
    await redis.set('test:connectivity', 'success');
    const result = await redis.get('test:connectivity');
    await redis.del('test:connectivity');
    
    const info = await redis.info('server');
    const version = info.match(/redis_version:(.+)/)[1];
    
    console.log('✅ Redis connection successful!');
    console.log(`   Version: ${version}`);
    console.log(`   Test result: ${result}`);
    
    redis.disconnect();
    return true;
  } catch (error) {
    console.log('❌ Redis connection failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Database Connectivity Test');
  console.log('==============================');
  
  const postgresOk = await testPostgreSQLConnection();
  console.log('');
  const redisOk = await testRedisConnection();
  
  console.log('');
  console.log('📊 Test Summary:');
  console.log(`   PostgreSQL: ${postgresOk ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Redis: ${redisOk ? '✅ Connected' : '❌ Failed'}`);
  
  if (postgresOk && redisOk) {
    console.log('');
    console.log('🎉 All database connections successful!');
    process.exit(0);
  } else {
    console.log('');
    console.log('⚠️  Some database connections failed. Check your configuration.');
    console.log('   Make sure Docker services are running: npm run dev:services');
    process.exit(1);
  }
}

main().catch(console.error);