/**
 * Credential validation utilities for external services
 */

import {
  CredentialValidationResult,
  OpenAICredentials,
  AnthropicCredentials,
  AWSCredentials,
} from '../types/credentials.js'

export class CredentialValidator {
  /**
   * Validate OpenAI credentials
   */
  async validateOpenAI(credentials: OpenAICredentials): Promise<CredentialValidationResult> {
    try {
      // Mock validation for development - in production this would make actual API calls
      if (process.env.USE_MOCK_SERVICES === 'true') {
        return {
          service: 'openai',
          valid: credentials.apiKey.startsWith('sk-'),
          details: {
            accountInfo: { type: 'individual', tier: 'tier-1' },
            rateLimit: { remaining: 1000, resetTime: new Date(Date.now() + 3600000) },
          },
        }
      }

      // Real validation would make API call here
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          'User-Agent': 'AI-Validation-Platform/1.0',
        },
      })

      if (!response.ok) {
        return {
          service: 'openai',
          valid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return {
        service: 'openai',
        valid: true,
        details: {
          rateLimit: {
            remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
            resetTime: new Date(
              parseInt(response.headers.get('x-ratelimit-reset-time') || '0') * 1000
            ),
          },
        },
      }
    } catch (error) {
      return {
        service: 'openai',
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Validate Anthropic credentials
   */
  async validateAnthropic(credentials: AnthropicCredentials): Promise<CredentialValidationResult> {
    try {
      // Mock validation for development
      if (process.env.USE_MOCK_SERVICES === 'true') {
        return {
          service: 'anthropic',
          valid: credentials.apiKey.startsWith('sk-ant-'),
          details: {
            accountInfo: { type: 'individual' },
            rateLimit: { remaining: 500, resetTime: new Date(Date.now() + 3600000) },
          },
        }
      }

      // Real validation would make API call here
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': credentials.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      })

      return {
        service: 'anthropic',
        valid: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
    } catch (error) {
      return {
        service: 'anthropic',
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Validate AWS credentials
   */
  async validateAWS(credentials: AWSCredentials): Promise<CredentialValidationResult> {
    try {
      // Mock validation for development
      if (process.env.USE_MOCK_SERVICES === 'true') {
        return {
          service: 'aws',
          valid: credentials.accessKeyId.length > 0 && credentials.secretAccessKey.length > 0,
          details: {
            accountInfo: { accountId: '123456789012', region: credentials.region },
          },
        }
      }

      // Real validation would use AWS SDK here
      // This is a simplified example - in production you'd use STS GetCallerIdentity
      return {
        service: 'aws',
        valid: true,
        details: {
          accountInfo: { region: credentials.region },
        },
      }
    } catch (error) {
      return {
        service: 'aws',
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Validate all credentials
   */
  async validateAllCredentials(
    openai: OpenAICredentials,
    anthropic: AnthropicCredentials,
    aws: AWSCredentials
  ): Promise<CredentialValidationResult[]> {
    const results = await Promise.all([
      this.validateOpenAI(openai),
      this.validateAnthropic(anthropic),
      this.validateAWS(aws),
    ])

    return results
  }
}
