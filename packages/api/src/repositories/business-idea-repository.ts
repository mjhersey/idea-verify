/**
 * BusinessIdea repository with CRUD operations and query optimization
 */

import { getPrismaClient } from '../database/index.js';
import type { 
  BusinessIdea, 
  CreateBusinessIdeaInput, 
  UpdateBusinessIdeaInput, 
  BusinessIdeaFilters,
  PaginationOptions,
  PaginatedResponse,
  BusinessIdeaWithUser,
  BusinessIdeaWithEvaluations,
  BusinessIdeaComplete,
  BusinessIdeaStatus
} from '@ai-validation/shared';

export class BusinessIdeaRepository {
  private prisma = getPrismaClient();

  /**
   * Create a new business idea
   */
  async create(data: CreateBusinessIdeaInput): Promise<BusinessIdea> {
    try {
      return await this.prisma.businessIdea.create({
        data
      });
    } catch (error) {
      throw new Error(`Failed to create business idea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find business idea by ID
   */
  async findById(id: string): Promise<BusinessIdea | null> {
    try {
      return await this.prisma.businessIdea.findUnique({
        where: { id }
      });
    } catch (error) {
      throw new Error(`Failed to find business idea by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find business idea with user
   */
  async findByIdWithUser(id: string): Promise<BusinessIdeaWithUser | null> {
    try {
      return await this.prisma.businessIdea.findUnique({
        where: { id },
        include: {
          user: true
        }
      });
    } catch (error) {
      throw new Error(`Failed to find business idea with user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find business idea with evaluations
   */
  async findByIdWithEvaluations(id: string): Promise<BusinessIdeaWithEvaluations | null> {
    try {
      return await this.prisma.businessIdea.findUnique({
        where: { id },
        include: {
          evaluations: {
            orderBy: {
              created_at: 'desc'
            }
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to find business idea with evaluations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find business idea with complete nested data
   */
  async findByIdComplete(id: string): Promise<BusinessIdeaComplete | null> {
    try {
      return await this.prisma.businessIdea.findUnique({
        where: { id },
        include: {
          user: true,
          evaluations: {
            include: {
              agent_results: {
                orderBy: {
                  created_at: 'desc'
                }
              }
            },
            orderBy: {
              created_at: 'desc'
            }
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to find complete business idea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update business idea
   */
  async update(id: string, data: UpdateBusinessIdeaInput): Promise<BusinessIdea> {
    try {
      return await this.prisma.businessIdea.update({
        where: { id },
        data
      });
    } catch (error) {
      throw new Error(`Failed to update business idea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete business idea
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.businessIdea.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`Failed to delete business idea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find business ideas with filters and pagination
   */
  async findMany(
    filters: BusinessIdeaFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<BusinessIdea>> {
    try {
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};
      
      if (filters.user_id) {
        where.user_id = filters.user_id;
      }
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.title_contains) {
        where.title = {
          contains: filters.title_contains,
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
      const total = await this.prisma.businessIdea.count({ where });

      // Get business ideas
      const businessIdeas = await this.prisma.businessIdea.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      });

      return {
        data: businessIdeas,
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
      throw new Error(`Failed to find business ideas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find business ideas for a specific user
   */
  async findByUserId(
    userId: string,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<BusinessIdea>> {
    return this.findMany({ user_id: userId }, pagination);
  }

  /**
   * Find business ideas by status
   */
  async findByStatus(
    status: BusinessIdeaStatus,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<BusinessIdea>> {
    return this.findMany({ status }, pagination);
  }

  /**
   * Search business ideas by text
   */
  async search(
    query: string,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<BusinessIdea>> {
    try {
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      const where = {
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive' as const
            }
          },
          {
            description: {
              contains: query,
              mode: 'insensitive' as const
            }
          }
        ]
      };

      // Get total count for pagination
      const total = await this.prisma.businessIdea.count({ where });

      // Get business ideas
      const businessIdeas = await this.prisma.businessIdea.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      });

      return {
        data: businessIdeas,
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
      throw new Error(`Failed to search business ideas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if business idea exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.businessIdea.count({
        where: { id }
      });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check business idea existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user owns business idea
   */
  async isOwnedByUser(id: string, userId: string): Promise<boolean> {
    try {
      const count = await this.prisma.businessIdea.count({
        where: {
          id,
          user_id: userId
        }
      });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check business idea ownership: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get business idea statistics
   */
  async getStats(): Promise<{
    totalIdeas: number;
    newIdeasLastWeek: number;
    ideasByStatus: Record<BusinessIdeaStatus, number>;
    averageDescriptionLength: number;
  }> {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [totalIdeas, newIdeasLastWeek, ideasByStatus, avgLengthResult] = await Promise.all([
        this.prisma.businessIdea.count(),
        this.prisma.businessIdea.count({
          where: {
            created_at: {
              gte: lastWeek
            }
          }
        }),
        this.prisma.businessIdea.groupBy({
          by: ['status'],
          _count: {
            status: true
          }
        }),
        this.prisma.$queryRaw<Array<{ avg_length: number }>>`
          SELECT AVG(LENGTH(description)) as avg_length 
          FROM business_ideas
        `
      ]);

      // Transform status counts
      const statusCounts: Record<BusinessIdeaStatus, number> = {
        draft: 0,
        submitted: 0,
        evaluating: 0,
        completed: 0
      };

      ideasByStatus.forEach(item => {
        statusCounts[item.status as BusinessIdeaStatus] = item._count.status;
      });

      return {
        totalIdeas,
        newIdeasLastWeek,
        ideasByStatus: statusCounts,
        averageDescriptionLength: Math.round(avgLengthResult[0]?.avg_length || 0)
      };
    } catch (error) {
      throw new Error(`Failed to get business idea statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update business idea status
   */
  async updateStatus(id: string, status: BusinessIdeaStatus): Promise<BusinessIdea> {
    return this.update(id, { status });
  }
}