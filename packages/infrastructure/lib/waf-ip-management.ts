import * as cdk from 'aws-cdk-lib'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export interface WAFIPManagementProps extends cdk.StackProps {
  environment: string
}

export class WAFIPManagement extends Construct {
  public readonly blockedIpSet: wafv2.CfnIPSet
  public readonly suspiciousIpSet: wafv2.CfnIPSet
  public readonly ipManagementFunction: lambda.Function

  constructor(scope: Construct, id: string, props: WAFIPManagementProps) {
    super(scope, id)

    const { environment } = props

    // Create IP sets for different threat levels
    this.createIPSets(environment)

    // Create Lambda function for automated IP management
    this.createIPManagementFunction(environment)

    // Set up automated threat intelligence updates
    this.setupThreatIntelligenceUpdates(environment)
  }

  private createIPSets(environment: string): void {
    // Blocked IP set for confirmed malicious IPs
    this.blockedIpSet = new wafv2.CfnIPSet(this, 'BlockedIPSet', {
      name: `ai-validation-blocked-ips-${environment}`,
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: this.getKnownBadIps(),
      description: 'IP addresses that are permanently blocked',
    })

    // Suspicious IP set for temporary blocking
    this.suspiciousIpSet = new wafv2.CfnIPSet(this, 'SuspiciousIPSet', {
      name: `ai-validation-suspicious-ips-${environment}`,
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: [],
      description: 'IP addresses under temporary restriction',
    })

    // Add tags
    cdk.Tags.of(this.blockedIpSet).add('ManagedBy', 'CDK')
    cdk.Tags.of(this.blockedIpSet).add('Environment', environment)
    cdk.Tags.of(this.suspiciousIpSet).add('ManagedBy', 'CDK')
    cdk.Tags.of(this.suspiciousIpSet).add('Environment', environment)
  }

