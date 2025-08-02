"use strict";
/**
 * Mock Anthropic Claude API Service
 * Provides Claude-compatible response formats for development and testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAnthropicService = void 0;
const http_1 = require("http");
const url_1 = require("url");
class MockAnthropicService {
    server = null;
    config;
    requestCount = 0;
    tokenCount = 0;
    lastReset = Date.now();
    constructor(config) {
        this.config = {
            rateLimits: {
                requestsPerMinute: 500,
                tokensPerMinute: 50000
            },
            ...config
        };
    }
    /**
     * Start the mock server
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = (0, http_1.createServer)((req, res) => {
                this.handleRequest(req, res);
            });
            this.server.listen(this.config.port, () => {
                console.log(`Mock Anthropic service started on port ${this.config.port}`);
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    /**
     * Stop the mock server
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Mock Anthropic service stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Handle incoming HTTP requests
     */
    handleRequest(req, res) {
        const { pathname } = (0, url_1.parse)(req.url || '', true);
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        // Skip auth validation for health endpoint
        if (pathname === '/health') {
            this.handleHealth(res);
            return;
        }
        // Validate API key for other endpoints
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || !apiKey.startsWith('sk-ant-')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'error',
                error: {
                    type: 'authentication_error',
                    message: 'Invalid API key provided'
                }
            }));
            return;
        }
        // Check rate limits
        this.updateRateLimits();
        if (this.isRateLimited()) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'error',
                error: {
                    type: 'rate_limit_error',
                    message: 'Rate limit exceeded'
                }
            }));
            return;
        }
        // Route requests
        if (pathname === '/v1/messages' && req.method === 'POST') {
            this.handleMessages(req, res);
        }
        else if (pathname === '/health' && req.method === 'GET') {
            this.handleHealth(res);
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'error',
                error: {
                    type: 'not_found_error',
                    message: 'Not found'
                }
            }));
        }
    }
    /**
     * Handle /v1/messages endpoint
     */
    handleMessages(req, res) {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const response = this.generateMockMessage(data);
                // Add rate limit headers
                res.setHeader('anthropic-ratelimit-requests-limit', this.config.rateLimits.requestsPerMinute);
                res.setHeader('anthropic-ratelimit-requests-remaining', Math.max(0, this.config.rateLimits.requestsPerMinute - this.requestCount));
                res.setHeader('anthropic-ratelimit-requests-reset', new Date(this.lastReset + 60000).toISOString());
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
                this.requestCount++;
            }
            catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    type: 'error',
                    error: {
                        type: 'invalid_request_error',
                        message: 'Invalid JSON in request body'
                    }
                }));
            }
        });
    }
    /**
     * Generate mock message response
     */
    generateMockMessage(request) {
        const messages = request.messages || [];
        const lastMessage = messages[messages.length - 1];
        // Generate contextual response based on request
        let mockContent = "This is a mock response from the Anthropic Claude API service.";
        if (lastMessage?.content?.toLowerCase().includes('business idea')) {
            mockContent = "I've analyzed your business idea thoroughly. The concept demonstrates several promising characteristics: strong market alignment, clear value proposition, and scalable business model. Key considerations include competitive landscape analysis, customer acquisition strategy, and regulatory compliance. I recommend conducting targeted market research to validate core assumptions before proceeding with development.";
        }
        else if (lastMessage?.content?.toLowerCase().includes('evaluate')) {
            mockContent = "My evaluation indicates this is a viable business opportunity with moderate to high potential. Strengths: Clear problem-solution fit, addressable market opportunity, defensible business model. Areas requiring attention: Go-to-market strategy, competitive differentiation, financial projections. Overall assessment: Proceed with cautious optimism and structured validation approach.";
        }
        else if (lastMessage?.content?.toLowerCase().includes('market analysis')) {
            mockContent = "Market analysis reveals favorable conditions for this business concept. Total Addressable Market (TAM) appears substantial with growing demand trends. Key market drivers include: digital transformation, changing consumer preferences, regulatory support. Competitive landscape shows room for differentiation. Recommended next steps: primary market research, customer interviews, competitive intelligence gathering.";
        }
        const inputTokens = this.estimateTokens(messages.map((m) => m.content).join(' '));
        const outputTokens = this.estimateTokens(mockContent);
        return {
            id: `msg_mock_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [{
                    type: 'text',
                    text: mockContent
                }],
            model: request.model || 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
                input_tokens: inputTokens,
                output_tokens: outputTokens
            }
        };
    }
    /**
     * Estimate token count (rough approximation)
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * Update rate limit counters
     */
    updateRateLimits() {
        const now = Date.now();
        if (now - this.lastReset >= 60000) {
            this.requestCount = 0;
            this.tokenCount = 0;
            this.lastReset = now;
        }
    }
    /**
     * Handle /health endpoint
     */
    handleHealth(res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            service: 'mock-anthropic',
            timestamp: new Date().toISOString()
        }));
    }
    /**
     * Check if request is rate limited
     */
    isRateLimited() {
        return this.requestCount >= this.config.rateLimits.requestsPerMinute;
    }
}
exports.MockAnthropicService = MockAnthropicService;
//# sourceMappingURL=mock-anthropic-service.js.map