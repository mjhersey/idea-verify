#!/usr/bin/env node
/**
 * Migration management CLI tool
 */

import { Command } from 'commander'
import {
  deployMigrations,
  getMigrationStatus,
  validateMigrations,
  createMigration,
  resetDatabase,
  generateClient,
} from './migrations.js'

const program = new Command()

program.name('migrate-cli').description('Database migration management tool').version('1.0.0')

program
  .command('deploy')
  .description('Deploy migrations for production')
  .action(async () => {
    try {
      await deployMigrations()
      process.exit(0)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    try {
      const status = await getMigrationStatus()

      console.log('\n📊 Migration Status:')
      console.log(`Applied migrations: ${status.appliedMigrations.length}`)
      console.log(`Pending migrations: ${status.pendingMigrations.length}`)
      console.log(`Has unapplied migrations: ${status.hasUnappliedMigrations}`)

      if (status.appliedMigrations.length > 0) {
        console.log('\n📝 Recent applied migrations:')
        status.appliedMigrations.slice(0, 5).forEach(migration => {
          const status = migration.rolled_back_at
            ? '❌ ROLLED BACK'
            : migration.finished_at
              ? '✅ COMPLETED'
              : '⏳ PENDING'
          console.log(
            `  ${status} ${migration.migration_name} (${migration.started_at.toISOString()})`
          )
        })
      }

      if (status.pendingMigrations.length > 0) {
        console.log('\n⏳ Pending migrations:')
        status.pendingMigrations.forEach(migration => {
          console.log(`  - ${migration}`)
        })
      }

      process.exit(0)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('validate')
  .description('Validate migration integrity')
  .action(async () => {
    try {
      const validation = await validateMigrations()

      if (validation.valid) {
        console.log('✅ All migrations are valid')
      } else {
        console.log('❌ Migration validation failed:')
        validation.issues.forEach(issue => {
          console.log(`  - ${issue}`)
        })
      }

      process.exit(validation.valid ? 0 : 1)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('create <name>')
  .description('Create a new migration')
  .action(async (name: string) => {
    try {
      await createMigration(name)
      process.exit(0)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('reset')
  .description('Reset database and apply all migrations')
  .option('--skip-seed', 'Skip running seed scripts')
  .action(async options => {
    try {
      await resetDatabase(options.skipSeed)
      process.exit(0)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('generate')
  .description('Generate Prisma client')
  .action(async () => {
    try {
      await generateClient()
      process.exit(0)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

program.parse()
