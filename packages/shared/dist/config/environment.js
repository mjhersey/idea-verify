"use strict";
/**
 * Environment configuration and variable management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentConfig = getEnvironmentConfig;
exports.generateEnvTemplate = generateEnvTemplate;
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)();
/**
 * Get environment configuration with validation
 */
function getEnvironmentConfig() {
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
        frontendUrl: process.env.FRONTEND_URL,
        aws: {
            region: process.env.AWS_REGION,
            profile: process.env.AWS_PROFILE
        },
        secretsManager: {
            region: process.env.AWS_REGION,
            secretNames: {
                openai: process.env.SECRETS_OPENAI_NAME,
                anthropic: process.env.SECRETS_ANTHROPIC_NAME,
                aws: process.env.SECRETS_AWS_NAME
            }
        },
        database: process.env.DATABASE_URL ? {
            url: process.env.DATABASE_URL,
            maxConnections: process.env.DATABASE_MAX_CONNECTIONS ? parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10) : 20,
            connectionTimeoutMs: process.env.DATABASE_CONNECTION_TIMEOUT_MS ? parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 10) : 30000,
            poolTimeoutMs: process.env.DATABASE_POOL_TIMEOUT_MS ? parseInt(process.env.DATABASE_POOL_TIMEOUT_MS, 10) : 30000
        } : undefined,
        development: {
            useMockServices: process.env.USE_MOCK_SERVICES === 'true',
            mockDataPath: process.env.MOCK_DATA_PATH
        },
        redis: process.env.REDIS_HOST ? {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: process.env.REDIS_MAX_RETRIES ? parseInt(process.env.REDIS_MAX_RETRIES, 10) : 3
        } : undefined,
        orchestrator: {
            maxConcurrentEvaluations: parseInt(process.env.ORCHESTRATOR_MAX_CONCURRENT || '10', 10),
            defaultTimeout: parseInt(process.env.ORCHESTRATOR_TIMEOUT || '300000', 10), // 5 minutes
            retryAttempts: parseInt(process.env.ORCHESTRATOR_RETRIES || '3', 10)
        }
    };
}
/**
 * Generate environment variable template
 */
function generateEnvTemplate() {
    return `# AI Validation Platform Environment Configuration

# Node Environment
NODE_ENV=development
PORT=3000

# Frontend Configuration
FRONTEND_URL=http://localhost:5173

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# AWS Secrets Manager Secret Names
SECRETS_OPENAI_NAME=ai-validation-platform/openai
SECRETS_ANTHROPIC_NAME=ai-validation-platform/anthropic
SECRETS_AWS_NAME=ai-validation-platform/aws

# Database Configuration
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform?schema=public&connect_timeout=30&pool_timeout=30
DATABASE_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT_MS=30000
DATABASE_POOL_TIMEOUT_MS=30000

# Redis Configuration (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_MAX_RETRIES=3

# Orchestrator Configuration
ORCHESTRATOR_MAX_CONCURRENT=10
ORCHESTRATOR_TIMEOUT=300000
ORCHESTRATOR_RETRIES=3

# Development Configuration
USE_MOCK_SERVICES=true
MOCK_DATA_PATH=./data/mock

# Optional: Local development overrides (DO NOT COMMIT THESE VALUES)
# OPENAI_API_KEY=your-local-key-for-testing
# ANTHROPIC_API_KEY=your-local-key-for-testing
`;
}
//# sourceMappingURL=environment.js.map