import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export interface AiValidationPlatformStackProps extends cdk.StackProps {
  environment: string
}

export class AiValidationPlatformStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly database: rds.DatabaseInstance
  public readonly redisCluster: elasticache.CfnCacheCluster
  public readonly reportsBucket: s3.Bucket
  public readonly assetsBucket: s3.Bucket
  public readonly applicationRole: iam.Role

  constructor(scope: Construct, id: string, props: AiValidationPlatformStackProps) {
    super(scope, id, props)

    const { environment } = props

    // VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'AiValidationVpc', {
      maxAzs: 2,
      cidr: '10.0.0.0/16',
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: environment === 'dev' ? 1 : 2, // Cost optimization for dev
      enableDnsHostnames: true,
      enableDnsSupport: true,
    })

    // Database subnet group
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      description: 'Subnet group for RDS database',
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    })

    // Database security group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    })

    // Application security group (for future ECS services)
    const appSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for application services',
    })

    // Allow application to connect to database
    dbSecurityGroup.addIngressRule(
      appSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow application to connect to PostgreSQL'
    )

    // Database credentials secret
    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      description: 'PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'aivalidation' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        includeSpace: false,
        passwordLength: 32,
      },
    })

    // Environment-specific database configuration
    const dbConfig = this.getDatabaseConfig(environment)

    // RDS PostgreSQL instance with environment-specific sizing
    this.database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: dbConfig.instanceType,
      allocatedStorage: dbConfig.allocatedStorage,
      maxAllocatedStorage: dbConfig.maxAllocatedStorage,
      storageType: dbConfig.storageType,
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'aivalidation',
      vpc: this.vpc,
      subnetGroup: dbSubnetGroup,
      securityGroups: [dbSecurityGroup],
      backupRetention: dbConfig.backupRetention,
      deletionProtection: dbConfig.deletionProtection,
      multiAz: dbConfig.multiAz,
      storageEncrypted: true,
      monitoringInterval: dbConfig.monitoringInterval,
      enablePerformanceInsights: dbConfig.enablePerformanceInsights,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(
        this,
        'DefaultParameterGroup',
        'default.postgres15'
      ),
    })

    // Redis subnet group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for ElastiCache Redis',
      subnetIds: this.vpc.privateSubnets.map(subnet => subnet.subnetId),
    })

    // Redis security group
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    })

    // Allow application to connect to Redis
    redisSecurityGroup.addIngressRule(
      appSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow application to connect to Redis'
    )

    // Environment-specific Redis configuration
    const redisConfig = this.getRedisConfig(environment)

    // ElastiCache Redis cluster with environment-specific sizing
    this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: redisConfig.nodeType,
      engine: 'redis',
      numCacheNodes: redisConfig.numNodes,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      port: 6379,
      engineVersion: '7.0',
    })

    // S3 bucket for evaluation reports
    this.reportsBucket = new s3.Bucket(this, 'EvaluationReportsBucket', {
      bucketName: `ai-validation-reports-${environment}-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: environment === 'prod',
      lifecycleRules: [
        {
          id: 'DeleteOldVersionsRule',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
        {
          id: 'DeleteIncompleteUploadsRule',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    })

    // S3 bucket for static assets
    this.assetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
      bucketName: `ai-validation-assets-${environment}-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
    })

    // IAM role for application services
    this.applicationRole = new iam.Role(this, 'ApplicationServiceRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'IAM role for AI Validation Platform application services',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    })

    // Grant application access to secrets
    dbCredentials.grantRead(this.applicationRole)

    // Grant application access to S3 buckets
    this.reportsBucket.grantReadWrite(this.applicationRole)
    this.assetsBucket.grantRead(this.applicationRole)

    // Grant application access to Secrets Manager for LLM credentials
    this.applicationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:ai-validation/*`],
      })
    )

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    })

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
      exportName: `${this.stackName}-DatabaseEndpoint`,
    })

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.database.instanceEndpoint.port.toString(),
      description: 'RDS PostgreSQL port',
      exportName: `${this.stackName}-DatabasePort`,
    })

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrRedisEndpointAddress,
      description: 'ElastiCache Redis endpoint',
      exportName: `${this.stackName}-RedisEndpoint`,
    })

    new cdk.CfnOutput(this, 'ReportsBucketName', {
      value: this.reportsBucket.bucketName,
      description: 'S3 bucket for evaluation reports',
      exportName: `${this.stackName}-ReportsBucketName`,
    })

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'S3 bucket for static assets',
      exportName: `${this.stackName}-AssetsBucketName`,
    })

    new cdk.CfnOutput(this, 'ApplicationRoleArn', {
      value: this.applicationRole.roleArn,
      description: 'IAM role ARN for application services',
      exportName: `${this.stackName}-ApplicationRoleArn`,
    })

    new cdk.CfnOutput(this, 'ApplicationSecurityGroupId', {
      value: appSecurityGroup.securityGroupId,
      description: 'Security group ID for application services',
      exportName: `${this.stackName}-ApplicationSecurityGroupId`,
    })

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Private subnet IDs',
      exportName: `${this.stackName}-PrivateSubnetIds`,
    })

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Public subnet IDs',
      exportName: `${this.stackName}-PublicSubnetIds`,
    })
  }

  private getDatabaseConfig(environment: string) {
    switch (environment) {
      case 'prod':
        return {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
          allocatedStorage: 100,
          maxAllocatedStorage: 1000,
          storageType: rds.StorageType.GP3,
          backupRetention: cdk.Duration.days(7),
          deletionProtection: true,
          multiAz: true,
          monitoringInterval: cdk.Duration.seconds(60),
          enablePerformanceInsights: true,
        }
      case 'staging':
        return {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
          allocatedStorage: 50,
          maxAllocatedStorage: 200,
          storageType: rds.StorageType.GP3,
          backupRetention: cdk.Duration.days(3),
          deletionProtection: false,
          multiAz: false,
          monitoringInterval: cdk.Duration.seconds(60),
          enablePerformanceInsights: true,
        }
      case 'dev':
      default:
        return {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
          allocatedStorage: 20, // Free tier limit
          maxAllocatedStorage: 50,
          storageType: rds.StorageType.GP2,
          backupRetention: cdk.Duration.days(1),
          deletionProtection: false,
          multiAz: false,
          monitoringInterval: cdk.Duration.seconds(0),
          enablePerformanceInsights: false,
        }
    }
  }

  private getRedisConfig(environment: string) {
    switch (environment) {
      case 'prod':
        return {
          nodeType: 'cache.t3.small',
          numNodes: 1,
        }
      case 'staging':
        return {
          nodeType: 'cache.t3.micro',
          numNodes: 1,
        }
      case 'dev':
      default:
        return {
          nodeType: 'cache.t3.micro', // Free tier compatible
          numNodes: 1,
        }
    }
  }
}
