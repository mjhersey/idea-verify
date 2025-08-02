/**
 * Credential validation utilities for external services
 */
import { CredentialValidationResult, OpenAICredentials, AnthropicCredentials, AWSCredentials } from '../types/credentials.js';
export declare class CredentialValidator {
    /**
     * Validate OpenAI credentials
     */
    validateOpenAI(credentials: OpenAICredentials): Promise<CredentialValidationResult>;
    /**
     * Validate Anthropic credentials
     */
    validateAnthropic(credentials: AnthropicCredentials): Promise<CredentialValidationResult>;
    /**
     * Validate AWS credentials
     */
    validateAWS(credentials: AWSCredentials): Promise<CredentialValidationResult>;
    /**
     * Validate all credentials
     */
    validateAllCredentials(openai: OpenAICredentials, anthropic: AnthropicCredentials, aws: AWSCredentials): Promise<CredentialValidationResult[]>;
}
//# sourceMappingURL=credential-validator.d.ts.map