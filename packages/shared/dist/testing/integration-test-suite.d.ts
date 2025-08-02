/**
 * Integration Test Suite for External Services
 * Comprehensive testing of all external service connections
 */
export interface IntegrationTestResult {
    service: string;
    test: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: Record<string, unknown>;
}
export interface TestSuiteOptions {
    includeRealServices: boolean;
    includeErrorScenarios: boolean;
    timeout: number;
    maxConcurrency: number;
}
export declare class IntegrationTestSuite {
    private validator;
    private secretsManager;
    private options;
    constructor(options?: Partial<TestSuiteOptions>);
    /**
     * Run all integration tests
     */
    runAllTests(): Promise<IntegrationTestResult[]>;
    /**
     * Test credential validation for all services
     */
    testCredentialValidation(): Promise<IntegrationTestResult[]>;
    /**
     * Test basic service connections
     */
    testServiceConnections(): Promise<IntegrationTestResult[]>;
    /**
     * Test health check endpoints
     */
    testHealthChecks(): Promise<IntegrationTestResult[]>;
    /**
     * Test rate limiting behavior
     */
    testRateLimiting(): Promise<IntegrationTestResult[]>;
    /**
     * Test error handling scenarios
     */
    testErrorHandling(): Promise<IntegrationTestResult[]>;
    /**
     * Test service degradation strategies
     */
    testServiceDegradation(): Promise<IntegrationTestResult[]>;
    /**
     * Test OpenAI connection
     */
    private testOpenAIConnection;
    /**
     * Test Anthropic connection
     */
    private testAnthropicConnection;
    /**
     * Get mock credentials for testing
     */
    private getMockCredentials;
    /**
     * Get credentials from environment variables
     */
    private getEnvCredentials;
    /**
     * Print test summary
     */
    private printSummary;
}
//# sourceMappingURL=integration-test-suite.d.ts.map