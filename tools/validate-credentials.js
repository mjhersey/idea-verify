#!/usr/bin/env node

/**
 * Credential Validation Script
 * Tests all external service connections and validates credentials
 */

const { SecretsManager } = require('../packages/shared/dist/secrets/secrets-manager.js')
const { CredentialValidator } = require('../packages/shared/dist/utils/credential-validator.js')
const { getEnvironmentConfig } = require('../packages/shared/dist/config/environment.js')

async function validateCredentials() {
  console.log('🔍 Validating External Service Credentials\n')

  try {
    // Load environment configuration
    const config = getEnvironmentConfig()
    console.log(`Environment: ${config.nodeEnv}`)
    console.log(`Mock Services: ${config.development.useMockServices ? 'Enabled' : 'Disabled'}`)
    console.log(`AWS Region: ${config.aws.region}\n`)

    // Initialize services
    const secretsManager = new SecretsManager(config.secretsManager)
    const validator = new CredentialValidator()

    console.log('📥 Retrieving credentials from AWS Secrets Manager...')

    // Retrieve credentials
    let credentials
    try {
      credentials = await secretsManager.getAllCredentials()
      console.log('✅ Successfully retrieved credentials from Secrets Manager\n')
    } catch (error) {
      console.log('⚠️  Failed to retrieve from Secrets Manager, checking local environment...')

      // Fallback to environment variables for development
      credentials = {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'sk-mock-key-for-testing',
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-mock-key-for-testing',
        },
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAMOCKKEY',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock-secret-key',
          region: config.aws.region,
        },
      }
      console.log('✅ Using local environment credentials\n')
    }

    console.log('🧪 Testing service connections...\n')

    // Validate each service
    const results = await validator.validateAllCredentials(
      credentials.openai,
      credentials.anthropic,
      credentials.aws
    )

    // Display results
    let allValid = true
    for (const result of results) {
      const status = result.valid ? '✅' : '❌'
      console.log(
        `${status} ${result.service.toUpperCase()}: ${result.valid ? 'Valid' : 'Invalid'}`
      )

      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }

      if (result.details) {
        if (result.details.rateLimit) {
          console.log(`   Rate Limit: ${result.details.rateLimit.remaining} remaining`)
        }
        if (result.details.accountInfo) {
          console.log(`   Account: ${JSON.stringify(result.details.accountInfo)}`)
        }
      }

      if (!result.valid) {
        allValid = false
      }

      console.log()
    }

    console.log('='.repeat(50))

    if (allValid) {
      console.log('🎉 All credentials are valid!')
      console.log('External service connections are ready for development.')
      process.exit(0)
    } else {
      console.log('⚠️  Some credentials are invalid.')
      console.log('Please check your credential configuration and try again.')
      console.log('\nTroubleshooting:')
      console.log('- Ensure AWS Secrets Manager contains valid credentials')
      console.log('- Check that API keys have not expired')
      console.log('- Verify network connectivity to external services')
      console.log('- Review docs/credential-handoff-guide.md for setup instructions')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Validation failed:', error.message)

    if (error.message.includes('AWS_REGION')) {
      console.log('\n💡 Make sure to set up your environment variables:')
      console.log('   Run: npm run setup:dev')
    }

    process.exit(1)
  }
}

// Run validation
validateCredentials()
