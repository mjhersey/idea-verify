# AI-Powered Business Idea Validation Platform

A comprehensive platform that uses AI agents to validate business ideas through
market research, competitive analysis, customer research, technical feasibility
assessment, and financial analysis.

## 🏗️ Architecture

This is a monorepo project with a microservices architecture built using:

- **Frontend**: Vue.js 3.4+ with TypeScript, Vite, Pinia, and Tailwind CSS
- **API Gateway**: Express.js with TypeScript for REST API endpoints
- **Orchestrator**: Service for coordinating AI agent executions
- **AI Agents**: Individual microservices for specialized analysis
- **Database**: PostgreSQL 15+ for persistent data storage
- **Cache/Queue**: Redis 7+ for caching and message queues
- **Infrastructure**: AWS CDK for cloud deployment

## 📁 Project Structure

```
ai-validation-platform/
├── packages/
│   ├── web/                 # Vue.js frontend application
│   ├── api/                 # Express.js API Gateway
│   ├── orchestrator/        # Agent orchestration service
│   ├── agents/              # Individual AI agent services
│   │   ├── market-research/
│   │   ├── competitive-analysis/
│   │   ├── customer-research/
│   │   ├── technical-feasibility/
│   │   └── financial-analysis/
│   ├── shared/              # Shared utilities and types
│   └── infrastructure/      # AWS CDK infrastructure code
├── tools/                   # Build tools and scripts
├── docs/                    # Documentation
└── docker-compose.yml      # Local development environment
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ai-validation-platform
   ```

2. **Install dependencies**

   ```bash
   npm run install:all
   ```

3. **Set up environment variables**

   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

4. **Start development services**

   ```bash
   # Start databases and external services
   npm run dev:services

   # Start mock AI services (for offline development)
   npm run dev:mocks

   # Or start everything at once
   npm run dev:all
   ```

5. **Test database connectivity**

   ```bash
   npm run test:db
   ```

6. **Start the applications**

   ```bash
   # Start frontend (Vue.js) - http://localhost:5173
   npm run dev:web

   # Start API server (Express.js) - http://localhost:3000
   npm run dev:api

   # Start orchestrator service
   npm run dev:orchestrator
   ```

## 🛠️ Development

### Available Scripts

**Root Level Scripts:**

- `npm run install:all` - Install dependencies for all packages
- `npm run build` - Build all packages
- `npm run test` - Run tests for all packages
- `npm run lint` - Lint all packages
- `npm run clean` - Clean build artifacts

**Development Scripts:**

- `npm run dev:web` - Start frontend development server
- `npm run dev:api` - Start API development server
- `npm run dev:orchestrator` - Start orchestrator development server

**Docker Services:**

- `npm run dev:services` - Start PostgreSQL, Redis, and LocalStack
- `npm run dev:mocks` - Start mock AI services
- `npm run dev:all` - Start all Docker services
- `npm run dev:down` - Stop all Docker services
- `npm run dev:logs` - View Docker service logs

**Testing & Validation:**

- `npm run test:db` - Test database connectivity
- `npm run test:offline` - Test offline development mode
- `npm run test:integration` - Run integration tests

### Package Development

Each package has its own development scripts:

```bash
# Frontend (Vue.js)
cd packages/web
npm run dev          # Start dev server
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
npm run build        # Build for production

# API (Express.js)
cd packages/api
npm run dev          # Start with hot reload
npm run test         # Run API tests
npm run build        # Build for production

# Shared utilities
cd packages/shared
npm run test         # Run utility tests
npm run build        # Build shared package
```

## 🐳 Docker Services

The development environment includes:

- **PostgreSQL** (port 5432): Primary database
- **Redis** (port 6379): Caching and message queues
- **LocalStack** (port 4566): AWS services mock
- **Mock OpenAI** (port 3001): OpenAI API mock
- **Mock Anthropic** (port 3002): Anthropic API mock

### Database Schema

Initial development schema includes:

- `users` - User accounts (placeholder)
- `business_evaluations` - Business idea evaluation records
- `agent_executions` - AI agent execution tracking

## 🧪 Testing

The project uses a comprehensive testing strategy:

- **Unit Tests** (70%): Vitest for all packages
- **Integration Tests** (20%): API and database integration
- **E2E Tests** (10%): Cypress for critical user journeys

Run tests:

```bash
npm test                    # All tests
npm run test:offline        # Offline mode tests
npm run test:integration    # Integration tests
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Database
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform

# Redis
REDIS_URL=redis://localhost:6379

# Frontend
VITE_API_BASE_URL=http://localhost:3000

# Development
USE_MOCK_SERVICES=true
```

### Offline Development

The platform supports complete offline development using mock services:

1. All AI services have realistic mock implementations
2. LocalStack provides AWS service mocking
3. Development database with sample data
4. No external API dependencies required

## 📦 Package Dependencies

### Frontend (`packages/web`)

- Vue.js 3.4+, Vite 5.0+, TypeScript 5.0+
- Pinia 2.1+, Vue Router 4.2+
- Tailwind CSS 3.4+, Headless UI
- Vitest, Cypress, Chart.js

### API (`packages/api`)

- Express.js 4.18+, TypeScript 5.0+
- Security middleware (helmet, cors, rate limiting)
- Vitest, Supertest

### Shared (`packages/shared`)

- AWS SDK, credential management
- Rate limiting, quota monitoring
- Mock service implementations
- TypeScript utilities

## 🚢 Deployment

Infrastructure as Code using AWS CDK:

```bash
cd packages/infrastructure
npm run build
npm run deploy
```

Target AWS services:

- ECS for containerized services
- RDS PostgreSQL for database
- ElastiCache Redis for caching
- API Gateway for external access
- CloudWatch for monitoring

## 🔐 Security

- Credentials managed via AWS Secrets Manager
- No hardcoded secrets in codebase
- Rate limiting and request validation
- CORS and security headers configured
- Environment-based configuration

## 📚 Documentation

- `/docs` - Architecture and design documents
- Package README files for specific components
- API documentation via OpenAPI/Swagger (future)
- Inline code documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Development Standards

- TypeScript strict mode enabled
- ESLint and Prettier configured
- Comprehensive test coverage (>90% for business logic)
- Semantic commit messages
- Code review required for all changes

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check documentation in `/docs`
- Review troubleshooting guide
- Open GitHub issues for bugs
- Contact development team for questions

---

**Development Status**: Active development **Last Updated**: January 2025
**Node.js**: 18+ required **Platform**: Cross-platform (Windows, macOS, Linux)
