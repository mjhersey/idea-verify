/**
 * Integration tests for authentication endpoints
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { getPrismaClient } from '../../src/database/index.js'

// Mock environment variables
vi.mock('@ai-validation/shared', () => ({
  getEnvironmentConfig: vi.fn(() => ({
    nodeEnv: 'test',
    port: 3000,
    aws: {
      region: 'us-east-1',
    },
    frontendUrl: 'http://localhost:5173',
  })),
}))

describe('Authentication Endpoints', () => {
  const prisma = getPrismaClient()

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret'
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
  })

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.user.deleteMany({})
  })

  afterEach(async () => {
    // Clean up database after each test
    await prisma.user.deleteMany({})
  })

  afterAll(async () => {
    await prisma.$disconnect()
    delete process.env.JWT_ACCESS_SECRET
    delete process.env.JWT_REFRESH_SECRET
    delete process.env.DATABASE_URL
  })

  describe('POST /api/auth/register', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    }

    it('should register a new user successfully', async () => {
      const response = await request(app).post('/api/auth/register').send(validUserData).expect(201)

      expect(response.body.message).toBe('User registered successfully')
      expect(response.body.user).toBeDefined()
      expect(response.body.user.email).toBe(validUserData.email)
      expect(response.body.user.name).toBe(validUserData.name)
      expect(response.body.user.id).toBeDefined()
      expect(response.body.user.password_hash).toBeUndefined() // Should not expose password hash
      expect(response.body.tokens).toBeDefined()
      expect(response.body.tokens.accessToken).toBeDefined()
      expect(response.body.tokens.refreshToken).toBeDefined()
    })

    it('should reject registration with invalid email', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' }

      const response = await request(app).post('/api/auth/register').send(invalidData).expect(400)

      expect(response.body.error).toBe('Validation failed')
      expect(response.body.code).toBe('VALIDATION_ERROR')
    })

    it('should reject registration with weak password', async () => {
      const invalidData = { ...validUserData, password: 'weak' }

      const response = await request(app).post('/api/auth/register').send(invalidData).expect(400)

      expect(response.body.error).toBe('Validation failed')
      expect(response.body.code).toBe('VALIDATION_ERROR')
    })

    it('should reject registration with duplicate email', async () => {
      // Register first user
      await request(app).post('/api/auth/register').send(validUserData).expect(201)

      // Attempt to register with same email
      const response = await request(app).post('/api/auth/register').send(validUserData).expect(409)

      expect(response.body.error).toBe('Email address is already registered')
      expect(response.body.code).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('should reject registration with missing fields', async () => {
      const incompleteData = { email: validUserData.email }

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400)

      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('POST /api/auth/login', () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    }

    beforeEach(async () => {
      // Register a user for login tests
      await request(app).post('/api/auth/register').send(userData)
    })

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200)

      expect(response.body.message).toBe('Login successful')
      expect(response.body.user).toBeDefined()
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.user.password_hash).toBeUndefined()
      expect(response.body.tokens).toBeDefined()
      expect(response.body.tokens.accessToken).toBeDefined()
      expect(response.body.tokens.refreshToken).toBeDefined()
    })

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userData.password,
        })
        .expect(401)

      expect(response.body.error).toBe('Invalid email or password')
      expect(response.body.code).toBe('INVALID_CREDENTIALS')
    })

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword123!',
        })
        .expect(401)

      expect(response.body.error).toBe('Invalid email or password')
      expect(response.body.code).toBe('INVALID_CREDENTIALS')
    })

    it('should reject login with malformed email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: userData.password,
        })
        .expect(400)

      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Register and get refresh token
      const registerResponse = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      })

      refreshToken = registerResponse.body.tokens.refreshToken
    })

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(response.body.message).toBe('Tokens refreshed successfully')
      expect(response.body.tokens).toBeDefined()
      expect(response.body.tokens.accessToken).toBeDefined()
      expect(response.body.tokens.refreshToken).toBeDefined()
      expect(response.body.tokens.accessToken).not.toBe(refreshToken)
      expect(response.body.tokens.refreshToken).not.toBe(refreshToken)
    })

    it('should reject refresh with missing token', async () => {
      const response = await request(app).post('/api/auth/refresh').send({}).expect(400)

      expect(response.body.error).toBe('Refresh token is required')
      expect(response.body.code).toBe('MISSING_REFRESH_TOKEN')
    })

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401)

      expect(response.body.error).toBe('Token refresh failed')
    })
  })

  describe('GET /api/auth/profile', () => {
    let accessToken: string
    let userId: string

    beforeEach(async () => {
      // Register user and get access token
      const registerResponse = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      })

      accessToken = registerResponse.body.tokens.accessToken
      userId = registerResponse.body.user.id
    })

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body.user).toBeDefined()
      expect(response.body.user.id).toBe(userId)
      expect(response.body.user.email).toBe('test@example.com')
      expect(response.body.user.name).toBe('Test User')
      expect(response.body.user.password_hash).toBeUndefined()
    })

    it('should reject profile request without token', async () => {
      const response = await request(app).get('/api/auth/profile').expect(401)

      expect(response.body.error).toBe('Access token required')
      expect(response.body.code).toBe('MISSING_TOKEN')
    })

    it('should reject profile request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.error).toBe('Invalid access token')
    })
  })

  describe('PUT /api/auth/profile', () => {
    let accessToken: string

    beforeEach(async () => {
      // Register user and get access token
      const registerResponse = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      })

      accessToken = registerResponse.body.tokens.accessToken
    })

    it('should update user profile with valid data', async () => {
      const updateData = {
        name: 'Updated User',
        email: 'updated@example.com',
      }

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.message).toBe('Profile updated successfully')
      expect(response.body.user.name).toBe(updateData.name)
      expect(response.body.user.email).toBe(updateData.email)
    })

    it('should update only provided fields', async () => {
      const updateData = { name: 'Updated Name Only' }

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.user.name).toBe(updateData.name)
      expect(response.body.user.email).toBe('test@example.com') // Should remain unchanged
    })

    it('should reject update with no fields', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400)

      expect(response.body.error).toBe('No valid fields provided for update')
    })
  })

  describe('POST /api/auth/logout', () => {
    let accessToken: string
    let refreshToken: string

    beforeEach(async () => {
      // Register user and get tokens
      const registerResponse = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      })

      accessToken = registerResponse.body.tokens.accessToken
      refreshToken = registerResponse.body.tokens.refreshToken
    })

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200)

      expect(response.body.message).toBe('Logout successful')
    })

    it('should logout even without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200)

      expect(response.body.message).toBe('Logout successful')
    })
  })

  describe('Rate limiting', () => {
    it('should enforce rate limiting on registration', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      }

      // Make multiple rapid requests
      const promises = Array(6)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post('/api/auth/register')
            .send({ ...userData, email: `test${i}@example.com` })
        )

      const responses = await Promise.all(promises)

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })
})
