import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ParameterStoreStackProps extends cdk.StackProps {
  environment: string;
}

export class ParameterStoreStack extends cdk.Stack {
  public readonly parameters: Record<string, ssm.StringParameter>;
  public readonly secrets: Record<string, secretsmanager.Secret>;

  constructor(scope: Construct, id: string, props: ParameterStoreStackProps) {
    super(scope, id, props);

    const { environment } = props;

    this.parameters = {};
    this.secrets = {};

    // Environment-specific configuration parameters
    this.createEnvironmentParameters(environment);
    
    // Environment-specific secrets
    this.createEnvironmentSecrets(environment);

    // Feature flags
    this.createFeatureFlags(environment);

    // Application configuration
    this.createApplicationConfig(environment);
  }

  private createEnvironmentParameters(environment: string): void {
    // Database configuration
    this.parameters.dbName = new ssm.StringParameter(this, 'DbName', {
      parameterName: `/ai-validation/${environment}/database/name`,
      stringValue: `ai_validation_${environment}`,
      description: `Database name for ${environment} environment`,
    });

    this.parameters.dbPort = new ssm.StringParameter(this, 'DbPort', {
      parameterName: `/ai-validation/${environment}/database/port`,
      stringValue: '5432',
      description: `Database port for ${environment} environment`,
    });

    // Redis configuration
    this.parameters.redisPort = new ssm.StringParameter(this, 'RedisPort', {
      parameterName: `/ai-validation/${environment}/redis/port`,
      stringValue: '6379',
      description: `Redis port for ${environment} environment`,
    });

    // Application configuration
    this.parameters.nodeEnv = new ssm.StringParameter(this, 'NodeEnv', {
      parameterName: `/ai-validation/${environment}/app/node-env`,
      stringValue: environment === 'prod' ? 'production' : environment,
      description: `Node environment for ${environment}`,
    });

    this.parameters.logLevel = new ssm.StringParameter(this, 'LogLevel', {
      parameterName: `/ai-validation/${environment}/app/log-level`,
      stringValue: environment === 'prod' ? 'warn' : 'info',
      description: `Log level for ${environment} environment`,
    });

    // API Gateway configuration
    this.parameters.apiCorsOrigins = new ssm.StringParameter(this, 'ApiCorsOrigins', {
      parameterName: `/ai-validation/${environment}/api/cors-origins`,
      stringValue: this.getCorsOrigins(environment),
      description: `CORS origins for ${environment} environment`,
    });

    // Rate limiting configuration
    this.parameters.rateLimitWindow = new ssm.StringParameter(this, 'RateLimitWindow', {
      parameterName: `/ai-validation/${environment}/api/rate-limit-window`,
      stringValue: environment === 'prod' ? '900000' : '60000', // 15min prod, 1min dev
      description: `Rate limit window for ${environment} environment`,
    });

    this.parameters.rateLimitMax = new ssm.StringParameter(this, 'RateLimitMax', {
      parameterName: `/ai-validation/${environment}/api/rate-limit-max`,
      stringValue: environment === 'prod' ? '100' : '1000',
      description: `Rate limit max requests for ${environment} environment`,
    });
  }

