#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * Creates environment templates and validates configuration
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const ENV_TEMPLATE = `# AI Validation Platform Environment Configuration

# Node Environment
NODE_ENV=development
PORT=3000

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# AWS Secrets Manager Secret Names
SECRETS_OPENAI_NAME=ai-validation-platform/openai
SECRETS_ANTHROPIC_NAME=ai-validation-platform/anthropic
SECRETS_AWS_NAME=ai-validation-platform/aws

# Development Configuration
USE_MOCK_SERVICES=true
MOCK_DATA_PATH=./data/mock

# Optional: Local development overrides (DO NOT COMMIT THESE VALUES)
# OPENAI_API_KEY=your-local-key-for-testing
# ANTHROPIC_API_KEY=your-local-key-for-testing
`

const GITIGNORE_ADDITIONS = `
# Environment files
.env
.env.local
.env.development
.env.production

# AWS credentials
.aws/credentials
.aws/config

# Mock data
data/mock/*.json
`

async function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.toLowerCase().trim())
    })
  })
}

async function setupEnvironmentFiles() {
  console.log('🔧 Setting up development environment...\n')

  // Create .env.template file
  const envTemplatePath = path.join(process.cwd(), '.env.template')
  fs.writeFileSync(envTemplatePath, ENV_TEMPLATE)
  console.log('✅ Created .env.template')

  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    const createEnv = await askQuestion('Create .env file from template? (y/n): ')
    if (createEnv === 'y' || createEnv === 'yes') {
      fs.writeFileSync(envPath, ENV_TEMPLATE)
      console.log('✅ Created .env file')
    }
  } else {
    console.log('⚠️  .env file already exists, skipping creation')
  }

  // Update .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore')
  let gitignoreContent = ''

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
  }

  if (!gitignoreContent.includes('.env')) {
    fs.appendFileSync(gitignorePath, GITIGNORE_ADDITIONS)
    console.log('✅ Updated .gitignore with environment file patterns')
  }

  // Create mock data directory
  const mockDataDir = path.join(process.cwd(), 'data', 'mock')
  if (!fs.existsSync(mockDataDir)) {
    fs.mkdirSync(mockDataDir, { recursive: true })
    console.log('✅ Created mock data directory')
  }

  // Create credential handoff guide
  const handoffGuide = `# Secure Credential Handoff Process

## Overview
This document outlines the secure process for providing external service credentials to the development team.

## Required Credentials

### OpenAI API Key
- Account: [User to provide]
- API Key Format: sk-...
- Organization ID (optional): org-...
- Project ID (optional): proj_...

### Anthropic API Key  
- Account: [User to provide]
- API Key Format: sk-ant-...

### AWS Credentials
- Account ID: [User to provide]
- Access Key ID: AKIA...
- Secret Access Key: [User to provide]
- Region: us-east-1

## Handoff Methods (Choose One)

### Method 1: Encrypted File
1. Create a JSON file with credentials
2. Encrypt using GPG or similar
3. Share encrypted file + decryption key separately

### Method 2: Password Manager
1. Add credentials to shared password manager vault
2. Grant access to development team members

### Method 3: AWS Secrets Manager (Recommended)
1. User creates secrets in AWS Secrets Manager
2. User grants IAM access to development team
3. Development team retrieves via AWS CLI/SDK

## Security Requirements
- ✅ Credentials transmitted over encrypted channels only
- ✅ No credentials in plain text files, emails, or chat
- ✅ Access logging enabled where possible
- ✅ Rotation schedule established (monthly recommended)

## Post-Handoff Steps
1. Development team validates credentials using validation script
2. Credentials stored in AWS Secrets Manager
3. Local .env files configured with secret references
4. Original credential files securely deleted
5. Access confirmed through health checks

## Emergency Procedures
If credentials are compromised:
1. Immediately rotate/revoke compromised credentials
2. Update AWS Secrets Manager with new credentials
3. Notify all team members
4. Review access logs for unauthorized usage
`

  const handoffPath = path.join(process.cwd(), 'docs', 'credential-handoff-guide.md')
  fs.writeFileSync(handoffPath, handoffGuide)
  console.log('✅ Created credential handoff guide')

  console.log('\n🎉 Development environment setup complete!')
  console.log('\nNext steps:')
  console.log('1. Review .env.template and customize as needed')
  console.log('2. Follow docs/credential-handoff-guide.md for secure credential provision')
  console.log('3. Run "npm run validate:credentials" after receiving credentials')
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled by user.')
  rl.close()
  process.exit(130)
})

// Run setup
setupEnvironmentFiles()
  .catch(error => {
    console.error('Error during setup:', error)
    rl.close()
    process.exit(1)
  })
  .finally(() => {
    rl.close()
  })
