# External Service Integration Guide

## Overview

This guide provides comprehensive information for integrating with external
services in the AI-Powered Business Idea Validation Platform. The platform
integrates with OpenAI, Anthropic, and AWS services while maintaining security,
reliability, and cost efficiency.

## Architecture Overview

The platform uses a microservices architecture with centralized credential
management, rate limiting, and monitoring:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   API Gateway   │    │  Orchestrator   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Services Layer                        │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│ Credential Mgmt │   Rate Limiting │   Health Monitor│  Testing  │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAI API    │    │ Anthropic API   │    │  AWS Services   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Supported Services

### OpenAI API

- **Purpose**: Primary LLM provider for business idea evaluation
- **Models**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Rate Limits**: Tier-based (500-5000 RPM, 30K-1M TPM)
- **Cost**: $0.01-0.06 per 1K tokens depending on model

### Anthropic Claude API

- **Purpose**: Secondary LLM provider and fallback
- **Models**: Claude-3 Haiku, Claude-3 Sonnet, Claude-3 Opus
- **Rate Limits**: Tier-based (100-2000 RPM, 10K-100K TPM)
- **Cost**: $0.25-15.00 per 1M tokens depending on model

### AWS Services

- **Secrets Manager**: Secure credential storage
- **S3**: File storage and data persistence
- **CloudWatch**: Monitoring and alerting
- **IAM**: Access control and permissions

## Getting Started

### 1. Account Setup

Before development can begin, ensure all external service accounts are properly
configured:

```bash
# Validate user account setup
npm run validate:accounts
```

Required accounts:

- [x] OpenAI account with API access enabled
- [x] Anthropic account with Claude API access
- [x] AWS account with development IAM user
- [x] Billing alerts configured on AWS account
- [x] Account documentation completed

### 2. Development Environment Setup

```bash
# Set up development environment
npm run setup:dev

# This creates:
# - .env.template with all required variables
# - .env file (if it doesn't exist)
# - Updated .gitignore with security patterns
# - Mock data directories
# - Credential handoff guide
```

### 3. Credential Management

```bash
# Validate credentials (supports both real and mock services)
npm run validate:credentials

# Expected output:
# ✅ OPENAI: Valid
# ✅ ANTHROPIC: Valid
# ✅ AWS: Valid
```

## Development Modes

### Mock Services Mode (Default)

For offline development and testing:

```bash
# Start all mock services
npm run mock:start

# Check service status
npm run mock:status

# Run comprehensive offline tests
npm run test:offline
```

Mock services include:

- OpenAI API mock (port 3001) with realistic business evaluation responses
- Anthropic API mock (port 3002) with Claude-compatible message format
- LocalStack for AWS services (port 4566)

### Production Mode

For production or testing with real services:

```bash
# Set environment variables
export USE_MOCK_SERVICES=false
export USE_REAL_SERVICES=true

# Ensure credentials are properly configured
npm run validate:credentials
```

## Service Integration Patterns

### 1. Using ServiceClient (Recommended)

The `ServiceClient` class provides built-in rate limiting, quota management, and
error handling:

```typescript
import { ServiceClient, getServiceConfig } from '@ai-validation/shared'

// Initialize client
const config = getServiceConfig('openai')
const client = new ServiceClient('openai', config)

// Execute request with automatic retry and rate limiting
const result = await client.executeRequest(
  async () => {
    // Your API call here
    return await openaiAPI.createCompletion(params)
  },
  {
    estimatedTokens: 1000,
    estimatedCost: 0.02,
    priority: 'high',
  }
)
```

### 2. Manual Integration

For custom integration patterns:

```typescript
import {
  RateLimiter,
  QuotaMonitor,
  CredentialValidator,
} from '@ai-validation/shared'

// Initialize components
const rateLimiter = new RateLimiter(config.rateLimiting)
const quotaMonitor = new QuotaMonitor()
const validator = new CredentialValidator()

// Validate credentials
const credentials = await getCredentials('openai')
const isValid = await validator.validateOpenAI(credentials)

// Execute with rate limiting
if (isValid.valid) {
  const result = await rateLimiter.executeWithRetry(
    'openai',
    () => makeAPICall(credentials),
    estimatedTokens
  )
}
```

## Rate Limiting & Quotas

### Configuration

Rate limits are automatically configured based on service tier:

```typescript
// OpenAI Tier 1 (default)
const openaiLimits = {
  requestsPerMinute: 500,
  tokensPerMinute: 30000,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
}

// Anthropic Developer Tier (default)
const anthropicLimits = {
  requestsPerMinute: 100,
  tokensPerMinute: 10000,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
}
```

### Monitoring

```bash
# Check quota status for all services
npm run monitor:quotas

# View rate limit status
npm run monitor:rates
```

### Fallback Strategies

When quotas are exceeded:

1. **Primary → Secondary**: OpenAI → Anthropic
2. **Secondary → Mock**: Anthropic → Mock Services
3. **Graceful Degradation**: Reduced functionality with cached data

