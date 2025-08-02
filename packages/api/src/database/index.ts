/**
 * Database connection and configuration
 * Integrates with Prisma Client and environment configuration from Story 1.0
 */

import { PrismaClient } from '../generated/prisma/index.js';
import { getEnvironmentConfig } from '@ai-validation/shared';

// Global Prisma Client instance with connection pooling
let prisma: PrismaClient | null = null;

// Connection monitoring
interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  lastHealthCheck: Date;
  uptime: number;
}

let connectionMetrics: ConnectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  lastHealthCheck: new Date(),
  uptime: 0
};

/**
 * Add connection pooling parameters to database URL
 */
function addConnectionPooling(databaseUrl: string): string {
  try {
    const url = new globalThis.URL(databaseUrl);
    
    // Get configuration from environment or use defaults
    const maxConnections = process.env.DATABASE_MAX_CONNECTIONS || '20';
    const connectionTimeout = process.env.DATABASE_CONNECTION_TIMEOUT_MS || '30000';
    const poolTimeout = process.env.DATABASE_POOL_TIMEOUT_MS || '30000';
    
    // Add connection pooling parameters
    url.searchParams.set('connection_limit', maxConnections);
    url.searchParams.set('connect_timeout', Math.floor(parseInt(connectionTimeout) / 1000).toString());
    url.searchParams.set('pool_timeout', Math.floor(parseInt(poolTimeout) / 1000).toString());
    url.searchParams.set('socket_timeout', '30');
    
    // Add application name for monitoring
    url.searchParams.set('application_name', 'ai-validation-platform-api');
    
    return url.toString();
  } catch (error) {
    console.warn('Failed to parse database URL for pooling configuration:', error);
    return databaseUrl;
  }
}

/**
 * Get or create Prisma Client instance with proper configuration
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Try to get database URL from environment or config
    let databaseUrl = process.env.DATABASE_URL;
    
    // Only use shared config if required environment variables are available
    try {
      const config = getEnvironmentConfig();
      databaseUrl = config.database?.url || databaseUrl;
    } catch (error) {
      // Fall back to direct environment variables if shared config fails
      console.warn('Using direct environment variables for database connection');
    }
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    // Parse connection string to add connection pooling parameters
    const pooledUrl = addConnectionPooling(databaseUrl);
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: pooledUrl
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
    });

    // Enable graceful shutdown
    process.on('beforeExit', () => {
      void disconnectDatabase();
    });
  }

  return prisma;
}

/**
 * Connect to database with health check
 */
export async function connectDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    
    // Verify connection with a simple query
    await client.$queryRaw`SELECT 1`;
    
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw new Error('Failed to connect to database');
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.log('📤 Database disconnected');
  }
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
  try {
    const client = getPrismaClient();
    const startTime = Date.now();
    
    // Simple health check query
    await client.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      message: `Database connection healthy (${responseTime}ms)`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get comprehensive database connection info for monitoring
 */
export async function getDatabaseInfo(): Promise<{
  connected: boolean;
  version?: string;
  connectionStats?: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
  };
  performance?: {
    averageQueryTime?: number;
    slowQueries?: number;
  };
  uptime?: number;
}> {
  try {
    const client = getPrismaClient();
    
    // Get PostgreSQL version
    const versionResult = await client.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    const version = versionResult[0]?.version;
    
    // Get comprehensive connection statistics
    const connectionStatsResult = await client.$queryRaw<Array<{
      total_connections: bigint;
      active_connections: bigint;
      idle_connections: bigint;
      waiting_connections: bigint;
      max_connections: bigint;
    }>>`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as waiting_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `;
    
    const stats = connectionStatsResult[0];
    const connectionStats = stats ? {
      total: Number(stats.total_connections),
      active: Number(stats.active_connections),
      idle: Number(stats.idle_connections),
      waiting: Number(stats.waiting_connections),
      maxConnections: Number(stats.max_connections)
    } : undefined;
    
    // Get database uptime
    const uptimeResult = await client.$queryRaw<Array<{ uptime_seconds: number }>>`
      SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime_seconds
    `;
    const uptime = uptimeResult[0]?.uptime_seconds;
    
    // Update metrics
    if (connectionStats) {
      connectionMetrics = {
        totalConnections: connectionStats.total,
        activeConnections: connectionStats.active,
        idleConnections: connectionStats.idle,
        lastHealthCheck: new Date(),
        uptime: uptime || 0
      };
    }
    
    return {
      connected: true,
      version,
      connectionStats,
      uptime
    };
  } catch (error) {
    return {
      connected: false
    };
  }
}

/**
 * Get current connection metrics
 */
export function getConnectionMetrics(): ConnectionMetrics {
  return { ...connectionMetrics };
}

/**
 * Monitor database connections under load
 */
export async function monitorConnectionLoad(): Promise<{
  healthy: boolean;
  warnings: string[];
  metrics: ConnectionMetrics;
}> {
  const warnings: string[] = [];
  const info = await getDatabaseInfo();
  
  if (!info.connected) {
    return {
      healthy: false,
      warnings: ['Database connection failed'],
      metrics: connectionMetrics
    };
  }
  
  if (info.connectionStats) {
    const { active, total, maxConnections } = info.connectionStats;
    const utilizationPercent = (total / maxConnections) * 100;
    const activePercent = (active / total) * 100;
    
    // Check connection pool utilization
    if (utilizationPercent > 80) {
      warnings.push(`High connection pool utilization: ${utilizationPercent.toFixed(1)}%`);
    }
    
    // Check active connection ratio
    if (activePercent > 90) {
      warnings.push(`High active connection ratio: ${activePercent.toFixed(1)}%`);
    }
    
    // Check for connection leaks (too many idle connections)
    if (info.connectionStats.idle > maxConnections * 0.5) {
      warnings.push(`Potential connection leak: ${info.connectionStats.idle} idle connections`);
    }
  }
  
  return {
    healthy: warnings.length === 0,
    warnings,
    metrics: connectionMetrics
  };
}

// Export Prisma Client for direct use
export { PrismaClient } from '../generated/prisma/index.js';
export default getPrismaClient;