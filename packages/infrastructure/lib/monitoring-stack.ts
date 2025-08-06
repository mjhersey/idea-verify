import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { EcsStack } from './ecs-stack'

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string
  ecsStack: EcsStack
  databaseInstance?: string // Database instance identifier from infrastructure stack
  redisClusterId?: string // Redis cluster ID from infrastructure stack
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard
  public readonly alertTopic: sns.Topic

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props)

    const { environment, ecsStack, databaseInstance, redisClusterId } = props

    // Get resource identifiers dynamically or use defaults
    const dbInstanceId = databaseInstance || `ai-validation-db-${environment}`
    const redisId = redisClusterId || `ai-validation-redis-${environment}`

    // SNS Topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `ai-validation-alerts-${environment}`,
      displayName: `AI Validation Platform Alerts (${environment})`,
    })

    // Email subscription for alerts (optional)
    if (process.env.ALERT_EMAIL) {
      this.alertTopic.addSubscription(new subscriptions.EmailSubscription(process.env.ALERT_EMAIL))
    }

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `ai-validation-${environment}`,
    })

    // Application metrics
    this.createApplicationMetrics(ecsStack)

    // Infrastructure metrics
    this.createInfrastructureMetrics(ecsStack, dbInstanceId, redisId)

    // Custom business metrics
    this.createBusinessMetrics()

    // Alarms
    this.createAlarms(ecsStack, dbInstanceId, redisId)

    // Log Insights queries
    this.createLogInsights()

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `${this.stackName}-DashboardUrl`,
    })

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic ARN for alerts',
      exportName: `${this.stackName}-AlertTopicArn`,
    })
  }

  private createApplicationMetrics(ecsStack: EcsStack): void {
    // ECS Service metrics
    const ecsMetrics = [
      new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: ecsStack.apiService.serviceName,
          ClusterName: ecsStack.cluster.clusterName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ServiceName: ecsStack.apiService.serviceName,
          ClusterName: ecsStack.cluster.clusterName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
    ]

    // Application Load Balancer metrics
    const albMetrics = [
      new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'RequestCount',
        dimensionsMap: {
          LoadBalancer: ecsStack.loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensionsMap: {
          LoadBalancer: ecsStack.loadBalancer.loadBalancerFullName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          LoadBalancer: ecsStack.loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
    ]

    // Add to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS Service CPU & Memory',
        left: [ecsMetrics[0]],
        right: [ecsMetrics[1]],
        period: cdk.Duration.minutes(5),
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Application Load Balancer Metrics',
        left: [albMetrics[0]],
        right: [albMetrics[1]],
        period: cdk.Duration.minutes(5),
        width: 12,
        height: 6,
      })
    )
  }

  private createInfrastructureMetrics(
    ecsStack: EcsStack,
    dbInstanceId: string,
    redisId: string
  ): void {
    // Database metrics (RDS)
    const dbMetrics = [
      new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBInstanceIdentifier: dbInstanceId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: dbInstanceId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
    ]

    // ElastiCache metrics (Redis)
    const redisMetrics = [
      new cloudwatch.Metric({
        namespace: 'AWS/ElastiCache',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          CacheClusterId: redisId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      new cloudwatch.Metric({
        namespace: 'AWS/ElastiCache',
        metricName: 'CurrConnections',
        dimensionsMap: {
          CacheClusterId: redisId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
    ]

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Database Performance',
        left: [dbMetrics[0]],
        right: [dbMetrics[1]],
        period: cdk.Duration.minutes(5),
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Redis Performance',
        left: [redisMetrics[0]],
        right: [redisMetrics[1]],
        period: cdk.Duration.minutes(5),
        width: 12,
        height: 6,
      })
    )
  }

  private createBusinessMetrics(): void {
    // Custom metrics for business KPIs
    const businessMetrics = [
      new cloudwatch.Metric({
        namespace: 'AIValidation/Business',
        metricName: 'EvaluationsSubmitted',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      new cloudwatch.Metric({
        namespace: 'AIValidation/Business',
        metricName: 'EvaluationsCompleted',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      new cloudwatch.Metric({
        namespace: 'AIValidation/Business',
        metricName: 'EvaluationDuration',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      new cloudwatch.Metric({
        namespace: 'AIValidation/Business',
        metricName: 'ActiveUsers',
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
      }),
    ]

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Business Metrics',
        left: [businessMetrics[0], businessMetrics[1]],
        right: [businessMetrics[2]],
        period: cdk.Duration.minutes(15),
        width: 12,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Active Users',
        metrics: [businessMetrics[3]],
        period: cdk.Duration.minutes(5),
        width: 6,
        height: 3,
      })
    )
  }

  private createAlarms(ecsStack: EcsStack, dbInstanceId: string, redisId: string): void {
    // High CPU alarm
    new cloudwatch.Alarm(this, 'HighCpuAlarm', {
      alarmName: `ai-validation-high-cpu-${this.stackName}`,
      alarmDescription: 'High CPU utilization on ECS services',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: ecsStack.apiService.serviceName,
          ClusterName: ecsStack.cluster.clusterName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic))

    // High memory alarm
    new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      alarmName: `ai-validation-high-memory-${this.stackName}`,
      alarmDescription: 'High memory utilization on ECS services',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ServiceName: ecsStack.apiService.serviceName,
          ClusterName: ecsStack.cluster.clusterName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 85,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic))

    // High error rate alarm
    new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `ai-validation-high-error-rate-${this.stackName}`,
      alarmDescription: 'High 5xx error rate from load balancer',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          LoadBalancer: ecsStack.loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic))

    // Database connection alarm
    new cloudwatch.Alarm(this, 'HighDbConnectionsAlarm', {
      alarmName: `ai-validation-high-db-connections-${this.stackName}`,
      alarmDescription: 'High database connection count',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: dbInstanceId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 15, // Free tier limit is 20
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatch.SnsAction(this.alertTopic))
  }

  private createLogInsights(): void {
    // Create useful CloudWatch Insights queries
    const queries = [
      {
        name: 'Error Analysis',
        query: `
          fields @timestamp, @message, level, service, context.action, error.message
          | filter level = "error"
          | sort @timestamp desc
          | limit 100
        `,
      },
      {
        name: 'Request Performance',
        query: `
          fields @timestamp, context.duration, context.action, context.metadata.statusCode
          | filter context.action = "request_completed"
          | stats avg(context.duration), max(context.duration), count() by bin(5m)
        `,
      },
      {
        name: 'Evaluation Performance',
        query: `
          fields @timestamp, context.evaluationId, context.duration
          | filter context.action = "evaluation_completed"
          | stats avg(context.duration), count() by bin(15m)
        `,
      },
      {
        name: 'External API Health',
        query: `
          fields @timestamp, context.component, context.duration, context.metadata.success
          | filter context.action = "external_api_call"
          | stats count() by context.component, context.metadata.success
        `,
      },
    ]

    // Store queries as CloudWatch Insights saved queries would be done manually
    // or through custom resources - documenting them here for reference
    queries.forEach(query => {
      new cdk.CfnOutput(this, `LogInsightsQuery${query.name.replace(/\s/g, '')}`, {
        value: query.query,
        description: `CloudWatch Logs Insights query: ${query.name}`,
      })
    })
  }
}

export default MonitoringStack
