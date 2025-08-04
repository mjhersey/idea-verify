#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiValidationPlatformStack } from '../lib/ai-validation-platform-stack';
import { EcsStack } from '../lib/ecs-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { ParameterStoreStack } from '../lib/parameter-store-stack';
import { SecurityStack } from '../lib/security-stack';
import { CostOptimizationStack } from '../lib/cost-optimization-stack';
import { createStandardTags, DEFAULT_STACK_PROPS } from '../lib/common/base-stack-props';

const app = new cdk.App();

// Environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Development environment parameter store stack
const devParameterStack = new ParameterStoreStack(app, 'AiValidationParametersDev', {
  env: { account, region },
  environment: 'dev',
  projectName: DEFAULT_STACK_PROPS.projectName,
  tags: createStandardTags({ environment: 'dev' })
});

// Development environment infrastructure stack
const devInfraStack = new AiValidationPlatformStack(app, 'AiValidationPlatformDev', {
  env: { account, region },
  environment: 'dev',
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'dev',
    Owner: 'DevTeam'
  }
});

devInfraStack.addDependency(devParameterStack);

// Development environment ECS stack
const devEcsStack = new EcsStack(app, 'AiValidationEcsDev', {
  env: { account, region },
  environment: 'dev',
  infrastructureStack: devInfraStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'dev',
    Owner: 'DevTeam'
  }
});

// Development environment monitoring stack
const devMonitoringStack = new MonitoringStack(app, 'AiValidationMonitoringDev', {
  env: { account, region },
  environment: 'dev',
  ecsStack: devEcsStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'dev',
    Owner: 'DevTeam'
  }
});

// Development environment security stack
new SecurityStack(app, 'AiValidationSecurityDev', {
  env: { account, region },
  environment: 'dev',
  infrastructureStack: devInfraStack,
  ecsStack: devEcsStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'dev',
    Owner: 'DevTeam'
  }
});

// Development environment cost optimization stack
new CostOptimizationStack(app, 'AiValidationCostOptimizationDev', {
  env: { account, region },
  environment: 'dev',
  ecsCluster: devEcsStack.cluster,
  ecsServices: {
    api: devEcsStack.apiService,
    orchestrator: devEcsStack.orchestratorService,
    web: devEcsStack.webService,
  },
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'dev',
    Owner: 'DevTeam'
  }
});

// Staging environment parameter store stack
const stagingParameterStack = new ParameterStoreStack(app, 'AiValidationParametersStaging', {
  env: { account, region },
  environment: 'staging',
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'staging',
    Owner: 'DevTeam'
  }
});

// Staging environment infrastructure stack (for future use)
const stagingInfraStack = new AiValidationPlatformStack(app, 'AiValidationPlatformStaging', {
  env: { account, region },
  environment: 'staging',
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'staging',
    Owner: 'DevTeam'
  }
});

stagingInfraStack.addDependency(stagingParameterStack);

// Staging environment ECS stack
const stagingEcsStack = new EcsStack(app, 'AiValidationEcsStaging', {
  env: { account, region },
  environment: 'staging',
  infrastructureStack: stagingInfraStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'staging',
    Owner: 'DevTeam'
  }
});

// Staging environment security stack
new SecurityStack(app, 'AiValidationSecurityStaging', {
  env: { account, region },
  environment: 'staging',
  infrastructureStack: stagingInfraStack,
  ecsStack: stagingEcsStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'staging',
    Owner: 'DevTeam'
  }
});

// Staging environment cost optimization stack
new CostOptimizationStack(app, 'AiValidationCostOptimizationStaging', {
  env: { account, region },
  environment: 'staging',
  ecsCluster: stagingEcsStack.cluster,
  ecsServices: {
    api: stagingEcsStack.apiService,
    orchestrator: stagingEcsStack.orchestratorService,
    web: stagingEcsStack.webService,
  },
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'staging',
    Owner: 'DevTeam'
  }
});

// Production environment parameter store stack
const prodParameterStack = new ParameterStoreStack(app, 'AiValidationParametersProd', {
  env: { account, region },
  environment: 'prod',
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'prod',
    Owner: 'DevTeam'
  }
});

// Production environment infrastructure stack (for future use)
const prodInfraStack = new AiValidationPlatformStack(app, 'AiValidationPlatformProd', {
  env: { account, region },
  environment: 'prod',
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'prod',
    Owner: 'DevTeam'
  }
});

prodInfraStack.addDependency(prodParameterStack);

// Production environment ECS stack
const prodEcsStack = new EcsStack(app, 'AiValidationEcsProd', {
  env: { account, region },
  environment: 'prod',
  infrastructureStack: prodInfraStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'prod',
    Owner: 'DevTeam'
  }
});

// Production environment security stack
new SecurityStack(app, 'AiValidationSecurityProd', {
  env: { account, region },
  environment: 'prod',
  infrastructureStack: prodInfraStack,
  ecsStack: prodEcsStack,
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'prod',
    Owner: 'DevTeam'
  }
});

// Production environment cost optimization stack
new CostOptimizationStack(app, 'AiValidationCostOptimizationProd', {
  env: { account, region },
  environment: 'prod',
  ecsCluster: prodEcsStack.cluster,
  ecsServices: {
    api: prodEcsStack.apiService,
    orchestrator: prodEcsStack.orchestratorService,
    web: prodEcsStack.webService,
  },
  tags: {
    Project: 'AI-Validation-Platform',
    Environment: 'prod',
    Owner: 'DevTeam'
  }
});