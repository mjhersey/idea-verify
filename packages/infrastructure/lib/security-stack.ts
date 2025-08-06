import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { AiValidationPlatformStack } from './ai-validation-platform-stack'
import { EcsStack } from './ecs-stack'
import { WAFIPManagement } from './waf-ip-management'

export interface SecurityStackProps extends cdk.StackProps {
  environment: string
  infrastructureStack: AiValidationPlatformStack
  ecsStack: EcsStack
}

export class SecurityStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL
  public readonly securityGroups: Map<string, ec2.SecurityGroup>
  public readonly auditLogGroup: logs.LogGroup
  public readonly wafLogBucket: s3.Bucket
  public readonly wafIpManagement: WAFIPManagement

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props)

    const { environment, infrastructureStack, ecsStack } = props

    this.securityGroups = new Map()

    // Create WAF IP management system
    this.wafIpManagement = new WAFIPManagement(this, 'WAFIPManagement', {
      environment: environment,
    })

    // Create security groups with minimal access
    this.createSecurityGroups(infrastructureStack, ecsStack, environment)

    // Set up AWS WAF
    this.setupWAF(ecsStack, environment)

    // Configure audit logging
    this.setupAuditLogging(environment)

    // Configure network ACLs
    this.configureNetworkACLs(infrastructureStack, environment)

    // Create security compliance resources
    this.createComplianceResources(environment)
  }

  private createSecurityGroups(
    infrastructureStack: AiValidationPlatformStack,
    ecsStack: EcsStack,
    environment: string
  ): void {
    const vpc = infrastructureStack.vpc

    // ALB Security Group - Public facing
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: false,
    })

    // Allow HTTPS inbound from anywhere
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from internet'
    )

    // Allow HTTP inbound (for redirect to HTTPS)
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic for redirect to HTTPS'
    )

    // Restrict outbound to ECS services only
    albSecurityGroup.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3000),
      'Allow traffic to ECS services'
    )

    this.securityGroups.set('alb', albSecurityGroup)

    // ECS Task Security Group
    const ecsTaskSecurityGroup = new ec2.SecurityGroup(this, 'ECSTaskSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: false,
    })

    // Allow traffic from ALB only
    ecsTaskSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB'
    )

    // Allow outbound to specific services
    ecsTaskSecurityGroup.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL connection'
    )

    ecsTaskSecurityGroup.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis connection'
    )

    // Allow HTTPS outbound for external APIs
    ecsTaskSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS for external API calls'
    )

    // Allow DNS resolution
    ecsTaskSecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(53), 'Allow DNS resolution')

    this.securityGroups.set('ecs-task', ecsTaskSecurityGroup)

    // Database Security Group (already exists, but let's tighten it)
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroupTightened', {
      vpc,
      description: 'Tightened security group for RDS database',
      allowAllOutbound: false,
    })

    // Only allow connections from ECS tasks
    dbSecurityGroup.addIngressRule(
      ecsTaskSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from ECS tasks only'
    )

    // No outbound rules needed for database
    this.securityGroups.set('database', dbSecurityGroup)

    // Redis Security Group
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroupTightened', {
      vpc,
      description: 'Tightened security group for ElastiCache Redis',
      allowAllOutbound: false,
    })

    // Only allow connections from ECS tasks
    redisSecurityGroup.addIngressRule(
      ecsTaskSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from ECS tasks only'
    )

    this.securityGroups.set('redis', redisSecurityGroup)

    // Bastion Host Security Group (for maintenance access)
    if (environment !== 'dev') {
      const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
        vpc,
        description: 'Security group for bastion host',
        allowAllOutbound: false,
      })

      // Allow SSH from specific IP ranges only
      const allowedSshIps = this.getAllowedSshIps(environment)
      for (const ipRange of allowedSshIps) {
        bastionSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(ipRange),
          ec2.Port.tcp(22),
          `Allow SSH from ${ipRange}`
        )
      }

      // Allow outbound to VPC only
      bastionSecurityGroup.addEgressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.allTraffic(),
        'Allow traffic within VPC'
      )

      this.securityGroups.set('bastion', bastionSecurityGroup)
    }

    // Apply security group tags
    for (const [name, sg] of this.securityGroups) {
      cdk.Tags.of(sg).add('SecurityGroup', name)
      cdk.Tags.of(sg).add('Environment', environment)
      cdk.Tags.of(sg).add('ManagedBy', 'CDK')
    }
  }

  private setupWAF(ecsStack: EcsStack, environment: string): void {
    // Create S3 bucket for WAF logs
    this.wafLogBucket = new s3.Bucket(this, 'WAFLogBucket', {
      bucketName: `ai-validation-waf-logs-${environment}-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(environment === 'prod' ? 90 : 30),
        },
      ],
    })

    // Create IP set for rate limiting exemptions (e.g., office IPs)
    const trustedIpSet = new wafv2.CfnIPSet(this, 'TrustedIPSet', {
      name: `ai-validation-trusted-ips-${environment}`,
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: this.getTrustedIps(environment),
    })

    // Create regex pattern set for common attack patterns
    const attackPatternSet = new wafv2.CfnRegexPatternSet(this, 'AttackPatternSet', {
      name: `ai-validation-attack-patterns-${environment}`,
      scope: 'REGIONAL',
      regularExpressionList: [
        { regexString: '(?i)(union.*select|select.*from|insert.*into|delete.*from)' }, // SQL injection
        { regexString: '(?i)(<script|javascript:|onerror=|onload=)' }, // XSS
        { regexString: '(?i)(\.\.\/|\.\.\\\\)' }, // Path traversal
        { regexString: '(?i)(cmd=|exec=|system\\(|eval\\()' }, // Command injection
      ],
    })

    // Create WAF Web ACL
    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `ai-validation-waf-${environment}`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `ai-validation-waf-${environment}`,
      },
      rules: [
        // Rule 1: Block requests from known bad IPs
        {
          name: 'BlockBadIPs',
          priority: 1,
          statement: {
            ipSetReferenceStatement: {
              arn: this.wafIpManagement.getBlockedIpSetArn(),
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'BlockBadIPs',
          },
        },
        // Rule 2: Rate limiting (except trusted IPs)
        {
          name: 'RateLimiting',
          priority: 2,
          statement: {
            rateBasedStatement: {
              limit: environment === 'prod' ? 2000 : 5000, // Requests per 5 minutes
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                notStatement: {
                  statement: {
                    ipSetReferenceStatement: {
                      arn: trustedIpSet.attrArn,
                    },
                  },
                },
              },
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimiting',
          },
        },
        // Rule 3: AWS Managed Core Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
              excludedRules: environment === 'dev' ? [{ name: 'SizeRestrictions_BODY' }] : [],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },
        // Rule 4: AWS Managed Known Bad Inputs Rule Set
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        // Rule 5: SQL Injection Protection
        {
          name: 'SQLInjectionProtection',
          priority: 5,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLInjectionProtection',
          },
        },
        // Rule 6: Custom attack pattern blocking
        {
          name: 'BlockAttackPatterns',
          priority: 6,
          statement: {
            regexPatternSetReferenceStatement: {
              arn: attackPatternSet.attrArn,
              fieldToMatch: {
                allQueryArguments: {},
              },
              textTransformations: [
                { priority: 0, type: 'URL_DECODE' },
                { priority: 1, type: 'HTML_ENTITY_DECODE' },
                { priority: 2, type: 'LOWERCASE' },
              ],
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'BlockAttackPatterns',
          },
        },
        // Rule 7: Geo-blocking (if required)
        ...(this.shouldEnableGeoBlocking(environment)
          ? [
              {
                name: 'GeoBlocking',
                priority: 7,
                statement: {
                  geoMatchStatement: {
                    countryCodes: this.getBlockedCountries(environment),
                  },
                },
                action: { block: {} },
                visibilityConfig: {
                  sampledRequestsEnabled: true,
                  cloudWatchMetricsEnabled: true,
                  metricName: 'GeoBlocking',
                },
              },
            ]
          : []),
      ],
    })

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: ecsStack.loadBalancer.loadBalancerArn,
      webAclArn: this.webAcl.attrArn,
    })

    // Enable WAF logging
    const wafLogConfig = new wafv2.CfnLoggingConfiguration(this, 'WAFLoggingConfiguration', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [`arn:aws:s3:::${this.wafLogBucket.bucketName}`],
    })

    wafLogConfig.node.addDependency(this.wafLogBucket)
  }

  private setupAuditLogging(environment: string): void {
    // Create CloudWatch log group for audit logs
    this.auditLogGroup = new logs.LogGroup(this, 'AuditLogGroup', {
      logGroupName: `/aws/security/ai-validation/${environment}`,
      retention:
        environment === 'prod' ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.THREE_MONTHS,
    })

    // Create log stream for security events
    new logs.LogStream(this, 'SecurityEventStream', {
      logGroup: this.auditLogGroup,
      logStreamName: 'security-events',
    })

    // Create log stream for access logs
    new logs.LogStream(this, 'AccessLogStream', {
      logGroup: this.auditLogGroup,
      logStreamName: 'access-logs',
    })

    // Create log stream for compliance events
    new logs.LogStream(this, 'ComplianceLogStream', {
      logGroup: this.auditLogGroup,
      logStreamName: 'compliance-events',
    })
  }

  private configureNetworkACLs(
    infrastructureStack: AiValidationPlatformStack,
    environment: string
  ): void {
    const vpc = infrastructureStack.vpc

    // Create Network ACL for public subnets
    const publicNacl = new ec2.NetworkAcl(this, 'PublicNetworkAcl', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    })

    // Inbound rules for public subnet
    publicNacl.addEntry('AllowHttpsInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.tcpPort(443),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    publicNacl.addEntry('AllowHttpInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 110,
      traffic: ec2.AclTraffic.tcpPort(80),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    publicNacl.addEntry('AllowEphemeralInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 120,
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    // Outbound rules for public subnet
    publicNacl.addEntry('AllowAllOutbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.allTraffic(),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    // Create Network ACL for private subnets
    const privateNacl = new ec2.NetworkAcl(this, 'PrivateNetworkAcl', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    })

    // Inbound rules for private subnet
    privateNacl.addEntry('AllowVpcInbound', {
      cidr: ec2.AclCidr.ipv4(vpc.vpcCidrBlock),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.allTraffic(),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    // Outbound rules for private subnet
    privateNacl.addEntry('AllowVpcOutbound', {
      cidr: ec2.AclCidr.ipv4(vpc.vpcCidrBlock),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.allTraffic(),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    privateNacl.addEntry('AllowHttpsOutbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 110,
      traffic: ec2.AclTraffic.tcpPort(443),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    // Create Network ACL for database subnets (most restrictive)
    const databaseNacl = new ec2.NetworkAcl(this, 'DatabaseNetworkAcl', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    })

    // Only allow PostgreSQL traffic from private subnets
    databaseNacl.addEntry('AllowPostgresFromPrivate', {
      cidr: ec2.AclCidr.ipv4('10.0.0.0/16'), // VPC CIDR
      ruleNumber: 100,
      traffic: ec2.AclTraffic.tcpPort(5432),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    })

    databaseNacl.addEntry('AllowPostgresToPrivate', {
      cidr: ec2.AclCidr.ipv4('10.0.0.0/16'), // VPC CIDR
      ruleNumber: 100,
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    })
  }

  private createComplianceResources(environment: string): void {
    // Create IAM role for security scanning
    const securityScanRole = new iam.Role(this, 'SecurityScanRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for security compliance scanning',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    // Add permissions for security scanning
    securityScanRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ec2:Describe*',
          'rds:Describe*',
          'elasticache:Describe*',
          's3:GetBucket*',
          's3:ListBucket',
          'ecs:Describe*',
          'wafv2:Get*',
          'wafv2:List*',
        ],
        resources: ['*'],
      })
    )

    // Add permissions for writing audit logs
    securityScanRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [this.auditLogGroup.logGroupArn],
      })
    )

    // Output important security resources
    new cdk.CfnOutput(this, 'WAFWebACLId', {
      value: this.webAcl.attrId,
      description: 'WAF Web ACL ID',
      exportName: `${this.stackName}-WAFWebACLId`,
    })

    new cdk.CfnOutput(this, 'WAFWebACLArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: `${this.stackName}-WAFWebACLArn`,
    })

    new cdk.CfnOutput(this, 'AuditLogGroupName', {
      value: this.auditLogGroup.logGroupName,
      description: 'Audit log group name',
      exportName: `${this.stackName}-AuditLogGroupName`,
    })

    new cdk.CfnOutput(this, 'SecurityScanRoleArn', {
      value: securityScanRole.roleArn,
      description: 'Security scan role ARN',
      exportName: `${this.stackName}-SecurityScanRoleArn`,
    })
  }

  private getAllowedSshIps(environment: string): string[] {
    // In production, restrict to known office/VPN IPs
    if (environment === 'prod') {
      return [
        // Add your office/VPN IP ranges here
        // '203.0.113.0/24', // Example office IP range
      ]
    }
    // In dev/staging, allow from specific IPs only
    return []
  }

  private getTrustedIps(environment: string): string[] {
    // IPs that are exempt from rate limiting
    const baseIps = [
      // CloudWatch synthetic monitoring
      '54.240.196.0/24',
      '54.240.197.0/24',
      // AWS health checks
      '54.239.98.0/24',
      '54.239.99.0/24',
    ]

    // Add environment-specific trusted IPs
    switch (environment) {
      case 'prod':
        return [
          ...baseIps,
          // Add production office/VPN IP ranges
          '203.0.113.0/24', // Example corporate network
          '198.51.100.0/24', // Example VPN network
        ]
      case 'staging':
        return [
          ...baseIps,
          // Add staging trusted IPs
          '203.0.113.0/24', // Example office network
        ]
      default: // dev
        return [
          ...baseIps,
          // Development - more permissive
          '10.0.0.0/8', // Private networks
        ]
    }
  }

  // Removed getBlockedIpSetArn method - now using WAFIPManagement

  private shouldEnableGeoBlocking(environment: string): boolean {
    // Enable geo-blocking only in production
    return environment === 'prod'
  }

  private getBlockedCountries(environment: string): string[] {
    // List of country codes to block (if geo-blocking is enabled)
    if (environment === 'prod') {
      return [
        // High-risk countries for production
        'CN', // China
        'RU', // Russia
        'KP', // North Korea
        'IR', // Iran
        // Add more as needed based on threat intelligence
      ]
    }
    return [] // No geo-blocking for dev/staging
  }
}

export default SecurityStack
