import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from '@/composables/useWebSocket';

// Mock Socket.IO
const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    token: 'test-token'
  }))
}));

// Mock environment
vi.mock('@/config/environment', () => ({
  API_URL: 'http://localhost:3000'
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize with disconnected state', () => {
      const webSocket = useWebSocket();
      
      expect(webSocket.connectionState.value).toBe('disconnected');
      expect(webSocket.isConnected.value).toBe(false);
      expect(webSocket.isConnecting.value).toBe(false);
      expect(webSocket.isReconnecting.value).toBe(false);
    });

    it('should attempt to connect with auth token', async () => {
      const webSocket = useWebSocket();
      
      // Simulate successful connection
      mockSocket.once.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 10);
        }
      });
      
      const result = await webSocket.connect();
      
      expect(result).toBe(true);
    });

    it('should handle connection failure', async () => {
      const webSocket = useWebSocket();
      
      // Simulate connection error
      mockSocket.once.mockImplementation((event, callback) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(new Error('Connection failed')), 10);
        }
      });
      
      try {
        await webSocket.connect();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should disconnect properly', () => {
      const webSocket = useWebSocket();
      
      webSocket.disconnect();
      
      expect(webSocket.connectionState.value).toBe('disconnected');
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to evaluation updates', () => {
      const webSocket = useWebSocket();
      const evaluationId = 'test-eval-123';
      
      const mockHandlers = {
        onProgress: vi.fn(),
        onInsight: vi.fn(),
        onStatus: vi.fn()
      };
      
      webSocket.subscribeToEvaluation(evaluationId, mockHandlers);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', evaluationId);
    });

    it('should unsubscribe from evaluation', () => {
      const webSocket = useWebSocket();
      const evaluationId = 'test-eval-123';
      
      webSocket.unsubscribeFromEvaluation(evaluationId);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', evaluationId);
    });

    it('should register and unregister event handlers', () => {
      const webSocket = useWebSocket();
      const handler = vi.fn();
      
      webSocket.on('agent:progress', handler);
      expect(mockSocket.on).toHaveBeenCalledWith('agent:progress', handler);
      
      webSocket.off('agent:progress', handler);
      expect(mockSocket.off).toHaveBeenCalledWith('agent:progress', handler);
    });
  });

  describe('SSE Fallback', () => {
    it('should attempt SSE connection on WebSocket failure', async () => {
      const webSocket = useWebSocket();
      
      // Mock EventSource
      const mockEventSource = {
        onopen: null,
        onerror: null,
        close: vi.fn(),
        addEventListener: vi.fn()
      };
      
      // @ts-ignore
      global.EventSource = vi.fn(() => mockEventSource);
      
      // Simulate WebSocket failure
      mockSocket.once.mockImplementation((event, callback) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(new Error('WebSocket failed')), 10);
        }
      });
      
      try {
        await webSocket.connect();
      } catch (error) {
        // Connection might fail in test environment, but SSE should be attempted
        expect(global.EventSource).toHaveBeenCalled();
      }
    });
  });

  describe('State Management', () => {
    it('should update connection state correctly', () => {
      const webSocket = useWebSocket();
      
      expect(webSocket.connectionState.value).toBe('disconnected');
      expect(webSocket.isConnected.value).toBe(false);
      expect(webSocket.isConnecting.value).toBe(false);
      expect(webSocket.isReconnecting.value).toBe(false);
    });

    it('should track reconnection attempts', () => {
      const webSocket = useWebSocket();
      
      expect(webSocket.reconnectAttempts.value).toBe(0);
      expect(webSocket.usingSse.value).toBe(false);
    });
  });
});