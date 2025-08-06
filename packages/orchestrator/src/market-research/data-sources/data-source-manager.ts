/**
 * Data Source Manager
 * Coordinates access to multiple data sources with fallback strategies and data quality scoring
 */

import { WebScraper, ScrapingRequest, ScrapingResult } from './web-scraper.js'
import { DataSource, MarketSizingRequest } from '../schemas/market-research-types.js'

export interface DataSourceStrategy {
  primary: string[] // Primary data sources to try first
  fallback: string[] // Fallback sources if primary fails
  timeout: number // Maximum time to spend on data collection
  minQuality: number // Minimum data quality threshold (0-100)
}

export interface DataCollectionResult {
  source: string
  data: any
  quality: number
  timestamp: Date
  processingTime: number
}

export interface DataSourceConfig {
  enableWebScraping: boolean
  enableAPIAccess: boolean
  enableCaching: boolean
  maxConcurrentSources: number
  dataFreshnessHours: number
  strategies: {
    news: DataSourceStrategy
    reports: DataSourceStrategy
    government: DataSourceStrategy
    social: DataSourceStrategy
    financial: DataSourceStrategy
  }
}

export class DataSourceManager {
  private webScraper: WebScraper
  private config: DataSourceConfig
  private dataCache: Map<string, DataCollectionResult> = new Map()

  constructor(config: Partial<DataSourceConfig> = {}) {
    this.config = {
      enableWebScraping: true,
      enableAPIAccess: false, // Disabled by default for demo
      enableCaching: true,
      maxConcurrentSources: 5,
      dataFreshnessHours: 6,
      strategies: {
        news: {
          primary: ['reuters', 'bloomberg', 'techcrunch'],
          fallback: ['general-news', 'industry-blogs'],
          timeout: 30000,
          minQuality: 70,
        },
        reports: {
          primary: ['gartner', 'forrester', 'mckinsey'],
          fallback: ['industry-associations', 'government-reports'],
          timeout: 45000,
          minQuality: 80,
        },
        government: {
          primary: ['census', 'bls', 'education-dept'],
          fallback: ['state-agencies', 'international-orgs'],
          timeout: 60000,
          minQuality: 85,
        },
        social: {
          primary: ['twitter-api', 'linkedin-api'],
          fallback: ['social-scraping', 'trend-aggregators'],
          timeout: 20000,
          minQuality: 60,
        },
        financial: {
          primary: ['sec-filings', 'yahoo-finance'],
          fallback: ['financial-news', 'analyst-reports'],
          timeout: 30000,
          minQuality: 75,
        },
      },
      ...config,
    }

    this.webScraper = new WebScraper({
      respectRobotsTxt: true,
      rateLimitMs: 2000,
      maxConcurrentRequests: this.config.maxConcurrentSources,
      enableCaching: this.config.enableCaching,
    })
  }

