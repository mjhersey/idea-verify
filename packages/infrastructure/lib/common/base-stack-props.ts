import * as cdk from 'aws-cdk-lib';

/**
 * Common properties for all AI Validation Platform stacks
 */
export interface BaseStackProps extends cdk.StackProps {
  environment: string;
  projectName?: string;
  costCenter?: string;
  owner?: string;
}

/**
 * Default values for base stack properties
 */
export const DEFAULT_STACK_PROPS = {
  projectName: 'AI-Validation-Platform',
  costCenter: 'Engineering',
  owner: 'DevTeam',
};

/**
 * Utility function to create standardized tags
 */
export function createStandardTags(props: BaseStackProps): Record<string, string> {
  const {
    environment,
    projectName = DEFAULT_STACK_PROPS.projectName,
    costCenter = DEFAULT_STACK_PROPS.costCenter,
    owner = DEFAULT_STACK_PROPS.owner,
  } = props;

  return {
    Project: projectName,
    Environment: environment,
    CostCenter: costCenter,
    Owner: owner,
    ManagedBy: 'CDK',
    CreatedDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };
}

/**
 * Utility function to create standardized resource names
 */
export function createResourceName(
  resourceType: string,
  environment: string,
  projectName: string = DEFAULT_STACK_PROPS.projectName
): string {
  const normalizedProject = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${normalizedProject}-${resourceType}-${environment}`;
}

/**
 * Utility function to create standardized stack names
 */
export function createStackName(
  stackType: string,
  environment: string,
  projectName: string = DEFAULT_STACK_PROPS.projectName
): string {
  const capitalizedEnv = environment.charAt(0).toUpperCase() + environment.slice(1);
  return `${projectName}${stackType}${capitalizedEnv}`;
}

/**
 * Utility function to get environment-specific configurations
 */
export function getEnvironmentConfig(environment: string) {
  const configs = {
    dev: {
      instanceSize: 'small',
      minCapacity: 1,
      maxCapacity: 2,
      enableDetailedMonitoring: false,
      backupRetentionDays: 7,
      logRetentionDays: 7,
      enablePerformanceInsights: false,
    },
    staging: {
      instanceSize: 'small',
      minCapacity: 1,
      maxCapacity: 4,
      enableDetailedMonitoring: true,
      backupRetentionDays: 14,
      logRetentionDays: 30,
      enablePerformanceInsights: true,
    },
    prod: {
      instanceSize: 'medium',
      minCapacity: 2,
      maxCapacity: 10,
      enableDetailedMonitoring: true,
      backupRetentionDays: 30,
      logRetentionDays: 90,
      enablePerformanceInsights: true,
    },
  };

  return configs[environment as keyof typeof configs] || configs.dev;
}