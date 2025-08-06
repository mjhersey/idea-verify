import { ref, onUnmounted, computed } from 'vue';
import { io, Socket } from 'socket.io-client';
import type {
  ConnectionState,
  WebSocketClientOptions,
  SubscriptionOptions
} from '@ai-validation/shared';
import { useAuthStore } from '@/stores/auth';

// Global type definitions for browser APIs
/* global EventSource, URL, MessageEvent */

export function useWebSocket() {
  const authStore = useAuthStore();
  
  // Connection state
  const socket = ref<Socket | null>(null);
  const connectionState = ref<ConnectionState>('disconnected');
  const lastError = ref<string | null>(null);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = ref(5);
  
  // Event handlers storage
  const eventHandlers = new Map<string, Set<Function>>();
  
  // SSE fallback
  const sseConnection = ref<EventSource | null>(null);
  const usingSse = ref(false);
  
  // Connection options
  const defaultOptions: WebSocketClientOptions = {
    url: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    token: '',
    reconnect: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  };

  // Computed states
  const isConnected = computed(() => connectionState.value === 'connected');
  const isConnecting = computed(() => connectionState.value === 'connecting');
  const isReconnecting = computed(() => connectionState.value === 'reconnecting');

  // Connect to WebSocket server
  const connect = async (options?: Partial<WebSocketClientOptions>) => {
    const config = { ...defaultOptions, ...options };
    
    // Get auth token
    const token = config.token || authStore.token;
    if (!token) {
      lastError.value = 'Authentication token required';
      return false;
    }

    connectionState.value = 'connecting';
    
    try {
      // Try WebSocket first
      socket.value = io(`${config.url}/evaluation-progress`, {
        auth: { token },
        reconnection: config.reconnect,
        reconnectionDelay: config.reconnectDelay,
        reconnectionAttempts: config.maxReconnectAttempts,
        transports: ['websocket', 'polling']
      });

      setupSocketListeners();
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        socket.value?.once('connect', () => {
          clearTimeout(timeout);
          connectionState.value = 'connected';
          reconnectAttempts.value = 0;
          usingSse.value = false;
          resolve();
        });

        socket.value?.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      return true;
    } catch (error) {
      console.warn('WebSocket connection failed, falling back to SSE:', error);
      return connectSSE(config);
    }
  };

  // Setup WebSocket event listeners
  const setupSocketListeners = () => {
    if (!socket.value) return;

    socket.value.on('disconnect', () => {
      connectionState.value = 'disconnected';
      console.log('WebSocket disconnected');
    });

    socket.value.on('reconnect', (attemptNumber) => {
      connectionState.value = 'connected';
      reconnectAttempts.value = attemptNumber;
      console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
    });

    socket.value.on('reconnect_attempt', (attemptNumber) => {
      connectionState.value = 'reconnecting';
      reconnectAttempts.value = attemptNumber;
    });

    socket.value.on('reconnect_failed', () => {
      connectionState.value = 'failed';
      lastError.value = 'Failed to reconnect after maximum attempts';
      // Fallback to SSE
      const token = authStore.token;
      if (token) {
        connectSSE({ ...defaultOptions, token });
      }
    });

    socket.value.on('error', (error) => {
      lastError.value = error.message || 'WebSocket error occurred';
      console.error('WebSocket error:', error);
    });

    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      if (socket.value?.connected) {
        socket.value.emit('ping');
      }
    }, 30000);

    socket.value.on('pong', (data) => {
      console.debug('Heartbeat pong received:', data);
    });

    // Clean up heartbeat on disconnect
    socket.value.once('disconnect', () => {
      clearInterval(heartbeatInterval);
    });
  };

  // Connect to Server-Sent Events (fallback)
  const connectSSE = async (config: WebSocketClientOptions): Promise<boolean> => {
    try {
      connectionState.value = 'connecting';
      
      const url = new URL(`${config.url}/api/events/evaluations/current/events`);
      url.searchParams.append('token', config.token);

      sseConnection.value = new EventSource(url.toString());
      usingSse.value = true;

      sseConnection.value.onopen = () => {
        connectionState.value = 'connected';
        reconnectAttempts.value = 0;
        console.log('SSE connection established');
      };

      sseConnection.value.onerror = (error) => {
        console.error('SSE error:', error);
        lastError.value = 'SSE connection error';
        
        if (connectionState.value === 'connected') {
          connectionState.value = 'reconnecting';
          reconnectAttempts.value++;
          
          if (reconnectAttempts.value >= maxReconnectAttempts.value) {
            connectionState.value = 'failed';
            sseConnection.value?.close();
          }
        }
      };

      // Setup SSE event listeners
      setupSSEListeners();

      return true;
    } catch (error) {
      connectionState.value = 'failed';
      lastError.value = 'Failed to establish SSE connection';
      return false;
    }
  };

  // Setup SSE event listeners
  const setupSSEListeners = () => {
    if (!sseConnection.value) return;

    // Map SSE events to WebSocket-like events
    const eventTypes = [
      'agent:progress',
      'insight:discovered',
      'evaluation:status',
      'agent:completed',
      'evaluation:error',
      'evaluation:completed'
    ];

    eventTypes.forEach(eventType => {
      sseConnection.value?.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          emitEvent(eventType, data);
        } catch (error) {
          console.error(`Failed to parse SSE event ${eventType}:`, error);
        }
      });
    });
  };

  // Emit event to registered handlers
  const emitEvent = (eventType: string, data: any) => {
    const handlers = eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  };

  // Subscribe to evaluation updates
  const subscribeToEvaluation = (evaluationId: string, options: SubscriptionOptions) => {
    if (socket.value?.connected) {
      socket.value.emit('subscribe', evaluationId);
      
      // Register event handlers
      if (options.onProgress) {
        on('agent:progress', options.onProgress);
      }
      if (options.onInsight) {
        on('insight:discovered', options.onInsight);
      }
      if (options.onStatus) {
        on('evaluation:status', options.onStatus);
      }
      if (options.onAgentCompleted) {
        on('agent:completed', options.onAgentCompleted);
      }
      if (options.onError) {
        on('evaluation:error', options.onError);
      }
      if (options.onCompleted) {
        on('evaluation:completed', options.onCompleted);
      }
    } else if (usingSse.value) {
      // For SSE, we're already receiving all events for the current evaluation
      // Just register the handlers
      if (options.onProgress) {
        on('agent:progress', options.onProgress);
      }
      if (options.onInsight) {
        on('insight:discovered', options.onInsight);
      }
      if (options.onStatus) {
        on('evaluation:status', options.onStatus);
      }
      if (options.onAgentCompleted) {
        on('agent:completed', options.onAgentCompleted);
      }
      if (options.onError) {
        on('evaluation:error', options.onError);
      }
      if (options.onCompleted) {
        on('evaluation:completed', options.onCompleted);
      }
    }
  };

  // Unsubscribe from evaluation
  const unsubscribeFromEvaluation = (evaluationId: string) => {
    if (socket.value?.connected) {
      socket.value.emit('unsubscribe', evaluationId);
    }
    // Clear all event handlers for this evaluation
    eventHandlers.clear();
  };

  // Register event handler
  const on = (eventType: string, handler: Function) => {
    if (!eventHandlers.has(eventType)) {
      eventHandlers.set(eventType, new Set());
    }
    eventHandlers.get(eventType)?.add(handler);

    // If using WebSocket, also register with socket
    if (socket.value && !usingSse.value) {
      socket.value.on(eventType, handler as any);
    }
  };

  // Unregister event handler
  const off = (eventType: string, handler: Function) => {
    eventHandlers.get(eventType)?.delete(handler);
    
    // If using WebSocket, also unregister from socket
    if (socket.value && !usingSse.value) {
      socket.value.off(eventType, handler as any);
    }
  };

  // Disconnect
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
    if (sseConnection.value) {
      sseConnection.value.close();
      sseConnection.value = null;
    }
    eventHandlers.clear();
    connectionState.value = 'disconnected';
    usingSse.value = false;
  };

  // Clean up on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    // State
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    lastError,
    reconnectAttempts,
    usingSse,
    
    // Methods
    connect,
    disconnect,
    subscribeToEvaluation,
    unsubscribeFromEvaluation,
    on,
    off
  };
}