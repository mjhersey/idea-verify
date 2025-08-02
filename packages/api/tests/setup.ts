/**
 * Test setup file for environment configuration
 */

import { beforeAll } from 'vitest';

beforeAll(() => {
  // Set required environment variables for tests
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
  process.env.SECRETS_OPENAI_NAME = 'test-openai';
  process.env.SECRETS_ANTHROPIC_NAME = 'test-anthropic';
  process.env.SECRETS_AWS_NAME = 'test-aws';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.USE_MOCK_SERVICES = 'true';
});