/**
 * Database performance tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPrismaClient, disconnectDatabase } from '../../src/database/index.js'
import { UserRepository, BusinessIdeaRepository } from '../../src/repositories/index.js'
import { UserFactory, BusinessIdeaFactory, DatabaseTestUtils } from './test-factories.js'
import { withTransaction, bulkOperationManager } from '../../src/database/transaction-manager.js'

describe('Database Performance Tests', () => {
  let prisma: ReturnType<typeof getPrismaClient>
  let userRepository: UserRepository
  let businessIdeaRepository: BusinessIdeaRepository
  let skipTests = false

  beforeAll(async () => {
    try {
      prisma = getPrismaClient()
      userRepository = new UserRepository()
      businessIdeaRepository = new BusinessIdeaRepository()
      // Try a simple query to check database connectivity
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      console.log('⚠️  Skipping performance tests - database not available')
      skipTests = true
    }
  })

  afterAll(async () => {
    if (!skipTests) {
      await disconnectDatabase()
    }
  })

  describe('Query Performance', () => {
    it('should handle large pagination efficiently', async () => {
      if (skipTests) return

      const startTime = Date.now()

      // Test pagination with large offset
      const result = await userRepository.findMany(
        {},
        {
          page: 1,
          limit: 100,
        }
      )

      const queryTime = Date.now() - startTime

      expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
      expect(result.data).toBeDefined()
      expect(result.pagination).toBeDefined()
    })

    it('should perform complex queries efficiently', async () => {
      if (skipTests) return
      const startTime = Date.now()

      // Complex query with joins
      const ideas = await prisma.businessIdea.findMany({
        include: {
          user: true,
          evaluations: {
            include: {
              agent_results: true,
            },
          },
        },
        take: 10,
      })

      const queryTime = Date.now() - startTime

      expect(queryTime).toBeLessThan(500) // Should complete within 500ms
      expect(ideas).toBeDefined()
    })

    it('should handle search queries efficiently', async () => {
      if (skipTests) return
      const startTime = Date.now()

      const searchResults = await businessIdeaRepository.search('AI', { limit: 50 })

      const queryTime = Date.now() - startTime

      expect(queryTime).toBeLessThan(300) // Should complete within 300ms
      expect(searchResults.data).toBeDefined()
    })
  })

  describe('Bulk Operations Performance', () => {
    it('should handle bulk user creation efficiently', async () => {
      if (skipTests) return
      const testUsers = UserFactory.createMany(100)
      const userEmails = testUsers.map(u => u.email)

      try {
        const startTime = Date.now()

        await withTransaction(async tx => {
          for (const userData of testUsers) {
            await tx.user.create({ data: userData })
          }
        })

        const insertTime = Date.now() - startTime

        // Should create 100 users within 2 seconds
        expect(insertTime).toBeLessThan(2000)

        // Verify all users were created
        const createdCount = await prisma.user.count({
          where: {
            email: { in: userEmails },
          },
        })

        expect(createdCount).toBe(100)
      } finally {
        // Cleanup
        await DatabaseTestUtils.cleanupTestData(prisma, { userEmails })
      }
    })

    it('should handle bulk business idea creation efficiently', async () => {
      if (skipTests) return
      // First create a test user
      const testUser = await userRepository.create(UserFactory.create())

      try {
        const testIdeas = BusinessIdeaFactory.createMany(50, {
          user_id: testUser.id,
        })

        const startTime = Date.now()

        await withTransaction(async tx => {
          for (const ideaData of testIdeas) {
            await tx.businessIdea.create({ data: ideaData })
          }
        })

        const insertTime = Date.now() - startTime

        // Should create 50 ideas within 1 second
        expect(insertTime).toBeLessThan(1000)

        // Verify all ideas were created
        const createdCount = await prisma.businessIdea.count({
          where: { user_id: testUser.id },
        })

        expect(createdCount).toBe(50)
      } finally {
        // Cleanup
        try {
          await prisma.user.deleteMany({ where: { id: testUser.id } })
        } catch (error) {
          console.warn('Cleanup failed:', error)
        }
      }
    })
  })

  describe('Connection Pool Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      if (skipTests) return
      const concurrentRequests = 20
      const startTime = Date.now()

      // Create concurrent database operations
      const operations = Array.from({ length: concurrentRequests }, () => userRepository.getStats())

      const results = await Promise.all(operations)
      const totalTime = Date.now() - startTime

      // Should handle 20 concurrent requests within 2 seconds
      expect(totalTime).toBeLessThan(2000)
      expect(results).toHaveLength(concurrentRequests)

      // All results should be valid
      results.forEach(result => {
        expect(result.totalUsers).toBeGreaterThanOrEqual(0)
      })
    })

    it('should maintain performance under sustained load', async () => {
      if (skipTests) return
      const iterations = 5
      const requestsPerIteration = 10
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now()

        const operations = Array.from({ length: requestsPerIteration }, () =>
          businessIdeaRepository.getStats()
        )

        await Promise.all(operations)
        times.push(Date.now() - startTime)

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Performance should remain consistent
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)
      const minTime = Math.min(...times)

      expect(avgTime).toBeLessThan(1000)
      expect(maxTime - minTime).toBeLessThan(avgTime) // Variance should be reasonable
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      if (skipTests) return
      const initialMemory = process.memoryUsage()

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await userRepository.findMany({}, { limit: 10 })
        await businessIdeaRepository.findMany({}, { limit: 10 })

        // Force garbage collection every 20 iterations
        if (i % 20 === 0 && global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage()

      // Memory usage should not increase dramatically
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const heapIncreasePercentage = (heapIncrease / initialMemory.heapUsed) * 100

      // Allow up to 50% increase in heap usage
      expect(heapIncreasePercentage).toBeLessThan(50)
    })
  })

  describe('Index Performance', () => {
    it('should use indexes efficiently for common queries', async () => {
      if (skipTests) return
      // Test queries that should use indexes
      const indexedQueries = [
        () => prisma.user.findUnique({ where: { email: 'test@example.com' } }),
        () => prisma.businessIdea.findMany({ where: { status: 'draft' } }),
        () => prisma.businessIdea.findMany({ where: { user_id: 'test-id' } }),
        () => prisma.evaluation.findMany({ where: { business_idea_id: 'test-id' } }),
        () => prisma.agentResult.findMany({ where: { evaluation_id: 'test-id' } }),
      ]

      for (const query of indexedQueries) {
        const startTime = Date.now()

        try {
          await query()
        } catch (error) {
          // Expected for non-existent IDs
        }

        const queryTime = Date.now() - startTime

        // Indexed queries should be very fast
        expect(queryTime).toBeLessThan(50)
      }
    })
  })

  describe('Transaction Performance', () => {
    it('should handle nested transactions efficiently', async () => {
      if (skipTests) return
      const testUser = await userRepository.create(UserFactory.create())

      try {
        const startTime = Date.now()

        await withTransaction(async tx => {
          // Create business idea
          const businessIdea = await tx.businessIdea.create({
            data: BusinessIdeaFactory.create({ user_id: testUser.id }),
          })

          // Create evaluation
          const evaluation = await tx.evaluation.create({
            data: {
              business_idea_id: businessIdea.id,
              priority: 'normal',
            },
          })

          // Create multiple agent results
          for (let i = 0; i < 5; i++) {
            await tx.agentResult.create({
              data: {
                evaluation_id: evaluation.id,
                agent_type: 'market-research',
                input_data: { test: `data_${i}` },
              },
            })
          }
        })

        const transactionTime = Date.now() - startTime

        // Complex transaction should complete within 500ms
        expect(transactionTime).toBeLessThan(500)
      } finally {
        // Cleanup
        try {
          await prisma.user.deleteMany({ where: { id: testUser.id } })
        } catch (error) {
          console.warn('Cleanup failed:', error)
        }
      }
    })
  })
})
