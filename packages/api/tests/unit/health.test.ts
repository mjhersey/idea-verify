import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('Health endpoint', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body).toHaveProperty('status', 'healthy')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('uptime')
    expect(response.body).toHaveProperty('version')
  })
})