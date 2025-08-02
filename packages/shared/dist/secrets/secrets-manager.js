"use strict";
/**
 * AWS Secrets Manager integration for secure credential storage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsManager = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
class SecretsManager {
    client;
    config;
    constructor(config) {
        this.config = config;
        this.client = new client_secrets_manager_1.SecretsManagerClient({
            region: config.region
        });
    }
    /**
     * Retrieve credentials from AWS Secrets Manager
     */
    async getCredentials(service) {
        try {
            const secretName = this.config.secretNames[service];
            const command = new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: secretName
            });
            const response = await this.client.send(command);
            if (!response.SecretString) {
                throw new Error(`No secret string found for ${service}`);
            }
            return JSON.parse(response.SecretString);
        }
        catch (error) {
            throw new Error(`Failed to retrieve ${service} credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Store credentials in AWS Secrets Manager
     */
    async putCredentials(service, credentials) {
        try {
            const secretName = this.config.secretNames[service];
            const command = new client_secrets_manager_1.PutSecretValueCommand({
                SecretId: secretName,
                SecretString: JSON.stringify(credentials)
            });
            await this.client.send(command);
        }
        catch (error) {
            throw new Error(`Failed to store ${service} credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a new secret in AWS Secrets Manager
     */
    async createSecret(service, credentials, description) {
        try {
            const secretName = this.config.secretNames[service];
            const command = new client_secrets_manager_1.CreateSecretCommand({
                Name: secretName,
                SecretString: JSON.stringify(credentials),
                Description: description || `Credentials for ${service} service`
            });
            await this.client.send(command);
        }
        catch (error) {
            if (error instanceof Error && error.name === 'ResourceExistsException') {
                // Secret already exists, update it instead
                await this.putCredentials(service, credentials);
                return;
            }
            throw new Error(`Failed to create ${service} secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get all credentials at once
     */
    async getAllCredentials() {
        const [openai, anthropic, aws] = await Promise.all([
            this.getCredentials('openai'),
            this.getCredentials('anthropic'),
            this.getCredentials('aws')
        ]);
        return {
            openai: openai,
            anthropic: anthropic,
            aws: aws
        };
    }
}
exports.SecretsManager = SecretsManager;
//# sourceMappingURL=secrets-manager.js.map