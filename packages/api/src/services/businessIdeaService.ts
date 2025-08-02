/**
 * Business idea service for handling idea submission logic
 */

import { BusinessIdeaRepository } from '../repositories/business-idea-repository.js';

export interface CreateIdeaInput {
  userId: string;
  title?: string;
  description: string;
}

export interface BusinessIdea {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class BusinessIdeaService {
  private businessIdeaRepository: BusinessIdeaRepository;

  constructor() {
    this.businessIdeaRepository = new BusinessIdeaRepository();
  }

  /**
   * Create a new business idea with validation and sanitization
   */
  async createIdea(input: CreateIdeaInput): Promise<BusinessIdea> {
    try {
      // Sanitize and validate description
      const sanitizedDescription = this.sanitizeInput(input.description);
      
      // Generate title if not provided
      const title = input.title || this.generateTitleFromDescription(sanitizedDescription);
      const sanitizedTitle = this.sanitizeInput(title);

      // Additional content validation
      this.validateContent(sanitizedDescription);

      // Create business idea in database
      const businessIdea = await this.businessIdeaRepository.create({
        user_id: input.userId,
        title: sanitizedTitle,
        description: sanitizedDescription,
        status: 'submitted'
      });

      console.log(`Business idea created: ${businessIdea.id} for user ${input.userId}`);

      return businessIdea;

    } catch (error) {
      console.error('Business idea creation error:', error);
      throw new Error(`Failed to create business idea: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  private sanitizeInput(input: string): string {
    if (!input) return '';

    // Remove HTML tags and potentially dangerous characters
    let sanitized = input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
      .trim();

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
  }

  /**
   * Generate a title from description if not provided
   */
  private generateTitleFromDescription(description: string): string {
    // Take first 50 characters and find the last complete word
    const maxLength = 50;
    let title = description.substring(0, maxLength);
    
    if (description.length > maxLength) {
      const lastSpaceIndex = title.lastIndexOf(' ');
      if (lastSpaceIndex > 20) { // Ensure minimum meaningful length
        title = title.substring(0, lastSpaceIndex);
      }
      title += '...';
    }

    return title;
  }

  /**
   * Validate content for inappropriate language and spam patterns
   */
  private validateContent(content: string): void {
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{10,}/, // Repeated characters
      /https?:\/\/[^\s]{20,}/, // Long URLs
      /\b(?:click here|buy now|limited time|act now)\b/gi, // Spam phrases
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        throw new Error('Content contains spam patterns');
      }
    }

    // Check for minimum meaningful content
    const words = content.split(/\s+/).filter(word => word.length > 2);
    if (words.length < 10) {
      throw new Error('Description must contain at least 10 meaningful words');
    }

    // Check for excessive capitalization
    const upperCaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (upperCaseRatio > 0.3) {
      throw new Error('Excessive use of capital letters detected');
    }
  }
}

// Export singleton instance
export const businessIdeaService = new BusinessIdeaService();