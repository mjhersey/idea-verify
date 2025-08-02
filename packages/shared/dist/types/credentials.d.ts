/**
 * Type definitions for credential management
 */
export interface ExternalServiceCredentials {
    openai: OpenAICredentials;
    anthropic: AnthropicCredentials;
    aws: AWSCredentials;
}
export interface OpenAICredentials {
    apiKey: string;
    organizationId?: string;
    projectId?: string;
}
export interface AnthropicCredentials {
    apiKey: string;
}
export interface AWSCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
}
export interface CredentialValidationResult {
    service: string;
    valid: boolean;
    error?: string;
    details?: {
        accountInfo?: any;
        rateLimit?: {
            remaining: number;
            resetTime: Date;
        };
    };
}
export interface SecretsManagerConfig {
    region: string;
    secretNames: {
        openai: string;
        anthropic: string;
        aws: string;
    };
}
export interface CredentialRotationConfig {
    enabled: boolean;
    schedule: string;
    notificationEmail?: string;
    gracePeriodDays: number;
}
//# sourceMappingURL=credentials.d.ts.map