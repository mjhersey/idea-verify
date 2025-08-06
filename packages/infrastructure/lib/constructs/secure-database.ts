import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import {
  BaseStackProps,
  createResourceName,
  createStandardTags,
  getEnvironmentConfig,
} from '../common/base-stack-props'

export interface SecureDatabaseProps {
  vpc: ec2.IVpc
  environment: string
  projectName?: string
  databaseName?: string
  username?: string
  securityGroups?: ec2.ISecurityGroup[]
}

export class SecureDatabase extends Construct {
  public readonly instance: rds.DatabaseInstance
  public readonly secret: secretsmanager.ISecret
  public readonly logGroup: logs.LogGroup

  constructor(scope: Construct, id: string, props: SecureDatabaseProps) {
    super(scope, id)

    const {
      vpc,
      environment,
      projectName = 'AI-Validation-Platform',
      databaseName = 'aivalidation',
      username = 'aivalidation',
      securityGroups = [],
    } = props

    const config = getEnvironmentConfig(environment)
    const resourceName = createResourceName('db', environment, projectName)

    // Create database subnet group
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      subnetGroupName: `${resourceName}-subnet-group`,
      description: `Database subnet group for ${projectName} ${environment}`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    })

    // Create database secret
    this.secret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `${resourceName}-credentials`,
      description: `Database credentials for ${projectName} ${environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        includeSpace: false,
        passwordLength: 32,
      },
    })

    // Create CloudWatch log group for database logs
    this.logGroup = new logs.LogGroup(this, 'DatabaseLogGroup', {
      logGroupName: `/aws/rds/instance/${resourceName}`,
      retention:
        environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    })

    // Create parameter group with secure settings
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      parameters: {
        // Security parameters
        log_statement: 'all',
        log_min_duration_statement: '1000', // Log slow queries
        shared_preload_libraries: 'pg_stat_statements',
        log_connections: '1',
        log_disconnections: '1',
        log_checkpoints: '1',
        log_lock_waits: '1',

        // Performance parameters
        shared_buffers: '{DBInstanceClassMemory/4}',
        effective_cache_size: '{DBInstanceClassMemory*3/4}',
        maintenance_work_mem: '{DBInstanceClassMemory/16}',
        checkpoint_completion_target: '0.9',
        wal_buffers: '16MB',
        default_statistics_target: '100',
        random_page_cost: '1.1',
        effective_io_concurrency: '200',
      },
    })

    // Determine instance class based on environment
    const instanceClass = this.getInstanceClass(environment)

    // Create the database instance
    this.instance = new rds.DatabaseInstance(this, 'DatabaseInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: instanceClass,
      instanceIdentifier: resourceName,
      vpc,
      subnetGroup,
      securityGroups,
      credentials: rds.Credentials.fromSecret(this.secret),
      databaseName,

      // Storage configuration
      allocatedStorage: this.getAllocatedStorage(environment),
      maxAllocatedStorage: this.getMaxAllocatedStorage(environment),
      storageType: rds.StorageType.GP2,
      storageEncrypted: true,

      // Backup configuration
      backupRetention: cdk.Duration.days(config.backupRetentionDays),
      deleteAutomatedBackups: environment !== 'prod',
      deletionProtection: environment === 'prod',

      // Monitoring configuration
      monitoringInterval: config.enableDetailedMonitoring ? cdk.Duration.seconds(60) : undefined,
      enablePerformanceInsights: config.enablePerformanceInsights,
      performanceInsightRetention: config.enablePerformanceInsights
        ? rds.PerformanceInsightRetention.DEFAULT
        : undefined,

      // Network configuration
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      multiAz: environment === 'prod',

      // Security configuration
      parameterGroup,
      cloudwatchLogsExports: ['postgresql'],

      // Maintenance
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
    })

    // Apply standard tags
    const tags = createStandardTags({
      environment,
      projectName,
    } as BaseStackProps)

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this.instance).add(key, value)
      cdk.Tags.of(this.secret).add(key, value)
      cdk.Tags.of(this.logGroup).add(key, value)
    })

    // Add specific tags for the database
    cdk.Tags.of(this.instance).add('Component', 'Database')
    cdk.Tags.of(this.instance).add('Engine', 'PostgreSQL')
    cdk.Tags.of(this.instance).add('Backup', environment === 'prod' ? 'Required' : 'Optional')
  }

  private getInstanceClass(environment: string): ec2.InstanceType {
    switch (environment) {
      case 'prod':
        return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
      case 'staging':
        return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO)
      default: // dev
        return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO)
    }
  }

  private getAllocatedStorage(environment: string): number {
    switch (environment) {
      case 'prod':
        return 100 // GB
      case 'staging':
        return 50 // GB
      default: // dev
        return 20 // GB (free tier)
    }
  }

  private getMaxAllocatedStorage(environment: string): number {
    switch (environment) {
      case 'prod':
        return 1000 // GB
      case 'staging':
        return 200 // GB
      default: // dev
        return 100 // GB
    }
  }
}