  private createIPManagementFunction(environment: string): void {
    // Create log group for the function
    const logGroup = new logs.LogGroup(this, 'IPManagementLogGroup', {
      logGroupName: `/aws/lambda/ai-validation-ip-management-${environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
    })

    // Create the Lambda function
    this.ipManagementFunction = new lambda.Function(this, 'IPManagementFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'ip_management.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import urllib3
import os
from datetime import datetime, timedelta
from typing import List, Dict, Set

# Initialize clients
wafv2 = boto3.client('wafv2')
cloudwatch = boto3.client('cloudwatch')
http = urllib3.PoolManager()

# Configuration
BLOCKED_IP_SET_ID = os.environ['BLOCKED_IP_SET_ID']
SUSPICIOUS_IP_SET_ID = os.environ['SUSPICIOUS_IP_SET_ID']
ENVIRONMENT = os.environ['ENVIRONMENT']

def handler(event, context):
    """
    Main handler for IP management operations
    """
    try:
        operation = event.get('operation', 'update_threat_intelligence')
        
        if operation == 'update_threat_intelligence':
            return update_threat_intelligence()
        elif operation == 'analyze_logs':
            return analyze_waf_logs()
        elif operation == 'cleanup_temporary_blocks':
            return cleanup_temporary_blocks()
        elif operation == 'add_ip':
            return add_ip_to_set(event['ip'], event['set_type'], event.get('reason', ''))
        elif operation == 'remove_ip':
            return remove_ip_from_set(event['ip'], event['set_type'])
        else:
            return {'statusCode': 400, 'body': f'Unknown operation: {operation}'}
            
    except Exception as e:
        print(f'Error in IP management: {str(e)}')
        return {'statusCode': 500, 'body': f'Error: {str(e)}'}

def update_threat_intelligence():
    """
    Update IP sets with latest threat intelligence
    """
    print('Updating threat intelligence...')
    
    # Get current blocked IPs
    current_blocked = get_current_ips(BLOCKED_IP_SET_ID)
    
    # Fetch threat intelligence from multiple sources
    new_threats = fetch_threat_intelligence()
    
    # Merge with existing IPs
    updated_ips = list(set(current_blocked + new_threats))
    
    # Limit to AWS WAF maximum (10,000 IPs per set)
    if len(updated_ips) > 9500:  # Leave some room for manual additions
        updated_ips = updated_ips[:9500]
        print(f'Truncated IP list to 9500 entries')
    
    # Update the IP set
    if updated_ips != current_blocked:
        update_ip_set(BLOCKED_IP_SET_ID, updated_ips)
        print(f'Updated blocked IP set: {len(updated_ips)} total IPs')
        
        # Send CloudWatch metric
        cloudwatch.put_metric_data(
            Namespace='AI-Validation/Security',
            MetricData=[
                {
                    'MetricName': 'BlockedIPCount',
                    'Value': len(updated_ips),
                    'Unit': 'Count',
                    'Dimensions': [
                        {'Name': 'Environment', 'Value': ENVIRONMENT}
                    ]
                }
            ]
        )
    else:
        print('No new threats found')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Threat intelligence updated',
            'blocked_ip_count': len(updated_ips),
            'new_threats': len(new_threats)
        })
    }

def fetch_threat_intelligence() -> List[str]:
    """
    Fetch threat intelligence from various sources
    """
    threats = []
    
    # Known malicious IP ranges (examples - replace with real sources)
    known_bad_ranges = [
        # Tor exit nodes (sample)
        '185.220.100.0/24',
        '185.220.101.0/24',
        # Known bot networks
        '195.123.245.0/24',
        # Scanning networks
        '192.42.116.0/24',
    ]
    
    # Convert CIDR ranges to individual IPs (simplified)
    for cidr in known_bad_ranges:
        if '/32' in cidr:
            threats.append(cidr.replace('/32', ''))
        elif '/24' in cidr:
            # For demo purposes, just add the network address
            threats.append(cidr.replace('/24', '.0'))
    
    # In production, you would fetch from:
    # - Commercial threat intelligence feeds
    # - Government feeds (if available)
    # - Open source intelligence
    # - Your own analytics
    
    return threats

def analyze_waf_logs():
    """
    Analyze WAF logs to identify suspicious patterns
    """
    print('Analyzing WAF logs for suspicious patterns...')
    
    # This would typically analyze CloudWatch Logs or S3 logs
    # For now, return a placeholder
    
    suspicious_ips = []
    
    # Example: IPs with high request rates or attack patterns
    # In production, this would query actual logs
    
    if suspicious_ips:
        current_suspicious = get_current_ips(SUSPICIOUS_IP_SET_ID)
        updated_suspicious = list(set(current_suspicious + suspicious_ips))
        
        if len(updated_suspicious) > 1000:  # Reasonable limit for suspicious IPs
            updated_suspicious = updated_suspicious[:1000]
        
        update_ip_set(SUSPICIOUS_IP_SET_ID, updated_suspicious)
        print(f'Updated suspicious IP set: {len(updated_suspicious)} IPs')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'WAF log analysis completed',
            'suspicious_ips_found': len(suspicious_ips)
        })
    }

def cleanup_temporary_blocks():
    """
    Remove IPs from suspicious list that have been there too long
    """
    print('Cleaning up temporary blocks...')
    
    # This would check timestamps and remove old entries
    # For now, just clear suspicious IPs older than 24 hours
    
    current_suspicious = get_current_ips(SUSPICIOUS_IP_SET_ID)
    
    # In a real implementation, you'd track timestamps
    # For demo, just clear the suspicious list periodically
    if len(current_suspicious) > 100:
        cleaned_list = current_suspicious[:50]  # Keep most recent 50
        update_ip_set(SUSPICIOUS_IP_SET_ID, cleaned_list)
        print(f'Cleaned suspicious IP list: {len(cleaned_list)} remaining')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Cleanup completed',
            'remaining_suspicious_ips': len(current_suspicious)
        })
    }

def get_current_ips(ip_set_id: str) -> List[str]:
    """
    Get current IPs from an IP set
    """
    try:
        response = wafv2.get_ip_set(
            Scope='REGIONAL',
            Id=ip_set_id
        )
        return response['IPSet']['Addresses']
    except Exception as e:
        print(f'Error getting IP set {ip_set_id}: {str(e)}')
        return []

def update_ip_set(ip_set_id: str, addresses: List[str]):
    """
    Update an IP set with new addresses
    """
    try:
        # First get the current lock token
        response = wafv2.get_ip_set(
            Scope='REGIONAL',
            Id=ip_set_id
        )
        
        lock_token = response['LockToken']
        
        # Update the IP set
        wafv2.update_ip_set(
            Scope='REGIONAL',
            Id=ip_set_id,
            Addresses=addresses,
            LockToken=lock_token
        )
        
        print(f'Successfully updated IP set {ip_set_id} with {len(addresses)} addresses')
        
    except Exception as e:
        print(f'Error updating IP set {ip_set_id}: {str(e)}')
        raise

def add_ip_to_set(ip: str, set_type: str, reason: str = ''):
    """
    Add a single IP to the specified set
    """
    ip_set_id = BLOCKED_IP_SET_ID if set_type == 'blocked' else SUSPICIOUS_IP_SET_ID
    
    current_ips = get_current_ips(ip_set_id)
    
    if ip not in current_ips:
        current_ips.append(ip)
        update_ip_set(ip_set_id, current_ips)
        print(f'Added IP {ip} to {set_type} set. Reason: {reason}')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': f'IP {ip} added to {set_type} set',
            'reason': reason
        })
    }

def remove_ip_from_set(ip: str, set_type: str):
    """
    Remove a single IP from the specified set
    """
    ip_set_id = BLOCKED_IP_SET_ID if set_type == 'blocked' else SUSPICIOUS_IP_SET_ID
    
    current_ips = get_current_ips(ip_set_id)
    
    if ip in current_ips:
        current_ips.remove(ip)
        update_ip_set(ip_set_id, current_ips)
        print(f'Removed IP {ip} from {set_type} set')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': f'IP {ip} removed from {set_type} set'
        })
    }
      `),
      environment: {
        BLOCKED_IP_SET_ID: this.blockedIpSet.attrId,
        SUSPICIOUS_IP_SET_ID: this.suspiciousIpSet.attrId,
        ENVIRONMENT: environment,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      logGroup: logGroup,
    })

    // Grant permissions to manage WAF IP sets
    this.ipManagementFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['wafv2:GetIPSet', 'wafv2:UpdateIPSet', 'wafv2:ListIPSets'],
        resources: [this.blockedIpSet.attrArn, this.suspiciousIpSet.attrArn],
      })
    )

    // Grant permissions to read WAF logs
    this.ipManagementFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:GetLogEvents',
          'logs:FilterLogEvents',
        ],
        resources: [`arn:aws:logs:*:*:log-group:/aws/wafv2/*`],
      })
    )

    // Grant permissions to write CloudWatch metrics
    this.ipManagementFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    )
  }

  private setupThreatIntelligenceUpdates(environment: string): void {
    // Schedule threat intelligence updates
    const threatIntelRule = new events.Rule(this, 'ThreatIntelligenceUpdateRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(6)), // Update every 6 hours
      description: 'Update threat intelligence feeds',
    })

    threatIntelRule.addTarget(
      new targets.LambdaFunction(this.ipManagementFunction, {
        event: events.RuleTargetInput.fromObject({
          operation: 'update_threat_intelligence',
        }),
      })
    )

    // Schedule log analysis
    const logAnalysisRule = new events.Rule(this, 'LogAnalysisRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)), // Analyze logs hourly
      description: 'Analyze WAF logs for suspicious patterns',
    })

    logAnalysisRule.addTarget(
      new targets.LambdaFunction(this.ipManagementFunction, {
        event: events.RuleTargetInput.fromObject({
          operation: 'analyze_logs',
        }),
      })
    )

    // Schedule cleanup of temporary blocks
    const cleanupRule = new events.Rule(this, 'CleanupRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(24)), // Daily cleanup
      description: 'Clean up temporary IP blocks',
    })

    cleanupRule.addTarget(
      new targets.LambdaFunction(this.ipManagementFunction, {
        event: events.RuleTargetInput.fromObject({
          operation: 'cleanup_temporary_blocks',
        }),
      })
    )
  }

  private getKnownBadIps(): string[] {
    // Known malicious IPs and ranges
    return [
      // Known scanning/attack sources
      '192.168.1.100', // Example - replace with real malicious IPs
      '10.0.0.100', // Example internal test IP
      // Add more known bad IPs here
    ]
  }

  // Public methods for integration with SecurityStack
  public getBlockedIpSetArn(): string {
    return this.blockedIpSet.attrArn
  }

  public getSuspiciousIpSetArn(): string {
    return this.suspiciousIpSet.attrArn
  }
}
