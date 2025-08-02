/**
 * Tests for QuotaMonitor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotaMonitor } from './quota-monitor.js';

describe('QuotaMonitor', () => {
  let quotaMonitor: QuotaMonitor;
  let alertCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    quotaMonitor = new QuotaMonitor();
    alertCallback = vi.fn();
  });

  describe('configure and basic usage', () => {
    it('should configure quota monitoring', () => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 1000,
        monthlyLimit: 30000,
        costLimit: 100,
        alertThresholds: [50, 75, 90]
      });

      const usage = quotaMonitor.getUsage('test-service');
      expect(usage).toEqual({
        requests: 0,
        tokens: 0,
        cost: 0,
        errors: 0,
        lastRequest: expect.any(Date)
      });
    });

    it('should record usage correctly', () => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 1000,
        alertThresholds: [50, 75, 90]
      });

      quotaMonitor.recordUsage('test-service', 100, 0.50, false);
      quotaMonitor.recordUsage('test-service', 200, 1.00, true);

      const usage = quotaMonitor.getUsage('test-service');
      expect(usage).toEqual({
        requests: 2,
        tokens: 300,
        cost: 1.50,
        errors: 1,
        lastRequest: expect.any(Date)
      });
    });
  });

  describe('getQuotaStatus', () => {
    it('should return correct quota status', () => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 1000,
        monthlyLimit: 10000,
        costLimit: 50,
        alertThresholds: [50, 75, 90]
      });

      quotaMonitor.recordUsage('test-service', 1000, 25, false);

      const status = quotaMonitor.getQuotaStatus('test-service');
      
      expect(status).toEqual({
        requests: {
          used: 1,
          limit: 1000,
          resetTime: expect.any(Date),
          percentageUsed: 0.1
        },
        tokens: {
          used: 1000,
          limit: 10000,
          resetTime: expect.any(Date),
          percentageUsed: 10
        },
        cost: {
          used: 25,
          limit: 50,
          resetTime: expect.any(Date),
          percentageUsed: 50
        }
      });
    });

    it('should return null for unconfigured service', () => {
      const status = quotaMonitor.getQuotaStatus('nonexistent-service');
      expect(status).toBeNull();
    });
  });

  describe('isWithinLimits', () => {
    beforeEach(() => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 10,
        monthlyLimit: 1000,
        costLimit: 100,
        alertThresholds: [50, 75, 90]
      });
    });

    it('should return true when within limits', () => {
      quotaMonitor.recordUsage('test-service', 100, 10, false);
      expect(quotaMonitor.isWithinLimits('test-service')).toBe(true);
    });

    it('should return false when daily request limit exceeded', () => {
      for (let i = 0; i < 10; i++) {
        quotaMonitor.recordUsage('test-service', 10, 1, false);
      }
      expect(quotaMonitor.isWithinLimits('test-service')).toBe(false);
    });

    it('should return false when monthly token limit exceeded', () => {
      quotaMonitor.recordUsage('test-service', 1001, 1, false);
      expect(quotaMonitor.isWithinLimits('test-service')).toBe(false);
    });

    it('should return false when cost limit exceeded', () => {
      quotaMonitor.recordUsage('test-service', 10, 101, false);
      expect(quotaMonitor.isWithinLimits('test-service')).toBe(false);
    });
  });

  describe('getFallbackStrategy', () => {
    it('should recommend fallback when near limits', () => {
      quotaMonitor.configure('openai', {
        dailyLimit: 100,
        alertThresholds: [50, 75, 90]
      });

      // Use 85% of daily limit
      for (let i = 0; i < 85; i++) {
        quotaMonitor.recordUsage('openai', 10, 1, false);
      }

      const strategy = quotaMonitor.getFallbackStrategy('openai');
      
      expect(strategy.canSwitch).toBe(true);
      expect(strategy.alternatives).toContain('anthropic');
      expect(strategy.recommendations).toContain('Switch to Anthropic API as fallback');
    });

    it('should recommend mock services when cost critical', () => {
      quotaMonitor.configure('test-service', {
        costLimit: 100,
        alertThresholds: [50, 75, 90]
      });

      quotaMonitor.recordUsage('test-service', 10, 91, false);

      const strategy = quotaMonitor.getFallbackStrategy('test-service');
      
      expect(strategy.alternatives).toContain('mock-services');
      expect(strategy.recommendations).toContain('Cost limit critical - enable mock services');
    });
  });

  describe('resetUsage', () => {
    beforeEach(() => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 1000,
        alertThresholds: [50, 75, 90]
      });

      quotaMonitor.recordUsage('test-service', 500, 50, true);
    });

    it('should reset daily counters', () => {
      quotaMonitor.resetUsage('test-service', 'daily');

      const usage = quotaMonitor.getUsage('test-service');
      expect(usage!.requests).toBe(0);
      expect(usage!.errors).toBe(0);
      expect(usage!.tokens).toBe(500); // Should not reset monthly counters
      expect(usage!.cost).toBe(50);
    });

    it('should reset monthly counters', () => {
      quotaMonitor.resetUsage('test-service', 'monthly');

      const usage = quotaMonitor.getUsage('test-service');
      expect(usage!.requests).toBe(1); // Should not reset daily counters
      expect(usage!.errors).toBe(1);
      expect(usage!.tokens).toBe(0);
      expect(usage!.cost).toBe(0);
    });

    it('should reset all counters', () => {
      quotaMonitor.resetUsage('test-service', 'all');

      const usage = quotaMonitor.getUsage('test-service');
      expect(usage!.requests).toBe(0);
      expect(usage!.errors).toBe(0);
      expect(usage!.tokens).toBe(0);
      expect(usage!.cost).toBe(0);
    });
  });

  describe('alert system', () => {
    it('should trigger alerts at thresholds', () => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 100,
        alertThresholds: [50, 90],
        alertCallback
      });

      // Reach 50% threshold
      for (let i = 0; i < 50; i++) {
        quotaMonitor.recordUsage('test-service', 10, 1, false);
      }

      expect(alertCallback).toHaveBeenCalledWith(expect.objectContaining({
        service: 'test-service',
        type: 'usage',
        threshold: 50,
        current: 50,
        limit: 100,
        severity: 'warning'
      }));
    });

    it('should trigger critical alerts', () => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 100,
        alertThresholds: [90],
        alertCallback
      });

      // Reach 90% threshold
      for (let i = 0; i < 90; i++) {
        quotaMonitor.recordUsage('test-service', 10, 1, false);
      }

      expect(alertCallback).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'critical',
        threshold: 90
      }));
    });

    it('should not spam alerts', () => {
      quotaMonitor.configure('test-service', {
        dailyLimit: 100,
        alertThresholds: [50],
        alertCallback
      });

      // Trigger alert multiple times
      for (let i = 0; i < 60; i++) {
        quotaMonitor.recordUsage('test-service', 10, 1, false);
      }

      // Should only be called once despite multiple threshold crossings
      expect(alertCallback).toHaveBeenCalledTimes(1);
    });
  });
});