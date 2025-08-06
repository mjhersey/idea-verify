#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * Comprehensive setup and validation for the AI Validation Platform
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`📋 Running: ${command} ${args.join(' ')}`)

    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || rootDir,
      ...options,
    })

    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

async function checkPrerequisites() {
  console.log('🔍 Checking Prerequisites...')

  const checks = [
    { name: 'Node.js', command: 'node', args: ['--version'] },
    { name: 'npm', command: 'npm', args: ['--version'] },
    { name: 'Docker', command: 'docker', args: ['--version'] },
    { name: 'Docker Compose', command: 'docker-compose', args: ['--version'] },
  ]

  for (const check of checks) {
    try {
      await runCommand(check.command, check.args)
      console.log(`✅ ${check.name} is available`)
    } catch (error) {
      console.log(`❌ ${check.name} is not available or not working`)
      throw new Error(`${check.name} is required but not available`)
    }
  }
}

async function installDependencies() {
  console.log('\n📦 Installing Dependencies...')

  // Install root dependencies
  await runCommand('npm', ['install'])

  // Install workspace dependencies
  await runCommand('npm', ['run', 'install:all'])

  console.log('✅ Dependencies installed successfully')
}

async function setupEnvironment() {
  console.log('\n🔧 Setting up Environment...')

  // Check if .env exists, if not copy from template
  const envPath = join(rootDir, '.env')
  const envTemplatePath = join(rootDir, '.env.template')

  if (!existsSync(envPath) && existsSync(envTemplatePath)) {
    console.log('📄 Copying .env.template to .env...')
    await runCommand('cp', ['.env.template', '.env'])
    console.log('⚠️  Please review and update .env file with your configuration')
  }

  console.log('✅ Environment configuration ready')
}

async function setupGitHooks() {
  console.log('\n🪝 Setting up Git Hooks...')

  try {
    await runCommand('npm', ['run', 'prepare'])
    console.log('✅ Git hooks configured successfully')
  } catch (error) {
    console.log('⚠️  Git hooks setup failed, continuing...')
  }
}

async function startServices() {
  console.log('\n🐳 Starting Development Services...')

  try {
    // Start essential services (database, redis, localstack)
    await runCommand('npm', ['run', 'dev:services'])

    // Wait a moment for services to initialize
    console.log('⏳ Waiting for services to initialize...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    console.log('✅ Development services started')
  } catch (error) {
    console.log('⚠️  Failed to start some services, you may need to start them manually')
    console.log('   Try: npm run dev:services')
  }
}

async function validateSetup() {
  console.log('\n🧪 Validating Setup...')

  try {
    // Validate environment configuration
    await runCommand('npm', ['run', 'test:env'])

    // Test database connectivity
    await runCommand('npm', ['run', 'test:db'])

    console.log('✅ All validations passed')
  } catch (error) {
    console.log('⚠️  Some validations failed')
    console.log('   Manual validation may be required')
  }
}

async function buildPackages() {
  console.log('\n🔨 Building Packages...')

  try {
    await runCommand('npm', ['run', 'build'])
    console.log('✅ All packages built successfully')
  } catch (error) {
    console.log('⚠️  Build failed, some packages may need attention')
    throw error
  }
}

async function runTests() {
  console.log('\n🧪 Running Tests...')

  try {
    await runCommand('npm', ['test'])
    console.log('✅ All tests passed')
  } catch (error) {
    console.log('⚠️  Some tests failed, review test output')
  }
}

async function main() {
  console.log('🚀 AI Validation Platform - Development Environment Setup')
  console.log('=========================================================')

  try {
    await checkPrerequisites()
    await installDependencies()
    await setupEnvironment()
    await setupGitHooks()
    await startServices()
    await validateSetup()
    await buildPackages()
    await runTests()

    console.log('\n🎉 Development Environment Setup Complete!')
    console.log('==========================================')
    console.log('')
    console.log('📋 Next Steps:')
    console.log('1. Review and update .env file if needed')
    console.log('2. Start the frontend: npm run dev:web')
    console.log('3. Start the API: npm run dev:api')
    console.log('4. Open http://localhost:5173 in your browser')
    console.log('')
    console.log('🔧 Useful Commands:')
    console.log('- npm run dev:all          # Start all Docker services')
    console.log('- npm run dev:down         # Stop all Docker services')
    console.log('- npm run test:db          # Test database connectivity')
    console.log('- npm run test:env         # Validate environment setup')
    console.log('- npm run dev:logs         # View service logs')
    console.log('')
    console.log('📚 Documentation: ./README.md')
  } catch (error) {
    console.log('\n❌ Setup Failed!')
    console.log(`Error: ${error.message}`)
    console.log('')
    console.log('🔧 Troubleshooting:')
    console.log('1. Ensure all prerequisites are installed')
    console.log('2. Check Docker is running')
    console.log('3. Review error messages above')
    console.log('4. See README.md for manual setup instructions')

    process.exit(1)
  }
}

main().catch(console.error)
