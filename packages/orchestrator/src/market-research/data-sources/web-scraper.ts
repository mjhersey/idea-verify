/**
 * Ethical Web Scraper for Market Research Data
 * Implements rate limiting, robots.txt compliance, and data quality validation
 */

import { DataSource } from '../schemas/market-research-types.js';

export interface ScrapingConfig {
  respectRobotsTxt: boolean;
  rateLimitMs: number;
  maxConcurrentRequests: number;
  userAgent: string;
  timeout: number;
  retryAttempts: number;
  proxyRotation: boolean;
  enableCaching: boolean;
  cacheTtlMs: number;
}

export interface ScrapingRequest {
  url: string;
  selector?: string;
  dataType: 'text' | 'json' | 'table' | 'list';
  source: DataSource;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'numeric' | 'date' | 'url' | 'email';
  pattern?: RegExp;
  min?: number;
  max?: number;
}

export interface ScrapingResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    url: string;
    timestamp: Date;
    responseTime: number;
    dataQuality: number; // 0-100
    source: DataSource;
  };
}

export interface RobotsTxtCache {
  [domain: string]: {
    allowed: boolean;
    lastChecked: Date;
    rules: string[];
  };
}

export class WebScraper {
  private config: ScrapingConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private robotsCache: RobotsTxtCache = {};
  private dataCache: Map<string, { data: any; timestamp: Date }> = new Map();

  constructor(config: Partial<ScrapingConfig> = {}) {
    this.config = {
      respectRobotsTxt: true,
      rateLimitMs: 100, // Reduced for testing
      maxConcurrentRequests: 5, // Increased for testing
      userAgent: 'AI-Validation-Research-Bot/1.0 (+https://example.com/bot)',
      timeout: 2000, // Reduced for testing
      retryAttempts: 1, // Reduced for testing
      proxyRotation: false,
      enableCaching: true,
      cacheTtlMs: 3600000, // 1 hour
      ...config
    };
  }

