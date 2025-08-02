/**
 * Environment configuration and variable management
 */

import { config } from 'dotenv';
import { SecretsManagerConfig } from '../types/credentials.js';

// Load environment variables
config();

export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  aws: {
    region: string;
    profile?: string;
  };
  secretsManager: SecretsManagerConfig;
  development: {
    useMockServices: boolean;
    mockDataPath?: string;
  };
}

/**
 * Get environment configuration with validation
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const requiredEnvVars = [
    'AWS_REGION',
    'SECRETS_OPENAI_NAME',
    'SECRETS_ANTHROPIC_NAME', 
    'SECRETS_AWS_NAME'
  ];

  // Validate required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    aws: {
      region: process.env.AWS_REGION!,
      profile: process.env.AWS_PROFILE
    },
    secretsManager: {
      region: process.env.AWS_REGION!,
      secretNames: {
        openai: process.env.SECRETS_OPENAI_NAME!,
        anthropic: process.env.SECRETS_ANTHROPIC_NAME!,
        aws: process.env.SECRETS_AWS_NAME!
      }
    },
    development: {
      useMockServices: process.env.USE_MOCK_SERVICES === 'true',
      mockDataPath: process.env.MOCK_DATA_PATH
    }
  };
}

/**
 * Generate environment variable template
 */
export function generateEnvTemplate(): string {
  return `# AI Validation Platform Environment Configuration

# Node Environment
NODE_ENV=development
PORT=3000

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# AWS Secrets Manager Secret Names
SECRETS_OPENAI_NAME=ai-validation-platform/openai
SECRETS_ANTHROPIC_NAME=ai-validation-platform/anthropic
SECRETS_AWS_NAME=ai-validation-platform/aws

# Development Configuration
USE_MOCK_SERVICES=true
MOCK_DATA_PATH=./data/mock

# Optional: Local development overrides (DO NOT COMMIT THESE VALUES)
# OPENAI_API_KEY=your-local-key-for-testing
# ANTHROPIC_API_KEY=your-local-key-for-testing
`;
}