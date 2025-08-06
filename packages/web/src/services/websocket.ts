import type {
  SubscriptionOptions,
  ConnectionState,
  AgentProgressEvent,
  InsightDiscoveredEvent,
  EvaluationStatusEvent,
  AgentCompletedEvent,
  ErrorEvent,
  EvaluationCompletedEvent
} from '@ai-validation/shared';

// Global type definitions for browser APIs
/* global EventSource, URL, MessageEvent */

export interface WebSocketServiceConfig {
  baseUrl: string;
  authToken?: string;
  enableSSEFallback?: boolean;
  reconnectOptions?: {
    maxAttempts: number;
    delay: number;
    backoffMultiplier: number;
  };
}

export interface EvaluationSubscription {
  evaluationId: string;
  handlers: {
    // eslint-disable-next-line no-unused-vars
    onProgress?: (event: AgentProgressEvent) => void;
    // eslint-disable-next-line no-unused-vars
    onInsight?: (event: InsightDiscoveredEvent) => void;
    // eslint-disable-next-line no-unused-vars
    onStatus?: (event: EvaluationStatusEvent) => void;
    // eslint-disable-next-line no-unused-vars
    onAgentCompleted?: (event: AgentCompletedEvent) => void;
    // eslint-disable-next-line no-unused-vars
    onError?: (error: ErrorEvent) => void;
    // eslint-disable-next-line no-unused-vars
    onCompleted?: (event: EvaluationCompletedEvent) => void;
  };
  active: boolean;
}

