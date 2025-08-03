/**
 * Message Bus Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBus } from '../../../src/communication/message-bus.js';
import { 
  MessageType, 
  MessageHandler,
  Message,
  AgentStartMessage,
  AgentCompleteMessage
} from '../../../src/communication/message-types.js';

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = MessageBus.createTestInstance();
  });

  afterEach(async () => {
    await messageBus.shutdown();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MessageBus.getInstance();
      const instance2 = MessageBus.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance properly', async () => {
      const instance1 = MessageBus.getInstance();
      MessageBus.resetInstance();
      const instance2 = MessageBus.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Message Publishing and Subscription', () => {
    it('should publish and receive messages', async () => {
      const handler = vi.fn();
      const messageHandler: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: handler
      };

      await messageBus.subscribe(MessageType.AGENT_START, messageHandler);

      const message = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      await messageBus.publish(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should handle multiple handlers for same message type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const messageHandler1: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: handler1
      };

      const messageHandler2: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: handler2
      };

      await messageBus.subscribe(MessageType.AGENT_START, messageHandler1);
      await messageBus.subscribe(MessageType.AGENT_START, messageHandler2);

      const message = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      await messageBus.publish(message);

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });

    it('should not call handler if canHandle returns false', async () => {
      const handler = vi.fn();
      const messageHandler: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_COMPLETE,
        handle: handler
      };

      await messageBus.subscribe(MessageType.AGENT_START, messageHandler);

      const message = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      await messageBus.publish(message);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should unsubscribe handlers', async () => {
      const handler = vi.fn();
      const messageHandler: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: handler
      };

      await messageBus.subscribe(MessageType.AGENT_START, messageHandler);
      await messageBus.unsubscribe(MessageType.AGENT_START, messageHandler);

      const message = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      await messageBus.publish(message);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Request/Response Pattern', () => {
    it('should handle request/response with replyTo', async () => {
      // Set up a handler that responds to requests
      const respondingHandler: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: async (msg: Message) => {
          if (msg.correlationId) {
            const response = messageBus.createMessage<AgentCompleteMessage>(
              MessageType.AGENT_COMPLETE,
              {
                evaluationId: (msg as AgentStartMessage).payload.evaluationId,
                agentType: (msg as AgentStartMessage).payload.agentType,
                result: {
                  id: 'test-result',
                  evaluation_id: (msg as AgentStartMessage).payload.evaluationId,
                  agent_type: (msg as AgentStartMessage).payload.agentType,
                  status: 'completed',
                  score: 85,
                  confidence: 'high',
                  insights: { test: 'insight' },
                  metadata: {},
                  rawData: {},
                  created_at: new Date(),
                  updated_at: new Date()
                },
                executionTime: 1000
              },
              {
                replyTo: msg.correlationId
              }
            );

            await messageBus.publish(response);
          }
        }
      };

      await messageBus.subscribe(MessageType.AGENT_START, respondingHandler);

      const requestMessage = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      const response = await messageBus.request<AgentStartMessage, AgentCompleteMessage>(
        requestMessage,
        5000
      );

      expect(response.type).toBe(MessageType.AGENT_COMPLETE);
      expect(response.payload.evaluationId).toBe('test-eval');
    });

    it('should timeout on request without response', async () => {
      const requestMessage = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      await expect(
        messageBus.request<AgentStartMessage, AgentCompleteMessage>(
          requestMessage,
          100 // Short timeout
        )
      ).rejects.toThrow('Request timeout after 100ms');
    });
  });

  describe('Message History and Monitoring', () => {
    it('should maintain message history', async () => {
      const message1 = messageBus.createMessage(MessageType.AGENT_START, {});
      const message2 = messageBus.createMessage(MessageType.AGENT_COMPLETE, {});

      await messageBus.publish(message1);
      await messageBus.publish(message2);

      const history = messageBus.getMessageHistory();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(message1.id);
      expect(history[1].id).toBe(message2.id);
    });

    it('should limit message history size', async () => {
      // Publish more than max history size
      for (let i = 0; i < 1200; i++) {
        const message = messageBus.createMessage(MessageType.AGENT_START, { index: i });
        await messageBus.publish(message);
      }

      const history = messageBus.getMessageHistory();
      expect(history.length).toBe(1000); // Max history size
    });

    it('should provide handler count information', async () => {
      const handler1: MessageHandler = {
        canHandle: () => true,
        handle: async () => {}
      };

      const handler2: MessageHandler = {
        canHandle: () => true,
        handle: async () => {}
      };

      expect(messageBus.getHandlerCount()).toBe(0);

      await messageBus.subscribe(MessageType.AGENT_START, handler1);
      expect(messageBus.getHandlerCount()).toBe(1);
      expect(messageBus.getHandlerCount(MessageType.AGENT_START)).toBe(1);

      await messageBus.subscribe(MessageType.AGENT_START, handler2);
      expect(messageBus.getHandlerCount()).toBe(2);
      expect(messageBus.getHandlerCount(MessageType.AGENT_START)).toBe(2);

      await messageBus.subscribe(MessageType.AGENT_COMPLETE, handler1);
      expect(messageBus.getHandlerCount()).toBe(3);
    });

    it('should clear message history', async () => {
      const message = messageBus.createMessage(MessageType.AGENT_START, {});
      await messageBus.publish(message);

      expect(messageBus.getMessageHistory()).toHaveLength(1);
      
      messageBus.clearHistory();
      expect(messageBus.getMessageHistory()).toHaveLength(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status with normal load', async () => {
      const health = await messageBus.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('totalHandlers');
      expect(health.details).toHaveProperty('pendingRequests');
      expect(health.details).toHaveProperty('messageHistory');
      expect(health.details).toHaveProperty('registeredTypes');
    });

    it('should report degraded status with high pending requests', async () => {
      // Mock high pending requests
      for (let i = 0; i < 150; i++) {
        const message = messageBus.createMessage(MessageType.AGENT_START, {});
        messageBus.request(message, 10000).catch(() => {}); // Don't await, create pending requests
      }

      const health = await messageBus.healthCheck();
      expect(health.status).toBe('degraded');
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: async () => {
          throw new Error('Handler error');
        }
      };

      const goodHandler = vi.fn();
      const goodMessageHandler: MessageHandler = {
        canHandle: (msg: Message) => msg.type === MessageType.AGENT_START,
        handle: goodHandler
      };

      await messageBus.subscribe(MessageType.AGENT_START, errorHandler);
      await messageBus.subscribe(MessageType.AGENT_START, goodMessageHandler);

      const message = messageBus.createMessage<AgentStartMessage>(
        MessageType.AGENT_START,
        {
          evaluationId: 'test-eval',
          agentType: 'market-research',
          businessIdea: {
            id: 'test-idea',
            title: 'Test Idea',
            description: 'Test Description'
          }
        }
      );

      // Should not throw, but both handlers should be called
      await expect(messageBus.publish(message)).resolves.not.toThrow();
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const message = messageBus.createMessage(MessageType.AGENT_START, {});
      await messageBus.publish(message);

      expect(messageBus.getMessageHistory()).toHaveLength(1);
      expect(messageBus.getHandlerCount()).toBe(0);

      await messageBus.shutdown();

      expect(messageBus.getMessageHistory()).toHaveLength(0);
      expect(messageBus.getPendingRequestCount()).toBe(0);
    });

    it('should reject pending requests on shutdown', async () => {
      const requestPromise = messageBus.request(
        messageBus.createMessage(MessageType.AGENT_START, {}),
        10000
      );

      await messageBus.shutdown();

      await expect(requestPromise).rejects.toThrow('MessageBus shutting down');
    });
  });
});