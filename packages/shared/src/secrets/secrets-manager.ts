/**
 * AWS Secrets Manager integration for secure credential storage
 */

import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { ExternalServiceCredentials, SecretsManagerConfig } from '../types/credentials.js';

export class SecretsManager {
  private client: SecretsManagerClient;
  private config: SecretsManagerConfig;

  constructor(config: SecretsManagerConfig) {
    this.config = config;
    this.client = new SecretsManagerClient({ 
      region: config.region 
    });
  }

  /**
   * Retrieve credentials from AWS Secrets Manager
   */
  async getCredentials(service: keyof ExternalServiceCredentials): Promise<ExternalServiceCredentials[typeof service]> {
    try {
      const secretName = this.config.secretNames[service];
      const command = new GetSecretValueCommand({
        SecretId: secretName
      });

      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error(`No secret string found for ${service}`);
      }

      return JSON.parse(response.SecretString);
    } catch (error) {
      throw new Error(`Failed to retrieve ${service} credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store credentials in AWS Secrets Manager
   */
  async putCredentials(service: keyof ExternalServiceCredentials, credentials: ExternalServiceCredentials[typeof service]): Promise<void> {
    try {
      const secretName = this.config.secretNames[service];
      const command = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: JSON.stringify(credentials)
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(`Failed to store ${service} credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new secret in AWS Secrets Manager
   */
  async createSecret(service: keyof ExternalServiceCredentials, credentials: ExternalServiceCredentials[typeof service], description?: string): Promise<void> {
    try {
      const secretName = this.config.secretNames[service];
      const command = new CreateSecretCommand({
        Name: secretName,
        SecretString: JSON.stringify(credentials),
        Description: description || `Credentials for ${service} service`
      });

      await this.client.send(command);
    } catch (error) {
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
  async getAllCredentials(): Promise<ExternalServiceCredentials> {
    const [openai, anthropic, aws] = await Promise.all([
      this.getCredentials('openai'),
      this.getCredentials('anthropic'),
      this.getCredentials('aws')
    ]);

    return {
      openai,
      anthropic,
      aws
    };
  }
}