  /**
   * Scrape multiple URLs with rate limiting and ethical practices
   */
  async scrapeMultiple(requests: ScrapingRequest[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    
    // Process requests with concurrency control
    for (const request of requests) {
      try {
        const result = await this.queueRequest(() => this.scrapeSingle(request));
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            url: request.url,
            timestamp: new Date(),
            responseTime: 0,
            dataQuality: 0,
            source: request.source
          }
        });
      }
    }

    return results;
  }

  /**
   * Scrape a single URL with validation and quality checks
   */
  async scrapeSingle(request: ScrapingRequest): Promise<ScrapingResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getFromCache(request.url);
        if (cached) {
          return {
            success: true,
            data: cached.data,
            metadata: {
              url: request.url,
              timestamp: cached.timestamp,
              responseTime: 0,
              dataQuality: 85, // Cached data gets good quality score
              source: request.source
            }
          };
        }
      }

      // Check robots.txt compliance
      if (this.config.respectRobotsTxt) {
        const allowed = await this.checkRobotsAllowed(request.url);
        if (!allowed) {
          throw new Error('Scraping not allowed by robots.txt');
        }
      }

      // Simulate web scraping (in production, this would use a real HTTP client)
      const data = await this.mockScrape(request);
      
      // Validate scraped data
      const dataQuality = this.validateData(data, request.validationRules || []);
      
      const result: ScrapingResult = {
        success: true,
        data,
        metadata: {
          url: request.url,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          dataQuality,
          source: request.source
        }
      };

      // Cache the result
      if (this.config.enableCaching && dataQuality > 70) {
        this.addToCache(request.url, data);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          url: request.url,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          dataQuality: 0,
          source: request.source
        }
      };
    }
  }

  /**
   * Queue a request to respect rate limiting
   */
  private async queueRequest<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        if (this.activeRequests >= this.config.maxConcurrentRequests) {
          // Wait and try again
          setTimeout(() => this.requestQueue.push(executeRequest), this.config.rateLimitMs);
          return;
        }

        this.activeRequests++;
        
        try {
          // Apply rate limiting
          await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          
          // Process next queued request
          const nextRequest = this.requestQueue.shift();
          if (nextRequest) {
            nextRequest();
          }
        }
      };

      executeRequest();
    });
  }

  /**
   * Check robots.txt compliance
   */
  private async checkRobotsAllowed(url: string): Promise<boolean> {
    try {
      const domain = new URL(url).hostname;
      
      // Check cache first
      const cached = this.robotsCache[domain];
      if (cached && Date.now() - cached.lastChecked.getTime() < 86400000) { // 24 hours
        return cached.allowed;
      }

      // Mock robots.txt checking (in production, this would fetch actual robots.txt)
      const robotsAllowed = !url.includes('private') && !url.includes('admin');
      
      this.robotsCache[domain] = {
        allowed: robotsAllowed,
        lastChecked: new Date(),
        rules: robotsAllowed ? ['Allow: *'] : ['Disallow: /']
      };

      return robotsAllowed;
    } catch (error) {
      console.warn('Error checking robots.txt:', error);
      return false; // Err on the side of caution
    }
  }

  /**
   * Mock scraping implementation (replace with real scraping in production)
   */
  private async mockScrape(request: ScrapingRequest): Promise<any> {
    // Simulate network delay (reduced for testing)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Generate mock data based on the URL and data type
    const url = request.url.toLowerCase();
    
    if (url.includes('news') || url.includes('article')) {
      return {
        title: 'Market Analysis: AI Education Sector Shows Strong Growth',
        content: 'The artificial intelligence education market continues to expand...',
        publishDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        author: 'Market Research Team',
        tags: ['AI', 'Education', 'Market Growth']
      };
    }

    if (url.includes('report') || url.includes('research')) {
      return {
        title: 'Industry Report: EdTech Market Trends 2024',
        marketSize: 89.7e9, // $89.7B
        growthRate: 12.4,
        keyTrends: [
          'Personalized Learning',
          'AI Integration',
          'Remote Education'
        ],
        competitorAnalysis: {
          topPlayers: ['Google', 'Microsoft', 'Coursera'],
          marketShare: [25, 20, 15]
        }
      };
    }

    if (url.includes('government') || url.includes('.gov')) {
      return {
        source: 'Department of Education',
        statistics: {
          studentEnrollment: 76.8e6,
          educationSpending: 735e9,
          technologyAdoption: 68
        },
        regulations: [
          'COPPA Compliance Required',
          'Student Privacy Protection'
        ]
      };
    }

    if (url.includes('social') || url.includes('twitter') || url.includes('linkedin')) {
      return {
        platform: 'Social Media',
        mentions: Math.floor(Math.random() * 10000),
        sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
        trendingTopics: ['#EdTech', '#AI', '#Learning'],
        engagement: Math.floor(Math.random() * 5000)
      };
    }

    // Default fallback data
    return {
      url: request.url,
      dataType: request.dataType,
      scrapedAt: new Date(),
      content: 'Mock scraped content for testing purposes'
    };
  }

  /**
   * Validate scraped data quality
   */
  private validateData(data: any, rules: ValidationRule[]): number {
    if (!data || typeof data !== 'object') {
      return 20; // Low quality for non-object data
    }

    let qualityScore = 100;
    let totalRules = Math.max(rules.length, 1);

    for (const rule of rules) {
      const fieldValue = data[rule.field];
      let rulePass = false;

      switch (rule.type) {
        case 'required':
          rulePass = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
          break;
        case 'numeric':
          rulePass = typeof fieldValue === 'number' && !isNaN(fieldValue);
          if (rulePass && rule.min !== undefined) rulePass = fieldValue >= rule.min;
          if (rulePass && rule.max !== undefined) rulePass = fieldValue <= rule.max;
          break;
        case 'date':
          rulePass = fieldValue instanceof Date || !isNaN(Date.parse(fieldValue));
          break;
        case 'url':
          try {
            new URL(fieldValue);
            rulePass = true;
          } catch {
            rulePass = false;
          }
          break;
      }

      if (!rulePass) {
        qualityScore -= (100 / totalRules);
      }
    }

    // Additional quality checks
    const dataKeys = Object.keys(data);
    if (dataKeys.length === 0) qualityScore -= 50; // Empty data
    if (dataKeys.length < 3) qualityScore -= 20;   // Limited data

    // Check for common data quality indicators
    if (data.title && data.title.length > 10) qualityScore += 5;
    if (data.content && data.content.length > 100) qualityScore += 5;
    if (data.publishDate || data.createdAt || data.timestamp) qualityScore += 5;

    return Math.max(0, Math.min(100, Math.round(qualityScore)));
  }

  /**
   * Cache management
   */
  private getFromCache(url: string): { data: any; timestamp: Date } | null {
    const cached = this.dataCache.get(url);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.config.cacheTtlMs) {
      this.dataCache.delete(url);
      return null;
    }

    return cached;
  }

  private addToCache(url: string, data: any): void {
    this.dataCache.set(url, {
      data,
      timestamp: new Date()
    });

    // Simple cache cleanup - remove oldest entries if cache gets too large
    if (this.dataCache.size > 1000) {
      const oldestKey = this.dataCache.keys().next().value;
      this.dataCache.delete(oldestKey);
    }
  }

  /**
   * Get configured data sources for different types of market research
   */
  static getDefaultDataSources(): { [category: string]: ScrapingRequest[] } {
    return {
      'news': [
        {
          url: 'https://example.com/tech-news/market-analysis',
          dataType: 'json',
          source: {
            name: 'Tech News Market Analysis',
            type: 'news',
            credibility: 80,
            recency: new Date(),
            accessDate: new Date()
          }
        }
      ],
      'reports': [
        {
          url: 'https://example.com/research/industry-reports',
          dataType: 'json',
          source: {
            name: 'Industry Research Reports',
            type: 'industry-report',
            credibility: 90,
            recency: new Date(),
            accessDate: new Date()
          },
          validationRules: [
            { field: 'marketSize', type: 'numeric', min: 0 },
            { field: 'growthRate', type: 'numeric', min: -100, max: 1000 }
          ]
        }
      ],
      'government': [
        {
          url: 'https://example.gov/education/statistics',
          dataType: 'json',
          source: {
            name: 'Government Education Statistics',
            type: 'government-data',
            credibility: 95,
            recency: new Date(),
            accessDate: new Date()
          }
        }
      ],
      'social': [
        {
          url: 'https://example.com/social-media/trends',
          dataType: 'json',
          source: {
            name: 'Social Media Trends',
            type: 'web-scraping',
            credibility: 70,
            recency: new Date(),
            accessDate: new Date()
          }
        }
      ]
    };
  }

  /**
   * Health check for the scraper
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check cache size
    if (this.dataCache.size > 500) {
      issues.push('Cache size is large, may impact performance');
    }

    // Check active requests
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      issues.push('Maximum concurrent requests reached');
    }

    // Check robots cache age
    const now = Date.now();
    const staleRobots = Object.values(this.robotsCache).filter(
      cache => now - cache.lastChecked.getTime() > 86400000
    ).length;
    
    if (staleRobots > 10) {
      issues.push('Many stale robots.txt cache entries');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.requestQueue = [];
    this.dataCache.clear();
    this.robotsCache = {};
    this.activeRequests = 0;
  }
}