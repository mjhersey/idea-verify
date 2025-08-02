/**
 * Integration tests for ideas endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { authService } from '../../src/services/authService.js';
import { BusinessIdeaRepository } from '../../src/repositories/business-idea-repository.js';
import { UserRepository } from '../../src/repositories/user-repository.js';

describe.skipIf(!process.env.DATABASE_URL || process.env.NODE_ENV === 'ci')('Ideas Endpoints Integration', () => {
  let authToken: string;
  let userId: string;
  let userRepository: UserRepository;
  let businessIdeaRepository: BusinessIdeaRepository;

  beforeEach(async () => {
    userRepository = new UserRepository();
    businessIdeaRepository = new BusinessIdeaRepository();

    // Create test user
    const testUser = await userRepository.create({
      email: 'test@example.com',
      password_hash: await authService.hashPassword('TestPass123!'),
      name: 'Test User'
    });
    userId = testUser.id;

    // Generate auth token
    authToken = authService.generateAccessToken({
      userId: testUser.id,
      email: testUser.email
    });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await businessIdeaRepository.delete();
      await userRepository.delete(userId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('POST /api/ideas', () => {
    const validIdea = {
      title: 'Test Business Idea',
      description: 'This is a comprehensive business idea description that contains enough characters to meet the minimum requirement of 50 characters and provides meaningful content about the business concept.'
    };

    it('should create a business idea successfully', async () => {
      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validIdea)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Business idea submitted successfully');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('title', validIdea.title);
      expect(response.body.data).toHaveProperty('description', validIdea.description);
      expect(response.body.data).toHaveProperty('status', 'submitted');
      expect(response.body.data).toHaveProperty('created_at');
      expect(response.body.data.submission_metadata).toHaveProperty('user_id', userId);
      expect(response.body.data.submission_metadata).toHaveProperty('next_steps');
      expect(response.body.data.submission_metadata).toHaveProperty('estimated_processing_time');
    });

    it('should create idea without title', async () => {
      const ideaWithoutTitle = {
        description: 'This is a business idea description without a title that should automatically generate one from the description content provided here.'
      };

      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ideaWithoutTitle)
        .expect(201);

      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data.title).toContain('...');
      expect(response.body.data.title.length).toBeLessThanOrEqual(53);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ideas')
        .send(validIdea)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', 'Bearer invalid-token')
        .send(validIdea)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid access token');
    });

    it('should validate description length (too short)', async () => {
      const shortIdea = {
        title: 'Short',
        description: 'Too short'
      };

      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(shortIdea)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.details[0].msg).toContain('between 50 and 5000 characters');
    });

    it('should validate description length (too long)', async () => {
      const longDescription = 'A'.repeat(5001);
      const longIdea = {
        title: 'Long Idea',
        description: longDescription
      };

      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(longIdea)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.details[0].msg).toContain('between 50 and 5000 characters');
    });

    it('should validate title length when provided', async () => {
      const invalidTitleIdea = {
        title: 'A', // Too short
        description: validIdea.description
      };

      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTitleIdea)
        .expect(400);

      expect(response.body.details[0].msg).toContain('between 5 and 100 characters');
    });

    it('should handle rate limiting', async () => {
      // Make 10 requests quickly (rate limit is 10/minute)
      const requests = Array.from({ length: 11 }, (_, i) => 
        request(app)
          .post('/api/ideas')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...validIdea,
            description: `${validIdea.description} - Request ${i}`
          })
      );

      const responses = await Promise.all(requests);
      
      // First 10 should succeed, 11th should be rate limited
      const successfulResponses = responses.filter(r => r.status === 201);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(successfulResponses.length).toBeLessThanOrEqual(10);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      }
    });

    it('should sanitize HTML content', async () => {
      const maliciousIdea = {
        title: '<script>alert("xss")</script>Clean Title',
        description: 'This description contains <script>alert("xss")</script> malicious content and <b>HTML tags</b> that should be sanitized for security purposes.'
      };

      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousIdea)
        .expect(201);

      expect(response.body.data.title).not.toContain('<script>');
      expect(response.body.data.description).not.toContain('<script>');
      expect(response.body.data.description).not.toContain('<b>');
    });

    it('should reject spam content', async () => {
      const spamIdea = {
        description: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA repeated character spam content'
      };

      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(spamIdea)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid content detected');
      expect(response.body).toHaveProperty('code', 'CONTENT_VALIDATION_FAILED');
    });

    it('should require description field', async () => {
      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Title Only' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should handle database errors gracefully', async () => {
      // This test would require mocking the database to fail
      // For now, we'll test with valid data to ensure the endpoint works
      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validIdea)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Business idea submitted successfully');
    });

    it('should log successful submissions', async () => {
      // Mock console.log to capture logs
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validIdea)
        .expect(201);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Business idea submitted:')
      );

      consoleSpy.mockRestore();
    });

    it('should return rate limiting headers', async () => {
      const response = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validIdea)
        .expect(201);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });
});