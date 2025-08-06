import * as cdk from 'aws-cdk-lib'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

interface CostOptimizationStackProps extends cdk.StackProps {
  environment: string
  ecsCluster: ecs.ICluster
  ecsServices: {
    api: ecs.IService
    orchestrator: ecs.IService
    web: ecs.IService
  }
}

export class CostOptimizationStack extends cdk.Stack {
  public readonly costTopic: sns.ITopic
  public readonly budgetAlarms: budgets.CfnBudget[]
  public readonly autoScalingPolicies: applicationautoscaling.ScalableTarget[]

  constructor(scope: Construct, id: string, props: CostOptimizationStackProps) {
    super(scope, id, props)

    const { environment, ecsCluster, ecsServices } = props

    // Create SNS topic for cost alerts
    this.costTopic = new sns.Topic(this, 'CostAlertsTopic', {
      topicName: `ai-validation-cost-alerts-${environment}`,
      displayName: `AI Validation Cost Alerts (${environment.toUpperCase()})`,
    })

    // Add email subscription for cost alerts
    this.costTopic.addSubscription(new snsSubscriptions.EmailSubscription('admin@company.com'))

    // Create budget alarms
    this.budgetAlarms = this.createBudgetAlarms(environment)

    // Configure auto-scaling for cost optimization
    this.autoScalingPolicies = this.configureAutoScaling(ecsServices, environment)

    // Create cost monitoring dashboard
    this.createCostDashboard(environment)

    // Create scheduled scaling
    this.createScheduledScaling(ecsServices, environment)

    // Create cost optimization Lambda functions
    this.createCostOptimizationFunctions(environment)

    // Add comprehensive resource tagging
    this.addResourceTags(environment)
  }