class WebSocketService {
  private config: WebSocketServiceConfig;
  private connection: any = null; // Will be Socket or EventSource
  private connectionState: ConnectionState = 'disconnected';
  private subscriptions = new Map<string, EvaluationSubscription>();
  private eventListeners = new Map<string, Function[]>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private usingSSE = false;

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      enableSSEFallback: true,
      reconnectOptions: {
        maxAttempts: 5,
        delay: 1000,
        backoffMultiplier: 2
      },
      ...config
    };
  }

  // Get current connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Check if connected
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // Check if using SSE fallback
  isUsingSSE(): boolean {
    return this.usingSSE;
  }

  // Connect to WebSocket or SSE
  async connect(authToken?: string): Promise<boolean> {
    const token = authToken || this.config.authToken;
    if (!token) {
      throw new Error('Authentication token required');
    }

    this.config.authToken = token;
    this.connectionState = 'connecting';
    this.emit('stateChange', this.connectionState);

    try {
      // Try WebSocket first
      await this.connectWebSocket(token);
      return true;
    } catch (error) {
      console.warn('WebSocket connection failed:', error);
      
      if (this.config.enableSSEFallback) {
        try {
          await this.connectSSE(token);
          return true;
        } catch (sseError) {
          console.error('SSE fallback failed:', sseError);
          this.connectionState = 'failed';
          this.emit('stateChange', this.connectionState);
          throw sseError;
        }
      } else {
        this.connectionState = 'failed';
        this.emit('stateChange', this.connectionState);
        throw error;
      }
    }
  }

  // Connect via WebSocket
  private async connectWebSocket(token: string): Promise<void> {
    const { io } = await import('socket.io-client');
    
    this.connection = io(`${this.config.baseUrl}/evaluation-progress`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false // Handle reconnection manually
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.connection.once('connect', () => {
        clearTimeout(timeout);
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.usingSSE = false;
        this.setupWebSocketListeners();
        this.startHeartbeat();
        this.emit('stateChange', this.connectionState);
        resolve();
      });

      this.connection.once('connect_error', (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // Connect via Server-Sent Events
  private async connectSSE(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.config.baseUrl}/api/events/evaluations/current/events`);
      url.searchParams.append('token', token);

      this.connection = new EventSource(url.toString());
      this.usingSSE = true;

      this.connection.onopen = () => {
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.setupSSEListeners();
        this.emit('stateChange', this.connectionState);
        resolve();
      };

      this.connection.onerror = (error: any) => {
        if (this.connectionState === 'connecting') {
          reject(error);
        } else {
          this.handleDisconnection();
        }
      };

      // Set timeout for SSE connection
      setTimeout(() => {
        if (this.connectionState !== 'connected') {
          this.connection?.close();
          reject(new Error('SSE connection timeout'));
        }
      }, 10000);
    });
  }

  // Setup WebSocket event listeners
  private setupWebSocketListeners(): void {
    this.connection.on('disconnect', () => {
      this.handleDisconnection();
    });

    this.connection.on('error', (error: any) => {
      this.emit('error', error);
    });

    this.connection.on('pong', (data: any) => {
      console.debug('WebSocket heartbeat pong:', data);
    });

    // Setup evaluation event listeners
    const eventTypes = [
      'agent:progress',
      'insight:discovered',
      'evaluation:status',
      'agent:completed',
      'evaluation:error',
      'evaluation:completed'
    ];

    eventTypes.forEach(eventType => {
      this.connection.on(eventType, (data: any) => {
        this.handleEvaluationEvent(eventType, data);
      });
    });
  }

  // Setup SSE event listeners
  private setupSSEListeners(): void {
    const eventTypes = [
      'agent:progress',
      'insight:discovered',
      'evaluation:status',
      'agent:completed',
      'evaluation:error',
      'evaluation:completed'
    ];

    eventTypes.forEach(eventType => {
      this.connection.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvaluationEvent(eventType, data);
        } catch (error) {
          console.error(`Failed to parse SSE event ${eventType}:`, error);
        }
      });
    });

    this.connection.addEventListener('heartbeat', (event: MessageEvent) => {
      console.debug('SSE heartbeat received:', event.data);
    });
  }

  // Handle evaluation events
  private handleEvaluationEvent(eventType: string, data: any): void {
    // Emit to general listeners
    this.emit(eventType, data);

    // Handle subscription-specific events
    this.subscriptions.forEach((subscription, evaluationId) => {
      if (!subscription.active) return;

      // Check if event is for this evaluation
      const isForThisEvaluation = 
        data.evaluationId === evaluationId ||
        (eventType.startsWith('agent:') && data.agentType && subscription.handlers.onProgress) ||
        (eventType === 'insight:discovered' && data.agentType && subscription.handlers.onInsight);

      if (!isForThisEvaluation) return;

      switch (eventType) {
        case 'agent:progress':
          subscription.handlers.onProgress?.(data);
          break;
        case 'insight:discovered':
          subscription.handlers.onInsight?.(data);
          break;
        case 'evaluation:status':
          subscription.handlers.onStatus?.(data);
          break;
        case 'agent:completed':
          subscription.handlers.onAgentCompleted?.(data);
          break;
        case 'evaluation:error':
          subscription.handlers.onError?.(data);
          break;
        case 'evaluation:completed':
          subscription.handlers.onCompleted?.(data);
          break;
      }
    });
  }

  // Start heartbeat for WebSocket
  private startHeartbeat(): void {
    if (this.usingSSE) return; // SSE has server-side heartbeat

    this.heartbeatTimer = setInterval(() => {
      if (this.connection && this.connectionState === 'connected') {
        this.connection.emit('ping');
      }
    }, 30000);
  }

  // Handle disconnection
  private handleDisconnection(): void {
    this.connectionState = 'disconnected';
    this.emit('stateChange', this.connectionState);
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Attempt reconnection
    this.scheduleReconnect();
  }

  // Schedule reconnection attempt
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectOptions!.maxAttempts) {
      this.connectionState = 'failed';
      this.emit('stateChange', this.connectionState);
      return;
    }

    const delay = this.config.reconnectOptions!.delay * 
                 Math.pow(this.config.reconnectOptions!.backoffMultiplier, this.reconnectAttempts);

    this.connectionState = 'reconnecting';
    this.emit('stateChange', this.connectionState);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      });
    }, delay);
  }

  // Subscribe to evaluation updates
  subscribeToEvaluation(evaluationId: string, handlers: SubscriptionOptions): void {
    const subscription: EvaluationSubscription = {
      evaluationId,
      handlers,
      active: true
    };

    this.subscriptions.set(evaluationId, subscription);

    // If using WebSocket, send subscription message
    if (this.connection && !this.usingSSE && this.connectionState === 'connected') {
      this.connection.emit('subscribe', evaluationId);
    }
  }

  // Unsubscribe from evaluation
  unsubscribeFromEvaluation(evaluationId: string): void {
    const subscription = this.subscriptions.get(evaluationId);
    if (subscription) {
      subscription.active = false;
      this.subscriptions.delete(evaluationId);

      // If using WebSocket, send unsubscribe message
      if (this.connection && !this.usingSSE && this.connectionState === 'connected') {
        this.connection.emit('unsubscribe', evaluationId);
      }
    }
  }

  // Add event listener
  addEventListener(eventType: string, handler: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(handler);
  }

  // Remove event listener
  removeEventListener(eventType: string, handler: Function): void {
    const handlers = this.eventListeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Emit event to listeners
  private emit(eventType: string, data?: any): void {
    const handlers = this.eventListeners.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  // Disconnect
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.connection) {
      if (this.usingSSE) {
        (this.connection as EventSource).close();
      } else {
        this.connection.disconnect();
      }
      this.connection = null;
    }

    this.subscriptions.clear();
    this.eventListeners.clear();
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.usingSSE = false;
  }
}

// Export singleton instance
let webSocketServiceInstance: WebSocketService | null = null;

export function createWebSocketService(config: WebSocketServiceConfig): WebSocketService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService(config);
  }
  return webSocketServiceInstance;
}

export function getWebSocketService(): WebSocketService {
  if (!webSocketServiceInstance) {
    throw new Error('WebSocket service not initialized. Call createWebSocketService first.');
  }
  return webSocketServiceInstance;
}

export { WebSocketService };