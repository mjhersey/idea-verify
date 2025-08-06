import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as autoscaling from 'aws-cdk-lib/aws-applicationautoscaling'
import { Construct } from 'constructs'
import { AiValidationPlatformStack } from './ai-validation-platform-stack'

export interface EcsStackProps extends cdk.StackProps {
  environment: string
  infrastructureStack: AiValidationPlatformStack
  imageTag?: string // Default to 'latest' if not provided
}

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer
  public readonly apiService: ecs.FargateService
  public readonly orchestratorService: ecs.FargateService
  public readonly webService: ecs.FargateService

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props)

    const { environment, infrastructureStack, imageTag = 'latest' } = props
    const { vpc, database, redisCluster, reportsBucket, assetsBucket } = infrastructureStack

    // Get image tag from context or use provided imageTag
    const deployImageTag = this.node.tryGetContext('imageTag') || imageTag

    // ECR repositories for container images
    const apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: `ai-validation-api-${environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    })

    const orchestratorRepository = new ecr.Repository(this, 'OrchestratorRepository', {
      repositoryName: `ai-validation-orchestrator-${environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    })

    const webRepository = new ecr.Repository(this, 'WebRepository', {
      repositoryName: `ai-validation-web-${environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    })

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'AiValidationCluster', {
      vpc,
      clusterName: `ai-validation-${environment}`,
      containerInsights: environment !== 'dev',
    })

    // Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
      vpc,
      internetFacing: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    })

    // CloudWatch Log Groups
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/ai-validation-api-${environment}`,
      retention:
        environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    const orchestratorLogGroup = new logs.LogGroup(this, 'OrchestratorLogGroup', {
      logGroupName: `/ecs/ai-validation-orchestrator-${environment}`,
      retention:
        environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    const webLogGroup = new logs.LogGroup(this, 'WebLogGroup', {
      logGroupName: `/ecs/ai-validation-web-${environment}`,
      retention:
        environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    // Task Execution Role (for pulling images and writing logs)
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    })

    // Grant ECR access to task execution role
    apiRepository.grantPull(taskExecutionRole)
    orchestratorRepository.grantPull(taskExecutionRole)
    webRepository.grantPull(taskExecutionRole)

    // API Task Definition
    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
      family: `ai-validation-api-${environment}`,
      cpu: environment === 'dev' ? 256 : 512,
      memoryLimitMiB: environment === 'dev' ? 512 : 1024,
      executionRole: taskExecutionRole,
      taskRole: infrastructureStack.applicationRole,
    })

    const apiContainer = apiTaskDefinition.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepository, deployImageTag),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_URL: `postgresql://aivalidation:password@${database.instanceEndpoint.hostname}:${database.instanceEndpoint.port}/aivalidation`,
        REDIS_URL: `redis://${redisCluster.attrRedisEndpointAddress}:6379`,
        REPORTS_BUCKET: reportsBucket.bucketName,
        ASSETS_BUCKET: assetsBucket.bucketName,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      healthCheck: {
        command: [
          'CMD-SHELL',
          'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    })

    apiContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    })

    // Orchestrator Task Definition
    const orchestratorTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      'OrchestratorTaskDefinition',
      {
        family: `ai-validation-orchestrator-${environment}`,
        cpu: environment === 'dev' ? 256 : 512,
        memoryLimitMiB: environment === 'dev' ? 512 : 1024,
        executionRole: taskExecutionRole,
        taskRole: infrastructureStack.applicationRole,
      }
    )

    const orchestratorContainer = orchestratorTaskDefinition.addContainer('OrchestratorContainer', {
      image: ecs.ContainerImage.fromEcrRepository(orchestratorRepository, deployImageTag),
      environment: {
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: `postgresql://aivalidation:password@${database.instanceEndpoint.hostname}:${database.instanceEndpoint.port}/aivalidation`,
        REDIS_URL: `redis://${redisCluster.attrRedisEndpointAddress}:6379`,
        REPORTS_BUCKET: reportsBucket.bucketName,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'orchestrator',
        logGroup: orchestratorLogGroup,
      }),
      healthCheck: {
        command: [
          'CMD-SHELL',
          'wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    })

    orchestratorContainer.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    })

    // Web Task Definition
    const webTaskDefinition = new ecs.FargateTaskDefinition(this, 'WebTaskDefinition', {
      family: `ai-validation-web-${environment}`,
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
    })

    const webContainer = webTaskDefinition.addContainer('WebContainer', {
      image: ecs.ContainerImage.fromEcrRepository(webRepository, deployImageTag),
      environment: {
        NODE_ENV: 'production',
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web',
        logGroup: webLogGroup,
      }),
      healthCheck: {
        command: [
          'CMD-SHELL',
          'wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    })

    webContainer.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    })

    // ECS Services
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.cluster,
      taskDefinition: apiTaskDefinition,
      serviceName: `ai-validation-api-${environment}`,
      desiredCount: environment === 'dev' ? 1 : 2,
      minHealthyPercent: environment === 'dev' ? 0 : 50,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    })

    this.orchestratorService = new ecs.FargateService(this, 'OrchestratorService', {
      cluster: this.cluster,
      taskDefinition: orchestratorTaskDefinition,
      serviceName: `ai-validation-orchestrator-${environment}`,
      desiredCount: environment === 'dev' ? 1 : 2,
      minHealthyPercent: environment === 'dev' ? 0 : 50,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    })

    this.webService = new ecs.FargateService(this, 'WebService', {
      cluster: this.cluster,
      taskDefinition: webTaskDefinition,
      serviceName: `ai-validation-web-${environment}`,
      desiredCount: environment === 'dev' ? 1 : 2,
      minHealthyPercent: environment === 'dev' ? 0 : 50,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    })

    // Load Balancer Target Groups
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    const webTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WebTargetGroup', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    // Register services with target groups
    this.apiService.attachToApplicationTargetGroup(apiTargetGroup)
    this.webService.attachToApplicationTargetGroup(webTargetGroup)

    // Load Balancer Listeners
    const listener = this.loadBalancer.addListener('PublicListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([webTargetGroup]),
    })

    // Route API traffic to API service
    listener.addAction('ApiRoute', {
      priority: 100,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*'])],
      action: elbv2.ListenerAction.forward([apiTargetGroup]),
    })

    // Auto Scaling for production
    if (environment === 'prod') {
      // API Service Auto Scaling
      const apiScaling = this.apiService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      })

      apiScaling.scaleOnCpuUtilization('ApiCpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.minutes(5),
        scaleOutCooldown: cdk.Duration.minutes(2),
      })

      apiScaling.scaleOnMemoryUtilization('ApiMemoryScaling', {
        targetUtilizationPercent: 80,
        scaleInCooldown: cdk.Duration.minutes(5),
        scaleOutCooldown: cdk.Duration.minutes(2),
      })

      // Orchestrator Service Auto Scaling
      const orchestratorScaling = this.orchestratorService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 5,
      })

      orchestratorScaling.scaleOnCpuUtilization('OrchestratorCpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.minutes(5),
        scaleOutCooldown: cdk.Duration.minutes(2),
      })

      // Web Service Auto Scaling
      const webScaling = this.webService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 8,
      })

      webScaling.scaleOnCpuUtilization('WebCpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.minutes(5),
        scaleOutCooldown: cdk.Duration.minutes(2),
      })
    }

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
      exportName: `${this.stackName}-LoadBalancerDNS`,
    })

    new cdk.CfnOutput(this, 'ApiRepositoryUri', {
      value: apiRepository.repositoryUri,
      description: 'API ECR repository URI',
      exportName: `${this.stackName}-ApiRepositoryUri`,
    })

    new cdk.CfnOutput(this, 'OrchestratorRepositoryUri', {
      value: orchestratorRepository.repositoryUri,
      description: 'Orchestrator ECR repository URI',
      exportName: `${this.stackName}-OrchestratorRepositoryUri`,
    })

    new cdk.CfnOutput(this, 'WebRepositoryUri', {
      value: webRepository.repositoryUri,
      description: 'Web ECR repository URI',
      exportName: `${this.stackName}-WebRepositoryUri`,
    })

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS cluster name',
      exportName: `${this.stackName}-ClusterName`,
    })
  }
}
