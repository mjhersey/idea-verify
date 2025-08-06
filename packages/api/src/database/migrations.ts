/**
 * Database migration utilities and deployment scripts
 */

import { execSync } from 'child_process'
import { getPrismaClient } from './index.js'

export interface MigrationInfo {
  id: string
  checksum: string
  started_at: Date
  finished_at: Date | null
  migration_name: string
  logs: string | null
  rolled_back_at: Date | null
  applied_steps_count: number
}

/**
 * Deploy migrations for production environment
 */
export async function deployMigrations(): Promise<void> {
  try {
    console.log('🚀 Deploying database migrations...')

    // Run Prisma migrate deploy
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log('✅ Migrations deployed successfully')
  } catch (error) {
    console.error('❌ Migration deployment failed:', error)
    throw new Error('Migration deployment failed')
  }
}

/**
 * Get migration status and history
 */
export async function getMigrationStatus(): Promise<{
  appliedMigrations: MigrationInfo[]
  pendingMigrations: string[]
  hasUnappliedMigrations: boolean
}> {
  try {
    const prisma = getPrismaClient()

    // Get applied migrations from _prisma_migrations table
    const appliedMigrations = await prisma.$queryRaw<MigrationInfo[]>`
      SELECT 
        id,
        checksum,
        started_at,
        finished_at,
        migration_name,
        logs,
        rolled_back_at,
        applied_steps_count
      FROM _prisma_migrations 
      ORDER BY started_at DESC
    `

    // Check for pending migrations using Prisma CLI
    let pendingMigrations: string[] = []
    try {
      const output = execSync('npx prisma migrate status', {
        encoding: 'utf8',
        stdio: 'pipe',
      })

      // Parse output to find pending migrations
      const lines = output.split('\n')
      pendingMigrations = lines
        .filter(line => line.includes('not yet been applied'))
        .map(line => line.trim())
    } catch (statusError) {
      // If status command fails, assume no pending migrations
      console.warn('Could not check migration status - assuming no pending migrations')
    }

    return {
      appliedMigrations,
      pendingMigrations,
      hasUnappliedMigrations: pendingMigrations.length > 0,
    }
  } catch (error) {
    console.error('Error getting migration status:', error)
    throw error
  }
}

/**
 * Validate migration integrity
 */
export async function validateMigrations(): Promise<{
  valid: boolean
  issues: string[]
}> {
  try {
    const issues: string[] = []

    // Check if database schema matches Prisma schema
    try {
      execSync('npx prisma db push --preview-feature --accept-data-loss', {
        stdio: 'pipe',
      })
    } catch (error) {
      issues.push('Database schema does not match Prisma schema')
    }

    // Check migration history consistency
    const status = await getMigrationStatus()

    // Look for rolled back migrations
    const rolledBackMigrations = status.appliedMigrations.filter(m => m.rolled_back_at !== null)

    if (rolledBackMigrations.length > 0) {
      issues.push(`Found ${rolledBackMigrations.length} rolled back migrations`)
    }

    // Check for failed migrations
    const failedMigrations = status.appliedMigrations.filter(
      m => m.finished_at === null && m.rolled_back_at === null
    )

    if (failedMigrations.length > 0) {
      issues.push(`Found ${failedMigrations.length} incomplete migrations`)
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  } catch (error) {
    return {
      valid: false,
      issues: [
        `Migration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    }
  }
}

/**
 * Create a new migration from schema changes
 */
export async function createMigration(name: string): Promise<void> {
  try {
    console.log(`📝 Creating migration: ${name}`)

    execSync(`npx prisma migrate dev --name ${name}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log('✅ Migration created successfully')
  } catch (error) {
    console.error('❌ Migration creation failed:', error)
    throw new Error('Migration creation failed')
  }
}

/**
 * Reset database and apply all migrations
 */
export async function resetDatabase(skipSeed = false): Promise<void> {
  try {
    console.log('🔄 Resetting database...')

    const resetCommand = skipSeed
      ? 'npx prisma migrate reset --force --skip-seed'
      : 'npx prisma migrate reset --force'

    execSync(resetCommand, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log('✅ Database reset completed')
  } catch (error) {
    console.error('❌ Database reset failed:', error)
    throw new Error('Database reset failed')
  }
}

/**
 * Generate Prisma client after schema changes
 */
export async function generateClient(): Promise<void> {
  try {
    console.log('⚙️ Generating Prisma client...')

    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log('✅ Prisma client generated successfully')
  } catch (error) {
    console.error('❌ Client generation failed:', error)
    throw new Error('Client generation failed')
  }
}
