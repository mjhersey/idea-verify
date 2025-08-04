#!/usr/bin/env python3

"""
Cost Reporting Script for AI Validation Platform
Generates comprehensive cost reports with allocation tracking and recommendations
"""

import boto3
import json
import csv
import argparse
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from botocore.exceptions import ClientError, NoCredentialsError

class CostReporter:
    """Comprehensive cost reporting and analysis tool"""
    
    def __init__(self, environment: str = 'all'):
        """Initialize the cost reporter with AWS clients"""
        try:
            self.ce_client = boto3.client('ce')  # Cost Explorer
            self.cloudwatch_client = boto3.client('cloudwatch')
            self.sts_client = boto3.client('sts')
            self.environment = environment
            
            # Verify AWS credentials
            self.account_id = self.sts_client.get_caller_identity()['Account']
            print(f"📊 Connected to AWS Account: {self.account_id}")
            
        except NoCredentialsError:
            print("❌ AWS credentials not found. Please configure AWS CLI or set environment variables.")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error initializing AWS clients: {str(e)}")
            sys.exit(1)
    
    def get_cost_and_usage(self, start_date: str, end_date: str, granularity: str = 'MONTHLY') -> Dict[str, Any]:
        """Get cost and usage data from AWS Cost Explorer"""
        try:
            filters = {
                'Tags': {
                    'Key': 'Project',
                    'Values': ['AI-Validation-Platform']
                }
            }
            
            # Add environment filter if specific environment requested
            if self.environment != 'all':
                filters = {
                    'And': [
                        filters,
                        {
                            'Tags': {
                                'Key': 'Environment',
                                'Values': [self.environment]
                            }
                        }
                    ]
                }
            
            response = self.ce_client.get_cost_and_usage(
                TimePeriod={
                    'Start': start_date,
                    'End': end_date
                },
                Granularity=granularity,
                Metrics=['BlendedCost', 'UsageQuantity'],
                GroupBy=[
                    {'Type': 'TAG', 'Key': 'Environment'},
                    {'Type': 'TAG', 'Key': 'Service'},
                    {'Type': 'DIMENSION', 'Key': 'SERVICE'}
                ],
                Filter=filters
            )
            
            return response
            
        except ClientError as e:
            print(f"❌ Error retrieving cost data: {e}")
            return {}
    
    def get_rightsizing_recommendations(self) -> Dict[str, Any]:
        """Get rightsizing recommendations from AWS Cost Explorer"""
        try:
            response = self.ce_client.get_rightsizing_recommendation(
                Filter={
                    'Tags': {
                        'Key': 'Project',
                        'Values': ['AI-Validation-Platform']
                    }
                },
                Configuration={
                    'BenefitsConsidered': True,
                    'RecommendationTarget': 'SAME_INSTANCE_FAMILY'
                }
            )
            
            return response
            
        except ClientError as e:
            print(f"⚠️  Rightsizing recommendations not available: {e}")
            return {}
    
    def get_usage_forecast(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get usage forecast for the next period"""
        try:
            response = self.ce_client.get_usage_forecast(
                TimePeriod={
                    'Start': start_date,
                    'End': end_date
                },
                Metric='BLENDED_COST',
                Granularity='MONTHLY',
                Filter={
                    'Tags': {
                        'Key': 'Project',
                        'Values': ['AI-Validation-Platform']
                    }
                }
            )
            
            return response
            
        except ClientError as e:
            print(f"⚠️  Usage forecast not available: {e}")
            return {}
    
    def process_cost_data(self, cost_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and structure cost data for reporting"""
        processed_data = {
            'total_cost': 0.0,
            'by_environment': defaultdict(float),
            'by_service': defaultdict(float),
            'by_aws_service': defaultdict(float),
            'daily_costs': [],
            'monthly_trend': []
        }
        
        if not cost_data or 'ResultsByTime' not in cost_data:
            return processed_data
        
        for result in cost_data['ResultsByTime']:
            period_start = result['TimePeriod']['Start']
            period_total = 0.0
            
            for group in result['Groups']:
                keys = group['Keys']
                cost = float(group['Metrics']['BlendedCost']['Amount'])
                
                # Extract tags and dimensions
                environment = 'unknown'
                service = 'unknown'
                aws_service = 'unknown'
                
                for i, key in enumerate(keys):
                    if i == 0 and key:  # Environment tag
                        environment = key
                    elif i == 1 and key:  # Service tag
                        service = key
                    elif i == 2 and key:  # AWS Service dimension
                        aws_service = key
                
                # Aggregate costs
                processed_data['by_environment'][environment] += cost
                processed_data['by_service'][service] += cost
                processed_data['by_aws_service'][aws_service] += cost
                period_total += cost
            
            processed_data['daily_costs'].append({
                'date': period_start,
                'cost': period_total
            })
            
            processed_data['total_cost'] += period_total
        
        return processed_data
    
    def generate_cost_allocation_report(self, days: int = 30) -> Dict[str, Any]:
        """Generate detailed cost allocation report"""
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        print(f"📈 Generating cost allocation report for {days} days ({start_date} to {end_date})")
        
        # Get cost data
        cost_data = self.get_cost_and_usage(start_date, end_date, 'DAILY')
        processed_data = self.process_cost_data(cost_data)
        
        # Get recommendations
        recommendations = self.get_rightsizing_recommendations()
        
        # Get forecast
        forecast_start = datetime.now().strftime('%Y-%m-%d')
        forecast_end = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        forecast_data = self.get_usage_forecast(forecast_start, forecast_end)
        
        report = {
            'metadata': {
                'report_date': datetime.now().isoformat(),
                'period_start': start_date,
                'period_end': end_date,
                'environment': self.environment,
                'account_id': self.account_id
            },
            'summary': {
                'total_cost': processed_data['total_cost'],
                'average_daily_cost': processed_data['total_cost'] / days,
                'projected_monthly_cost': (processed_data['total_cost'] / days) * 30
            },
            'cost_breakdown': {
                'by_environment': dict(processed_data['by_environment']),
                'by_service': dict(processed_data['by_service']),
                'by_aws_service': dict(processed_data['by_aws_service'])
            },
            'trends': {
                'daily_costs': processed_data['daily_costs']
            },
            'recommendations': self._process_recommendations(recommendations),
            'forecast': self._process_forecast(forecast_data)
        }
        
        return report
    
    def _process_recommendations(self, recommendations: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process rightsizing recommendations"""
        if not recommendations or 'RightsizingRecommendations' not in recommendations:
            return []
        
        processed_recommendations = []
        
        for rec in recommendations['RightsizingRecommendations']:
            processed_rec = {
                'account_id': rec.get('AccountId', ''),
                'current_instance': rec.get('CurrentInstance', {}),
                'rightsizing_type': rec.get('RightsizingType', ''),
                'modify_recommendation': rec.get('ModifyRecommendationDetail', {}),
                'terminate_recommendation': rec.get('TerminateRecommendationDetail', {}),
                'estimated_monthly_savings': rec.get('EstimatedMonthlySavings', '0')
            }
            processed_recommendations.append(processed_rec)
        
        return processed_recommendations
    
    def _process_forecast(self, forecast_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process usage forecast data"""
        if not forecast_data or 'ForecastResultsByTime' not in forecast_data:
            return {}
        
        forecast_results = []
        total_forecast = 0.0
        
        for result in forecast_data['ForecastResultsByTime']:
            period = result['TimePeriod']
            mean_value = float(result['MeanValue'])
            
            forecast_results.append({
                'period_start': period['Start'],
                'period_end': period['End'],
                'forecasted_cost': mean_value
            })
            
            total_forecast += mean_value
        
        return {
            'total_forecasted_cost': total_forecast,
            'forecast_by_period': forecast_results
        }
    
    def generate_visualizations(self, report: Dict[str, Any], output_dir: str = '.') -> List[str]:
        """Generate cost visualization charts"""
        generated_files = []
        
        # Set style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
        # 1. Cost by Environment Pie Chart
        if report['cost_breakdown']['by_environment']:
            plt.figure(figsize=(10, 8))
            env_data = report['cost_breakdown']['by_environment']
            
            plt.pie(env_data.values(), labels=env_data.keys(), autopct='%1.1f%%', startangle=90)
            plt.title(f'Cost Distribution by Environment\nTotal: ${report["summary"]["total_cost"]:.2f}')
            
            filename = f'{output_dir}/cost_by_environment.png'
            plt.savefig(filename, dpi=300, bbox_inches='tight')
            plt.close()
            generated_files.append(filename)
        
        # 2. Cost by Service Bar Chart
        if report['cost_breakdown']['by_service']:
            plt.figure(figsize=(12, 6))
            service_data = report['cost_breakdown']['by_service']
            
            plt.bar(service_data.keys(), service_data.values())
            plt.title('Cost Distribution by Service')
            plt.xlabel('Service')
            plt.ylabel('Cost ($)')
            plt.xticks(rotation=45)
            
            filename = f'{output_dir}/cost_by_service.png'
            plt.savefig(filename, dpi=300, bbox_inches='tight')
            plt.close()
            generated_files.append(filename)
        
        # 3. Daily Cost Trend
        if report['trends']['daily_costs']:
            plt.figure(figsize=(14, 6))
            trend_data = report['trends']['daily_costs']
            
            dates = [datetime.strptime(item['date'], '%Y-%m-%d') for item in trend_data]
            costs = [item['cost'] for item in trend_data]
            
            plt.plot(dates, costs, marker='o', linewidth=2, markersize=4)
            plt.title('Daily Cost Trend')
            plt.xlabel('Date')
            plt.ylabel('Daily Cost ($)')
            plt.xticks(rotation=45)
            plt.grid(True, alpha=0.3)
            
            filename = f'{output_dir}/daily_cost_trend.png'
            plt.savefig(filename, dpi=300, bbox_inches='tight')
            plt.close()
            generated_files.append(filename)
        
        # 4. AWS Service Cost Distribution
        if report['cost_breakdown']['by_aws_service']:
            plt.figure(figsize=(12, 8))
            aws_service_data = report['cost_breakdown']['by_aws_service']
            
            # Only show top 10 services
            sorted_services = sorted(aws_service_data.items(), key=lambda x: x[1], reverse=True)[:10]
            services, costs = zip(*sorted_services)
            
            plt.barh(services, costs)
            plt.title('Top 10 AWS Services by Cost')
            plt.xlabel('Cost ($)')
            plt.ylabel('AWS Service')
            
            filename = f'{output_dir}/cost_by_aws_service.png'
            plt.savefig(filename, dpi=300, bbox_inches='tight')
            plt.close()
            generated_files.append(filename)
        
        return generated_files
    
    def export_to_csv(self, report: Dict[str, Any], filename: str) -> str:
        """Export cost data to CSV format"""
        # Prepare data for CSV
        rows = []
        
        # Add summary data
        rows.append(['Summary', '', '', ''])
        rows.append(['Total Cost', report['summary']['total_cost'], '', ''])
        rows.append(['Average Daily Cost', report['summary']['average_daily_cost'], '', ''])
        rows.append(['Projected Monthly Cost', report['summary']['projected_monthly_cost'], '', ''])
        rows.append(['', '', '', ''])
        
        # Add environment breakdown
        rows.append(['Cost by Environment', '', '', ''])
        for env, cost in report['cost_breakdown']['by_environment'].items():
            rows.append([env, cost, '', ''])
        rows.append(['', '', '', ''])
        
        # Add service breakdown
        rows.append(['Cost by Service', '', '', ''])
        for service, cost in report['cost_breakdown']['by_service'].items():
            rows.append([service, cost, '', ''])
        rows.append(['', '', '', ''])
        
        # Add daily costs
        rows.append(['Daily Costs', '', '', ''])
        rows.append(['Date', 'Cost', '', ''])
        for daily_cost in report['trends']['daily_costs']:
            rows.append([daily_cost['date'], daily_cost['cost'], '', ''])
        
        # Write to CSV
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Category', 'Value/Name', 'Cost', 'Notes'])
            writer.writerows(rows)
        
        return filename
    
    def export_to_json(self, report: Dict[str, Any], filename: str) -> str:
        """Export complete report to JSON format"""
        with open(filename, 'w', encoding='utf-8') as jsonfile:
            json.dump(report, jsonfile, indent=2, default=str)
        
        return filename
    
    def print_summary_report(self, report: Dict[str, Any]) -> None:
        """Print a formatted summary report to console"""
        print("\n" + "="*80)
        print("🏢 AI VALIDATION PLATFORM - COST REPORT")
        print("="*80)
        
        metadata = report['metadata']
        print(f"📅 Report Date: {metadata['report_date']}")
        print(f"🗓️  Period: {metadata['period_start']} to {metadata['period_end']}")
        print(f"🌍 Environment: {metadata['environment']}")
        print(f"🏦 Account ID: {metadata['account_id']}")
        
        print("\n📊 COST SUMMARY")
        print("-" * 40)
        summary = report['summary']
        print(f"💰 Total Cost: ${summary['total_cost']:.2f}")
        print(f"📈 Average Daily Cost: ${summary['average_daily_cost']:.2f}")
        print(f"📅 Projected Monthly Cost: ${summary['projected_monthly_cost']:.2f}")
        
        print("\n🏷️  COST BY ENVIRONMENT")
        print("-" * 40)
        for env, cost in sorted(report['cost_breakdown']['by_environment'].items(), key=lambda x: x[1], reverse=True):
            percentage = (cost / summary['total_cost'] * 100) if summary['total_cost'] > 0 else 0
            print(f"  {env:12} ${cost:8.2f} ({percentage:5.1f}%)")
        
        print("\n🔧 COST BY SERVICE")
        print("-" * 40)
        for service, cost in sorted(report['cost_breakdown']['by_service'].items(), key=lambda x: x[1], reverse=True):
            percentage = (cost / summary['total_cost'] * 100) if summary['total_cost'] > 0 else 0
            print(f"  {service:12} ${cost:8.2f} ({percentage:5.1f}%)")
        
        print("\n☁️  TOP AWS SERVICES")
        print("-" * 40)
        aws_services = sorted(report['cost_breakdown']['by_aws_service'].items(), key=lambda x: x[1], reverse=True)[:5]
        for service, cost in aws_services:
            percentage = (cost / summary['total_cost'] * 100) if summary['total_cost'] > 0 else 0
            print(f"  {service:20} ${cost:8.2f} ({percentage:5.1f}%)")
        
        if report['recommendations']:
            print("\n💡 RIGHTSIZING RECOMMENDATIONS")
            print("-" * 40)
            total_savings = sum(float(rec.get('estimated_monthly_savings', 0)) for rec in report['recommendations'])
            print(f"  Potential Monthly Savings: ${total_savings:.2f}")
            print(f"  Number of Recommendations: {len(report['recommendations'])}")
        
        if report['forecast'] and 'total_forecasted_cost' in report['forecast']:
            print("\n🔮 30-DAY FORECAST")
            print("-" * 40)
            forecast_cost = report['forecast']['total_forecasted_cost']
            print(f"  Forecasted Cost (30 days): ${forecast_cost:.2f}")
            current_monthly = summary['projected_monthly_cost']
            if current_monthly > 0:
                change = ((forecast_cost - current_monthly) / current_monthly) * 100
                trend = "📈" if change > 0 else "📉" if change < 0 else "➡️"
                print(f"  Change from Current Trend: {trend} {change:+.1f}%")
        
        print("\n" + "="*80)

def main():
    """Main function to run cost reporting"""
    parser = argparse.ArgumentParser(description='AI Validation Platform Cost Reporter')
    parser.add_argument('-e', '--environment', choices=['dev', 'staging', 'prod', 'all'], 
                       default='all', help='Environment to analyze (default: all)')
    parser.add_argument('-d', '--days', type=int, default=30, 
                       help='Number of days to analyze (default: 30)')
    parser.add_argument('-o', '--output', default='cost_report', 
                       help='Output file prefix (default: cost_report)')
    parser.add_argument('--format', choices=['json', 'csv', 'both'], default='both',
                       help='Output format (default: both)')
    parser.add_argument('--charts', action='store_true', 
                       help='Generate visualization charts')
    parser.add_argument('--quiet', action='store_true', 
                       help='Suppress console output')
    
    args = parser.parse_args()
    
    try:
        # Initialize reporter
        reporter = CostReporter(args.environment)
        
        # Generate report
        report = reporter.generate_cost_allocation_report(args.days)
        
        # Print summary unless quiet mode
        if not args.quiet:
            reporter.print_summary_report(report)
        
        # Export data
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        generated_files = []
        
        if args.format in ['json', 'both']:
            json_file = f"{args.output}_{args.environment}_{timestamp}.json"
            reporter.export_to_json(report, json_file)
            generated_files.append(json_file)
            print(f"📄 JSON report saved: {json_file}")
        
        if args.format in ['csv', 'both']:
            csv_file = f"{args.output}_{args.environment}_{timestamp}.csv"
            reporter.export_to_csv(report, csv_file)
            generated_files.append(csv_file)
            print(f"📊 CSV report saved: {csv_file}")
        
        # Generate charts if requested
        if args.charts:
            try:
                chart_files = reporter.generate_visualizations(report, '.')
                generated_files.extend(chart_files)
                print(f"📈 Generated {len(chart_files)} visualization charts")
            except ImportError:
                print("⚠️  Visualization libraries not available. Install matplotlib and seaborn for charts.")
            except Exception as e:
                print(f"⚠️  Error generating charts: {str(e)}")
        
        print(f"\n✅ Cost report generation completed successfully!")
        print(f"📁 Generated {len(generated_files)} output files")
        
    except KeyboardInterrupt:
        print("\n⏹️  Report generation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error generating cost report: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()