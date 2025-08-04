# AI Validation Platform Infrastructure

AWS CDK infrastructure code for the AI-Powered Business Idea Validation Platform.

## Overview

This package contains Infrastructure as Code (IaC) using AWS CDK to provision and manage the cloud infrastructure required for the AI Validation Platform. It creates separate environments (dev, staging, prod) with appropriate resource sizing and security configurations.

## Architecture

### Network Infrastructure
- **VPC**: Custom VPC with public, private, and database subnets across 2 Availability Zones
- **Security Groups**: Restrictive security groups for database, Redis, and application tiers
- **NAT Gateways**: Cost-optimized NAT gateway configuration (1 for dev, 2 for prod)

### Compute & Storage
- **RDS PostgreSQL**: Free tier compatible database (t3.micro, 20GB) with automated backups
- **ElastiCache Redis**: Single-node Redis cluster for BullMQ and caching
- **S3 Buckets**: Encrypted buckets for evaluation reports and static assets
- **Secrets Manager**: Secure credential storage with automatic password generation

### Security & Access
- **IAM Roles**: Least privilege roles for application services
- **Database Encryption**: Encryption at rest for all data stores
- **VPC Security**: Private subnets for databases, public subnets for load balancers
- **Secrets Integration**: Automatic integration with AWS Secrets Manager from Story 1.0

## Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)

### Installation
```bash
npm install
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

### Deploy
```bash
# Bootstrap CDK (one-time setup per account/region)
npx cdk bootstrap

# Deploy development environment
npx cdk deploy AiValidationPlatformDev

# Deploy staging environment
npx cdk deploy AiValidationPlatformStaging

# Deploy production environment
npx cdk deploy AiValidationPlatformProd
```

## Stack Outputs

After deployment, the stack provides these outputs for application configuration:

- `VpcId`: VPC identifier
- `DatabaseEndpoint`: PostgreSQL database endpoint
- `DatabasePort`: PostgreSQL database port (5432)
- `RedisEndpoint`: ElastiCache Redis endpoint
- `ReportsBucketName`: S3 bucket for evaluation reports
- `AssetsBucketName`: S3 bucket for static assets
- `ApplicationRoleArn`: IAM role ARN for ECS tasks
- `ApplicationSecurityGroupId`: Security group for application services
- `PrivateSubnetIds`: Comma-separated list of private subnet IDs
- `PublicSubnetIds`: Comma-separated list of public subnet IDs

## Environment-Specific Configuration

### Development Environment
- Single NAT gateway for cost optimization
- Minimal database backup retention (1 day)
- No deletion protection
- No performance insights
- Single AZ deployment

### Production Environment
- Dual NAT gateways for high availability
- Extended backup retention (7 days)
- Deletion protection enabled
- Performance insights enabled
- Multi-AZ deployment
- S3 bucket versioning enabled

## Cost Optimization

The infrastructure is designed with AWS Free Tier in mind:
- **RDS**: t3.micro instance with 20GB storage
- **ElastiCache**: cache.t3.micro single node
- **EC2**: Future ECS tasks will use t3.micro instances
- **S3**: Lifecycle rules for automated cleanup
- **NAT Gateway**: Single gateway in dev environment

## Security Features

### Network Security
- Private subnets for databases and application services
- Security groups with minimal required access
- No direct internet access to database tier

### Data Security
- Encryption at rest for RDS and S3
- Automated credential generation and rotation
- Integration with AWS Secrets Manager
- IAM roles with least privilege access

### Monitoring & Compliance
- CloudWatch integration ready
- Resource tagging for cost allocation
- Audit-ready IAM policies

## Testing

The infrastructure includes comprehensive unit tests using CDK assertions:

```bash
npm test
```

Tests validate:
- Resource creation and configuration
- Security group rules
- IAM policies and roles
- Environment-specific settings
- Cost optimization features

## Commands

- `npm run build`: Compile TypeScript to JavaScript
- `npm run test`: Run unit tests
- `npm run lint`: Run ESLint
- `npm run clean`: Remove build artifacts
- `npx cdk synth`: Synthesize CloudFormation template
- `npx cdk diff`: Compare deployed stack with current state
- `npx cdk deploy`: Deploy this stack to your default AWS account/region
- `npx cdk destroy`: Destroy the deployed stack

## Integration with Application Services

This infrastructure integrates with services from previous stories:
- **Story 1.0**: Credential management via AWS Secrets Manager
- **Story 1.2**: PostgreSQL database for data persistence
- **Story 1.3-1.6**: Application services deployment ready

The infrastructure provides all necessary resources for containerized deployment of:
- API service (Express.js)
- Orchestrator service (BullMQ)
- Web frontend (Vue.js)
- AI agents (LangChain + LLM providers)

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**
   ```bash
   npx cdk bootstrap
   ```

2. **AWS Credentials Not Configured**
   ```bash
   aws configure
   ```

3. **Region Mismatch**
   Ensure `CDK_DEFAULT_REGION` matches your AWS CLI configuration

4. **Resource Limits**
   Check AWS service quotas if deployment fails

### Support

For infrastructure issues, check:
- AWS CloudFormation console for stack events
- CDK diff output for unexpected changes
- AWS service limits and quotas
- IAM permissions for deployment user/role