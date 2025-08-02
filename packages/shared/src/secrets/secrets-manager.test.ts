/**
 * Tests for SecretsManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecretsManager } from './secrets-manager.js';
import { SecretsManagerConfig } from '../types/credentials.js';

// Mock AWS SDK
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(() => ({
    send: mockSend
  })),
  GetSecretValueCommand: vi.fn(),
  PutSecretValueCommand: vi.fn(),
  CreateSecretCommand: vi.fn()
}));

describe('SecretsManager', () => {
  let secretsManager: SecretsManager;
  let mockConfig: SecretsManagerConfig;

  beforeEach(() => {
    mockConfig = {
      region: 'us-east-1',
      secretNames: {
        openai: 'test/openai',
        anthropic: 'test/anthropic',
        aws: 'test/aws'
      }
    };

    // Reset mocks
    vi.clearAllMocks();
    
    secretsManager = new SecretsManager(mockConfig);
  });

  describe('getCredentials', () => {
    it('should retrieve credentials successfully', async () => {
      const mockCredentials = { apiKey: 'test-key' };
      mockSend.mockResolvedValue({
        SecretString: JSON.stringify(mockCredentials)
      });

      const result = await secretsManager.getCredentials('openai');

      expect(result).toEqual(mockCredentials);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no secret string found', async () => {
      mockSend.mockResolvedValue({});

      await expect(secretsManager.getCredentials('openai'))
        .rejects.toThrow('No secret string found for openai');
    });

    it('should throw error on AWS SDK error', async () => {
      mockSend.mockRejectedValue(new Error('AWS Error'));

      await expect(secretsManager.getCredentials('openai'))
        .rejects.toThrow('Failed to retrieve openai credentials: AWS Error');
    });
  });

  describe('putCredentials', () => {
    it('should store credentials successfully', async () => {
      const credentials = { apiKey: 'new-key' };
      mockSend.mockResolvedValue({});

      await secretsManager.putCredentials('openai', credentials);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw error on AWS SDK error', async () => {
      mockSend.mockRejectedValue(new Error('AWS Error'));

      await expect(secretsManager.putCredentials('openai', {}))
        .rejects.toThrow('Failed to store openai credentials: AWS Error');
    });
  });

  describe('createSecret', () => {
    it('should create secret successfully', async () => {
      const credentials = { apiKey: 'new-key' };
      mockSend.mockResolvedValue({});

      await secretsManager.createSecret('openai', credentials, 'Test secret');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should update existing secret when ResourceExistsException occurs', async () => {
      const credentials = { apiKey: 'new-key' };
      const existsError = new Error('Resource exists');
      existsError.name = 'ResourceExistsException';
      
      mockSend
        .mockRejectedValueOnce(existsError)
        .mockResolvedValueOnce({});

      await secretsManager.createSecret('openai', credentials);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAllCredentials', () => {
    it('should retrieve all credentials successfully', async () => {
      const mockCredentials = {
        openai: { apiKey: 'openai-key' },
        anthropic: { apiKey: 'anthropic-key' },
        aws: { accessKeyId: 'aws-key' }
      };

      mockSend
        .mockResolvedValueOnce({ SecretString: JSON.stringify(mockCredentials.openai) })
        .mockResolvedValueOnce({ SecretString: JSON.stringify(mockCredentials.anthropic) })
        .mockResolvedValueOnce({ SecretString: JSON.stringify(mockCredentials.aws) });

      const result = await secretsManager.getAllCredentials();

      expect(result).toEqual(mockCredentials);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});