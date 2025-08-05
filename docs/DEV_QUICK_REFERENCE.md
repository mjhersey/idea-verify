# Development Quick Reference

## 🚀 Start Development Environment

### Full Stack Startup (Recommended)

```bash
# 1. Start infrastructure (Docker containers)
npm run dev:services  # PostgreSQL, Redis, LocalStack

# 2. Start AI mocks (Docker containers)
npm run dev:mocks     # Mock OpenAI, Mock Anthropic

# 3. Start applications (Command line - 3 terminals)
npm run dev:web           # Terminal 1: Frontend (Vue.js)
npm run dev:api           # Terminal 2: API (Express.js)
npm run dev:orchestrator  # Terminal 3: Orchestrator

# Or start all Docker services at once
npm run dev:all       # All containers (infrastructure + mocks)
```

### Individual Package Development

```bash
# Frontend only
cd packages/web && npm run dev

# API only
cd packages/api && npm run dev

# Orchestrator only
cd packages/orchestrator && npm run dev
```

## 🔍 Service URLs

| Service            | URL                   | Purpose     |
| ------------------ | --------------------- | ----------- |
| **Frontend**       | http://localhost:5173 | Vue.js UI   |
| **API Gateway**    | http://localhost:3000 | REST API    |
| **PostgreSQL**     | localhost:5432        | Database    |
| **Redis**          | localhost:6379        | Cache/Queue |
| **Mock OpenAI**    | http://localhost:3001 | AI Mock API |
| **Mock Anthropic** | http://localhost:3002 | AI Mock API |
| **LocalStack**     | http://localhost:4566 | AWS Mock    |

## 🧪 Testing & Validation

```bash
# Quick validation
npm run test:db           # Test database connectivity
npm run test:offline      # Test offline development mode
npm run test:env          # Validate environment setup

# Comprehensive testing
npm test                  # All unit tests
npm run test:integration  # Integration tests
npm run test:integration:full  # Full test suite with services
```

## 🛠️ Common Development Tasks

### Managing Services

```bash
# Start services
npm run dev:services      # Core infrastructure only
npm run dev:mocks         # AI mocks only
npm run dev:all           # Everything

# Monitor services
npm run dev:logs          # All service logs
docker-compose ps         # Service status
docker-compose logs <service>  # Specific service logs

# Stop services
npm run dev:down          # Stop all Docker services
docker-compose stop <service>  # Stop specific service
```

### Package Management

```bash
# Install/update dependencies
npm run install:all       # Install for all packages
npm install --workspace=packages/web <package>  # Add to specific package

# Build and clean
npm run build             # Build all packages
npm run clean             # Clean build artifacts
```

### Code Quality

```bash
# Formatting
npm run format            # Format all code
npm run format:check      # Check formatting

# Linting
npm run lint              # Lint all packages

# Git operations
git add . && git commit   # Triggers pre-commit hooks
```

## 🐛 Quick Troubleshooting

### Service Won't Start

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :3000  # API
lsof -i :5173  # Frontend

# Kill process and restart
kill -9 <PID>
npm run dev:down && npm run dev:services
```

### Database Issues

```bash
# Reset database
docker-compose down
docker volume rm idea-verify_postgres_data
npm run dev:services
npm run test:db
```

### Clean Slate Reset

```bash
# Nuclear option - reset everything
npm run dev:down
docker system prune -f
rm -rf node_modules packages/*/node_modules
npm run install:all
npm run dev:services
```

### Docker Issues

```bash
# Check Docker daemon
docker info

# Clean Docker resources
docker system prune -f
docker volume prune -f

# Restart Docker (system-specific)
# macOS: Docker Desktop restart
# Linux: sudo systemctl restart docker
```

## 📁 Key Directories

```
idea-verify/
├── packages/
│   ├── web/              # Vue.js frontend
│   ├── api/              # Express.js API
│   ├── orchestrator/     # AI coordination
│   ├── shared/           # Shared utilities
│   └── agents/           # AI agent services
├── docs/                 # Documentation
├── tools/                # Development scripts
└── tests/                # Integration tests
```

## 🔧 Environment Variables

Default development configuration (no .env needed):

```bash
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform
REDIS_URL=redis://localhost:6379
VITE_API_BASE_URL=http://localhost:3000
USE_MOCK_SERVICES=true
NODE_ENV=development
```

## 📋 Daily Workflow

### Starting Your Day

```bash
# 1. Pull latest changes
git pull

# 2. Update dependencies (if package.json changed)
npm run install:all

# 3. Start infrastructure
npm run dev:services
npm run dev:mocks

# 4. Start applications (3 terminals)
npm run dev:web
npm run dev:api
npm run dev:orchestrator

# 5. Verify everything works
npm run test:offline
```

### During Development

```bash
# Make changes and test
npm test                  # Run tests
npm run lint              # Check code quality

# Test specific components
cd packages/web && npm run test      # Frontend tests
cd packages/api && npm run test      # API tests

# Database operations
npm run test:db           # Test DB connectivity
```

### End of Day

```bash
# Commit changes
git add .
git commit -m "feat: description of changes"
git push

# Stop services (optional - can leave running)
npm run dev:down
```

## 🆘 Emergency Commands

```bash
# Everything is broken - start over
npm run dev:down
docker system prune -f --volumes
rm -rf node_modules packages/*/node_modules package-lock.json packages/*/package-lock.json
npm cache clean --force
npm run install:all
npm run dev:all

# Just the apps are broken - keep infrastructure
cd packages/web && rm -rf node_modules dist .vite
cd packages/api && rm -rf node_modules dist
npm run install:all
npm run dev:web
npm run dev:api
```

## 🔗 Useful Links

- **Main README**: [README.md](../README.md)
- **Full Setup Guide**: [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)
- **API Docs**: [api-documentation.md](./api-documentation.md)
- **Troubleshooting**:
  [troubleshooting-runbook.md](./troubleshooting-runbook.md)
- **Architecture**: [architecture.md](./architecture.md)
