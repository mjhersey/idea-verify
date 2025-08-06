# Integration Testing Framework

This directory contains comprehensive integration tests for the AI Validation
Platform deployed environment.

## Test Suites

### 1. End-to-End Tests (`e2e-test-suite.ts`)

- **Purpose**: Complete user journey testing from registration to evaluation
- **Coverage**: Full application workflow, UI interactions, business logic
- **Duration**: ~5-10 minutes per test
- **Dependencies**: Deployed environment with all services

### 2. API Integration Tests (`api-integration.test.ts`)

- **Purpose**: Test all API endpoints against real deployed services
- **Coverage**: Authentication, CRUD operations, error handling, security
- **Duration**: ~2-5 minutes per test
- **Dependencies**: API service deployment

### 3. Database Integration Tests (`database-integration.test.ts`)

- **Purpose**: Test database operations with real RDS instance
- **Coverage**: CRUD operations, transactions, performance, constraints
- **Duration**: ~1-3 minutes per test
- **Dependencies**: RDS PostgreSQL instance

### 4. Authentication Flow Tests (`auth-flow.test.ts`)

- **Purpose**: Comprehensive JWT authentication system testing
- **Coverage**: Registration, login, token refresh, session management
- **Duration**: ~2-4 minutes per test
- **Dependencies**: API service with JWT implementation

### 5. Evaluation Pipeline Tests (`evaluation-pipeline.test.ts`)

- **Purpose**: Test the complete evaluation pipeline with orchestrator and
  agents
- **Coverage**: Simple/complex evaluations, concurrent processing, agent
  integration
- **Duration**: ~5-15 minutes per test (due to evaluation processing time)
- **Dependencies**: All services (API, Orchestrator, Agents)

### 6. Performance Tests (`performance.test.ts`)

- **Purpose**: Load testing and performance validation
- **Coverage**: Concurrent users, response times, throughput, stress limits
- **Duration**: ~5-10 minutes per test
- **Dependencies**: Deployed infrastructure

## Configuration

### Environment Variables

Required for all tests:

- `TEST_BASE_URL`: Base URL of the deployed environment
- `TEST_ENVIRONMENT`: Environment name (dev/staging/prod)

Database tests require:

- `DATABASE_URL` or `TEST_DATABASE_URL`: Database connection string

AWS-dependent tests require:

- `AWS_REGION`: AWS region
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

Performance test tuning:

- `PERF_CONCURRENT_USERS`: Number of concurrent users (default: 10)
- `PERF_TEST_DURATION`: Test duration in milliseconds (default: 15000)

### Test Configuration Files

- `vitest.integration.config.ts`: Main Vitest configuration
- `setup.ts`: Global test setup and utilities
- `README.md`: This documentation

## Running Tests

### All Integration Tests

```bash
npm run test:integration
```

### Individual Test Suites

```bash
npm run test:integration:e2e
npm run test:integration:api
npm run test:integration:database
npm run test:integration:auth
npm run test:integration:evaluation
npm run test:integration:performance
```

### With Watch Mode

```bash
npm run test:integration:watch
```

### Environment-Specific Examples

```bash
# Development environment
TEST_BASE_URL=http://localhost:3000 TEST_ENVIRONMENT=dev npm run test:integration

# Staging environment
TEST_BASE_URL=https://staging.aivalidation.com TEST_ENVIRONMENT=staging npm run test:integration

# Production environment (limited tests)
TEST_BASE_URL=https://aivalidation.com TEST_ENVIRONMENT=prod npm run test:integration:performance
```

## CI/CD Integration

The integration tests are automatically executed in GitHub Actions:

### Triggers

- **Push to main**: Runs all tests against dev environment
- **Pull Request**: Runs all tests with temporary environment
- **Manual Dispatch**: Allows selection of environment and test suite

### Workflow Jobs

1. **Environment Setup**: Deploys infrastructure if needed
2. **Environment Validation**: Validates deployment health
3. **Test Execution**: Runs selected test suites in parallel
4. **Report Generation**: Creates consolidated test report
5. **Cleanup**: Destroys temporary resources

### GitHub Workflow

`.github/workflows/integration-tests.yml`

## Test Development Guidelines

### Writing Integration Tests

1. **Test Structure**: Use consistent setup/cleanup, descriptive test names
2. **Resource Management**: Always clean up test data, use unique identifiers
3. **Error Handling**: Test both success and failure scenarios
4. **Performance**: Set appropriate timeouts, avoid unnecessary delays
5. **Environment Awareness**: Handle differences between dev/staging/prod

### Best Practices

```typescript
describe('Feature Tests', () => {
  let testData: TestData

  beforeAll(async () => {
    // Setup test resources
    testData = await setupTestData()
  })

  afterAll(async () => {
    // Cleanup test resources
    await cleanupTestData(testData)
  })

  test('should handle feature correctly', async () => {
    // Test implementation with proper assertions
    const result = await testFeature(testData)
    expect(result).toMatchExpectedStructure()
  })
})
```

### Test Data Management

- Use unique identifiers (timestamps, UUIDs) to avoid conflicts
- Create minimal test data required for the test
- Clean up all created resources in `afterAll` hooks
- Use environment-specific test accounts when possible

### Error Scenarios

- Test invalid inputs and edge cases
- Verify proper error messages and status codes
- Test authentication and authorization failures
- Validate rate limiting and security measures

## Monitoring and Debugging

### Test Failures

1. **Check Environment Health**: Verify all services are running
2. **Review Logs**: Check application logs for errors
3. **Network Issues**: Verify connectivity and timeouts
4. **Resource Limits**: Check if hitting rate limits or resource constraints

### Performance Issues

1. **Baseline Metrics**: Compare against historical performance
2. **Resource Utilization**: Monitor CPU, memory, database connections
3. **Network Latency**: Check response times and throughput
4. **Concurrent Load**: Verify system handles expected load

### Debug Mode

```bash
# Run tests with verbose output
DEBUG=* npm run test:integration

# Run specific test with detailed logging
TEST_LOG_LEVEL=debug npm run test:integration:api
```

## Security Considerations

### Test Data

- Never use production credentials in tests
- Use temporary test accounts that are automatically cleaned up
- Avoid storing sensitive data in test files or logs

### Environment Access

- Limit test access to development and staging environments
- Use separate AWS accounts/regions for testing when possible
- Implement proper IAM permissions for test execution

### Data Privacy

- Generate synthetic test data instead of using real user data
- Ensure test data doesn't contain PII or sensitive information
- Clean up all test artifacts after execution

## Troubleshooting

### Common Issues

**Tests timing out**

- Increase timeout values in test configuration
- Check if services are healthy and responding
- Verify network connectivity

**Authentication failures**

- Ensure test environment has proper JWT configuration
- Check if test user credentials are correct
- Verify token expiration settings

**Database connection errors**

- Validate DATABASE_URL environment variable
- Check RDS instance status and security groups
- Verify connection pool settings

**Evaluation tests failing**

- Ensure orchestrator service is running
- Check if external API credentials are configured
- Verify BullMQ Redis connection

**Performance tests inconsistent**

- Run tests multiple times to establish baseline
- Consider system load and resource availability
- Adjust concurrent user counts for environment capacity

### Getting Help

1. Check GitHub Actions logs for CI/CD failures
2. Review application logs in CloudWatch
3. Use environment validation script: `npm run validate:environment`
4. Contact the development team with specific error messages and environment
   details