  private createBudgetAlarms(environment: string): budgets.CfnBudget[] {
    const budgets: budgets.CfnBudget[] = []

    // Environment-specific budget limits
    const budgetLimits = {
      dev: { monthly: 50, quarterly: 150 },
      staging: { monthly: 100, quarterly: 300 },
      prod: { monthly: 500, quarterly: 1500 },
    }

    const limits = budgetLimits[environment as keyof typeof budgetLimits] || budgetLimits.dev

    // Monthly budget
    const monthlyBudget = new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `ai-validation-monthly-budget-${environment}`,
        budgetLimit: {
          amount: limits.monthly,
          unit: 'USD',
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        costFilters: {
          TagKey: ['Project'],
          TagValue: ['AI-Validation-Platform'],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.costTopic.topicArn,
            },
          ],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.costTopic.topicArn,
            },
          ],
        },
      ],
    })

    budgets.push(monthlyBudget)

    // Service-specific budgets
    const services = ['api', 'orchestrator', 'web']
    services.forEach(service => {
      const serviceBudget = new budgets.CfnBudget(this, `${service}Budget`, {
        budget: {
          budgetName: `ai-validation-${service}-budget-${environment}`,
          budgetLimit: {
            amount: limits.monthly / services.length,
            unit: 'USD',
          },
          timeUnit: 'MONTHLY',
          budgetType: 'COST',
          costFilters: {
            TagKey: ['Service'],
            TagValue: [service],
          },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 90,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [
              {
                subscriptionType: 'SNS',
                address: this.costTopic.topicArn,
              },
            ],
          },
        ],
      })

      budgets.push(serviceBudget)
    })

    return budgets
  }

  private configureAutoScaling(
    services: { api: ecs.IService; orchestrator: ecs.IService; web: ecs.IService },
    environment: string
  ): applicationautoscaling.ScalableTarget[] {
    const scalableTargets: applicationautoscaling.ScalableTarget[] = []

    // Environment-specific scaling configuration
    const scalingConfig = {
      dev: { min: 1, max: 2 },
      staging: { min: 1, max: 4 },
      prod: { min: 2, max: 10 },
    }

    const config = scalingConfig[environment as keyof typeof scalingConfig] || scalingConfig.dev

    // Configure scaling for each service
    Object.entries(services).forEach(([serviceName, service]) => {
      const scalableTarget = new applicationautoscaling.ScalableTarget(
        this,
        `${serviceName}ScalableTarget`,
        {
          serviceNamespace: applicationautoscaling.ServiceNamespace.ECS,
          scalableDimension: 'ecs:service:DesiredCount',
          resourceId: `service/${service.cluster.clusterName}/${service.serviceName}`,
          minCapacity: config.min,
          maxCapacity: config.max,
        }
      )

      // CPU-based scaling policy
      const cpuScaling = new applicationautoscaling.TargetTrackingScalingPolicy(
        this,
        `${serviceName}CpuScaling`,
        {
          scalingTarget: scalableTarget,
          targetValue: 70,
          predefinedMetric:
            applicationautoscaling.PredefinedMetric.ECS_SERVICE_AVERAGE_CPU_UTILIZATION,
          scaleInCooldown: cdk.Duration.minutes(5),
          scaleOutCooldown: cdk.Duration.minutes(2),
        }
      )

      // Memory-based scaling policy
      const memoryScaling = new applicationautoscaling.TargetTrackingScalingPolicy(
        this,
        `${serviceName}MemoryScaling`,
        {
          scalingTarget: scalableTarget,
          targetValue: 80,
          predefinedMetric:
            applicationautoscaling.PredefinedMetric.ECS_SERVICE_AVERAGE_MEMORY_UTILIZATION,
          scaleInCooldown: cdk.Duration.minutes(5),
          scaleOutCooldown: cdk.Duration.minutes(2),
        }
      )

      // Request-based scaling for API service
      if (serviceName === 'api') {
        const requestScaling = new applicationautoscaling.TargetTrackingScalingPolicy(
          this,
          'ApiRequestScaling',
          {
            scalingTarget: scalableTarget,
            targetValue: 1000, // Target 1000 requests per minute per task
            customMetric: new cloudwatch.Metric({
              namespace: 'AWS/ApplicationELB',
              metricName: 'RequestCountPerTarget',
              dimensionsMap: {
                TargetGroup: `targetgroup/ai-validation-api-tg-${environment}/*`,
              },
              statistic: 'Sum',
            }),
            scaleInCooldown: cdk.Duration.minutes(10), // Longer cooldown for request-based scaling
            scaleOutCooldown: cdk.Duration.minutes(3),
          }
        )
      }

      scalableTargets.push(scalableTarget)
    })

    return scalableTargets
  }

  private createCostDashboard(environment: string): void {
    const dashboard = new cloudwatch.Dashboard(this, 'CostDashboard', {
      dashboardName: `ai-validation-cost-${environment}`,
    })

    // Cost metrics widget
    const costWidget = new cloudwatch.GraphWidget({
      title: 'Daily Cost Trend',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Billing',
          metricName: 'EstimatedCharges',
          dimensionsMap: {
            Currency: 'USD',
          },
          statistic: 'Maximum',
          period: cdk.Duration.hours(24),
        }),
      ],
    })

    // Resource utilization widget
    const utilizationWidget = new cloudwatch.GraphWidget({
      title: 'Resource Utilization',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ServiceName: `ai-validation-api-${environment}`,
          },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            ServiceName: `ai-validation-api-${environment}`,
          },
          statistic: 'Average',
        }),
      ],
    })

    // Task count widget
    const taskCountWidget = new cloudwatch.GraphWidget({
      title: 'ECS Task Count',
      width: 12,
      height: 6,
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: {
            ServiceName: `ai-validation-api-${environment}`,
            ClusterName: `ai-validation-cluster-${environment}`,
          },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: {
            ServiceName: `ai-validation-orchestrator-${environment}`,
            ClusterName: `ai-validation-cluster-${environment}`,
          },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: {
            ServiceName: `ai-validation-web-${environment}`,
            ClusterName: `ai-validation-cluster-${environment}`,
          },
          statistic: 'Average',
        }),
      ],
    })

    // Cost allocation widget
    const costAllocationWidget = new cloudwatch.SingleValueWidget({
      title: 'Monthly Cost by Service',
      width: 12,
      height: 6,
      metrics: [
        new cloudwatch.Metric({
          namespace: 'CostOptimization',
          metricName: 'ServiceCost',
          dimensionsMap: {
            Service: 'api',
            Environment: environment,
          },
          statistic: 'Sum',
        }),
        new cloudwatch.Metric({
          namespace: 'CostOptimization',
          metricName: 'ServiceCost',
          dimensionsMap: {
            Service: 'orchestrator',
            Environment: environment,
          },
          statistic: 'Sum',
        }),
        new cloudwatch.Metric({
          namespace: 'CostOptimization',
          metricName: 'ServiceCost',
          dimensionsMap: {
            Service: 'web',
            Environment: environment,
          },
          statistic: 'Sum',
        }),
      ],
    })

    dashboard.addWidgets(costWidget, utilizationWidget)
    dashboard.addWidgets(taskCountWidget, costAllocationWidget)
  }

  private createScheduledScaling(
    services: { api: ecs.IService; orchestrator: ecs.IService; web: ecs.IService },
    environment: string
  ): void {
    // Only implement scheduled scaling for production
    if (environment !== 'prod') {
      return
    }

    // Create scheduled scaling rules
    const schedules = [
      {
        name: 'ScaleUpMorning',
        schedule: events.Schedule.cron({ hour: '8', minute: '0' }), // 8 AM UTC
        minCapacity: 3,
        maxCapacity: 10,
      },
      {
        name: 'ScaleDownEvening',
        schedule: events.Schedule.cron({ hour: '20', minute: '0' }), // 8 PM UTC
        minCapacity: 2,
        maxCapacity: 6,
      },
      {
        name: 'ScaleDownWeekend',
        schedule: events.Schedule.cron({ hour: '0', minute: '0', weekDay: 'SAT' }), // Saturday midnight
        minCapacity: 1,
        maxCapacity: 4,
      },
      {
        name: 'ScaleUpMonday',
        schedule: events.Schedule.cron({ hour: '7', minute: '0', weekDay: 'MON' }), // Monday 7 AM
        minCapacity: 2,
        maxCapacity: 8,
      },
    ]

    // Create Lambda function for scheduled scaling
    const scalingFunction = new lambda.Function(this, 'ScheduledScalingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const autoscaling = new AWS.ApplicationAutoScaling();

        exports.handler = async (event) => {
          const { serviceName, minCapacity, maxCapacity } = event;
          const clusterName = 'ai-validation-cluster-${environment}';
          
          try {
            await autoscaling.registerScalableTarget({
              ServiceNamespace: 'ecs',
              ResourceId: \`service/\${clusterName}/\${serviceName}\`,
              ScalableDimension: 'ecs:service:DesiredCount',
              MinCapacity: minCapacity,
              MaxCapacity: maxCapacity
            }).promise();
            
            console.log(\`Updated scaling for \${serviceName}: min=\${minCapacity}, max=\${maxCapacity}\`);
            return { statusCode: 200, body: 'Scaling updated successfully' };
          } catch (error) {
            console.error('Error updating scaling:', error);
            throw error;
          }
        };
      `),
      timeout: cdk.Duration.minutes(1),
    })

    // Grant permissions to update auto-scaling
    scalingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'application-autoscaling:RegisterScalableTarget',
          'application-autoscaling:DescribeScalableTargets',
          'ecs:UpdateService',
          'ecs:DescribeServices',
        ],
        resources: ['*'],
      })
    )

    // Create EventBridge rules for each schedule
    schedules.forEach(schedule => {
      Object.entries(services).forEach(([serviceName, service]) => {
        const rule = new events.Rule(this, `${schedule.name}${serviceName}Rule`, {
          schedule: schedule.schedule,
          description: `Scheduled scaling for ${serviceName} service`,
        })

        rule.addTarget(
          new targets.LambdaFunction(scalingFunction, {
            event: events.RuleTargetInput.fromObject({
              serviceName: service.serviceName,
              minCapacity: schedule.minCapacity,
              maxCapacity: schedule.maxCapacity,
            }),
          })
        )
      })
    })
  }

  private createCostOptimizationFunctions(environment: string): void {
    // Cost analysis function
    const costAnalysisFunction = new lambda.Function(this, 'CostAnalysisFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'cost_analysis.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
from datetime import datetime, timedelta

def handler(event, context):
    ce = boto3.client('ce')
    cloudwatch = boto3.client('cloudwatch')
    
    # Get cost data for the last 30 days
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    try:
        response = ce.get_cost_and_usage(
            TimePeriod={
                'Start': start_date,
                'End': end_date
            },
            Granularity='DAILY',
            Metrics=['BlendedCost'],
            GroupBy=[
                {'Type': 'TAG', 'Key': 'Service'},
                {'Type': 'TAG', 'Key': 'Environment'}
            ],
            Filter={
                'Tags': {
                    'Key': 'Project',
                    'Values': ['AI-Validation-Platform']
                }
            }
        )
        
        # Process cost data and send to CloudWatch
        for result in response['ResultsByTime']:
            date = result['TimePeriod']['Start']
            for group in result['Groups']:
                tags = dict(group['Keys'])
                cost = float(group['Metrics']['BlendedCost']['Amount'])
                
                service = tags.get('Service', 'Unknown')
                env = tags.get('Environment', '${environment}')
                
                cloudwatch.put_metric_data(
                    Namespace='CostOptimization',
                    MetricData=[
                        {
                            'MetricName': 'ServiceCost',
                            'Dimensions': [
                                {'Name': 'Service', 'Value': service},
                                {'Name': 'Environment', 'Value': env}
                            ],
                            'Value': cost,
                            'Unit': 'None',
                            'Timestamp': datetime.strptime(date, '%Y-%m-%d')
                        }
                    ]
                )
        
        return {
            'statusCode': 200,
            'body': json.dumps('Cost analysis completed successfully')
        }
        
    except Exception as e:
        print(f'Error: {str(e)}')
        raise e
      `),
      timeout: cdk.Duration.minutes(5),
    })

    // Grant permissions for cost analysis
    costAnalysisFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ce:GetCostAndUsage', 'ce:GetUsageReport', 'cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    )

    // Schedule cost analysis to run daily
    const costAnalysisRule = new events.Rule(this, 'CostAnalysisRule', {
      schedule: events.Schedule.cron({ hour: '6', minute: '0' }), // 6 AM UTC daily
      description: 'Daily cost analysis for AI Validation Platform',
    })

    costAnalysisRule.addTarget(new targets.LambdaFunction(costAnalysisFunction))

    // Right-sizing recommendations function
    const rightsizingFunction = new lambda.Function(this, 'RightsizingFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'rightsizing.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
from datetime import datetime, timedelta

def handler(event, context):
    ecs = boto3.client('ecs')
    cloudwatch = boto3.client('cloudwatch')
    sns = boto3.client('sns')
    
    cluster_name = 'ai-validation-cluster-${environment}'
    services = ['ai-validation-api-${environment}', 'ai-validation-orchestrator-${environment}', 'ai-validation-web-${environment}']
    
    recommendations = []
    
    for service_name in services:
        try:
            # Get service details
            service_response = ecs.describe_services(
                cluster=cluster_name,
                services=[service_name]
            )
            
            if not service_response['services']:
                continue
                
            service = service_response['services'][0]
            task_definition_arn = service['taskDefinition']
            
            # Get task definition
            task_def_response = ecs.describe_task_definition(
                taskDefinition=task_definition_arn
            )
            
            task_def = task_def_response['taskDefinition']
            current_cpu = task_def['cpu']
            current_memory = task_def['memory']
            
            # Get CloudWatch metrics for the last 7 days
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=7)
            
            # Get CPU utilization
            cpu_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/ECS',
                MetricName='CPUUtilization',
                Dimensions=[
                    {'Name': 'ServiceName', 'Value': service_name},
                    {'Name': 'ClusterName', 'Value': cluster_name}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,  # 1 hour
                Statistics=['Average', 'Maximum']
            )
            
            # Get Memory utilization
            memory_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/ECS',
                MetricName='MemoryUtilization',
                Dimensions=[
                    {'Name': 'ServiceName', 'Value': service_name},
                    {'Name': 'ClusterName', 'Value': cluster_name}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=3600,  # 1 hour
                Statistics=['Average', 'Maximum']
            )
            
            if cpu_response['Datapoints'] and memory_response['Datapoints']:
                avg_cpu = sum(dp['Average'] for dp in cpu_response['Datapoints']) / len(cpu_response['Datapoints'])
                max_cpu = max(dp['Maximum'] for dp in cpu_response['Datapoints'])
                avg_memory = sum(dp['Average'] for dp in memory_response['Datapoints']) / len(memory_response['Datapoints'])
                max_memory = max(dp['Maximum'] for dp in memory_response['Datapoints'])
                
                # Generate recommendations
                recommendation = {
                    'service': service_name,
                    'current_cpu': current_cpu,
                    'current_memory': current_memory,
                    'avg_cpu_utilization': round(avg_cpu, 2),
                    'max_cpu_utilization': round(max_cpu, 2),
                    'avg_memory_utilization': round(avg_memory, 2),
                    'max_memory_utilization': round(max_memory, 2)
                }
                
                # CPU recommendations
                if avg_cpu < 30 and max_cpu < 50:
                    recommendation['cpu_recommendation'] = 'DOWNSIZE'
                    recommendation['recommended_cpu'] = str(int(int(current_cpu) * 0.7))
                elif avg_cpu > 70 or max_cpu > 90:
                    recommendation['cpu_recommendation'] = 'UPSIZE'
                    recommendation['recommended_cpu'] = str(int(int(current_cpu) * 1.5))
                else:
                    recommendation['cpu_recommendation'] = 'OPTIMAL'
                    recommendation['recommended_cpu'] = current_cpu
                
                # Memory recommendations
                if avg_memory < 30 and max_memory < 50:
                    recommendation['memory_recommendation'] = 'DOWNSIZE'
                    recommendation['recommended_memory'] = str(int(int(current_memory) * 0.7))
                elif avg_memory > 70 or max_memory > 90:
                    recommendation['memory_recommendation'] = 'UPSIZE'
                    recommendation['recommended_memory'] = str(int(int(current_memory) * 1.5))
                else:
                    recommendation['memory_recommendation'] = 'OPTIMAL'
                    recommendation['recommended_memory'] = current_memory
                
                recommendations.append(recommendation)
        
        except Exception as e:
            print(f'Error analyzing {service_name}: {str(e)}')
    
    # Send recommendations via SNS if any changes are suggested
    changes_suggested = any(
        rec['cpu_recommendation'] != 'OPTIMAL' or rec['memory_recommendation'] != 'OPTIMAL'
        for rec in recommendations
    )
    
    if changes_suggested:
        message = "Right-sizing recommendations for AI Validation Platform:\\n\\n"
        for rec in recommendations:
            if rec['cpu_recommendation'] != 'OPTIMAL' or rec['memory_recommendation'] != 'OPTIMAL':
                message += f"Service: {rec['service']}\\n"
                message += f"  Current: {rec['current_cpu']} CPU, {rec['current_memory']} Memory\\n"
                message += f"  CPU Utilization: Avg {rec['avg_cpu_utilization']}%, Max {rec['max_cpu_utilization']}%\\n"
                message += f"  Memory Utilization: Avg {rec['avg_memory_utilization']}%, Max {rec['max_memory_utilization']}%\\n"
                message += f"  Recommendations: CPU {rec['cpu_recommendation']} -> {rec['recommended_cpu']}, Memory {rec['memory_recommendation']} -> {rec['recommended_memory']}\\n\\n"
        
        sns.publish(
            TopicArn='${this.costTopic.topicArn}',
            Subject='Right-sizing Recommendations - AI Validation Platform',
            Message=message
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'recommendations': recommendations,
            'changes_suggested': changes_suggested
        })
    }
      `),
      timeout: cdk.Duration.minutes(10),
    })

    // Grant permissions for right-sizing analysis
    rightsizingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecs:DescribeServices',
          'ecs:DescribeTaskDefinition',
          'cloudwatch:GetMetricStatistics',
          'sns:Publish',
        ],
        resources: ['*'],
      })
    )

    // Schedule right-sizing analysis to run weekly
    const rightsizingRule = new events.Rule(this, 'RightsizingRule', {
      schedule: events.Schedule.cron({ hour: '9', minute: '0', weekDay: 'MON' }), // Monday 9 AM UTC
      description: 'Weekly right-sizing analysis for AI Validation Platform',
    })

    rightsizingRule.addTarget(new targets.LambdaFunction(rightsizingFunction))
  }

  private addResourceTags(environment: string): void {
    // Common tags for all resources
    const commonTags = {
      Project: 'AI-Validation-Platform',
      Environment: environment,
      Owner: 'DevTeam',
      CostCenter: 'Engineering',
      Backup: environment === 'prod' ? 'Required' : 'Optional',
      Monitoring: 'Enabled',
      CreatedBy: 'CDK',
      LastModified: new Date().toISOString().split('T')[0],
    }

    // Apply tags to stack
    Object.entries(commonTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value)
    })

    // Service-specific tags
    const serviceSpecificTags = {
      Service: 'cost-optimization',
      Component: 'monitoring',
      Purpose: 'cost-tracking-and-optimization',
    }

    Object.entries(serviceSpecificTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value)
    })
  }
}