  private createEnvironmentSecrets(environment: string): void {
    // JWT secrets
    this.secrets.jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `/ai-validation/${environment}/jwt/secret`,
      description: `JWT secret for ${environment} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ algorithm: 'HS256' }),
        generateStringKey: 'secret',
        excludeCharacters: '"@/\\',
        passwordLength: 64,
      },
    });

    this.secrets.jwtRefreshSecret = new secretsmanager.Secret(this, 'JwtRefreshSecret', {
      secretName: `/ai-validation/${environment}/jwt/refresh-secret`,
      description: `JWT refresh secret for ${environment} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ algorithm: 'HS256' }),
        generateStringKey: 'secret',
        excludeCharacters: '"@/\\',
        passwordLength: 64,
      },
    });

    // External API secrets (placeholders - to be populated manually)
    this.secrets.openaiApiKey = new secretsmanager.Secret(this, 'OpenaiApiKey', {
      secretName: `/ai-validation/${environment}/external/openai-api-key`,
      description: `OpenAI API key for ${environment} environment`,
      secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_CHANGE_ME'),
    });

    this.secrets.anthropicApiKey = new secretsmanager.Secret(this, 'AnthropicApiKey', {
      secretName: `/ai-validation/${environment}/external/anthropic-api-key`,
      description: `Anthropic API key for ${environment} environment`,
      secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_CHANGE_ME'),
    });

    // Session secret
    this.secrets.sessionSecret = new secretsmanager.Secret(this, 'SessionSecret', {
      secretName: `/ai-validation/${environment}/session/secret`,
      description: `Session secret for ${environment} environment`,
      generateSecretString: {
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });
  }

  private createFeatureFlags(environment: string): void {
    // Feature flags for environment-specific functionality
    this.parameters.enableMockServices = new ssm.StringParameter(this, 'EnableMockServices', {
      parameterName: `/ai-validation/${environment}/features/enable-mock-services`,
      stringValue: environment === 'dev' ? 'true' : 'false',
      description: `Enable mock services for ${environment} environment`,
    });

    this.parameters.enableDetailedLogging = new ssm.StringParameter(this, 'EnableDetailedLogging', {
      parameterName: `/ai-validation/${environment}/features/enable-detailed-logging`,
      stringValue: environment !== 'prod' ? 'true' : 'false',
      description: `Enable detailed logging for ${environment} environment`,
    });

    this.parameters.enableMetricsCollection = new ssm.StringParameter(this, 'EnableMetricsCollection', {
      parameterName: `/ai-validation/${environment}/features/enable-metrics-collection`,
      stringValue: 'true',
      description: `Enable metrics collection for ${environment} environment`,
    });

    this.parameters.enableHealthChecks = new ssm.StringParameter(this, 'EnableHealthChecks', {
      parameterName: `/ai-validation/${environment}/features/enable-health-checks`,
      stringValue: 'true',
      description: `Enable health checks for ${environment} environment`,
    });

    this.parameters.enableRateLimiting = new ssm.StringParameter(this, 'EnableRateLimiting', {
      parameterName: `/ai-validation/${environment}/features/enable-rate-limiting`,
      stringValue: environment === 'prod' ? 'true' : 'false',
      description: `Enable rate limiting for ${environment} environment`,
    });
  }

  private createApplicationConfig(environment: string): void {
    // Application-specific configuration
    this.parameters.maxEvaluationTime = new ssm.StringParameter(this, 'MaxEvaluationTime', {
      parameterName: `/ai-validation/${environment}/app/max-evaluation-time`,
      stringValue: environment === 'prod' ? '600000' : '300000', // 10min prod, 5min dev
      description: `Maximum evaluation time for ${environment} environment`,
    });

    this.parameters.maxConcurrentEvaluations = new ssm.StringParameter(this, 'MaxConcurrentEvaluations', {
      parameterName: `/ai-validation/${environment}/app/max-concurrent-evaluations`,
      stringValue: environment === 'prod' ? '10' : '3',
      description: `Maximum concurrent evaluations for ${environment} environment`,
    });

    this.parameters.evaluationRetryAttempts = new ssm.StringParameter(this, 'EvaluationRetryAttempts', {
      parameterName: `/ai-validation/${environment}/app/evaluation-retry-attempts`,
      stringValue: environment === 'prod' ? '3' : '1',
      description: `Evaluation retry attempts for ${environment} environment`,
    });

    // External service timeouts
    this.parameters.externalApiTimeout = new ssm.StringParameter(this, 'ExternalApiTimeout', {
      parameterName: `/ai-validation/${environment}/external/api-timeout`,
      stringValue: environment === 'prod' ? '30000' : '10000', // 30s prod, 10s dev
      description: `External API timeout for ${environment} environment`,
    });

    // File upload configuration
    this.parameters.maxFileSize = new ssm.StringParameter(this, 'MaxFileSize', {
      parameterName: `/ai-validation/${environment}/upload/max-file-size`,
      stringValue: environment === 'prod' ? '10485760' : '5242880', // 10MB prod, 5MB dev
      description: `Maximum file size for uploads in ${environment} environment`,
    });
  }

  private getCorsOrigins(environment: string): string {
    switch (environment) {
      case 'prod':
        return 'https://aivalidation.com,https://www.aivalidation.com';
      case 'staging':
        return 'https://staging.aivalidation.com,https://localhost:3000';
      case 'dev':
      default:
        return 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000';
    }
  }
}

export default ParameterStoreStack;