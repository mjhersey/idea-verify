/**
 * WebSocket Server for Real-time Updates
 * Provides real-time communication for evaluation progress and system events
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';
import { OrchestratorService } from '../orchestrator/orchestrator-service.js';
import { ServiceFactory } from '../config/service-factory.js';
import {
  WebSocketEvent,
  EvaluationProgressEvent,
  EvaluationCompletedEvent,
  EvaluationFailedEvent,
  SystemHealthEvent
} from './types.js';

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
  evaluationId?: string;
  lastPing: Date;
  metadata?: Record<string, any>;
}

export interface WebSocketServerConfig {
  port?: number;
  path?: string;
  pingInterval?: number;
  maxConnections?: number;
  enableHeartbeat?: boolean;
}

export class WebSocketServer extends EventEmitter {
  private wss: WSServer;
  private clients = new Map<string, WebSocketClient>();
  private orchestrator: OrchestratorService;
  private serviceFactory: ServiceFactory;
  private config: Required<WebSocketServerConfig>;
  private heartbeatInterval?: NodeJS.Timeout;
  private isStarted = false;

  constructor(config: WebSocketServerConfig = {}) {
    super();

    this.config = {
      port: 3001,
      path: '/ws',
      pingInterval: 30000, // 30 seconds
      maxConnections: 1000,
      enableHeartbeat: true,
      ...config
    };

    this.orchestrator = OrchestratorService.getInstance();
    this.serviceFactory = ServiceFactory.getInstance();
    
    // Initialize WebSocket server
    this.wss = new WSServer({
      port: this.config.port,
      path: this.config.path
    });

    this.setupEventHandlers();
  }

  async start(server?: Server): Promise<void> {
    if (this.isStarted) {
      console.log('[WebSocketServer] Server already started');
      return;
    }

    try {
      // If an HTTP server is provided, attach to it instead of using standalone
      if (server) {
        this.wss = new WSServer({
          server,
          path: this.config.path
        });
        this.setupEventHandlers();
      }

      // Start heartbeat if enabled
      if (this.config.enableHeartbeat) {
        this.startHeartbeat();
      }

      // Subscribe to orchestrator events
      this.subscribeToOrchestratorEvents();

      this.isStarted = true;
      console.log(`[WebSocketServer] WebSocket server started on port ${this.config.port}${this.config.path}`);
      this.emit('started');

    } catch (error) {
      console.error('[WebSocketServer] Failed to start:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    console.log('[WebSocketServer] Shutting down WebSocket server...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.socket.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    // Close server
    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.isStarted = false;
        console.log('[WebSocketServer] WebSocket server shut down');
        this.emit('shutdown');
        resolve();
      });
    });
  }

  // Client management

  getConnectedClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientsByUserId(userId: string): WebSocketClient[] {
    return Array.from(this.clients.values()).filter(client => client.userId === userId);
  }

  getClientsByEvaluationId(evaluationId: string): WebSocketClient[] {
    return Array.from(this.clients.values()).filter(client => 
      client.evaluationId === evaluationId || client.subscriptions.has(`evaluation:${evaluationId}`)
    );
  }

  // Broadcasting methods

  broadcast(event: WebSocketEvent): void {
    const message = JSON.stringify(event);
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(message);
          sentCount++;
        } catch (error) {
          console.error(`[WebSocketServer] Failed to send message to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      }
    }

    console.log(`[WebSocketServer] Broadcasted ${event.type} to ${sentCount} clients`);
  }

  broadcastToUser(userId: string, event: WebSocketEvent): void {
    const clients = this.getClientsByUserId(userId);
    const message = JSON.stringify(event);

    for (const client of clients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(message);
        } catch (error) {
          console.error(`[WebSocketServer] Failed to send message to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      }
    }

    console.log(`[WebSocketServer] Sent ${event.type} to ${clients.length} clients for user ${userId}`);
  }

  broadcastToEvaluation(evaluationId: string, event: WebSocketEvent): void {
    const clients = this.getClientsByEvaluationId(evaluationId);
    const message = JSON.stringify(event);

    for (const client of clients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(message);
        } catch (error) {
          console.error(`[WebSocketServer] Failed to send message to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      }
    }

    console.log(`[WebSocketServer] Sent ${event.type} to ${clients.length} clients for evaluation ${evaluationId}`);
  }

  sendToClient(clientId: string, event: WebSocketEvent): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(event));
      return true;
    } catch (error) {
      console.error(`[WebSocketServer] Failed to send message to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  // Event handling setup

  private setupEventHandlers(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Check connection limit
    if (this.clients.size >= this.config.maxConnections) {
      console.warn('[WebSocketServer] Connection limit reached, rejecting new connection');
      socket.close(1008, 'Connection limit reached');
      return;
    }

    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      lastPing: new Date()
    };

    // Parse connection parameters from URL or headers
    this.parseConnectionParams(client, request);

    this.clients.set(clientId, client);

    console.log(`[WebSocketServer] Client ${clientId} connected (${this.clients.size} total)`);

    // Set up client event handlers
    socket.on('message', (data) => this.handleClientMessage(clientId, data.toString()));
    socket.on('close', (code, reason) => this.handleClientDisconnect(clientId, code, reason));
    socket.on('error', (error) => this.handleClientError(clientId, error));
    socket.on('pong', () => this.handleClientPong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'system-health',
      data: { message: 'Connected to AI Validation WebSocket' },
      timestamp: new Date().toISOString()
    });

    this.emit('clientConnected', client);
  }

  private handleClientMessage(clientId: string, data: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(client, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(client, message.data);
          break;
        case 'ping':
          client.lastPing = new Date();
          this.sendToClient(clientId, {
            type: 'system-health',
            data: { pong: true },
            timestamp: new Date().toISOString()
          });
          break;
        default:
          console.warn(`[WebSocketServer] Unknown message type from client ${clientId}:`, message.type);
      }
    } catch (error) {
      console.error(`[WebSocketServer] Failed to parse message from client ${clientId}:`, error);
    }
  }

  private handleClientDisconnect(clientId: string, code: number, reason: Buffer): void {
    this.removeClient(clientId);
    console.log(`[WebSocketServer] Client ${clientId} disconnected (code: ${code}, reason: ${reason.toString()})`);
  }

  private handleClientError(clientId: string, error: Error): void {
    console.error(`[WebSocketServer] Client ${clientId} error:`, error);
    this.removeClient(clientId);
  }

  private handleClientPong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
    }
  }

  private handleServerError(error: Error): void {
    console.error('[WebSocketServer] Server error:', error);
    this.emit('error', error);
  }

  // Subscription management

  private handleSubscription(client: WebSocketClient, data: any): void {
    const { channel, evaluationId, userId } = data;

    if (channel) {
      client.subscriptions.add(channel);
    }

    if (evaluationId) {
      client.evaluationId = evaluationId;
      client.subscriptions.add(`evaluation:${evaluationId}`);
    }

    if (userId) {
      client.userId = userId;
      client.subscriptions.add(`user:${userId}`);
    }

    console.log(`[WebSocketServer] Client ${client.id} subscribed to:`, Array.from(client.subscriptions));
  }

  private handleUnsubscription(client: WebSocketClient, data: any): void {
    const { channel, evaluationId, userId } = data;

    if (channel) {
      client.subscriptions.delete(channel);
    }

    if (evaluationId) {
      client.subscriptions.delete(`evaluation:${evaluationId}`);
      if (client.evaluationId === evaluationId) {
        client.evaluationId = undefined;
      }
    }

    if (userId) {
      client.subscriptions.delete(`user:${userId}`);
      if (client.userId === userId) {
        client.userId = undefined;
      }
    }

    console.log(`[WebSocketServer] Client ${client.id} unsubscribed from channels`);
  }

  // Orchestrator event integration

  private subscribeToOrchestratorEvents(): void {
    // Listen for evaluation progress updates
    this.orchestrator.on('evaluation-progress', (data) => {
      const event: EvaluationProgressEvent = {
        type: 'evaluation-progress',
        data: {
          evaluationId: data.evaluationId,
          progress: data.progress,
          status: data.status,
          agentProgress: data.agentProgress
        },
        timestamp: new Date().toISOString()
      };
      this.broadcastToEvaluation(data.evaluationId, event);
    });

    // Listen for evaluation completion
    this.orchestrator.on('evaluation-completed', (data) => {
      const event: EvaluationCompletedEvent = {
        type: 'evaluation-completed',
        data,
        timestamp: new Date().toISOString()
      };
      this.broadcastToEvaluation(data.evaluationId, event);
    });

    // Listen for evaluation failures
    this.orchestrator.on('evaluation-failed', (data) => {
      const event: EvaluationFailedEvent = {
        type: 'evaluation-failed',
        data: {
          evaluationId: data.evaluationId,
          error: data.error,
          partialResults: data.partialResults
        },
        timestamp: new Date().toISOString()
      };
      this.broadcastToEvaluation(data.evaluationId, event);
    });
  }

  // Utility methods

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseConnectionParams(client: WebSocketClient, request: IncomingMessage): void {
    const url = new URL(request.url || '', 'http://localhost');
    
    // Extract parameters from query string
    const userId = url.searchParams.get('userId');
    const evaluationId = url.searchParams.get('evaluationId');

    if (userId) {
      client.userId = userId;
      client.subscriptions.add(`user:${userId}`);
    }

    if (evaluationId) {
      client.evaluationId = evaluationId;
      client.subscriptions.add(`evaluation:${evaluationId}`);
    }

    // Store additional metadata
    client.metadata = {
      userAgent: request.headers['user-agent'],
      ip: request.socket.remoteAddress,
      connectedAt: new Date().toISOString()
    };
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.emit('clientDisconnected', client);
      console.log(`[WebSocketServer] Removed client ${clientId} (${this.clients.size} remaining)`);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = this.config.pingInterval * 2; // Allow 2x ping interval before timeout

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
        
        if (timeSinceLastPing > timeout) {
          console.log(`[WebSocketServer] Client ${clientId} timed out`);
          client.socket.close(1000, 'Ping timeout');
          this.removeClient(clientId);
        } else if (client.socket.readyState === WebSocket.OPEN) {
          // Send ping
          try {
            client.socket.ping();
          } catch (error) {
            console.error(`[WebSocketServer] Failed to ping client ${clientId}:`, error);
            this.removeClient(clientId);
          }
        }
      }
    }, this.config.pingInterval);

    console.log(`[WebSocketServer] Heartbeat started with ${this.config.pingInterval}ms interval`);
  }
}