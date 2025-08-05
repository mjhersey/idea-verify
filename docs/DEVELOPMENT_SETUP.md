# Development Setup Guide

This guide provides comprehensive instructions for setting up and running the
AI-Powered Business Idea Validation Platform in development mode.

## 🚀 Quick Start (TL;DR)

```bash
# 1. Install dependencies
npm run install:all

# 2. Start infrastructure services (Docker)
npm run dev:services

# 3. Start mock AI services (Docker)
npm run dev:mocks

# 4. Start application services (Command Line)
npm run dev:web      # Frontend - http://localhost:5173
npm run dev:api      # API Gateway - http://localhost:3000
npm run dev:orchestrator  # Orchestrator service
```

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and **npm 9+**
- **Docker** and **Docker Compose**
- **Git**
- At least **4GB RAM** available for Docker services

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be 18.0.0 or higher

# Check npm version
npm --version   # Should be 9.0.0 or higher

# Check Docker
docker --version
docker-compose --version

# Check available memory
docker system info | grep "Total Memory"
```

## 🏗️ Project Architecture Overview

The platform consists of:

### Docker Services (Infrastructure)

- **PostgreSQL** (port 5432) - Primary database
- **Redis** (port 6379) - Caching and message queues
- **LocalStack** (port 4566) - AWS services mock
- **Mock OpenAI** (port 3001) - OpenAI API mock
- **Mock Anthropic** (port 3002) - Anthropic API mock

### Node.js Services (Applications)

- **Web Frontend** (port 5173) - Vue.js application
- **API Gateway** (port 3000) - Express.js REST API
- **Orchestrator** (port varies) - AI agent coordination

## 📦 Step-by-Step Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd idea-verify

# Install all dependencies (root + all packages)
npm run install:all
```

**What this does:**

- Installs root package dependencies
- Installs dependencies for all packages in the monorepo
- Sets up workspace links between packages

### Step 2: Environment Configuration

The project works out-of-the-box with default development settings, but you can
customize if needed:

```bash
# Copy environment template (if it exists)
cp .env.template .env  # Optional - defaults work for development

# Or create a custom .env file
cat > .env << EOF
# Database (Docker service)
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform

# Redis (Docker service)
REDIS_URL=redis://localhost:6379

# Frontend configuration
VITE_API_BASE_URL=http://localhost:3000

# Development mode - use mock services
USE_MOCK_SERVICES=true
NODE_ENV=development
EOF
```

### Step 3: Start Infrastructure Services (Docker)

```bash
# Start core infrastructure services
npm run dev:services

# Verify services are running
docker-compose ps

# Check service health
docker-compose logs postgres
docker-compose logs redis
docker-compose logs localstack
```

**Services started:**

- PostgreSQL database (with dev schema)
- Redis cache/queue
- LocalStack (AWS mocking)

**Expected output:**

```
NAME                          COMMAND                  SERVICE             STATUS              PORTS
ai-validation-postgres        "docker-entrypoint.s…"   postgres            running             0.0.0.0:5432->5432/tcp
ai-validation-redis           "docker-entrypoint.s…"   redis              running             0.0.0.0:6379->6379/tcp
ai-validation-localstack      "docker-entrypoint.sh"   localstack         running             0.0.0.0:4566->4566/tcp
```

### Step 4: Start Mock AI Services (Docker)

```bash
# Start mock AI services for offline development
npm run dev:mocks

# Verify AI mocks are running
curl http://localhost:3001/v1/models    # Mock OpenAI
curl http://localhost:3002/health       # Mock Anthropic
```

**Services started:**

- Mock OpenAI API (realistic responses)
- Mock Anthropic API (realistic responses)

### Step 5: Test Database Connectivity

```bash
# Test database connection and schema
npm run test:db
```

**Expected output:**

```
✅ Database connection successful
✅ Tables created: users, business_evaluations, agent_executions
✅ Sample data inserted
```

### Step 6: Start Application Services (Command Line)

Open **3 separate terminals** and run:

#### Terminal 1: Frontend (Vue.js)

```bash
npm run dev:web
```

- Starts Vite dev server
- Available at: http://localhost:5173
- Hot reload enabled
- TypeScript compilation

#### Terminal 2: API Gateway (Express.js)

```bash
npm run dev:api
```

- Starts Express server with hot reload
- Available at: http://localhost:3000
- API endpoints for frontend
- Database connectivity

#### Terminal 3: Orchestrator Service

```bash
npm run dev:orchestrator
```

- Coordinates AI agent executions
- Connects to message queues
- Manages evaluation workflows

## 🔍 Verification & Testing

### Test the Complete Setup

```bash
# Test offline development mode
npm run test:offline

# Run integration tests
npm run test:integration

# Test environment setup
npm run test:env
```

### Manual Verification

