import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getWebSocketServer } from '../websocket/websocket-server.js';
import { ProgressEmitter } from '@ai-validation/orchestrator';

const router = Router();

interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// SSE authentication middleware
const authenticateSSE = (req: Request, res: Response, next: Function) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    (req as any).userId = decoded.userId;
    (req as any).userEmail = decoded.email;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Server-Sent Events endpoint for evaluation progress
router.get('/evaluations/:evaluationId/events', authenticateSSE, (req: Request, res: Response) => {
  const { evaluationId } = req.params;
  const userId = (req as any).userId;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true'
  });

  console.log(`[SSE] Client ${userId} connected to evaluation ${evaluationId}`);

  // Send initial connection event
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ evaluationId, timestamp: new Date().toISOString() })}\n\n`);

  // Send current evaluation status if available
  try {
    const wsServer = getWebSocketServer();
    const eventEmitter = wsServer.getEventEmitter();
    const snapshot = eventEmitter.getProgressSnapshot(evaluationId);
    
    if (snapshot) {
      res.write(`event: evaluation:status\n`);
      res.write(`data: ${JSON.stringify({
        ...snapshot,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  } catch (error) {
    console.warn(`[SSE] Could not get initial snapshot for ${evaluationId}:`, error);
  }

  // Set up event listeners from orchestrator progress emitter
  const progressEmitter = ProgressEmitter.getInstance();

  const onAgentProgress = (evalId: string, event: any) => {
    if (evalId === evaluationId) {
      res.write(`event: agent:progress\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const onInsightDiscovered = (evalId: string, event: any) => {
    if (evalId === evaluationId) {
      res.write(`event: insight:discovered\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const onEvaluationStatus = (evalId: string, event: any) => {
    if (evalId === evaluationId) {
      res.write(`event: evaluation:status\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const onAgentCompleted = (evalId: string, event: any) => {
    if (evalId === evaluationId) {
      res.write(`event: agent:completed\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const onEvaluationError = (evalId: string, event: any) => {
    if (evalId === evaluationId) {
      res.write(`event: evaluation:error\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const onEvaluationCompleted = (evalId: string, event: any) => {
    if (evalId === evaluationId) {
      res.write(`event: evaluation:completed\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      
      // Close connection after evaluation completes
      setTimeout(() => {
        res.end();
      }, 1000);
    }
  };

  // Subscribe to events
  progressEmitter.on('agent:progress', onAgentProgress);
  progressEmitter.on('insight:discovered', onInsightDiscovered);
  progressEmitter.on('evaluation:status', onEvaluationStatus);
  progressEmitter.on('agent:completed', onAgentCompleted);
  progressEmitter.on('evaluation:error', onEvaluationError);
  progressEmitter.on('evaluation:completed', onEvaluationCompleted);

  // Keep-alive heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(`event: heartbeat\n`);
    res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client ${userId} disconnected from evaluation ${evaluationId}`);
    
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Remove event listeners to prevent memory leaks
    try {
      progressEmitter.off('agent:progress', onAgentProgress);
      progressEmitter.off('insight:discovered', onInsightDiscovered);
      progressEmitter.off('evaluation:status', onEvaluationStatus);
      progressEmitter.off('agent:completed', onAgentCompleted);
      progressEmitter.off('evaluation:error', onEvaluationError);
      progressEmitter.off('evaluation:completed', onEvaluationCompleted);
    } catch (cleanupError) {
      console.error(`[SSE] Error during event listener cleanup:`, cleanupError);
    }
    
    // Ensure response is properly closed
    try {
      if (!res.destroyed) {
        res.end();
      }
    } catch (responseError) {
      console.error(`[SSE] Error closing response:`, responseError);
    }
  });

  // Handle errors
  req.on('error', (error) => {
    console.error(`[SSE] Error for client ${userId}:`, error);
    
    // Clean up resources
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Remove event listeners
    try {
      progressEmitter.off('agent:progress', onAgentProgress);
      progressEmitter.off('insight:discovered', onInsightDiscovered);
      progressEmitter.off('evaluation:status', onEvaluationStatus);
      progressEmitter.off('agent:completed', onAgentCompleted);
      progressEmitter.off('evaluation:error', onEvaluationError);
      progressEmitter.off('evaluation:completed', onEvaluationCompleted);
    } catch (cleanupError) {
      console.error(`[SSE] Error during error cleanup:`, cleanupError);
    }
    
    // Safely end response
    try {
      if (!res.destroyed) {
        res.end();
      }
    } catch (responseError) {
      console.error(`[SSE] Error ending response after error:`, responseError);
    }
  });
});

// Health check endpoint for SSE
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'server-sent-events',
    timestamp: new Date().toISOString(),
    capabilities: ['evaluation-progress', 'heartbeat', 'fallback-mode']
  });
});

export default router;