/**
 * Message Bus Implementation
 * Handles inter-agent communication and message routing
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  Message, 
  MessageType, 
  MessageHandler, 
  MessageBus as IMessageBus,
  BaseMessage 
} from './message-types.js';

export class MessageBus extends EventEmitter implements IMessageBus {
  private static instance: MessageBus;
  private handlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (message: Message) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageHistory: Message[] = [];
  private maxHistorySize: number = 1000;

  private constructor() {
    super();
    this.setMaxListeners(100); // Increase max listeners for multiple handlers
  }

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  async publish(message: Message): Promise<void> {
    try {
      // Add to message history
      this.addToHistory(message);

      // Log message for debugging
      console.log(`[MessageBus] Publishing message: ${message.type} (${message.id})`);

      // Get handlers for this message type
      const handlers = this.handlers.get(message.type) || new Set();

      // Handle reply-to pattern for request/response
      if (message.replyTo) {
        const pendingRequest = this.pendingRequests.get(message.replyTo);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(message.replyTo);
          pendingRequest.resolve(message);
          return;
        }
      }

      // Process handlers in parallel
      const handlerPromises = Array.from(handlers).map(async (handler) => {
        try {
          if (handler.canHandle(message)) {
            await handler.handle(message as any);
          }
        } catch (error) {
          console.error(`[MessageBus] Handler error for ${message.type}:`, error);
          // Emit error event for monitoring
          this.emit('handler-error', { message, handler, error });
        }
      });

      await Promise.allSettled(handlerPromises);

      // Emit event for listeners
      this.emit(message.type, message);
      this.emit('message', message);

    } catch (error) {
      console.error(`[MessageBus] Error publishing message:`, error);
      throw error;
    }
  }

  async subscribe<T extends Message>(
    messageType: MessageType,
    handler: MessageHandler<T>
  ): Promise<void> {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    
    const handlersSet = this.handlers.get(messageType)!;
    handlersSet.add(handler as MessageHandler);

    console.log(`[MessageBus] Subscribed handler to ${messageType} (${handlersSet.size} total handlers)`);
  }

  async unsubscribe(messageType: MessageType, handler: MessageHandler): Promise<void> {
    const handlersSet = this.handlers.get(messageType);
    if (handlersSet) {
      handlersSet.delete(handler);
      
      if (handlersSet.size === 0) {
        this.handlers.delete(messageType);
      }
      
      console.log(`[MessageBus] Unsubscribed handler from ${messageType}`);
    }
  }

  async request<TRequest extends Message, TResponse extends Message>(
    message: TRequest,
    timeoutMs: number = 30000
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${timeoutMs}ms for message type: ${message.type}`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: resolve as (message: Message) => void,
        reject,
        timeout
      });

      // Add correlation ID to message
      const requestMessage = {
        ...message,
        correlationId: requestId
      };

      // Publish the request
      this.publish(requestMessage).catch(reject);
    });
  }

  // Utility methods for debugging and monitoring

  getMessageHistory(count?: number): Message[] {
    return count ? this.messageHistory.slice(-count) : [...this.messageHistory];
  }

  getHandlerCount(messageType?: MessageType): number {
    if (messageType) {
      return this.handlers.get(messageType)?.size || 0;
    }
    return Array.from(this.handlers.values()).reduce((sum, set) => sum + set.size, 0);
  }

  getRegisteredMessageTypes(): MessageType[] {
    return Array.from(this.handlers.keys());
  }

  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalHandlers: number;
      pendingRequests: number;
      messageHistory: number;
      registeredTypes: number;
    };
  }> {
    const details = {
      totalHandlers: this.getHandlerCount(),
      pendingRequests: this.getPendingRequestCount(),
      messageHistory: this.messageHistory.length,
      registeredTypes: this.getRegisteredMessageTypes().length
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for potential issues
    if (details.pendingRequests > 100) {
      status = 'degraded';
    }
    if (details.pendingRequests > 500) {
      status = 'unhealthy';
    }

    return { status, details };
  }

  // Shutdown method
  async shutdown(): Promise<void> {
    console.log('[MessageBus] Shutting down...');

    // Clear all pending requests
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('MessageBus shutting down'));
    }
    this.pendingRequests.clear();

    // Clear handlers
    this.handlers.clear();

    // Clear history
    this.clearHistory();

    // Remove all event listeners
    this.removeAllListeners();

    console.log('[MessageBus] Shutdown complete');
  }

  // Helper method to create standard messages
  createMessage(
    type: MessageType,
    payload: any,
    options: Partial<BaseMessage> = {}
  ): Message {
    return {
      id: uuidv4(),
      timestamp: new Date(),
      type,
      payload,
      ...options
    } as Message;
  }

  private addToHistory(message: Message): void {
    this.messageHistory.push(message);
    
    // Trim history if it exceeds max size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  // Test utility methods
  static resetInstance(): void {
    if (MessageBus.instance) {
      MessageBus.instance.shutdown();
    }
    MessageBus.instance = null as any;
  }

  // Create a scoped message bus for testing
  static createTestInstance(): MessageBus {
    return new MessageBus();
  }
}