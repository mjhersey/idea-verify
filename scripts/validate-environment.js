#!/usr/bin/env node

/**
 * Environment Validation Script
 *
 * Usage:
 *   node scripts/validate-environment.js [environment] [base-url]
 *
 * Examples:
 *   node scripts/validate-environment.js dev http://localhost:3000
 *   node scripts/validate-environment.js staging https://staging.aivalidation.com
 *   node scripts/validate-environment.js prod https://aivalidation.com
 */

import { EnvironmentValidator } from '../packages/shared/src/testing/environment-validator.js'

async function main() {
  const args = process.argv.slice(2)
  const environment = args[0] || process.env.NODE_ENV || 'dev'
  const baseUrl = args[1] || process.env.BASE_URL

  console.log('🔍 AI Validation Platform - Environment Validation')
  console.log('================================================')
  console.log(`Environment: ${environment}`)
  console.log(`Base URL: ${baseUrl || 'Not provided'}`)
  console.log('')

  const validator = new EnvironmentValidator(environment, baseUrl)

  try {
    const result = await validator.validate()

    // Print summary
    console.log('📊 Validation Summary:')
    console.log(`   Total checks: ${result.summary.total}`)
    console.log(`   ✅ Passed: ${result.summary.passed}`)
    console.log(`   ⚠️  Warnings: ${result.summary.warnings}`)
    console.log(`   ❌ Failed: ${result.summary.failed}`)
    console.log('')

    // Print detailed results by category
    const categories = ['infrastructure', 'services', 'configuration', 'security']

    for (const category of categories) {
      const categoryChecks = result.checks.filter(check => check.category === category)
      if (categoryChecks.length === 0) continue

      console.log(`📂 ${category.toUpperCase()}:`)

      for (const check of categoryChecks) {
        const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
        const duration = check.duration ? ` (${check.duration}ms)` : ''
        console.log(`   ${icon} ${check.name}: ${check.message}${duration}`)

        if (check.details && (check.status === 'fail' || check.status === 'warning')) {
          console.log(
            `      Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, '\n      ')}`
          )
        }
      }
      console.log('')
    }

    // Overall result
    if (result.valid) {
      console.log('🎉 Environment validation PASSED')
      console.log('All critical checks passed. Environment is ready for use.')
    } else {
      console.log('❌ Environment validation FAILED')
      console.log('Critical issues found. Please review and fix before proceeding.')

      const failedChecks = result.checks.filter(check => check.status === 'fail')
      if (failedChecks.length > 0) {
        console.log('\n🚨 Failed Checks:')
        for (const check of failedChecks) {
          console.log(`   • ${check.name}: ${check.message}`)
        }
      }
    }

    // JSON output for CI/CD
    if (process.env.OUTPUT_FORMAT === 'json') {
      console.log('\n' + JSON.stringify(result, null, 2))
    }

    // Exit with appropriate code
    process.exit(result.valid ? 0 : 1)
  } catch (error) {
    console.error('💥 Environment validation failed with error:')
    console.error(error)
    process.exit(1)
  }
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })
}

export default main
