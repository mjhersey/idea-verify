/**
 * Environment configuration and variable management
 */
import { SecretsManagerConfig } from '../types/credentials.js';
export interface EnvironmentConfig {
    nodeEnv: string;
    port: number;
    aws: {
        region: string;
        profile?: string;
    };
    secretsManager: SecretsManagerConfig;
    development: {
        useMockServices: boolean;
        mockDataPath?: string;
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