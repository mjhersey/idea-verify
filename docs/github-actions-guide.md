# GitHub Actions Workflows Guide

This document explains the GitHub Actions workflows configured for the AI
Validation Platform.

## Workflow Overview

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Purpose**: Continuous Integration for code quality and testing

**Triggers**:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs**:

- **Security & Dependencies**: Audits for vulnerabilities
- **Lint & Format**: Code style and formatting checks
- **TypeScript**: Type checking and compilation
- **Unit Tests**: Package-specific unit tests
- **Integration Tests**: Database and service integration (conditional)
- **Build Verification**: Ensures all packages build correctly
- **E2E Tests**: End-to-end testing (conditional)
- **Final Validation**: Comprehensive validation with development-friendly error
  handling

**Development Environment Behavior**:

- Core jobs (security, lint, typecheck, test, build) must pass
- Integration and E2E tests allow failures in development environments
- Use commit message flags to control behavior:
  - `[skip integration]` - Skip integration tests
  - `[skip e2e]` - Skip end-to-end tests

### 2. Infrastructure Deployment (`.github/workflows/deploy-infrastructure.yml`)

**Purpose**: Deploy AWS infrastructure using CDK

**Triggers**:

- Manual workflow dispatch (workflow_dispatch)
- Push to `main` branch with infrastructure changes
- Pull requests with infrastructure changes (validation only)

**Environment Handling**:

- **Development**: Skips deployment if AWS credentials not configured
- **Staging/Production**: Requires proper AWS credentials and approvals

**Development Behavior**:

- Infrastructure validation always runs (CDK synth)
- Actual deployment skipped gracefully if AWS credentials missing
- Shows helpful messages explaining development environment expectations

### 3. Development Environment Check (`.github/workflows/dev-environment-check.yml`)

**Purpose**: Validate development environment setup

**Features**:

- Package structure validation
- Development script availability
- Docker configuration checks
- Local build process testing
- Development server setup validation
- Generates status report in workflow summary

## Development Environment Usage

### Expected Workflow Behavior in Development

When you push commits to GitHub from a development environment:

1. **✅ Will Pass**:
   - Security audits
   - Linting and formatting
   - TypeScript compilation
   - Unit tests
   - Build verification
   - Development environment validation

2. **⚠️ May Fail (Expected)**:
   - Integration tests (no deployed infrastructure)
   - E2E tests (no deployed services)
   - Infrastructure deployment (no AWS credentials)

3. **✅ Final Status**:
   - Workflow completes successfully
   - Shows warnings for expected failures
   - Confirms core development requirements met

### Controlling Workflow Behavior

Use commit message flags to control execution:

```bash
# Skip integration tests
git commit -m "feat: add new feature [skip integration]"

# Skip E2E tests
git commit -m "fix: bug fix [skip e2e]"

# Skip both
git commit -m "refactor: code cleanup [skip integration] [skip e2e]"
```

### Setting Up Production Environment

For staging/production deployment:

1. **AWS Credentials**: Configure GitHub Secrets
   - `AWS_ROLE_TO_ASSUME_DEV`
   - `AWS_ROLE_TO_ASSUME_STAGING`
   - `AWS_ROLE_TO_ASSUME_PROD`

2. **Environment Protection**: Enable required reviewers for production

3. **Manual Deployment**: Use workflow dispatch for controlled deployments

## Workflow Files Structure

```
.github/workflows/
├── ci.yml                     # Main CI/CD pipeline
├── deploy-infrastructure.yml  # Infrastructure deployment
├── dev-environment-check.yml  # Development validation
├── rollback.yml              # Automated rollback procedures
└── promote-environment.yml   # Environment promotion pipeline
```

## Monitoring Workflow Status

### GitHub Actions UI

- View workflow runs in repository Actions tab
- Check job details and logs
- Monitor artifact uploads and downloads

### Workflow Summaries

Each workflow generates summaries showing:

- Job status and results
- Development environment compatibility
- Deployment status and next steps
- Error details and troubleshooting tips

## Troubleshooting Common Issues

### Build Failures

1. **Dependency Issues**:

   ```bash
   npm run install:all
   npm run clean
   npm run build
   ```

2. **Type Errors**:

   ```bash
   npm run typecheck --workspace=packages/api
   ```

3. **Lint Failures**:
   ```bash
   npm run lint
   npm run format
   ```

### Integration Test Failures

Expected in development environment:

- No deployed database
- No deployed Redis
- No deployed API services

**Solution**: Add `[skip integration]` to commit message or configure local
services

### Infrastructure Deployment Issues

**Development Environment**:

- Expected behavior - no AWS credentials configured
- Workflow will skip deployment and show informational message

**Production Environment**:

- Check AWS credentials configuration
- Verify IAM permissions
- Check CloudFormation stack status

## Best Practices

### Commit Messages

Use conventional commit format:

```
type(scope): description [flags]

Examples:
feat(api): add user authentication [skip integration]
fix(web): resolve login form validation
docs(readme): update installation instructions
```

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches

### Environment Management

- **Local**: Full development setup with Docker
- **Development**: Optional AWS deployment
- **Staging**: Full AWS deployment with testing
- **Production**: Full AWS deployment with approvals

## Monitoring and Alerts

### Workflow Notifications

Configure GitHub notifications for:

- Workflow failures
- Deployment completions
- Security alerts

### Integration with External Tools

Workflows integrate with:

- Codecov for coverage reporting
- Security scanning tools
- AWS CloudWatch for deployment monitoring

## Security Considerations

### Secrets Management

- Never commit AWS credentials
- Use GitHub Secrets for sensitive data
- Rotate credentials regularly

### Permissions

- Workflows use minimal required permissions
- Environment-specific protections enabled
- Manual approval required for production

### Dependency Security

- Automated security audits
- Vulnerability scanning
- Regular dependency updates