  /**
   * Collect comprehensive market data for a business idea
   */
  async collectMarketData(request: MarketSizingRequest): Promise<{
    news: DataCollectionResult[]
    reports: DataCollectionResult[]
    government: DataCollectionResult[]
    social: DataCollectionResult[]
    financial: DataCollectionResult[]
    metadata: {
      totalSources: number
      successfulSources: number
      averageQuality: number
      processingTime: number
    }
  }> {
    const startTime = Date.now()
    const results = {
      news: [] as DataCollectionResult[],
      reports: [] as DataCollectionResult[],
      government: [] as DataCollectionResult[],
      social: [] as DataCollectionResult[],
      financial: [] as DataCollectionResult[],
    }

    // Collect data from different source types in parallel
    const collectionPromises = [
      this.collectFromSourceType('news', request),
      this.collectFromSourceType('reports', request),
      this.collectFromSourceType('government', request),
      this.collectFromSourceType('social', request),
      this.collectFromSourceType('financial', request),
    ]

    const collectionResults = await Promise.allSettled(collectionPromises)

    // Process results
    const sourceTypes = ['news', 'reports', 'government', 'social', 'financial'] as const
    collectionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[sourceTypes[index]] = result.value
      }
    })

    // Calculate metadata
    const allResults = Object.values(results).flat()
    const totalSources = allResults.length
    const successfulSources = allResults.filter(r => r.quality > 0).length
    const averageQuality =
      totalSources > 0 ? allResults.reduce((sum, r) => sum + r.quality, 0) / totalSources : 0

    return {
      ...results,
      metadata: {
        totalSources,
        successfulSources,
        averageQuality: Math.round(averageQuality),
        processingTime: Date.now() - startTime,
      },
    }
  }

  /**
   * Collect data from a specific source type
   */
  private async collectFromSourceType(
    sourceType: keyof DataSourceConfig['strategies'],
    request: MarketSizingRequest
  ): Promise<DataCollectionResult[]> {
    const strategy = this.config.strategies[sourceType]
    const results: DataCollectionResult[] = []

    try {
      // Try primary sources first
      const primaryResults = await this.collectFromSources(
        strategy.primary,
        sourceType,
        request,
        strategy.timeout / 2
      )

      results.push(...primaryResults.filter(r => r.quality >= strategy.minQuality))

      // If we don't have enough quality data, try fallback sources
      if (results.length === 0 || results.every(r => r.quality < strategy.minQuality + 10)) {
        const fallbackResults = await this.collectFromSources(
          strategy.fallback,
          sourceType,
          request,
          strategy.timeout / 2
        )

        results.push(...fallbackResults.filter(r => r.quality >= strategy.minQuality - 10))
      }
    } catch (error) {
      console.warn(`Error collecting from ${sourceType} sources:`, error)
    }

    return results.sort((a, b) => b.quality - a.quality).slice(0, 3) // Return top 3 results
  }

  /**
   * Collect data from specific sources
   */
  private async collectFromSources(
    sources: string[],
    sourceType: string,
    request: MarketSizingRequest,
    timeout: number
  ): Promise<DataCollectionResult[]> {
    const scrapingRequests = sources.map(source =>
      this.createScrapingRequest(source, sourceType, request)
    )

    const timeoutPromise = new Promise<ScrapingResult[]>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )

    try {
      const scrapingResults = await Promise.race([
        this.webScraper.scrapeMultiple(scrapingRequests),
        timeoutPromise,
      ])

      return scrapingResults
        .filter(result => result.success)
        .map(result => ({
          source: result.metadata.source.name,
          data: result.data,
          quality: result.metadata.dataQuality,
          timestamp: result.metadata.timestamp,
          processingTime: result.metadata.responseTime,
        }))
    } catch (error) {
      console.warn(`Timeout or error collecting from sources: ${sources.join(', ')}`)
      return []
    }
  }

  /**
   * Create a scraping request for a specific source
   */
  private createScrapingRequest(
    source: string,
    sourceType: string,
    request: MarketSizingRequest
  ): ScrapingRequest {
    const category = request.businessIdea.category || 'technology'
    const title = encodeURIComponent(request.businessIdea.title)

    // Mock URLs - in production, these would be real endpoints
    const mockUrls: { [key: string]: string } = {
      // News sources
      reuters: `https://reuters.com/markets/${category}/analysis`,
      bloomberg: `https://bloomberg.com/news/search?query=${title}`,
      techcrunch: `https://techcrunch.com/search/${category}`,
      'general-news': `https://example-news.com/business/${category}`,
      'industry-blogs': `https://industry-insights.com/${category}/trends`,

      // Research reports
      gartner: `https://gartner.com/research/${category}-market-analysis`,
      forrester: `https://forrester.com/reports/${category}/2024`,
      mckinsey: `https://mckinsey.com/industries/${category}/insights`,
      'industry-associations': `https://industry-association.org/${category}/reports`,
      'government-reports': `https://commerce.gov/data/${category}-statistics`,

      // Government sources
      census: `https://census.gov/data/tables/${category}.html`,
      bls: `https://bls.gov/oes/current/industry-${category}.htm`,
      'education-dept': `https://ed.gov/about/offices/list/opepd/education-statistics`,
      'state-agencies': `https://state-gov.example.com/business/${category}`,
      'international-orgs': `https://oecd.org/education/${category}-data`,

      // Social media
      'twitter-api': `https://api.twitter.com/2/tweets/search/recent?query=${title}`,
      'linkedin-api': `https://api.linkedin.com/v2/shares?q=${category}`,
      'social-scraping': `https://social-trends.com/search/${category}`,
      'trend-aggregators': `https://trend-data.com/topics/${category}`,

      // Financial
      'sec-filings': `https://sec.gov/edgar/search?category=${category}`,
      'yahoo-finance': `https://finance.yahoo.com/sector/${category}`,
      'financial-news': `https://financial-times.com/markets/${category}`,
      'analyst-reports': `https://analyst-research.com/${category}/forecasts`,
    }

    const url = mockUrls[source] || `https://example.com/${sourceType}/${source}`

    return {
      url,
      dataType: 'json',
      source: {
        name: `${source} (${sourceType})`,
        type: this.mapSourceTypeToDataSourceType(sourceType),
        credibility: this.getSourceCredibility(source),
        recency: new Date(),
        accessDate: new Date(),
        url,
      },
      validationRules: this.getValidationRules(sourceType),
    }
  }

  /**
   * Map internal source types to DataSource types
   */
  private mapSourceTypeToDataSourceType(sourceType: string): DataSource['type'] {
    const mapping: { [key: string]: DataSource['type'] } = {
      news: 'news',
      reports: 'industry-report',
      government: 'government-data',
      social: 'web-scraping',
      financial: 'research-firm',
    }
    return mapping[sourceType] || 'web-scraping'
  }

  /**
   * Get credibility score for a source
   */
  private getSourceCredibility(source: string): number {
    const credibilityMap: { [key: string]: number } = {
      // High credibility
      gartner: 95,
      forrester: 95,
      mckinsey: 95,
      census: 98,
      bls: 96,
      'education-dept': 94,
      'sec-filings': 97,
      reuters: 90,
      bloomberg: 90,

      // Medium credibility
      techcrunch: 80,
      'yahoo-finance': 75,
      'industry-associations': 85,
      'government-reports': 90,
      'analyst-reports': 80,
      'financial-news': 82,

      // Lower credibility
      'general-news': 70,
      'industry-blogs': 65,
      'social-scraping': 60,
      'trend-aggregators': 68,
      'state-agencies': 78,
      'international-orgs': 85,
    }

    return credibilityMap[source] || 70
  }

  /**
   * Get validation rules for different source types
   */
  private getValidationRules(sourceType: string) {
    const rules: { [key: string]: any[] } = {
      reports: [
        { field: 'marketSize', type: 'numeric', min: 0 },
        { field: 'growthRate', type: 'numeric', min: -50, max: 500 },
      ],
      government: [
        { field: 'statistics', type: 'required' },
        { field: 'source', type: 'required' },
      ],
      financial: [
        { field: 'revenue', type: 'numeric', min: 0 },
        { field: 'marketCap', type: 'numeric', min: 0 },
      ],
      news: [
        { field: 'title', type: 'required' },
        { field: 'publishDate', type: 'date' },
      ],
      social: [
        { field: 'mentions', type: 'numeric', min: 0 },
        { field: 'sentiment', type: 'required' },
      ],
    }

    return rules[sourceType] || []
  }

  /**
   * Get aggregated data quality score across all sources
   */
  getOverallDataQuality(): number {
    const allResults = Array.from(this.dataCache.values())
    if (allResults.length === 0) return 0

    const totalQuality = allResults.reduce((sum, result) => sum + result.quality, 0)
    return Math.round(totalQuality / allResults.length)
  }

  /**
   * Get data freshness score
   */
  getDataFreshness(): number {
    const allResults = Array.from(this.dataCache.values())
    if (allResults.length === 0) return 0

    const now = Date.now()
    const freshnessScores = allResults.map(result => {
      const ageHours = (now - result.timestamp.getTime()) / (1000 * 60 * 60)
      const maxAge = this.config.dataFreshnessHours
      return Math.max(0, 100 - (ageHours / maxAge) * 100)
    })

    return Math.round(
      freshnessScores.reduce((sum, score) => sum + score, 0) / freshnessScores.length
    )
  }

  /**
   * Health check for the data source manager
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []

    // Check web scraper health
    const scraperHealth = await this.webScraper.healthCheck()
    if (!scraperHealth.healthy) {
      issues.push(...scraperHealth.issues.map(issue => `WebScraper: ${issue}`))
    }

    // Check cache size
    if (this.dataCache.size > 1000) {
      issues.push('Data cache is very large, may impact performance')
    }

    // Check data freshness
    const freshness = this.getDataFreshness()
    if (freshness < 50) {
      issues.push('Data freshness is below acceptable threshold')
    }

    // Check data quality
    const quality = this.getOverallDataQuality()
    if (quality < 60) {
      issues.push('Overall data quality is below acceptable threshold')
    }

    return {
      healthy: issues.length === 0,
      issues,
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.webScraper.cleanup()
    this.dataCache.clear()
  }
}
