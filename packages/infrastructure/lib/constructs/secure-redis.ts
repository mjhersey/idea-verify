import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { BaseStackProps, createResourceName, createStandardTags, getEnvironmentConfig } from '../common/base-stack-props';

export interface SecureRedisProps {
  vpc: ec2.IVpc;
  environment: string;
  projectName?: string;
  securityGroups?: ec2.ISecurityGroup[];
}

export class SecureRedis extends Construct {
  public readonly cluster: elasticache.CfnReplicationGroup;
  public readonly subnetGroup: elasticache.CfnSubnetGroup;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: SecureRedisProps) {
    super(scope, id);

    const {
      vpc,
      environment,
      projectName = 'AI-Validation-Platform',
      securityGroups = [],
    } = props;

    const config = getEnvironmentConfig(environment);
    const resourceName = createResourceName('redis', environment, projectName);

    // Create CloudWatch log group for Redis logs
    this.logGroup = new logs.LogGroup(this, 'RedisLogGroup', {
      logGroupName: `/aws/elasticache/${resourceName}`,
      retention: environment === 'prod' 
        ? logs.RetentionDays.ONE_MONTH 
        : logs.RetentionDays.ONE_WEEK,
    });

    // Create subnet group for Redis
    this.subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      cacheSubnetGroupName: `${resourceName}-subnet-group`,
      description: `Redis subnet group for ${projectName} ${environment}`,
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // Create parameter group with optimized settings
    const parameterGroup = new elasticache.CfnParameterGroup(this, 'RedisParameterGroup', {
      cacheParameterGroupFamily: 'redis7.x',
      description: `Redis parameter group for ${projectName} ${environment}`,
      properties: {
        // Security settings
        'timeout': '300',
        'tcp-keepalive': '60',
        
        // Performance settings
        'maxmemory-policy': 'allkeys-lru',
        'maxmemory-samples': '5',
        
        // Persistence settings (if needed)
        'save': environment === 'prod' ? '900 1 300 10 60 10000' : '',
      },
    });

    // Create the Redis replication group
    this.cluster = new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupId: resourceName,
      description: `Redis cluster for ${projectName} ${environment}`,
      
      // Engine configuration
      engine: 'redis',
      engineVersion: '7.0',
      cacheNodeType: this.getNodeType(environment),
      
      // Network configuration
      cacheSubnetGroupName: this.subnetGroup.cacheSubnetGroupName,
      securityGroupIds: securityGroups.map(sg => sg.securityGroupId),
      
      // Replication configuration
      numCacheClusters: environment === 'prod' ? 3 : 1, // Multi-AZ for prod
      automaticFailoverEnabled: environment === 'prod',
      multiAzEnabled: environment === 'prod',
      
      // Security configuration
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      authToken: this.generateAuthToken(),
      
      // Backup configuration
      snapshotRetentionLimit: environment === 'prod' ? 7 : 1,
      snapshotWindow: '03:00-05:00',
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      
      // Parameter group
      cacheParameterGroupName: parameterGroup.ref,
      
      // Logging configuration
      logDeliveryConfigurations: [
        {
          destinationType: 'cloudwatch-logs',
          destinationDetails: {
            logGroup: this.logGroup.logGroupName,
          },
          logFormat: 'json',
          logType: 'slow-log',
        },
      ],
      
      // Notification configuration
      notificationTopicArn: this.getNotificationTopicArn(),
      
      // Auto-upgrade
      autoMinorVersionUpgrade: true,
    });

    // Add dependency
    this.cluster.addDependency(this.subnetGroup);
    this.cluster.addDependency(parameterGroup);

    // Apply standard tags
    const tags = createStandardTags({
      environment,
      projectName,
    } as BaseStackProps);

    // Convert tags to CloudFormation format
    const cfnTags = Object.entries(tags).map(([key, value]) => ({
      key,
      value,
    }));

    // Apply tags to resources
    this.cluster.tags = cfnTags.concat([
      { key: 'Component', value: 'Cache' },
      { key: 'Engine', value: 'Redis' },
      { key: 'Encryption', value: 'Enabled' },
    ]);

    // Apply tags to other resources
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this.subnetGroup).add(key, value);
      cdk.Tags.of(this.logGroup).add(key, value);
    });
  }

  private getNodeType(environment: string): string {
    switch (environment) {
      case 'prod':
        return 'cache.t3.medium';
      case 'staging':
        return 'cache.t3.small';
      default: // dev
        return 'cache.t3.micro';
    }
  }

  private generateAuthToken(): string {
    // Generate a secure auth token for Redis
    // In production, this should be stored in Secrets Manager
    return cdk.Token.asString(
      cdk.Fn.base64(
        cdk.Fn.sub('${AWS::StackId}-${AWS::Region}-redis-auth')
      )
    );
  }

  private getNotificationTopicArn(): string {
    // Try to import existing SNS topic, otherwise return undefined
    try {
      return cdk.Fn.importValue('AlertTopicArn');
    } catch {
      // Return empty string if no topic available
      return '';
    }
  }

  /**
   * Get the Redis endpoint for applications
   */
  public getEndpoint(): string {
    return this.cluster.attrRedisEndpointAddress;
  }

  /**
   * Get the Redis port
   */
  public getPort(): string {
    return this.cluster.attrRedisEndpointPort;
  }

  /**
   * Get connection string for applications
   */
  public getConnectionString(): string {
    return `redis://${this.getEndpoint()}:${this.getPort()}`;
  }
}