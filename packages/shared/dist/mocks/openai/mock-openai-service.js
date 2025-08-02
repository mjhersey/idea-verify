"use strict";
/**
 * Mock OpenAI API Service
 * Provides realistic response formats for development and testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockOpenAIService = void 0;
const http_1 = require("http");
const url_1 = require("url");
class MockOpenAIService {
    server = null;
    config;
    requestCount = 0;
    tokenCount = 0;
    lastReset = Date.now();
    // Mock models available
    models = [
        {
            id: 'gpt-4o',
            object: 'model',
            created: 1687882411,
            owned_by: 'openai'
        },
        {
            id: 'gpt-4o-mini',
            object: 'model',
            created: 1687882411,
            owned_by: 'openai'
        },
        {
            id: 'gpt-3.5-turbo',
            object: 'model',
            created: 1677610602,
            owned_by: 'openai'
        }
    ];
    constructor(config) {
        this.config = {
            rateLimits: {
                requestsPerMinute: 1000,
                tokensPerMinute: 100000
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
                console.log(`Mock OpenAI service started on port ${this.config.port}`);
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
                    console.log('Mock OpenAI service stopped');
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer sk-')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'Invalid API key provided',
                    type: 'invalid_request_error',
                    code: 'invalid_api_key'
                }
            }));
            return;
        }
        // Check rate limits
        this.updateRateLimits();
        if (this.isRateLimited()) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'Rate limit exceeded',
                    type: 'rate_limit_exceeded',
                    code: 'rate_limit_exceeded'
                }
            }));
            return;
        }
        // Route requests
        if (pathname === '/v1/models' && req.method === 'GET') {
            this.handleModels(res);
        }
        else if (pathname === '/v1/chat/completions' && req.method === 'POST') {
            this.handleChatCompletion(req, res);
        }
        else if (pathname === '/health' && req.method === 'GET') {
            this.handleHealth(res);
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'Not found',
                    type: 'invalid_request_error',
                    code: 'not_found'
                }
            }));
        }
    }
    /**
     * Handle /v1/models endpoint
     */
    handleModels(res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            object: 'list',
            data: this.models
        }));
    }
    /**
     * Handle /v1/chat/completions endpoint
     */
    handleChatCompletion(req, res) {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const response = this.generateMockCompletion(data);
                // Add rate limit headers
                res.setHeader('x-ratelimit-limit-requests', this.config.rateLimits.requestsPerMinute);
                res.setHeader('x-ratelimit-remaining-requests', Math.max(0, this.config.rateLimits.requestsPerMinute - this.requestCount));
                res.setHeader('x-ratelimit-reset-requests', Math.ceil((this.lastReset + 60000) / 1000));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
                this.requestCount++;
            }
            catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: {
                        message: 'Invalid JSON in request body',
                        type: 'invalid_request_error',
                        code: 'invalid_json'
                    }
                }));
            }
        });
    }
    /**
     * Generate mock completion response
     */
    generateMockCompletion(request) {
        const messages = request.messages || [];
        const lastMessage = messages[messages.length - 1];
        // Generate contextual response based on request
        let mockContent = "This is a mock response from the OpenAI API service.";
        if (lastMessage?.content?.toLowerCase().includes('business idea')) {
            mockContent = "Based on my analysis, this business idea shows strong potential in the current market. Key strengths include: clear value proposition, addressable market size, and competitive differentiation. Recommended next steps: validate assumptions through customer interviews and develop a minimum viable product.";
        }
        else if (lastMessage?.content?.toLowerCase().includes('evaluate')) {
            mockContent = "Evaluation complete. Score: 7.5/10. Strengths: Strong market demand, scalable business model. Areas for improvement: Competitive analysis, revenue projections, risk assessment.";
        }
        const promptTokens = this.estimateTokens(messages.map((m) => m.content).join(' '));
        const completionTokens = this.estimateTokens(mockContent);
        return {
            id: `chatcmpl-mock-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: request.model || 'gpt-4o',
            choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: mockContent
                    },
                    logprobs: null,
                    finish_reason: 'stop'
                }],
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens
            },
            system_fingerprint: 'fp_mock_system'
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
            service: 'mock-openai',
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
exports.MockOpenAIService = MockOpenAIService;
//# sourceMappingURL=mock-openai-service.js.map