## Error Handling

### Common Error Scenarios

1. **Rate Limit Exceeded (429)**
   - Automatic retry with exponential backoff
   - Respects `Retry-After` headers
   - Falls back to alternative service if available

2. **Invalid Credentials (401/403)**
   - Immediate failure, no retry
   - Alert to credential rotation needed
   - Switch to mock services in development

3. **Service Unavailable (5xx)**
   - Retry with exponential backoff
   - Circuit breaker after consecutive failures
   - Automatic fallback to alternative service

4. **Network Errors**
   - Retry with jitter to avoid thundering herd
   - Timeout handling
   - Connection pooling for efficiency

### Error Response Format

```typescript
interface ServiceError {
  service: string
  type: 'rate_limit' | 'auth' | 'network' | 'server' | 'quota'
  message: string
  retryable: boolean
  retryAfter?: number
  fallbackAvailable: boolean
}
```

## Monitoring & Alerting

### Health Monitoring

```typescript
import { ServiceHealthMonitors } from '@ai-validation/shared'

const monitors = new ServiceHealthMonitors()
monitors.startAllMonitoring()

// Custom alert handling
monitors.getMonitor().registerService(
  'custom-service',
  async () => healthCheck(),
  { interval: 60000, timeout: 10000 },
  {
    onUnhealthy: status => sendAlert(status),
    onRecovered: status => sendRecoveryNotification(status),
  }
)
```

### Integration Testing

```bash
# Run full integration test suite
npm run test:integration:full

# Run specific test categories
npm run test:integration -- --skip-errors
npm run test:integration -- --real-services
```

Test coverage includes:

- Credential validation for all services
- Service connectivity and response validation
- Health check endpoint verification
- Rate limiting behavior
- Error handling scenarios
- Service degradation strategies

## Security Best Practices

### Credential Management

1. **Never commit credentials to version control**
2. **Use AWS Secrets Manager for production**
3. **Implement credential rotation (monthly recommended)**
4. **Use least privilege IAM policies**
5. **Enable audit logging for all credential access**

### Network Security

1. **Use TLS 1.3 for all external communication**
2. **Validate SSL certificates**
3. **Implement request signing where available**
4. **Use VPC endpoints for AWS services**
5. **Monitor for unusual API usage patterns**

### Data Protection

1. **Encrypt sensitive data at rest (AES-256)**
2. **Use secure transport for all API calls**
3. **Implement data retention policies**
4. **Log access patterns for audit**
5. **Sanitize data before external API calls**

## Cost Optimization

### Token Management

```typescript
// Estimate tokens before API calls
const estimatedTokens = estimateTokenCount(prompt)
if (estimatedTokens > maxTokens) {
  throw new Error('Request exceeds token limit')
}

// Track costs in real-time
quotaMonitor.recordUsage(service, tokens, cost)
```

### Service Selection

```typescript
// Choose service based on cost and capability
function selectService(complexity: 'simple' | 'complex'): string {
  if (complexity === 'simple') {
    return 'gpt-3.5-turbo' // Lower cost
  } else {
    return 'gpt-4' // Higher capability
  }
}
```

### Caching Strategy

1. **Cache frequently used prompts and responses**
2. **Implement response deduplication**
3. **Use cheaper models for simple tasks**
4. **Batch requests when possible**
5. **Implement request queuing to optimize rate limits**

## Troubleshooting

Common issues and solutions are documented in the
[Troubleshooting Runbook](./troubleshooting-runbook.md).

## Configuration Reference

### Environment Variables

```bash
# Core Configuration
NODE_ENV=development|production
USE_MOCK_SERVICES=true|false
USE_REAL_SERVICES=true|false

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default
SECRETS_OPENAI_NAME=ai-validation-platform/openai
SECRETS_ANTHROPIC_NAME=ai-validation-platform/anthropic
SECRETS_AWS_NAME=ai-validation-platform/aws

# Development Configuration
MOCK_DATA_PATH=./data/mock
TEST_TIMEOUT=30000
MAX_CONCURRENCY=3

# Optional: Local development overrides (DO NOT COMMIT)
# OPENAI_API_KEY=your-local-key-for-testing
# ANTHROPIC_API_KEY=your-local-key-for-testing
```

### Service Endpoints

```bash
# Production Endpoints
OPENAI_API_BASE=https://api.openai.com/v1
ANTHROPIC_API_BASE=https://api.anthropic.com/v1

# Mock Service Endpoints (Development)
MOCK_OPENAI_URL=http://localhost:3001
MOCK_ANTHROPIC_URL=http://localhost:3002
LOCALSTACK_URL=http://localhost:4566
```

## Support & Resources

- **API Documentation**: See individual service documentation
- **Rate Limits**: Check service tier and upgrade if needed
- **Cost Monitoring**: Use AWS Cost Explorer and service dashboards
- **Health Monitoring**: Built-in health checks and alerting
- **Integration Support**: See troubleshooting runbook

---

_Last updated: January 2025_ _Version: 1.0_
