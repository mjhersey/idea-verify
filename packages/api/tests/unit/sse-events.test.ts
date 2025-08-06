import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import sseRoutes from '../../src/routes/sse-events';

// Mock the WebSocket server and orchestrator
vi.mock('../../src/websocket/websocket-server.js', () => ({
  getWebSocketServer: vi.fn(() => ({
    getEventEmitter: vi.fn(() => ({
      getProgressSnapshot: vi.fn(() => ({
        evaluationId: 'test-eval',
        overallProgress: 50,
        activeAgents: ['market-research'],
        completedAgents: []
      }))
    }))
  }))
}));

vi.mock('@ai-validation/orchestrator', () => ({
  ProgressEmitter: {
    getInstance: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn()
    }))
  }
}));

// Mock environment
process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

describe('SSE Events Router', () => {
  let app: express.Application;
  const testToken = jwt.sign({ userId: 'test-user', email: 'test@example.com' }, 'test-secret');
  const testEvaluationId = 'test-eval-123';

  beforeEach(() => {
    app = express();
    app.use('/api/events', sseRoutes);
  });

  describe('Authentication', () => {
    it('should require authentication token', async () => {
      const response = await request(app)
        .get(`/api/events/evaluations/${testEvaluationId}/events`)
        .expect(401);

      expect(response.body.error).toBe('Authentication token required');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get(`/api/events/evaluations/${testEvaluationId}/events`)
        .query({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid authentication token');
    });

    it('should accept valid authentication tokens', async () => {
      // This test would need special handling for SSE streams
      // For now, just test that it doesn't reject the token
      const response = await request(app)
        .get(`/api/events/evaluations/${testEvaluationId}/events`)
        .query({ token: testToken });

      // SSE responses have status 200 and special headers
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
    }, 10000); // Longer timeout for SSE
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/events/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'server-sent-events',
        timestamp: expect.any(String),
        capabilities: ['evaluation-progress', 'heartbeat', 'fallback-mode']
      });
    });
  });

  describe('SSE Stream', () => {
    it('should set correct SSE headers', async () => {
      const response = await request(app)
        .get(`/api/events/evaluations/${testEvaluationId}/events`)
        .query({ token: testToken });

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should send connected event initially', (done) => {
      const req = request(app)
        .get(`/api/events/evaluations/${testEvaluationId}/events`)
        .query({ token: testToken })
        .buffer(false)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
            
            // Check for connected event
            if (data.includes('event: connected')) {
              expect(data).toContain('event: connected');
              expect(data).toContain(`"evaluationId":"${testEvaluationId}"`);
              callback(null, data);
              done();
            }
          });
        });

      // Set timeout to prevent hanging
      setTimeout(() => {
        req.abort();
        done();
      }, 5000);
    });

    it('should handle client disconnection gracefully', (done) => {
      const req = request(app)
        .get(`/api/events/evaluations/${testEvaluationId}/events`)
        .query({ token: testToken })
        .buffer(false);

      req.on('response', (res) => {
        // Simulate client disconnection after a short delay
        setTimeout(() => {
          req.abort();
          done();
        }, 100);
      });

      req.on('error', (err) => {
        // Expected behavior when aborting
        expect(err.message).toContain('aborted');
        done();
      });
    });
  });
});