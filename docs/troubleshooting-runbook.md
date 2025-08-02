# Troubleshooting Runbook

## Overview

This runbook provides step-by-step troubleshooting procedures for common issues with external service integrations in the AI-Powered Business Idea Validation Platform.

## Quick Diagnostics

Before diving into specific issues, run these diagnostic commands:

```bash
# Check overall system health
npm run mock:status           # Mock services status
npm run validate:credentials  # Credential validation
npm run test:integration     # Basic connectivity tests
```

## Common Issues

### 1. Service Connection Failures

#### Symptoms
- ❌ API calls timing out
- ❌ Connection refused errors
- ❌ DNS resolution failures

#### Diagnostic Steps

```bash
# Step 1: Check service availability
curl -v https://api.openai.com/v1/models
curl -v https://api.anthropic.com/v1/messages

# Step 2: Check local mock services
curl -v http://localhost:3001/health
curl -v http://localhost:3002/health
curl -v http://localhost:4566/health

# Step 3: Check network connectivity
ping api.openai.com
ping api.anthropic.com
```

#### Resolution

**For Production Services:**
1. Verify internet connectivity
2. Check firewall/proxy settings
3. Confirm service status on provider status pages
4. Test from different network if possible

**For Mock Services:**
```bash
# Restart mock services
npm run mock:restart

# Check service logs
npm run mock:start  # Look for startup errors

# Verify ports are not in use
netstat -tulpn | grep :3001
netstat -tulpn | grep :3002
```

### 2. Authentication Errors

#### Symptoms
- ❌ 401 Unauthorized responses
- ❌ 403 Forbidden responses  
- ❌ Invalid API key messages

#### Diagnostic Steps

```bash
# Step 1: Validate credentials
npm run validate:credentials

# Step 2: Check credential format
echo $OPENAI_API_KEY | cut -c1-10    # Should start with "sk-"
echo $ANTHROPIC_API_KEY | cut -c1-10 # Should start with "sk-ant-"

# Step 3: Test credentials manually
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     https://api.anthropic.com/v1/messages
```

#### Resolution

**Check Credential Sources:**
1. Environment variables (`.env` file)
2. AWS Secrets Manager
3. Command line environment

**Common Fixes:**
```bash
# Fix 1: Reload environment
source .env
npm run validate:credentials

# Fix 2: Update credentials in Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id ai-validation-platform/openai \
  --secret-string '{"apiKey":"your-new-key"}'

# Fix 3: Rotate expired keys
# Follow credential rotation procedures in integration guide
```

### 3. Rate Limiting Issues

#### Symptoms
- ❌ 429 Too Many Requests errors
- ⚠️ Requests being delayed excessively
- ⚠️ Quota alerts being triggered

#### Diagnostic Steps

```bash
# Step 1: Check current usage
npm run monitor:quotas

# Step 2: Review rate limit status
# Look for these patterns in logs:
grep "Rate limit" logs/application.log
grep "429" logs/application.log
grep "Retry-After" logs/application.log
```

#### Resolution

**Immediate Actions:**
1. **Reduce Request Rate:**
   ```typescript
   // Increase delay between requests
   const config = getServiceConfig('openai');
   config.rateLimiting.baseDelayMs = 2000; // 2 seconds
   ```

2. **Switch to Alternative Service:**
   ```bash
   # Enable fallback to Anthropic
   export ENABLE_FALLBACK=true
   npm run validate:credentials
   ```

3. **Use Mock Services Temporarily:**
   ```bash
   export USE_MOCK_SERVICES=true
   npm run mock:start
   ```

**Long-term Solutions:**
1. **Upgrade Service Tier:**
   - OpenAI: Spend $100+ and wait 7+ days for Tier 2
   - Anthropic: Contact support for tier upgrade

2. **Implement Request Queuing:**
   ```typescript
   // Add to service configuration
   const queueConfig = {
     maxConcurrent: 5,
     queueSize: 100,
     priorityLevels: 3
   };
   ```

3. **Optimize Token Usage:**
   ```typescript
   // Reduce prompt size
   const optimizedPrompt = truncatePrompt(prompt, maxTokens);
   
   // Use cheaper models for simple tasks
   const model = complexity === 'simple' ? 'gpt-3.5-turbo' : 'gpt-4';
   ```

### 4. Quota Exhaustion

#### Symptoms
- 🚨 Cost alerts being triggered
- 🚨 Monthly/daily limits reached
- ❌ Service refusing requests due to quota

#### Diagnostic Steps

