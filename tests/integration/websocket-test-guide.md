# WebSocket Integration Testing Guide

## Overview

This guide covers the comprehensive WebSocket integration testing suite for
Story 2.5: WebSocket Integration & Real-time Updates.

## Test Structure

### 1. WebSocket Integration Tests (`websocket-integration.test.ts`)

Comprehensive end-to-end testing covering:

#### **Connection Management**

- Basic WebSocket connection establishment with authentication
- Subscription to evaluation updates
- Multiple event type handling (progress, insights, status, completion, errors)
- Connection state management and monitoring

#### **Network Resilience**

- Automatic reconnection after connection loss
- Subscription state persistence after reconnection
- Connection failure handling and recovery
- Network interruption simulation and recovery

#### **Authentication & Security**

- Invalid token rejection testing
- Token expiration handling
- Authentication middleware validation
- Secure connection establishment

#### **Server-Sent Events (SSE) Fallback**

- Automatic fallback when WebSocket fails
- Event format consistency between WebSocket and SSE
- SSE connection management and cleanup
- Fallback mechanism validation

#### **Resource Management**

- Memory leak detection and prevention
- Connection cleanup validation
- Resource usage monitoring
- Rapid connect/disconnect cycle handling

### 2. WebSocket Performance Tests (`websocket-performance.test.ts`)

Advanced performance validation including:

#### **Connection Performance**

- Connection establishment time measurement
- Concurrent connection handling (up to 50 connections)
- Connection spike handling without degradation
- Scalability under load testing

#### **Message Throughput**

- High-volume message processing (1000+ messages)
- Message latency measurement and validation
- Burst message handling without loss
- Real-time performance metrics collection

#### **Resource Utilization**

- Memory usage monitoring under sustained load
- CPU utilization tracking
- Connection pool management
- Resource cleanup validation

#### **Scalability Validation**

- Maximum concurrent connection testing
- Message distribution across connections
- Performance degradation monitoring
- Load balancing effectiveness

## Test Configuration

### Environment Variables

```bash
# Required for integration tests
TEST_API_URL=http://localhost:3000
TEST_ENVIRONMENT=integration
TEST_TIMEOUT=60000
TEST_MAX_RETRIES=3

# Optional for performance tests
WEBSOCKET_MAX_CONNECTIONS=50
WEBSOCKET_TEST_DURATION=30000
PERFORMANCE_MESSAGE_COUNT=1000
```

### Performance Benchmarks

#### **Connection Performance**

- Average connection time: < 2 seconds
- Maximum connection time: < 5 seconds
- Concurrent connections: 50+ without degradation
- Connection failure rate: < 1%

#### **Message Performance**

- Message throughput: > 50 messages/second
- Average message latency: < 100ms
- Maximum message latency: < 1 second
- Message loss rate: 0%

#### **Resource Usage**

- Memory increase under load: < 50MB
- Maximum memory usage: < 100MB increase
- Connection cleanup: 100% resource recovery
- No memory leaks after test completion

## Running Tests

### Basic Integration Tests

```bash
# Run all WebSocket integration tests
npm run test:integration:websocket:all

# Run specific test suites
npm run test:integration:websocket
npm run test:integration:websocket:performance

# Run with verbose output
npm run test:integration:websocket -- --reporter=verbose

# Run with coverage (if enabled)
npm run test:integration:websocket -- --coverage
```

### Performance Testing

```bash
# Run performance tests with extended timeout
npm run test:integration:websocket:performance -- --testTimeout=120000

# Run load testing with specific connection count
WEBSOCKET_MAX_CONNECTIONS=100 npm run test:integration:websocket:performance

# Run memory profiling tests
node --expose-gc node_modules/.bin/vitest run tests/integration/websocket-performance.test.ts
```

### Continuous Integration

```bash
# CI-friendly test execution
CI=true npm run test:integration:websocket:all

# With retry on failure
npm run test:integration:websocket:all -- --retry=3

# Generate test reports
npm run test:integration:websocket:all -- --reporter=junit --outputFile=websocket-test-results.xml
```

## Test Data and Mocking

### Mock Events Used in Tests

```typescript
// Agent Progress Event
const mockAgentProgressEvent: AgentProgressEvent = {
  agentType: 'market-research',
  status: 'running',
  progressPercentage: 50,
  timestamp: new Date(),
}

// Insight Discovery Event
const mockInsightEvent: InsightDiscoveredEvent = {
  agentType: 'competitive-analysis',
  insight: {
    type: 'market-opportunity',
    content: 'Large untapped market identified',
    importance: 'high',
  },
  confidence: 0.85,
  timestamp: new Date(),
}

// Evaluation Status Event
const mockStatusEvent: EvaluationStatusEvent = {
  evaluationId: 'test-eval-123',
  overallProgress: 75,
  activeAgents: ['market-research'],
  completedAgents: ['competitive-analysis'],
  failedAgents: [],
  timestamp: new Date(),
}
```

