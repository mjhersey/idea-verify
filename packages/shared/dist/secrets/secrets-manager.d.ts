/**
 * AWS Secrets Manager integration for secure credential storage
 */
import { ExternalServiceCredentials, SecretsManagerConfig } from '../types/credentials.js';
export declare class SecretsManager {
    private client;
    private config;
    constructor(config: SecretsManagerConfig);
    /**
     * Retrieve credentials from AWS Secrets Manager
     */
    getCredentials(service: keyof ExternalServiceCredentials): Promise<any>;
    /**
     * Store credentials in AWS Secrets Manager
     */
    putCredentials(service: keyof ExternalServiceCredentials, credentials: any): Promise<void>;
    /**
     * Create a new secret in AWS Secrets Manager
     */
    createSecret(service: keyof ExternalServiceCredentials, credentials: any, description?: string): Promise<void>;
    /**
     * Get all credentials at once
     */
    getAllCredentials(): Promise<ExternalServiceCredentials>;
}
//# sourceMappingURL=secrets-manager.d.ts.map