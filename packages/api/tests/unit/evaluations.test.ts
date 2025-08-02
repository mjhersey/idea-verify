import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('Evaluations API', () => {
  it('should create a new evaluation', async () => {
    const evaluationData = {
      description: 'Test business idea for validation',
      urgency: 'medium',
      industry: 'Technology'
    }

    const response = await request(app)
      .post('/api/evaluations')
      .send(evaluationData)
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(response.body.data).toHaveProperty('id')
    expect(response.body.data.description).toBe(evaluationData.description)
    expect(response.body.data.status).toBe('pending')
  })

  it('should get all evaluations', async () => {
    const response = await request(app)
      .get('/api/evaluations')
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
  })

  it('should return 404 for non-existent evaluation', async () => {
    const response = await request(app)
      .get('/api/evaluations/non-existent-id')
      .expect(404)

    expect(response.body.success).toBe(false)
    expect(response.body.error).toBe('Evaluation not found')
  })
})