### Authentication Tokens

- Valid tokens: `test-integration-token`, `test-performance-token-{id}`
- Invalid tokens: `invalid-token`, `expired-token`
- Health check token: `health-check-token`

## Test Scenarios Covered

### ✅ Functional Testing

- [x] WebSocket connection establishment
- [x] Authentication and authorization
- [x] Event subscription and unsubscription
- [x] Real-time message delivery
- [x] Multiple event types handling
- [x] Connection state management

### ✅ Resilience Testing

- [x] Network interruption recovery
- [x] Automatic reconnection
- [x] Connection failure handling
- [x] SSE fallback mechanism
- [x] Authentication failure recovery
- [x] Resource cleanup on disconnect

### ✅ Performance Testing

- [x] Concurrent connection handling
- [x] Message throughput validation
- [x] Latency measurement
- [x] Memory usage monitoring
- [x] Scalability under load
- [x] Resource utilization tracking

### ✅ Security Testing

- [x] Invalid authentication rejection
- [x] Token expiration handling
- [x] Secure connection establishment
- [x] Authorization validation
- [x] Connection access control

## Test Maintenance

### Adding New Tests

1. **Create test file**: Follow naming convention `websocket-{feature}.test.ts`
2. **Import utilities**: Use `WebSocketTestHelper` from setup
3. **Define test data**: Create mock events and expected responses
4. **Write test cases**: Use descriptive test names and proper cleanup
5. **Update documentation**: Add test scenarios to this guide

### Performance Baseline Updates

When updating performance benchmarks:

1. Run tests on clean environment
2. Record baseline metrics
3. Update benchmark values in tests
4. Document changes in git commit
5. Update this guide with new expectations

### Debugging Test Failures

#### Common Issues and Solutions

1. **Connection Timeouts**
   - Check if test server is running
   - Verify authentication tokens are valid
   - Increase timeout values for slow environments

2. **Message Loss**
   - Check server message queue capacity
   - Verify client-side event handlers are registered
   - Monitor network stability during tests

3. **Memory Leaks**
   - Ensure all sockets are properly disconnected
   - Run garbage collection between tests
   - Monitor resource cleanup in server logs

4. **Performance Degradation**
   - Check system resource availability
   - Verify no other processes are using test ports
   - Monitor database and Redis performance

## Integration with CI/CD

### GitHub Actions Configuration

```yaml
- name: Run WebSocket Integration Tests
  run: |
    npm run dev:services
    sleep 10  # Wait for services to start
    npm run test:integration:websocket:all
  env:
    TEST_API_URL: http://localhost:3000
    CI: true

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: websocket-test-results
    path: websocket-test-results.xml
```

### Test Reports

Test results include:

- Connection performance metrics
- Message throughput statistics
- Memory usage reports
- Error rate analysis
- Performance trend data

## Troubleshooting

### Common Test Environment Issues

1. **Port Conflicts**: Ensure test server ports (3000, 5432, 6379) are available
2. **Service Dependencies**: Start required services (PostgreSQL, Redis) before
   tests
3. **Authentication**: Verify test tokens are configured correctly in test
   environment
4. **Network Settings**: Check firewall settings for WebSocket connections
5. **Resource Limits**: Ensure sufficient memory for concurrent connection tests

### Performance Test Tuning

- Adjust `WEBSOCKET_MAX_CONNECTIONS` for your test environment capacity
- Modify `PERFORMANCE_MESSAGE_COUNT` based on test duration preferences
- Update timeout values for slower CI environments
- Configure memory limits for resource usage tests

## Success Criteria

All tests must pass with the following criteria:

### ✅ Integration Tests (100% Pass Rate)

- Connection establishment: < 5 second average
- Message delivery: 100% success rate
- Reconnection: < 10 second recovery time
- Resource cleanup: No memory leaks detected

### ✅ Performance Tests (Benchmark Achievement)

- Concurrent connections: 50+ simultaneous
- Message throughput: 50+ messages/second
- Memory efficiency: < 50MB increase under load
- Zero message loss under normal conditions

### ✅ Security Tests (100% Pass Rate)

- Authentication validation: All invalid tokens rejected
- Authorization enforcement: Proper access control
- Secure connections: TLS/WSS in production environment

## Future Enhancements

Planned test improvements:

- [ ] Browser-based WebSocket testing with Playwright
- [ ] Cross-platform compatibility testing
- [ ] WebSocket protocol version testing
- [ ] Compression and optimization testing
- [ ] Multi-region latency testing
- [ ] High-availability failover testing
