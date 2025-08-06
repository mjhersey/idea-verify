/**
 * Mock OpenAI API Service
 * Provides realistic response formats for development and testing
 */

import { createServer, Server } from 'http'
import { parse } from 'url'

export interface MockOpenAIConfig {
  port: number
  baseUrl?: string
  rateLimits?: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}

export interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface OpenAICompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    logprobs: null
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  system_fingerprint: string
}

export class MockOpenAIService {
  private server: Server | null = null
  private config: MockOpenAIConfig
  private requestCount = 0
  private tokenCount = 0
  private lastReset = Date.now()

  // Mock models available
  private models: OpenAIModel[] = [
    {
      id: 'gpt-4o',
      object: 'model',
      created: 1687882411,
      owned_by: 'openai',
    },
    {
      id: 'gpt-4o-mini',
      object: 'model',
      created: 1687882411,
      owned_by: 'openai',
    },
    {
      id: 'gpt-3.5-turbo',
      object: 'model',
      created: 1677610602,
      owned_by: 'openai',
    },
  ]

  constructor(config: MockOpenAIConfig) {
    this.config = {
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 100000,
      },
      ...config,
    }
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res)
      })

      this.server.listen(this.config.port, () => {
        console.log(`Mock OpenAI service started on port ${this.config.port}`)
        resolve()
      })

      this.server.on('error', reject)
    })
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock OpenAI service stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: any, res: any): void {
    const { pathname } = parse(req.url || '', true)

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // Skip auth validation for health endpoint
    if (pathname === '/health') {
      this.handleHealth(res)
      return
    }

    // Validate API key for other endpoints
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer sk-')) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: {
            message: 'Invalid API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        })
      )
      return
    }

    // Check rate limits
    this.updateRateLimits()
    if (this.isRateLimited()) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
            code: 'rate_limit_exceeded',
          },
        })
      )
      return
    }

    // Route requests
    if (pathname === '/v1/models' && req.method === 'GET') {
      this.handleModels(res)
    } else if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      this.handleChatCompletion(req, res)
    } else if (pathname === '/health' && req.method === 'GET') {
      this.handleHealth(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: {
            message: 'Not found',
            type: 'invalid_request_error',
            code: 'not_found',
          },
        })
      )
    }
  }

  /**
   * Handle /v1/models endpoint
   */
  private handleModels(res: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        object: 'list',
        data: this.models,
      })
    )
  }

  /**
   * Handle /v1/chat/completions endpoint
   */
  private handleChatCompletion(req: any, res: any): void {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const response = this.generateMockCompletion(data)

        // Add rate limit headers
        res.setHeader('x-ratelimit-limit-requests', this.config.rateLimits!.requestsPerMinute)
        res.setHeader(
          'x-ratelimit-remaining-requests',
          Math.max(0, this.config.rateLimits!.requestsPerMinute - this.requestCount)
        )
        res.setHeader('x-ratelimit-reset-requests', Math.ceil((this.lastReset + 60000) / 1000))

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))

        this.requestCount++
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: {
              message: 'Invalid JSON in request body',
              type: 'invalid_request_error',
              code: 'invalid_json',
            },
          })
        )
      }
    })
  }

  /**
   * Generate mock completion response with diverse patterns
   */
  private generateMockCompletion(request: any): OpenAICompletionResponse {
    const messages = request.messages || []
    const lastMessage = messages[messages.length - 1]
    const content = lastMessage?.content?.toLowerCase() || ''

    // Generate contextual response based on business idea type and request
    let mockContent = this.generateContextualResponse(content)

    const promptTokens = this.estimateTokens(messages.map((m: any) => m.content).join(' '))
    const completionTokens = this.estimateTokens(mockContent)

    return {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model || 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: mockContent,
          },
          logprobs: null,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      system_fingerprint: 'fp_mock_system',
    }
  }

  /**
   * Generate contextual responses based on business idea types
   */
  private generateContextualResponse(content: string): string {
    // SaaS/Software business ideas
    if (
      content.includes('saas') ||
      content.includes('software') ||
      content.includes('app') ||
      content.includes('platform')
    ) {
      return this.generateSaaSResponse(content)
    }

    // E-commerce business ideas
    if (
      content.includes('ecommerce') ||
      content.includes('e-commerce') ||
      content.includes('marketplace') ||
      content.includes('store') ||
      content.includes('retail')
    ) {
      return this.generateEcommerceResponse(content)
    }

    // Service business ideas
    if (
      content.includes('service') ||
      content.includes('consulting') ||
      content.includes('agency') ||
      content.includes('freelance')
    ) {
      return this.generateServiceResponse(content)
    }

    // Physical product ideas
    if (
      content.includes('product') ||
      content.includes('manufacturing') ||
      content.includes('invention') ||
      content.includes('gadget')
    ) {
      return this.generateProductResponse(content)
    }

    // Food & Restaurant ideas
    if (
      content.includes('restaurant') ||
      content.includes('food') ||
      content.includes('cafe') ||
      content.includes('catering')
    ) {
      return this.generateFoodResponse(content)
    }

    // Generic business evaluation
    if (
      content.includes('evaluate') ||
      content.includes('analysis') ||
      content.includes('assess')
    ) {
      return this.generateEvaluationResponse()
    }

    // Default response for general business ideas
    return this.generateGeneralBusinessResponse()
  }

  private generateSaaSResponse(content: string): string {
    const responses = [
      'SaaS Analysis: This software solution addresses a clear market need with strong recurring revenue potential. Key considerations: Customer acquisition cost, churn rate, and scalability. Recommended MVP approach: Focus on core features, implement robust user authentication, and establish pricing tiers. Market validation through beta testing is crucial.',
      'Software Platform Evaluation: Strong technical feasibility with growing market demand. Key strengths: Subscription model, low marginal costs, global reach. Challenges: Competitive landscape, customer retention, technical support. Next steps: Validate target audience, develop prototype, establish go-to-market strategy.',
      'App Development Assessment: Mobile-first approach shows promise in current market. Consider cross-platform development, user experience optimization, and app store visibility. Revenue models: Freemium, subscription, or in-app purchases. Focus on user engagement metrics and retention strategies.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateEcommerceResponse(content: string): string {
    const responses = [
      'E-commerce Opportunity: Market analysis shows strong demand in this sector. Key factors: Supply chain management, customer acquisition, inventory optimization. Consider starting with niche market before scaling. Essential elements: User-friendly website, payment processing, logistics partners, customer service excellence.',
      'Marketplace Assessment: Strong potential for platform-based business model. Revenue streams: Commission fees, subscription plans, premium listings. Critical success factors: Two-sided market growth, trust mechanisms, quality control. Focus on solving specific pain points for both buyers and sellers.',
      'Retail Business Evaluation: Solid foundation with clear value proposition. Consider omnichannel approach combining online and offline presence. Key metrics: Customer lifetime value, conversion rates, average order value. Invest in brand building and customer experience differentiation.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateServiceResponse(content: string): string {
    const responses = [
      'Service Business Analysis: High-margin opportunity with scalable potential. Strengths: Low startup costs, flexible operations, direct client relationships. Key considerations: Service standardization, quality control, team scaling. Focus on building strong reputation and referral systems.',
      'Consulting Opportunity: Expertise-based model with strong earning potential. Critical factors: Market positioning, thought leadership, client acquisition. Develop proprietary methodologies and case studies. Consider productizing services through courses or software tools.',
      'Agency Model Assessment: Strong demand for specialized services. Revenue optimization through retainer models and long-term contracts. Key challenges: Talent acquisition, client retention, service delivery consistency. Build scalable processes and systems early.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateProductResponse(content: string): string {
    const responses = [
      'Physical Product Assessment: Manufacturing business with tangible value proposition. Key considerations: Production costs, supply chain complexity, inventory management. Market entry strategy: Consider direct-to-consumer before retail partnerships. Focus on product-market fit and quality control.',
      'Product Innovation Analysis: Strong potential for market disruption. Critical factors: Patent protection, manufacturing partnerships, distribution channels. Validate demand through pre-orders or crowdfunding. Develop comprehensive business plan including regulatory compliance.',
      'Manufacturing Opportunity: Product shows promise in target market. Key challenges: Capital requirements, quality assurance, scaling production. Consider lean manufacturing principles and just-in-time inventory. Build strong supplier relationships and quality control systems.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateFoodResponse(content: string): string {
    const responses = [
      'Food Service Analysis: Restaurant industry opportunity with local market focus. Key factors: Location analysis, menu optimization, cost control. Critical success elements: Customer experience, food quality consistency, efficient operations. Consider starting with limited menu and expanding based on customer feedback.',
      'Food Business Assessment: Strong potential in growing food service market. Considerations: Health regulations, supply chain management, seasonal variations. Revenue optimization through catering services and delivery partnerships. Focus on brand building and customer loyalty programs.',
      'Culinary Venture Evaluation: Market shows demand for innovative food concepts. Key strategies: Unique value proposition, efficient kitchen operations, staff training. Consider multiple revenue streams: dine-in, takeout, catering, retail products. Build strong local community presence.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateEvaluationResponse(): string {
    const scores = [6.5, 7.0, 7.5, 8.0, 8.5]
    const score = scores[Math.floor(Math.random() * scores.length)]

    const evaluations = [
      `Business Idea Evaluation: Overall Score: ${score}/10. Strengths: Clear market opportunity, feasible execution plan, strong value proposition. Areas for improvement: Competitive analysis, financial projections, risk mitigation strategies. Recommended next steps: Market validation, customer interviews, prototype development.`,
      `Comprehensive Assessment: Score: ${score}/10. Positive indicators: Growing market demand, differentiated offering, experienced team potential. Development areas: Revenue model optimization, customer acquisition strategy, scalability planning. Priority actions: Validate assumptions, build MVP, establish partnerships.`,
      `Business Viability Analysis: Rating: ${score}/10. Key strengths: Solving real problem, addressable market size, sustainable competitive advantage. Enhancement opportunities: Marketing strategy, operational efficiency, technology integration. Next phase: Customer discovery, financial modeling, go-to-market planning.`,
    ]
    return evaluations[Math.floor(Math.random() * evaluations.length)]
  }

  private generateGeneralBusinessResponse(): string {
    const responses = [
      'Based on my analysis, this business idea shows strong potential in the current market. Key strengths include: clear value proposition, addressable market size, and competitive differentiation. Recommended next steps: validate assumptions through customer interviews and develop a minimum viable product.',
      'Business concept evaluation reveals promising opportunities with several growth vectors. Primary advantages: market timing, scalable model, customer pain point resolution. Strategic priorities: market research, financial planning, team building. Consider starting with focused market segment.',
      'Initial assessment indicates viable business opportunity with solid fundamentals. Core strengths: market demand validation, feasible business model, clear target audience. Development focus: competitive positioning, revenue optimization, operational excellence. Build strong foundation before scaling.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Update rate limit counters
   */
  private updateRateLimits(): void {
    const now = Date.now()
    if (now - this.lastReset >= 60000) {
      this.requestCount = 0
      this.tokenCount = 0
      this.lastReset = now
    }
  }

  /**
   * Handle /health endpoint
   */
  private handleHealth(res: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'mock-openai',
        timestamp: new Date().toISOString(),
      })
    )
  }

  /**
   * Check if request is rate limited
   */
  private isRateLimited(): boolean {
    return this.requestCount >= this.config.rateLimits!.requestsPerMinute
  }
}
