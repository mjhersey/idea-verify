/**
 * Test database connectivity
 */

import {
  connectDatabase,
  checkDatabaseHealth,
  getDatabaseInfo,
  monitorConnectionLoad,
  disconnectDatabase,
} from './index.js'

async function testConnection() {
  try {
    console.log('🔗 Testing database connection...')

    // Test connection
    await connectDatabase()

    // Test health check
    const health = await checkDatabaseHealth()
    console.log(`Health Status: ${health.status} - ${health.message}`)

    // Get database info
    const info = await getDatabaseInfo()
    console.log('Database Info:', {
      connected: info.connected,
      version: info.version?.substring(0, 50) + '...',
      connectionStats: info.connectionStats,
      uptime: info.uptime ? Math.floor(info.uptime) + 's' : 'unknown',
    })

    // Test connection monitoring
    const connectionLoad = await monitorConnectionLoad()
    console.log('Connection Load Monitor:', {
      healthy: connectionLoad.healthy,
      warnings: connectionLoad.warnings,
      metrics: connectionLoad.metrics,
    })

    console.log('✅ Database connection test successful!')
  } catch (error) {
    console.error('❌ Database connection test failed:', error)
    process.exit(1)
  } finally {
    await disconnectDatabase()
  }
}

testConnection()
