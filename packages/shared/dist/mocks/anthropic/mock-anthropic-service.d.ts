/**
 * Mock Anthropic Claude API Service
 * Provides Claude-compatible response formats for development and testing
 */
export interface MockAnthropicConfig {
    port: number;
    baseUrl?: string;
    rateLimits?: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
}
export interface AnthropicMessage {
    id: string;
    type: string;
    role: string;
    content: Array<{
        type: string;
        text: string;
    }>;
    model: string;
    stop_reason: string;
    stop_sequence: null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
export declare class MockAnthropicService {
    private server;
    private config;
    private requestCount;
    private tokenCount;
    private lastReset;
    constructor(config: MockAnthropicConfig);
    /**
     * Start the mock server
     */
    start(): Promise<void>;
    /**
     * Stop the mock server
     */
    stop(): Promise<void>;
    /**
     * Handle incoming HTTP requests
     */
    private handleRequest;
    /**
     * Handle /v1/messages endpoint
     */
    private handleMessages;
    /**
     * Generate mock message response
     */
    private generateMockMessage;
    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens;
    /**
     * Update rate limit counters
     */
    private updateRateLimits;
    /**
     * Handle /health endpoint
     */
    private handleHealth;
    /**
     * Check if request is rate limited
     */
    private isRateLimited;
}
//# sourceMappingURL=mock-anthropic-service.d.ts.map