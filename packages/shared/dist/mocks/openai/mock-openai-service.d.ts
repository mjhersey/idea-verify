/**
 * Mock OpenAI API Service
 * Provides realistic response formats for development and testing
 */
export interface MockOpenAIConfig {
    port: number;
    baseUrl?: string;
    rateLimits?: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
}
export interface OpenAIModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}
export interface OpenAICompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        logprobs: null;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint: string;
}
export declare class MockOpenAIService {
    private server;
    private config;
    private requestCount;
    private tokenCount;
    private lastReset;
    private models;
    constructor(config: MockOpenAIConfig);
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
     * Handle /v1/models endpoint
     */
    private handleModels;
    /**
     * Handle /v1/chat/completions endpoint
     */
    private handleChatCompletion;
    /**
     * Generate mock completion response with diverse patterns
     */
    private generateMockCompletion;
    /**
     * Generate contextual responses based on business idea types
     */
    private generateContextualResponse;
    private generateSaaSResponse;
    private generateEcommerceResponse;
    private generateServiceResponse;
    private generateProductResponse;
    private generateFoodResponse;
    private generateEvaluationResponse;
    private generateGeneralBusinessResponse;
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
//# sourceMappingURL=mock-openai-service.d.ts.map