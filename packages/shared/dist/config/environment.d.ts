/**
 * Environment configuration and variable management
 */
import { SecretsManagerConfig } from '../types/credentials.js';
export interface EnvironmentConfig {
    nodeEnv: string;
    port: number;
    frontendUrl?: string;
    aws: {
        region: string;
        profile?: string;
    };
    secretsManager: SecretsManagerConfig;
    database?: {
        url: string;
        maxConnections?: number;
        connectionTimeoutMs?: number;
        poolTimeoutMs?: number;
    };
    development: {
        useMockServices: boolean;
        mockDataPath?: string;
    };
    redis?: {
        host: string;
        port: number;
        password?: string;
        maxRetriesPerRequest?: number;
    };
    orchestrator?: {
        maxConcurrentEvaluations: number;
        defaultTimeout: number;
        retryAttempts: number;
    };
}
/**
 * Get environment configuration with validation
 */
export declare function getEnvironmentConfig(): EnvironmentConfig;
/**
 * Generate environment variable template
 */
export declare function generateEnvTemplate(): string;
//# sourceMappingURL=environment.d.ts.map