1. **Frontend**: Visit http://localhost:5173
   - Should load Vue.js application
   - Check browser console for errors

2. **API**: Test endpoints

   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/api/evaluations
   ```

3. **Database**: Connect and query

   ```bash
   # Using psql (if installed)
   psql postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform

   # Or using Docker
   docker exec -it ai-validation-postgres psql -U dev_user -d ai_validation_platform
   ```

## 🛠️ Development Workflows

### Daily Development

```bash
# Start your day
npm run dev:services  # Start infrastructure
npm run dev:mocks     # Start AI mocks

# In separate terminals
npm run dev:web       # Start frontend
npm run dev:api       # Start API
npm run dev:orchestrator  # Start orchestrator

# End your day
npm run dev:down      # Stop all Docker services
```

### Package-Specific Development

```bash
# Work on frontend only
cd packages/web
npm run dev
npm run test
npm run test:e2e

# Work on API only
cd packages/api
npm run dev
npm run test

# Work on shared utilities
cd packages/shared
npm run test
npm run build
```

### Running Tests

```bash
# All tests
npm test

# Specific test suites
npm run test:integration:api
npm run test:integration:database
npm run test:integration:auth
npm run test:integration:evaluation

# Performance tests
npm run test:integration:performance
```

### Database Operations

```bash
# Reset database
docker-compose down
docker volume rm idea-verify_postgres_data
npm run dev:services

# View database logs
npm run dev:logs postgres

# Backup/restore (future implementation)
# npm run db:backup
# npm run db:restore
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # API
lsof -i :5173  # Frontend

# Kill process
kill -9 <PID>
```

#### 2. Docker Services Won't Start

```bash
# Check Docker daemon
docker info

# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Restart Docker services
npm run dev:down
npm run dev:services
```

#### 3. Database Connection Failed

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify database exists
docker exec -it ai-validation-postgres psql -U dev_user -l

# Reset database
docker-compose down postgres
docker volume rm idea-verify_postgres_data
npm run dev:services
```

#### 4. Frontend Build Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules packages/*/node_modules
npm run install:all

# Clear Vite cache
rm -rf packages/web/.vite
cd packages/web && npm run dev
```

#### 5. Mock Services Not Responding

```bash
# Check mock service logs
docker-compose logs mock-openai
docker-compose logs mock-anthropic

# Restart mock services
docker-compose restart mock-openai mock-anthropic

# Test mock endpoints
curl -v http://localhost:3001/v1/models
curl -v http://localhost:3002/health
```

### Performance Issues

#### High Memory Usage

```bash
# Check Docker memory usage
docker stats

# Limit Docker memory (add to docker-compose.yml)
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

#### Slow Startup

```bash
# Check service health
docker-compose ps
docker-compose logs --tail=50

# Use faster startup (skip health checks)
docker-compose up -d --no-deps
```

### Environment Validation

```bash
# Comprehensive environment check
npm run validate:environment

# Check specific components
npm run validate:accounts
npm run validate:credentials
npm run mock:validate
```

## 📚 Additional Resources

- **Project README**: `README.md` - Overview and quick start
- **API Documentation**: `docs/api-documentation.md`
- **Troubleshooting Guide**: `docs/troubleshooting-runbook.md`
- **Architecture Docs**: `docs/architecture.md`
- **Frontend Architecture**: `docs/frontend-architecture.md`

## 🔧 Development Tools

### Useful Commands

```bash
# Code formatting
npm run format
npm run format:check

# Linting
npm run lint

# Building
npm run build

# Cleaning
npm run clean

# View logs
npm run dev:logs          # All services
npm run dev:logs postgres # Specific service
```

### IDE Configuration

Recommended VS Code extensions:

- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Docker

### Git Hooks

The project includes pre-commit hooks:

- Linting and formatting checks
- Commit message validation
- Test execution (if configured)

---

## ⚡ Quick Reference

| Service        | Port | URL                   | Purpose            |
| -------------- | ---- | --------------------- | ------------------ |
| Frontend       | 5173 | http://localhost:5173 | Vue.js application |
| API Gateway    | 3000 | http://localhost:3000 | REST API endpoints |
| PostgreSQL     | 5432 | localhost:5432        | Primary database   |
| Redis          | 6379 | localhost:6379        | Cache/queues       |
| Mock OpenAI    | 3001 | http://localhost:3001 | AI API mock        |
| Mock Anthropic | 3002 | http://localhost:3002 | AI API mock        |
| LocalStack     | 4566 | http://localhost:4566 | AWS services mock  |

### Essential Commands

```bash
# Full startup
npm run install:all && npm run dev:services && npm run dev:mocks

# Application startup
npm run dev:web & npm run dev:api & npm run dev:orchestrator

# Full shutdown
npm run dev:down

# Reset everything
npm run dev:down && docker system prune -f && npm run install:all
```
