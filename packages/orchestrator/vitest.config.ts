import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Set required environment variables for tests
      NODE_ENV: 'test',
      USE_MOCK_SERVICES: 'true',
      AWS_REGION: 'us-east-1',
      OPENAI_API_KEY: 'test-key',
      ANTHROPIC_API_KEY: 'test-key',
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SECRETS_OPENAI_NAME: 'test-openai-secret',
      SECRETS_ANTHROPIC_NAME: 'test-anthropic-secret',
      SECRETS_AWS_NAME: 'test-aws-secret'
    },
  },
});