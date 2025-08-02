/**
 * Transaction management utilities for complex database operations
 */

import { getPrismaClient } from './index.js';
import type { PrismaClient } from '../generated/prisma/index.js';

type TransactionCallback<T> = (tx: PrismaClient) => Promise<T>;

/**
 * Execute operations within a database transaction
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>
): Promise<T> {
  const prisma = getPrismaClient();
  
  try {
    return await prisma.$transaction(async (tx) => {
      return await callback(tx as PrismaClient);
    });
  } catch (error) {
    throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute operations within a transaction with retry logic
 */
export async function withTransactionRetry<T>(
  callback: TransactionCallback<T>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(callback);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on certain types of errors
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        console.warn(`Transaction attempt ${attempt} failed, retrying in ${retryDelay}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }
  }
  
  throw new Error(`Transaction failed after ${maxRetries} attempts. Last error: ${lastError!.message}`);
}

/**
 * Check if an error should not trigger a retry
 */
function isNonRetryableError(error: Error): boolean {
  const nonRetryablePatterns = [
    'unique constraint',
    'foreign key constraint',
    'check constraint',
    'not null constraint',
    'invalid input',
    'permission denied'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Batch operations within a transaction
 */
export async function batchTransaction<T>(
  operations: Array<TransactionCallback<T>>,
  batchSize = 10
): Promise<T[]> {
  const results: T[] = [];
  
  // Process operations in batches
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    
    const batchResults = await withTransaction(async (tx) => {
      return await Promise.all(batch.map(operation => operation(tx)));
    });
    
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Execute operations with isolation level control
 */
export async function withIsolationLevel<T>(
  callback: TransactionCallback<T>,
  isolationLevel: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE' = 'READ_COMMITTED'
): Promise<T> {
  const prisma = getPrismaClient();
  
  return await prisma.$transaction(async (tx) => {
    // Set isolation level for this transaction
    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`;
    return await callback(tx as PrismaClient);
  });
}

/**
 * Savepoint management for nested transactions
 */
export class SavepointManager {
  private savepointCounter = 0;
  
  async withSavepoint<T>(
    tx: PrismaClient,
    callback: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    const savepointName = `sp_${++this.savepointCounter}`;
    
    try {
      // Create savepoint
      await tx.$executeRaw`SAVEPOINT ${savepointName}`;
      
      // Execute operations
      const result = await callback(tx);
      
      // Release savepoint on success
      await tx.$executeRaw`RELEASE SAVEPOINT ${savepointName}`;
      
      return result;
    } catch (error) {
      // Rollback to savepoint on error
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT ${savepointName}`;
      throw error;
    }
  }
}

/**
 * Bulk operations with transaction optimization
 */
export class BulkOperationManager {
  private prisma = getPrismaClient();
  
  /**
   * Bulk insert with transaction
   */
  async bulkInsert<T>(
    tableName: string,
    data: T[],
    batchSize = 1000
  ): Promise<number> {
    let totalInserted = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      await withTransaction(async (tx) => {
        // Use createMany for efficient bulk insert
        const model = (tx as Record<string, { createMany: (args: { data: unknown[]; skipDuplicates: boolean }) => Promise<{ count: number }> }>)[tableName];
        const result = await model.createMany({
          data: batch,
          skipDuplicates: true
        });
        totalInserted += result.count;
      });
    }
    
    return totalInserted;
  }
  
  /**
   * Bulk update with transaction
   */
  async bulkUpdate<T>(
    tableName: string,
    updates: Array<{ where: Record<string, unknown>; data: T }>,
    batchSize = 100
  ): Promise<number> {
    let totalUpdated = 0;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      await withTransaction(async (tx) => {
        const model = (tx as Record<string, { updateMany: (args: { where: Record<string, unknown>; data: unknown }) => Promise<{ count: number }> }>)[tableName];
        const updatePromises = batch.map(update =>
          model.updateMany({
            where: update.where,
            data: update.data
          })
        );
        
        const results = await Promise.all(updatePromises);
        totalUpdated += results.reduce((sum, result) => sum + result.count, 0);
      });
    }
    
    return totalUpdated;
  }
  
  /**
   * Bulk delete with transaction
   */
  async bulkDelete(
    tableName: string,
    whereConditions: Record<string, unknown>[],
    batchSize = 100
  ): Promise<number> {
    let totalDeleted = 0;
    
    for (let i = 0; i < whereConditions.length; i += batchSize) {
      const batch = whereConditions.slice(i, i + batchSize);
      
      await withTransaction(async (tx) => {
        const model = (tx as Record<string, { deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }> }>)[tableName];
        const deletePromises = batch.map(where =>
          model.deleteMany({ where })
        );
        
        const results = await Promise.all(deletePromises);
        totalDeleted += results.reduce((sum, result) => sum + result.count, 0);
      });
    }
    
    return totalDeleted;
  }
}

// Export utility instances
export const savepointManager = new SavepointManager();
export const bulkOperationManager = new BulkOperationManager();