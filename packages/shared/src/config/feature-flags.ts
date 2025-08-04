/**
 * Environment-specific Feature Flags
 */

export interface FeatureFlags {
  enableMockServices: boolean;
  enableDetailedLogging: boolean;
  enableMetricsCollection: boolean;
  enableHealthChecks: boolean;
  enableRateLimiting: boolean;
  enableCaching: boolean;
  enableRetryLogic: boolean;
  enableAsyncProcessing: boolean;
  enableExternalApiValidation: boolean;
  enableDatabaseOptimizations: boolean;
}

export class FeatureFlagManager {
  private flags: FeatureFlags;
  private environment: string;

  constructor(environment?: string) {
    this.environment = environment || process.env.NODE_ENV || 'development';
    this.flags = this.getDefaultFlags();
  }

  private getDefaultFlags(): FeatureFlags {
    const isDev = this.environment === 'development' || this.environment === 'dev';
    const isStaging = this.environment === 'staging';
    const isProd = this.environment === 'production' || this.environment === 'prod';

    return {
      enableMockServices: isDev, // Only enable in development
      enableDetailedLogging: !isProd, // Disable in production for performance
      enableMetricsCollection: true, // Always enabled
      enableHealthChecks: true, // Always enabled
      enableRateLimiting: isProd || isStaging, // Only in staging/prod
      enableCaching: true, // Always enabled
      enableRetryLogic: true, // Always enabled
      enableAsyncProcessing: true, // Always enabled
      enableExternalApiValidation: !isDev, // Skip validation in dev (use mocks)
      enableDatabaseOptimizations: isProd || isStaging, // Only in staging/prod
    };
  }

  /**
   * Load feature flags from AWS Parameter Store
   */
  async loadFromParameterStore(): Promise<void> {
    try {
      const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm');
      const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

      const parameterNames = [
        `/ai-validation/${this.environment}/features/enable-mock-services`,
        `/ai-validation/${this.environment}/features/enable-detailed-logging`,
        `/ai-validation/${this.environment}/features/enable-metrics-collection`,
        `/ai-validation/${this.environment}/features/enable-health-checks`,
        `/ai-validation/${this.environment}/features/enable-rate-limiting`,
      ];

      const command = new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: false,
      });

      const response = await command.send(client);
      
      if (response.Parameters) {
        for (const param of response.Parameters) {
          if (param.Name && param.Value) {
            this.updateFlagFromParameter(param.Name, param.Value);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load feature flags from Parameter Store, using defaults:', error);
    }
  }

  private updateFlagFromParameter(paramName: string, value: string): void {
    const boolValue = value.toLowerCase() === 'true';
    
    if (paramName.includes('enable-mock-services')) {
      this.flags.enableMockServices = boolValue;
    } else if (paramName.includes('enable-detailed-logging')) {
      this.flags.enableDetailedLogging = boolValue;
    } else if (paramName.includes('enable-metrics-collection')) {
      this.flags.enableMetricsCollection = boolValue;
    } else if (paramName.includes('enable-health-checks')) {
      this.flags.enableHealthChecks = boolValue;
    } else if (paramName.includes('enable-rate-limiting')) {
      this.flags.enableRateLimiting = boolValue;
    }
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Override a feature flag (for testing)
   */
  override(feature: keyof FeatureFlags, value: boolean): void {
    this.flags[feature] = value;
  }

  /**
   * Reset to default flags
   */
  reset(): void {
    this.flags = this.getDefaultFlags();
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig() {
    return {
      environment: this.environment,
      flags: this.flags,
      isDevelopment: this.environment === 'development' || this.environment === 'dev',
      isStaging: this.environment === 'staging',
      isProduction: this.environment === 'production' || this.environment === 'prod',
    };
  }
}

// Global feature flag manager instance
let globalFeatureFlagManager: FeatureFlagManager | null = null;

/**
 * Get the global feature flag manager instance
 */
export function getFeatureFlags(): FeatureFlagManager {
  if (!globalFeatureFlagManager) {
    globalFeatureFlagManager = new FeatureFlagManager();
  }
  return globalFeatureFlagManager;
}

/**
 * Initialize feature flags from Parameter Store
 */
export async function initializeFeatureFlags(environment?: string): Promise<FeatureFlagManager> {
  globalFeatureFlagManager = new FeatureFlagManager(environment);
  await globalFeatureFlagManager.loadFromParameterStore();
  return globalFeatureFlagManager;
}

/**
 * Convenience functions for common feature checks
 */
export const FeatureFlag = {
  useMockServices: (): boolean => getFeatureFlags().isEnabled('enableMockServices'),
  useDetailedLogging: (): boolean => getFeatureFlags().isEnabled('enableDetailedLogging'),
  collectMetrics: (): boolean => getFeatureFlags().isEnabled('enableMetricsCollection'),
  enableHealthChecks: (): boolean => getFeatureFlags().isEnabled('enableHealthChecks'),
  enableRateLimiting: (): boolean => getFeatureFlags().isEnabled('enableRateLimiting'),
  enableCaching: (): boolean => getFeatureFlags().isEnabled('enableCaching'),
  useRetryLogic: (): boolean => getFeatureFlags().isEnabled('enableRetryLogic'),
  useAsyncProcessing: (): boolean => getFeatureFlags().isEnabled('enableAsyncProcessing'),
  validateExternalApis: (): boolean => getFeatureFlags().isEnabled('enableExternalApiValidation'),
  optimizeDatabase: (): boolean => getFeatureFlags().isEnabled('enableDatabaseOptimizations'),
} as const;

export default FeatureFlagManager;