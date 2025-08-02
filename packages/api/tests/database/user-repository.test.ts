/**
 * Integration tests for UserRepository
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { UserRepository } from '../../src/repositories/user-repository.js';
import { getPrismaClient, disconnectDatabase } from '../../src/database/index.js';
import type { CreateUserInput } from '@ai-validation/shared';

describe('UserRepository Integration Tests', () => {
  let userRepository: UserRepository;
  let prisma: ReturnType<typeof getPrismaClient>;
  let skipTests = false;

  beforeAll(async () => {
    try {
      userRepository = new UserRepository();
      prisma = getPrismaClient();
      // Try a simple query to check database connectivity
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.log('⚠️  Skipping database tests - database not available');
      skipTests = true;
    }
  });

  afterAll(async () => {
    if (!skipTests) {
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    if (skipTests) return;
    
    // Clean up test data before each test
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'test' } },
          { email: { contains: 'duplicate' } },
          { email: { contains: 'example.com' } }
        ]
      }
    });
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      if (skipTests) return;
      
      const userData: CreateUserInput = {
        email: 'test@example.com',
        password_hash: 'hashed_password_123',
        name: 'Test User'
      };

      const user = await userRepository.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.password_hash).toBe(userData.password_hash);
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate email', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'duplicate@example.com',
        password_hash: 'hashed_password_123',
        name: 'Test User'
      };

      await userRepository.create(userData);

      await expect(userRepository.create(userData)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'findtest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Find Test User'
      };

      const createdUser = await userRepository.create(userData);
      const foundUser = await userRepository.findById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should return null for non-existent ID', async () => {
      if (skipTests) return;
      const foundUser = await userRepository.findById('non-existent-id');
      expect(foundUser).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'emailtest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Email Test User'
      };

      await userRepository.create(userData);
      const foundUser = await userRepository.findByEmail(userData.email);

      expect(foundUser).toBeDefined();
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should return null for non-existent email', async () => {
      if (skipTests) return;
      const foundUser = await userRepository.findByEmail('nonexistent@example.com');
      expect(foundUser).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'updatetest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Update Test User'
      };

      const createdUser = await userRepository.create(userData);
      const updatedUser = await userRepository.update(createdUser.id, {
        name: 'Updated Name'
      });

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
    });

    it('should throw error for non-existent user', async () => {
      if (skipTests) return;
      await expect(userRepository.update('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'deletetest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Delete Test User'
      };

      const createdUser = await userRepository.create(userData);
      await userRepository.delete(createdUser.id);

      const foundUser = await userRepository.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });
  });

  describe('findMany', () => {
    beforeEach(async () => {
      if (skipTests) return;
      // Create test users
      const testUsers = [
        { email: 'user1@test.com', password_hash: 'hash1', name: 'User One' },
        { email: 'user2@test.com', password_hash: 'hash2', name: 'User Two' },
        { email: 'user3@test.com', password_hash: 'hash3', name: 'User Three' }
      ];

      for (const userData of testUsers) {
        await userRepository.create(userData);
      }
    });

    it('should find users with pagination', async () => {
      if (skipTests) return;
      const result = await userRepository.findMany({}, { page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBeGreaterThanOrEqual(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('should filter users by email', async () => {
      if (skipTests) return;
      const result = await userRepository.findMany({ email: 'user1' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toContain('user1');
    });

    it('should filter users by name', async () => {
      if (skipTests) return;
      const result = await userRepository.findMany({ name: 'One' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toContain('One');
    });
  });

  describe('exists', () => {
    it('should return true for existing user', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'existstest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Exists Test User'
      };

      const createdUser = await userRepository.create(userData);
      const exists = await userRepository.exists(createdUser.id);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      if (skipTests) return;
      const exists = await userRepository.exists('non-existent-id');
      expect(exists).toBe(false);
    });
  });

  describe('isEmailTaken', () => {
    it('should return true for taken email', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'takentest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Taken Test User'
      };

      await userRepository.create(userData);
      const isTaken = await userRepository.isEmailTaken(userData.email);

      expect(isTaken).toBe(true);
    });

    it('should return false for available email', async () => {
      if (skipTests) return;
      const isTaken = await userRepository.isEmailTaken('available@example.com');
      expect(isTaken).toBe(false);
    });

    it('should exclude specified user ID', async () => {
      if (skipTests) return;
      const userData: CreateUserInput = {
        email: 'excludetest@example.com',
        password_hash: 'hashed_password_123',
        name: 'Exclude Test User'
      };

      const createdUser = await userRepository.create(userData);
      const isTaken = await userRepository.isEmailTaken(userData.email, createdUser.id);

      expect(isTaken).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return user statistics', async () => {
      if (skipTests) return;
      const stats = await userRepository.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalUsers).toBe('number');
      expect(typeof stats.newUsersLastWeek).toBe('number');
      expect(typeof stats.newUsersLastMonth).toBe('number');
      expect(typeof stats.activeUsers).toBe('number');
      expect(stats.totalUsers).toBeGreaterThanOrEqual(0);
    });
  });
});