```bash
# Step 1: Check quota usage
npm run monitor:quotas

# Expected output:
# Service: openai
#   Requests: 850/1000 daily (85%)
#   Tokens: 45000/50000 monthly (90%)
#   Cost: $85.50/$100.00 monthly (85.5%)
```

#### Resolution

**Immediate Actions:**
1. **Enable Mock Services:**
   ```bash
   export USE_MOCK_SERVICES=true
   npm run mock:start
   npm run test:offline  # Verify functionality
   ```

2. **Implement Cost Controls:**
   ```typescript
   // Add stricter limits
   const emergencyConfig = {
     dailyLimit: 500,  // Reduce by 50%
     costLimit: 50,    // Reduce by 50%
     alertThresholds: [25, 50, 75] // Earlier warnings
   };
   ```

3. **Queue Non-Critical Requests:**
   ```typescript
   // Defer non-urgent requests
   if (priority === 'low' && quotaUsage > 80) {
     return queueForLater(request);
   }
   ```

**Long-term Solutions:**
1. **Increase Budget Allocation**
2. **Implement Better Caching**
3. **Optimize Prompt Engineering**
4. **Use Cheaper Models for Simple Tasks**

### 5. Mock Services Issues

#### Symptoms
- ❌ Mock services not starting
- ❌ Port conflicts
- ❌ Unrealistic responses from mocks

#### Diagnostic Steps

```bash
# Step 1: Check port availability
netstat -tulpn | grep :3001
netstat -tulpn | grep :3002
netstat -tulpn | grep :4566

# Step 2: Check mock service health
npm run mock:validate

# Step 3: Review mock service logs
npm run mock:start  # Look for startup errors
```

#### Resolution

**Port Conflicts:**
```bash
# Kill processes using required ports
sudo lsof -t -i:3001 | xargs kill -9
sudo lsof -t -i:3002 | xargs kill -9
sudo lsof -t -i:4566 | xargs kill -9

# Restart services
npm run mock:restart
```

**Service Configuration Issues:**
```bash
# Reset mock service configuration
rm -rf node_modules/@ai-validation/shared/dist
npm run build
npm run mock:start
```

**LocalStack Issues:**
```bash
# Start LocalStack with Docker Compose
docker-compose up localstack -d

# Check LocalStack status
curl http://localhost:4566/health
```

### 6. Integration Test Failures

#### Symptoms
- ❌ Integration tests failing
- ❌ Inconsistent test results
- ❌ Tests timing out

#### Diagnostic Steps

```bash
# Step 1: Run tests with verbose output
npm run test:integration -- --verbose

# Step 2: Run specific test categories
npm run test:integration -- --skip-errors
npm run test:integration:full

# Step 3: Check test environment
env | grep -E "(NODE_ENV|USE_MOCK|API_KEY)"
```

#### Resolution

**Test Environment Issues:**
```bash
# Ensure proper test environment
export NODE_ENV=test
export USE_MOCK_SERVICES=true
export SKIP_ERROR_TESTS=false

# Run with services
npm run test:integration:full
```

**Service Startup Issues:**
```bash
# Manual service startup for debugging
npm run mock:start
sleep 5  # Wait for services to be ready
npm run test:integration
npm run mock:stop
```

**Timeout Issues:**
```bash
# Increase test timeout
export TEST_TIMEOUT=60000
npm run test:integration
```

## Performance Issues

### Slow Response Times

#### Symptoms
- ⚠️ API calls taking >5 seconds
- ⚠️ Health checks showing degraded status
- ⚠️ User complaints about slow performance

#### Diagnostic Steps

```bash
# Step 1: Check service response times
time curl -H "Authorization: Bearer $OPENAI_API_KEY" \
          https://api.openai.com/v1/models

# Step 2: Monitor health status
npm run monitor:health

# Step 3: Check for rate limiting delays
grep "backoff" logs/application.log
```

#### Resolution

1. **Optimize API Calls:**
   ```typescript
   // Reduce token count
   const maxTokens = 100; // Reduce for faster responses
   
   // Use streaming for long responses
   const stream = await openai.createChatCompletion({
     model: "gpt-3.5-turbo",
     messages: messages,
     stream: true
   });
   ```

2. **Implement Caching:**
   ```typescript
   // Cache frequent requests
   const cache = new Map();
   const cacheKey = hashRequest(request);
   if (cache.has(cacheKey)) {
     return cache.get(cacheKey);
   }
   ```

3. **Use Faster Models:**
   ```typescript
   // Switch to faster, cheaper models
   const model = urgency === 'high' ? 'gpt-3.5-turbo' : 'gpt-4';
   ```

## Service-Specific Issues

### OpenAI Issues

