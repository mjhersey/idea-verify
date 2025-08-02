# Secure Credential Handoff Process

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
