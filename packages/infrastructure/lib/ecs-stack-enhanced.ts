import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as autoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';
import { AiValidationPlatformStack } from './ai-validation-platform-stack';

export interface EcsStackEnhancedProps extends cdk.StackProps {
  environment: string;
  infrastructureStack: AiValidationPlatformStack;
  domainName?: string; // e.g., 'aivalidation.com'
  hostedZoneId?: string; // Route53 hosted zone ID
}

export class EcsStackEnhanced extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly apiService: ecs.FargateService;
  public readonly orchestratorService: ecs.FargateService;
  public readonly webService: ecs.FargateService;
  public readonly certificate?: acm.Certificate;

  constructor(scope: Construct, id: string, props: EcsStackEnhancedProps) {
    super(scope, id, props);

    const { environment, infrastructureStack, domainName, hostedZoneId } = props;
    const { vpc, database, redisCluster, reportsBucket, assetsBucket } = infrastructureStack;

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'AiValidationCluster', {
      vpc,
      clusterName: `ai-validation-${environment}`,
      containerInsights: environment !== 'dev',
    });

    // Create or import SSL certificate
    if (domainName && hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: environment === 'prod' ? domainName : `${environment}.${domainName}`,
        subjectAlternativeNames: [
          environment === 'prod' ? `www.${domainName}` : `www.${environment}.${domainName}`,
          environment === 'prod' ? `api.${domainName}` : `api.${environment}.${domainName}`,
        ],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // Create Application Load Balancer with security enhancements
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
      vpc,
      internetFacing: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      loadBalancerName: `ai-validation-alb-${environment}`,
      dropInvalidHeaderFields: true, // Security: Drop invalid headers
      desyncMitigationMode: elbv2.DesyncMitigationMode.STRICTEST, // Security: Strictest desync mitigation
    });

    // Enable access logs for ALB
    if (environment === 'prod') {
      const albLogBucket = new cdk.aws_s3.Bucket(this, 'ALBLogBucket', {
        bucketName: `ai-validation-alb-logs-${environment}-${this.account}-${this.region}`,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        lifecycleRules: [
          {
            id: 'DeleteOldLogs',
            enabled: true,
            expiration: cdk.Duration.days(30),
          },
        ],
      });

      this.loadBalancer.logAccessLogs(albLogBucket, 'alb-logs');
    }

    // Configure HTTPS listener with TLS 1.2 minimum
    const httpsListener = this.loadBalancer.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: this.certificate ? [this.certificate] : undefined,
      sslPolicy: elbv2.SslPolicy.TLS12_EXT, // Security: TLS 1.2+ only
    });

    // Configure HTTP listener to redirect to HTTPS
    const httpListener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    httpListener.addAction('RedirectToHttps', {
      action: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Add security headers via ALB
    const defaultTargetGroup = new elbv2.ApplicationTargetGroup(this, 'DefaultTargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Add default action with security headers
    httpsListener.addAction('DefaultAction', {
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'OK',
      }),
    });

    // Create services with enhanced configurations
    this.apiService = this.createApiService(
      infrastructureStack,
      environment,
      httpsListener,
      domainName
    );

    this.orchestratorService = this.createOrchestratorService(
      infrastructureStack,
      environment
    );

    this.webService = this.createWebService(
      infrastructureStack,
      environment,
      httpsListener,
      domainName
    );

    // Configure DNS if domain is provided
    if (domainName && hostedZoneId) {
      this.configureDNS(domainName, hostedZoneId, environment);
    }

    // Add CloudWatch alarms for security monitoring
    this.createSecurityAlarms(environment);
  }

  private createApiService(
    infrastructureStack: AiValidationPlatformStack,
    environment: string,
    httpsListener: elbv2.ApplicationListener,
    domainName?: string
  ): ecs.FargateService {
    const { database, redisCluster, reportsBucket, assetsBucket } = infrastructureStack;

    // Create API repository
    const apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: `ai-validation-api-${environment}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE, // Security: Immutable tags
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    });

    // Task execution role
    const taskExecutionRole = new iam.Role(this, 'ApiTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    apiRepository.grantPull(taskExecutionRole);

    // Task definition with security settings
    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
      family: `ai-validation-api-${environment}`,
      cpu: environment === 'dev' ? 256 : 512,
      memoryLimitMiB: environment === 'dev' ? 512 : 1024,
      executionRole: taskExecutionRole,
      taskRole: infrastructureStack.applicationRole,
    });

    // Add container with security configurations
    const apiContainer = apiTaskDefinition.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        // Security headers configuration
        ENABLE_SECURITY_HEADERS: 'true',
        CORS_ORIGIN: domainName 
          ? `https://${environment === 'prod' ? '' : `${environment}.`}${domainName}`
          : 'http://localhost:3000',
        // CSP configuration
        CSP_DIRECTIVES: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; '),
        // Security configurations
        HELMET_CONFIG: JSON.stringify({
          contentSecurityPolicy: true,
          crossOriginEmbedderPolicy: true,
          crossOriginOpenerPolicy: true,
          crossOriginResourcePolicy: true,
          dnsPrefetchControl: true,
          frameguard: true,
          hidePoweredBy: true,
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
          },
          ieNoOpen: true,
          noSniff: true,
          originAgentCluster: true,
          permittedCrossDomainPolicies: false,
          referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
          xssFilter: true
        }),
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(
          cdk.aws_secretsmanager.Secret.fromSecretNameV2(
            this,
            'DbSecret',
            'rds!cluster-credentials'
          )
        ),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: new logs.LogGroup(this, 'ApiLogGroup', {
          logGroupName: `/ecs/ai-validation-api-${environment}`,
          retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      // Security: Read-only root filesystem
      readonlyRootFilesystem: true,
      // Security: Run as non-root user
      user: '1000:1000',
    });

    apiContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create service
    const apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.cluster,
      taskDefinition: apiTaskDefinition,
      serviceName: `ai-validation-api-${environment}`,
      desiredCount: environment === 'dev' ? 1 : 2,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      enableExecuteCommand: environment !== 'prod', // Debug access for non-prod
    });

    // Configure auto-scaling
    const scaling = apiService.autoScaleTaskCount({
      minCapacity: environment === 'dev' ? 1 : 2,
      maxCapacity: environment === 'dev' ? 2 : 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 75,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Add to load balancer with path-based routing
    const apiTargetGroup = httpsListener.addTargets('ApiTargetGroup', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [apiService],
      healthCheck: {
        enabled: true,
        path: '/api/health',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*']),
      ],
    });

    // Configure stickiness for session management
    apiTargetGroup.configureHealthCheck({
      enabled: true,
    });

    apiTargetGroup.enableCookieStickiness(cdk.Duration.hours(1), 'AIVSESSIONID');

    return apiService;
  }

  private createOrchestratorService(
    infrastructureStack: AiValidationPlatformStack,
    environment: string
  ): ecs.FargateService {
    const { database, redisCluster } = infrastructureStack;

    // Create orchestrator repository
    const orchestratorRepository = new ecr.Repository(this, 'OrchestratorRepository', {
      repositoryName: `ai-validation-orchestrator-${environment}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    });

    // Task execution role
    const taskExecutionRole = new iam.Role(this, 'OrchestratorTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    orchestratorRepository.grantPull(taskExecutionRole);

    // Task definition
    const orchestratorTaskDefinition = new ecs.FargateTaskDefinition(this, 'OrchestratorTaskDefinition', {
      family: `ai-validation-orchestrator-${environment}`,
      cpu: environment === 'dev' ? 256 : 512,
      memoryLimitMiB: environment === 'dev' ? 512 : 1024,
      executionRole: taskExecutionRole,
      taskRole: infrastructureStack.applicationRole,
    });

    // Add container
    const orchestratorContainer = orchestratorTaskDefinition.addContainer('OrchestratorContainer', {
      image: ecs.ContainerImage.fromEcrRepository(orchestratorRepository, 'latest'),
      environment: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(
          cdk.aws_secretsmanager.Secret.fromSecretNameV2(
            this,
            'OrchestratorDbSecret',
            'rds!cluster-credentials'
          )
        ),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'orchestrator',
        logGroup: new logs.LogGroup(this, 'OrchestratorLogGroup', {
          logGroupName: `/ecs/ai-validation-orchestrator-${environment}`,
          retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      readonlyRootFilesystem: true,
      user: '1000:1000',
    });

    orchestratorContainer.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    });

    // Create service (internal, not exposed to internet)
    const orchestratorService = new ecs.FargateService(this, 'OrchestratorService', {
      cluster: this.cluster,
      taskDefinition: orchestratorTaskDefinition,
      serviceName: `ai-validation-orchestrator-${environment}`,
      desiredCount: environment === 'dev' ? 1 : 2,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      enableExecuteCommand: environment !== 'prod',
    });

    // Configure auto-scaling
    const scaling = orchestratorService.autoScaleTaskCount({
      minCapacity: environment === 'dev' ? 1 : 2,
      maxCapacity: environment === 'dev' ? 2 : 5,
    });

    scaling.scaleOnCpuUtilization('OrchestratorCpuScaling', {
      targetUtilizationPercent: 70,
    });

    return orchestratorService;
  }

  private createWebService(
    infrastructureStack: AiValidationPlatformStack,
    environment: string,
    httpsListener: elbv2.ApplicationListener,
    domainName?: string
  ): ecs.FargateService {
    // Create web repository
    const webRepository = new ecr.Repository(this, 'WebRepository', {
      repositoryName: `ai-validation-web-${environment}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    });

    // Task execution role
    const taskExecutionRole = new iam.Role(this, 'WebTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    webRepository.grantPull(taskExecutionRole);

    // Task definition
    const webTaskDefinition = new ecs.FargateTaskDefinition(this, 'WebTaskDefinition', {
      family: `ai-validation-web-${environment}`,
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
    });

    // Add container
    const webContainer = webTaskDefinition.addContainer('WebContainer', {
      image: ecs.ContainerImage.fromEcrRepository(webRepository, 'latest'),
      environment: {
        NODE_ENV: 'production',
        API_BASE_URL: domainName 
          ? `https://api.${environment === 'prod' ? '' : `${environment}.`}${domainName}`
          : '/api',
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web',
        logGroup: new logs.LogGroup(this, 'WebLogGroup', {
          logGroupName: `/ecs/ai-validation-web-${environment}`,
          retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        }),
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      readonlyRootFilesystem: true,
      user: '1000:1000',
    });

    webContainer.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // Create service
    const webService = new ecs.FargateService(this, 'WebService', {
      cluster: this.cluster,
      taskDefinition: webTaskDefinition,
      serviceName: `ai-validation-web-${environment}`,
      desiredCount: environment === 'dev' ? 1 : 2,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      enableExecuteCommand: environment !== 'prod',
    });

    // Configure auto-scaling
    const scaling = webService.autoScaleTaskCount({
      minCapacity: environment === 'dev' ? 1 : 2,
      maxCapacity: environment === 'dev' ? 2 : 5,
    });

    scaling.scaleOnCpuUtilization('WebCpuScaling', {
      targetUtilizationPercent: 70,
    });

    // Add to load balancer with root path
    const webTargetGroup = httpsListener.addTargets('WebTargetGroup', {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [webService],
      healthCheck: {
        enabled: true,
        path: '/',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/*']),
      ],
    });

    return webService;
  }

  private configureDNS(domainName: string, hostedZoneId: string, environment: string): void {
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'DNSHostedZone', {
      hostedZoneId,
      zoneName: domainName,
    });

    // Main domain record
    new route53.ARecord(this, 'MainDomainRecord', {
      zone: hostedZone,
      recordName: environment === 'prod' ? domainName : `${environment}.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(this.loadBalancer)
      ),
    });

    // WWW subdomain
    new route53.ARecord(this, 'WwwDomainRecord', {
      zone: hostedZone,
      recordName: environment === 'prod' ? `www.${domainName}` : `www.${environment}.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(this.loadBalancer)
      ),
    });

    // API subdomain
    new route53.ARecord(this, 'ApiDomainRecord', {
      zone: hostedZone,
      recordName: environment === 'prod' ? `api.${domainName}` : `api.${environment}.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(this.loadBalancer)
      ),
    });
  }

  private createSecurityAlarms(environment: string): void {
    // Create CloudWatch alarms for security monitoring
    const alarmTopic = new cdk.aws_sns.Topic(this, 'SecurityAlarmTopic', {
      topicName: `ai-validation-security-alarms-${environment}`,
      displayName: `AI Validation Security Alarms (${environment})`,
    });

    // 4xx errors alarm
    new cdk.aws_cloudwatch.Alarm(this, 'High4xxErrorsAlarm', {
      alarmName: `ai-validation-high-4xx-errors-${environment}`,
      alarmDescription: 'High rate of 4xx errors detected',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_4XX_Count',
        dimensionsMap: {
          LoadBalancer: this.loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));

    // 5xx errors alarm
    new cdk.aws_cloudwatch.Alarm(this, 'High5xxErrorsAlarm', {
      alarmName: `ai-validation-high-5xx-errors-${environment}`,
      alarmDescription: 'High rate of 5xx errors detected',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          LoadBalancer: this.loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));
  }
}

export default EcsStackEnhanced;