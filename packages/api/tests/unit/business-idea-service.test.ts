/**
 * Unit tests for BusinessIdeaService
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// Mock the repository before importing modules
vi.mock('../../src/repositories/business-idea-repository.js', () => ({
  BusinessIdeaRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn()
  }))
}));

import { BusinessIdeaService } from '../../src/services/businessIdeaService.js';
import { BusinessIdeaRepository } from '../../src/repositories/business-idea-repository.js';

describe('BusinessIdeaService', () => {
  let service: BusinessIdeaService;
  let mockRepository: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create service instance and get the mock
    service = new BusinessIdeaService();
    mockRepository = (service as any).businessIdeaRepository;
  });

  describe('createIdea', () => {
    const validInput = {
      userId: 'user-123',
      title: 'My Business Idea',
      description: 'This is a detailed description of my business idea that is over 50 characters long and contains meaningful content about the business.'
    };

    const mockBusinessIdea = {
      id: 'idea-123',
      user_id: 'user-123',
      title: 'My Business Idea',
      description: 'This is a detailed description of my business idea that is over 50 characters long and contains meaningful content about the business.',
      status: 'submitted',
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should create a business idea successfully', async () => {
      mockRepository.create.mockResolvedValue(mockBusinessIdea);

      const result = await service.createIdea(validInput);

      expect(result).toEqual(mockBusinessIdea);
      expect(mockRepository.create).toHaveBeenCalledWith({
        user_id: validInput.userId,
        title: validInput.title,
        description: validInput.description,
        status: 'submitted'
      });
    });

    it('should generate title from description when title not provided', async () => {
      const inputWithoutTitle = {
        userId: 'user-123',
        description: 'This is a very long description that should be used to generate a title automatically when no title is provided by the user.'
      };

      const expectedTitle = 'This is a very long description that should be...';
      
      mockRepository.create.mockResolvedValue({
        ...mockBusinessIdea,
        title: expectedTitle
      });

      await service.createIdea(inputWithoutTitle);

      expect(mockRepository.create).toHaveBeenCalledWith({
        user_id: inputWithoutTitle.userId,
        title: expectedTitle,
        description: inputWithoutTitle.description,
        status: 'submitted'
      });
    });

    it('should sanitize HTML tags from input', async () => {
      const inputWithHTML = {
        userId: 'user-123',
        title: '<script>alert("xss")</script>Clean Title',
        description: 'This is a description with <b>HTML tags</b> and <script>malicious code</script> that should be sanitized to prevent XSS attacks.'
      };

      mockRepository.create.mockResolvedValue(mockBusinessIdea);

      await service.createIdea(inputWithHTML);

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.title).not.toContain('<script>');
      expect(createCall.title).not.toContain('</script>');
      expect(createCall.description).not.toContain('<b>');
      expect(createCall.description).not.toContain('</b>');
      expect(createCall.description).not.toContain('<script>');
    });

    it('should remove javascript: protocols', async () => {
      const inputWithJavaScript = {
        userId: 'user-123',
        description: 'This description contains javascript:alert("xss") which should be removed for security reasons and this makes it long enough.'
      };

      mockRepository.create.mockResolvedValue(mockBusinessIdea);

      await service.createIdea(inputWithJavaScript);

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.description).not.toContain('javascript:');
    });

    it('should reject content with spam patterns', async () => {
      const spamInput = {
        userId: 'user-123',
        description: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA spam content with repeated characters'
      };

      await expect(service.createIdea(spamInput)).rejects.toThrow('Content contains spam patterns');
    });

    it('should reject content with insufficient words', async () => {
      const shortInput = {
        userId: 'user-123',
        description: 'Too short description with few words'
      };

      await expect(service.createIdea(shortInput)).rejects.toThrow('Description must contain at least 10 meaningful words');
    });

    it('should reject content with excessive capitalization', async () => {
      const capsInput = {
        userId: 'user-123',
        description: 'THIS IS A VERY LONG DESCRIPTION WITH TOO MANY CAPITAL LETTERS WHICH SHOULD BE REJECTED FOR BEING TOO AGGRESSIVE AND SPAM-LIKE'
      };

      await expect(service.createIdea(capsInput)).rejects.toThrow('Excessive use of capital letters detected');
    });

    it('should handle repository errors', async () => {
      mockRepository.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.createIdea(validInput)).rejects.toThrow('Failed to create business idea');
    });

    it('should normalize whitespace in input', async () => {
      const inputWithExtraSpaces = {
        userId: 'user-123',
        description: 'This   description   has    multiple   spaces   that   should   be   normalized   to   single   spaces   for   better   formatting.'
      };

      mockRepository.create.mockResolvedValue(mockBusinessIdea);

      await service.createIdea(inputWithExtraSpaces);

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.description).not.toMatch(/\s{2,}/); // Should not contain multiple consecutive spaces
    });

    it('should trim input content', async () => {
      const inputWithSpaces = {
        userId: 'user-123',
        title: '   Title with spaces   ',
        description: '   This description has leading and trailing spaces that should be trimmed for consistency.   '
      };

      mockRepository.create.mockResolvedValue(mockBusinessIdea);

      await service.createIdea(inputWithSpaces);

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.title).toBe('Title with spaces');
      expect(createCall.description?.startsWith(' ')).toBe(false);
      expect(createCall.description?.endsWith(' ')).toBe(false);
    });
  });

  describe('generateTitleFromDescription', () => {
    it('should generate title under 50 characters', () => {
      const shortDescription = 'Short business idea description';
      // Use reflection to access private method for testing
      const title = (service as any).generateTitleFromDescription(shortDescription);
      expect(title).toBe(shortDescription);
      expect(title.length).toBeLessThanOrEqual(50);
    });

    it('should truncate long descriptions and add ellipsis', () => {
      const longDescription = 'This is a very long business idea description that exceeds fifty characters and should be truncated properly';
      const title = (service as any).generateTitleFromDescription(longDescription);
      expect(title).toContain('...');
      expect(title.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    it('should break at word boundaries', () => {
      const description = 'This is a moderately long business idea description that should break at word boundaries';
      const title = (service as any).generateTitleFromDescription(description);
      expect(title).toMatch(/\w+\.\.\.$/); // Should end with a word followed by ...
    });
  });

  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      const inputWithControlChars = 'Text with\x00control\x1Fcharacters\x7F';
      const sanitized = (service as any).sanitizeInput(inputWithControlChars);
      expect(sanitized).toBe('Text withcontrolcharacters');
    });

    it('should remove event handlers', () => {
      const inputWithHandlers = 'Text with onclick="malicious()" content';
      const sanitized = (service as any).sanitizeInput(inputWithHandlers);
      expect(sanitized).not.toContain('onclick=');
    });

    it('should handle empty input', () => {
      const sanitized = (service as any).sanitizeInput('');
      expect(sanitized).toBe('');
    });

    it('should handle null/undefined input', () => {
      const sanitizedNull = (service as any).sanitizeInput(null);
      const sanitizedUndefined = (service as any).sanitizeInput(undefined);
      expect(sanitizedNull).toBe('');
      expect(sanitizedUndefined).toBe('');
    });
  });
});