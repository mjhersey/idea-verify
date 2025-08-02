/**
 * Mock Service Manager
 * Manages all mock services for local development
 */
export interface MockServicesConfig {
    openai: {
        port: number;
        rateLimits?: {
            requestsPerMinute: number;
            tokensPerMinute: number;
        };
    };
    anthropic: {
        port: number;
        rateLimits?: {
            requestsPerMinute: number;
            tokensPerMinute: number;
        };
    };
    localstack: {
        endpoint: string;
        services: string[];
    };
}
export declare class MockServiceManager {
    private openaiService;
    private anthropicService;
    private config;
    private isRunning;
    constructor(config: MockServicesConfig);
    /**
     * Start all mock services
     */
    startAll(): Promise<void>;
    /**
     * Stop all mock services
     */
    stopAll(): Promise<void>;
    /**
     * Get service status
     */
    getStatus(): {
        isRunning: boolean;
        services: {
            openai: {
                port: number;
                url: string;
                healthCheck: string;
            };
            anthropic: {
                port: number;
                url: string;
                healthCheck: string;
            };
            localstack: {
                endpoint: string;
                services: string[];
            };
        };
    };
    /**
     * Validate all mock services are responding
     */
    validateServices(): Promise<boolean>;
}
//# sourceMappingURL=mock-service-manager.d.ts.map