**Common Error Codes:**
- `401`: Invalid API key
- `429`: Rate limit exceeded  
- `500`: OpenAI server error
- `503`: OpenAI service unavailable

**Specific Troubleshooting:**
```bash
# Check OpenAI service status
curl https://status.openai.com/api/v2/status.json

# Validate specific model availability
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models/gpt-4
```

### Anthropic Issues

**Common Error Codes:**
- `401`: Invalid API key
- `429`: Rate limit exceeded
- `400`: Invalid request format
- `500`: Anthropic server error

**Specific Troubleshooting:**
```bash
# Test with minimal request
curl -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 1,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

### AWS Issues

**Common Issues:**
- IAM permission errors
- Secrets Manager access denied
- Region configuration issues

**Specific Troubleshooting:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Test Secrets Manager access
aws secretsmanager get-secret-value \
  --secret-id ai-validation-platform/openai

# Check IAM permissions
aws iam get-user
aws iam list-attached-user-policies --user-name your-user
```

## Emergency Procedures

### Service Outage Response

1. **Immediate Actions (< 5 minutes):**
   ```bash
   # Switch to mock services
   export USE_MOCK_SERVICES=true
   npm run mock:start
   
   # Notify users of degraded service
   echo "Service temporarily degraded - using backup systems"
   ```

2. **Short-term Actions (< 30 minutes):**
   ```bash
   # Enable alternative service
   export ENABLE_FALLBACK=true
   npm run validate:credentials
   
   # Monitor service recovery
   watch -n 30 'curl -s https://status.openai.com/api/v2/status.json'
   ```

3. **Recovery Actions:**
   ```bash
   # Test service recovery
   npm run test:integration -- --real-services
   
   # Gradually switch back
   export USE_MOCK_SERVICES=false
   npm run validate:credentials
   ```

### Data Loss Prevention

1. **Enable Request Logging:**
   ```typescript
   const logger = new RequestLogger({
     logRequests: true,
     logResponses: true,
     retentionDays: 7
   });
   ```

2. **Implement Backup Storage:**
   ```typescript
   // Store critical requests/responses
   await backupStorage.store({
     timestamp: Date.now(),
     service: 'openai',
     request: sanitizeRequest(request),
     response: sanitizeResponse(response)
   });
   ```

## Escalation Procedures

### Internal Escalation

1. **Level 1**: Development Team
   - Check logs and metrics
   - Apply standard troubleshooting
   - Implement workarounds

2. **Level 2**: Senior Engineering
   - Architecture review
   - Service provider contact
   - Emergency configuration changes

3. **Level 3**: External Support
   - Contact service provider support
   - Escalate to account managers
   - Consider alternative providers

### External Escalation

**OpenAI Support:**
- Email: support@openai.com
- Priority support for paid tiers
- Status page: https://status.openai.com

**Anthropic Support:**
- Email: support@anthropic.com  
- Enterprise support available
- Status updates via Twitter: @AnthropicAI

**AWS Support:**
- Console: AWS Support Center
- Phone support for paid tiers
- Technical Account Manager (Enterprise)

## Monitoring & Alerting Setup

### Key Metrics to Monitor

```typescript
const criticalMetrics = {
  responseTime: { threshold: 5000, unit: 'ms' },
  errorRate: { threshold: 5, unit: 'percent' },
  quotaUsage: { threshold: 90, unit: 'percent' },
  costBurn: { threshold: 80, unit: 'percent' }
};
```

### Alert Thresholds

```typescript
const alertLevels = {
  warning: {
    responseTime: 2000, // 2 seconds
    errorRate: 2,       // 2%
    quotaUsage: 75      // 75%
  },
  critical: {
    responseTime: 5000, // 5 seconds  
    errorRate: 5,       // 5%
    quotaUsage: 90      // 90%
  }
};
```

## Maintenance Procedures

### Regular Maintenance Tasks

**Daily:**
- Review error logs
- Check quota usage
- Validate service health

**Weekly:**
- Review performance metrics
- Update rate limit configurations
- Test fallback procedures

**Monthly:**
- Rotate API credentials
- Review cost optimization
- Update service configurations
- Test disaster recovery procedures

### Credential Rotation

```bash
# Monthly credential rotation procedure
./scripts/rotate-credentials.sh --service=openai
./scripts/rotate-credentials.sh --service=anthropic
./scripts/rotate-aws-keys.sh

# Validate new credentials
npm run validate:credentials

# Update documentation
./scripts/update-credential-docs.sh
```

---

*Last updated: January 2025*
*Version: 1.0*

For additional support, contact the development team or refer to the [External Service Integration Guide](./external-service-integration-guide.md).