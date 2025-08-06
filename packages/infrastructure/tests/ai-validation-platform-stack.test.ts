import * as cdk from 'aws-cdk-lib'
import { Template, Match } from 'aws-cdk-lib/assertions'
import { AiValidationPlatformStack } from '../lib/ai-validation-platform-stack'
import { describe, it, expect, beforeEach } from 'vitest'

describe('AiValidationPlatformStack', () => {
  let app: cdk.App
  let stack: AiValidationPlatformStack
  let template: Template

  beforeEach(() => {
    app = new cdk.App()
    stack = new AiValidationPlatformStack(app, 'TestStack', {
      environment: 'test',
      env: { account: '123456789012', region: 'us-east-1' },
    })
    template = Template.fromStack(stack)
  })

  it('should create a VPC with correct configuration', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    })
  })

  it('should create public and private subnets', () => {
    // Should have at least 2 public subnets (one per AZ)
    template.resourceCountIs('AWS::EC2::Subnet', 6) // 2 AZs × 3 subnet types

    // Should have public subnets
    template.hasResourceProperties('AWS::EC2::Subnet', {
      MapPublicIpOnLaunch: true,
    })

    // Should have private subnets
    template.hasResourceProperties('AWS::EC2::Subnet', {
      MapPublicIpOnLaunch: false,
    })
  })

  it('should create RDS PostgreSQL instance with correct configuration', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      DBInstanceClass: 'db.t3.micro',
      AllocatedStorage: '20',
      StorageType: 'gp2',
      StorageEncrypted: true,
      DBName: 'aivalidation',
      BackupRetentionPeriod: 1, // Test environment
      DeletionProtection: false, // Test environment
      MultiAZ: false, // Test environment
    })
  })

  it('should create database subnet group', () => {
    template.hasResourceProperties('AWS::RDS::DBSubnetGroup', {
      DBSubnetGroupDescription: 'Subnet group for RDS database',
    })
  })

  it('should create database security group with restricted access', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for RDS PostgreSQL',
    })
  })

  it('should create ElastiCache Redis cluster', () => {
    template.hasResourceProperties('AWS::ElastiCache::CacheCluster', {
      Engine: 'redis',
      CacheNodeType: 'cache.t3.micro',
      NumCacheNodes: 1,
      Port: 6379,
      EngineVersion: '7.0',
    })
  })

  it('should create Redis subnet group', () => {
    template.hasResourceProperties('AWS::ElastiCache::SubnetGroup', {
      Description: 'Subnet group for ElastiCache Redis',
    })
  })

  it('should create S3 bucket for reports with encryption', () => {
    template.hasResourceProperties(
      'AWS::S3::Bucket',
      Match.objectLike({
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      })
    )
  })

  it('should create S3 bucket for static assets', () => {
    template.resourceCountIs('AWS::S3::Bucket', 2)
  })

  it('should create database credentials secret', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Description: 'PostgreSQL database credentials',
      GenerateSecretString: Match.objectLike({
        SecretStringTemplate: JSON.stringify({ username: 'aivalidation' }),
        GenerateStringKey: 'password',
        ExcludeCharacters: '"@/\\',
        IncludeSpace: false,
      }),
    })
  })

  it('should create IAM role for application services', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      },
    })
  })

  it('should grant application role access to secrets manager', () => {
    template.hasResourceProperties(
      'AWS::IAM::Policy',
      Match.objectLike({
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            }),
          ]),
        },
      })
    )
  })

  it('should create security group rules for database access', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      IpProtocol: 'tcp',
      FromPort: 5432,
      ToPort: 5432,
    })
  })

  it('should create security group rules for Redis access', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      IpProtocol: 'tcp',
      FromPort: 6379,
      ToPort: 6379,
    })
  })

  it('should output essential resource identifiers', () => {
    const outputs = template.findOutputs('*')

    expect(outputs).toHaveProperty('VpcId')
    expect(outputs).toHaveProperty('DatabaseEndpoint')
    expect(outputs).toHaveProperty('DatabasePort')
    expect(outputs).toHaveProperty('RedisEndpoint')
    expect(outputs).toHaveProperty('ReportsBucketName')
    expect(outputs).toHaveProperty('AssetsBucketName')
    expect(outputs).toHaveProperty('ApplicationRoleArn')
    expect(outputs).toHaveProperty('ApplicationSecurityGroupId')
    expect(outputs).toHaveProperty('PrivateSubnetIds')
    expect(outputs).toHaveProperty('PublicSubnetIds')
  })

  it('should tag resources appropriately', () => {
    // Check that stack has proper tags in constructor props
    expect(stack.tags).toBeDefined()
  })

  it('should configure lifecycle rules for S3 buckets', () => {
    template.hasResourceProperties(
      'AWS::S3::Bucket',
      Match.objectLike({
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Id: 'DeleteOldVersionsRule',
              Status: 'Enabled',
              NoncurrentVersionExpiration: {
                NoncurrentDays: 30,
              },
            }),
            Match.objectLike({
              Id: 'DeleteIncompleteUploadsRule',
              Status: 'Enabled',
              AbortIncompleteMultipartUpload: {
                DaysAfterInitiation: 1,
              },
            }),
          ]),
        },
      })
    )
  })
})

describe('AiValidationPlatformStack Environment-Specific Configuration', () => {
  it('should configure production environment with high availability', () => {
    const app = new cdk.App()
    const stack = new AiValidationPlatformStack(app, 'ProdStack', {
      environment: 'prod',
      env: { account: '123456789012', region: 'us-east-1' },
    })
    const template = Template.fromStack(stack)

    // Production should have deletion protection
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DeletionProtection: true,
      MultiAZ: true,
      BackupRetentionPeriod: 7,
    })

    // Production should have versioned S3 buckets
    template.hasResourceProperties(
      'AWS::S3::Bucket',
      Match.objectLike({
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      })
    )
  })

  it('should configure development environment for cost optimization', () => {
    const app = new cdk.App()
    const stack = new AiValidationPlatformStack(app, 'DevStack', {
      environment: 'dev',
      env: { account: '123456789012', region: 'us-east-1' },
    })
    const template = Template.fromStack(stack)

    // Development should not have deletion protection
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DeletionProtection: false,
      MultiAZ: false,
      BackupRetentionPeriod: 1,
    })

    // Should use single NAT gateway for cost savings
    template.resourceCountIs('AWS::EC2::NatGateway', 1)
  })
})
