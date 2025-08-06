/**
 * Database health check endpoints
 */

import { Router } from 'express'
import { checkDatabaseHealth, getDatabaseInfo, monitorConnectionLoad } from '../database/index.js'
import { getMigrationStatus, validateMigrations } from '../database/migrations.js'

const router = Router()

/**
 * Basic database health check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await checkDatabaseHealth()

    res.status(health.status === 'healthy' ? 200 : 503).json({
      status: health.status,
      message: health.message,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * Comprehensive database status
 */
router.get('/status', async (req, res) => {
  try {
    const [health, info, connectionLoad, migrationStatus, migrationValidation] = await Promise.all([
      checkDatabaseHealth(),
      getDatabaseInfo(),
      monitorConnectionLoad(),
      getMigrationStatus().catch(() => ({
        appliedMigrations: [],
        pendingMigrations: [],
        hasUnappliedMigrations: false,
      })),
      validateMigrations().catch(() => ({ valid: false, issues: ['Migration validation failed'] })),
    ])

    const isHealthy =
      health.status === 'healthy' &&
      connectionLoad.healthy &&
      migrationValidation.valid &&
      !migrationStatus.hasUnappliedMigrations

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: {
        connected: info.connected,
        version: info.version?.substring(0, 50),
        uptime: info.uptime ? Math.floor(info.uptime) : undefined,
      },
      connections: {
        healthy: connectionLoad.healthy,
        warnings: connectionLoad.warnings,
        stats: info.connectionStats,
        metrics: connectionLoad.metrics,
      },
      migrations: {
        valid: migrationValidation.valid,
        issues: migrationValidation.issues,
        applied: migrationStatus.appliedMigrations.length,
        pending: migrationStatus.pendingMigrations.length,
        hasUnapplied: migrationStatus.hasUnappliedMigrations,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Database status check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * Connection pool metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const [info, connectionLoad] = await Promise.all([getDatabaseInfo(), monitorConnectionLoad()])

    res.json({
      connection_pool: {
        total_connections: info.connectionStats?.total || 0,
        active_connections: info.connectionStats?.active || 0,
        idle_connections: info.connectionStats?.idle || 0,
        waiting_connections: info.connectionStats?.waiting || 0,
        max_connections: info.connectionStats?.maxConnections || 0,
        utilization_percent: info.connectionStats
          ? ((info.connectionStats.total / info.connectionStats.maxConnections) * 100).toFixed(2)
          : '0',
      },
      health: {
        healthy: connectionLoad.healthy,
        warnings: connectionLoad.warnings,
      },
      uptime_seconds: info.uptime ? Math.floor(info.uptime) : 0,
      last_check: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * Migration status endpoint
 */
router.get('/migrations', async (req, res) => {
  try {
    const [status, validation] = await Promise.all([getMigrationStatus(), validateMigrations()])

    res.json({
      migrations: {
        applied: status.appliedMigrations.map(m => ({
          name: m.migration_name,
          applied_at: m.started_at,
          completed_at: m.finished_at,
          rolled_back: !!m.rolled_back_at,
          steps: m.applied_steps_count,
        })),
        pending: status.pendingMigrations,
        has_unapplied: status.hasUnappliedMigrations,
      },
      validation: {
        valid: validation.valid,
        issues: validation.issues,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get migration status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

export default router
