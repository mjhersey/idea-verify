/**
 * User repository with CRUD operations and query optimization
 */

import { getPrismaClient } from '../database/index.js';
import type { 
  User, 
  CreateUserInput, 
  UpdateUserInput, 
  UserFilters,
  PaginationOptions,
  PaginatedResponse,
  UserWithBusinessIdeas
} from '@ai-validation/shared';

export class UserRepository {
  private prisma = getPrismaClient();

  /**
   * Create a new user
   */
  async create(data: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data
      });
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id }
      });
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email }
      });
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find user with their business ideas
   */
  async findByIdWithBusinessIdeas(id: string): Promise<UserWithBusinessIdeas | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
        include: {
          business_ideas: {
            orderBy: {
              created_at: 'desc'
            }
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to find user with business ideas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserInput): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data
      });
    } catch (error) {
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user (soft delete - mark as inactive)
   */
  async delete(id: string): Promise<void> {
    try {
      // In a real application, you might want to implement soft delete
      // For now, we'll do a hard delete but with cascade handling
      await this.prisma.user.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find users with filters and pagination
   */
  async findMany(
    filters: UserFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<User>> {
    try {
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};
      
      if (filters.email) {
        where.email = {
          contains: filters.email,
          mode: 'insensitive'
        };
      }
      
      if (filters.name) {
        where.name = {
          contains: filters.name,
          mode: 'insensitive'
        };
      }
      
      if (filters.created_after) {
        where.created_at = {
          ...(where.created_at || {}),
          gte: filters.created_after
        };
      }
      
      if (filters.created_before) {
        where.created_at = {
          ...(where.created_at || {}),
          lte: filters.created_before
        };
      }

      // Get total count for pagination
      const total = await this.prisma.user.count({ where });

      // Get users
      const users = await this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      });

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to find users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.user.count({
        where: { id }
      });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check user existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if email is already taken
   */
  async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    try {
      const where: Record<string, unknown> = { email };
      
      if (excludeUserId) {
        where.id = {
          not: excludeUserId
        };
      }

      const count = await this.prisma.user.count({ where });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check email availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<{
    totalUsers: number;
    newUsersLastWeek: number;
    newUsersLastMonth: number;
    activeUsers: number;
  }> {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [totalUsers, newUsersLastWeek, newUsersLastMonth, activeUsers] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({
          where: {
            created_at: {
              gte: lastWeek
            }
          }
        }),
        this.prisma.user.count({
          where: {
            created_at: {
              gte: lastMonth
            }
          }
        }),
        // Users with at least one business idea in the last month
        this.prisma.user.count({
          where: {
            business_ideas: {
              some: {
                created_at: {
                  gte: lastMonth
                }
              }
            }
          }
        })
      ]);

      return {
        totalUsers,
        newUsersLastWeek,
        newUsersLastMonth,
        activeUsers
      };
    } catch (error) {
      throw new Error(`Failed to get user statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}