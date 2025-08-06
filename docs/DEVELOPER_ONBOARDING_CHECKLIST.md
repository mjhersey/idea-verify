# Developer Onboarding Checklist

Welcome to the AI-Powered Business Idea Validation Platform! This checklist will
help you get up and running quickly.

## 📋 Pre-Setup Checklist

### System Requirements

- [ ] **Operating System**: Windows 10+, macOS 10.15+, or Linux
- [ ] **RAM**: At least 8GB (16GB recommended for smooth Docker operation)
- [ ] **Storage**: At least 5GB free space
- [ ] **Network**: Stable internet connection for initial setup

### Required Software

- [ ] **Node.js 18.0.0+** - [Download](https://nodejs.org/)
- [ ] **npm 9.0.0+** - Usually comes with Node.js
- [ ] **Git** - [Download](https://git-scm.com/)
- [ ] **Docker Desktop** - [Download](https://docs.docker.com/get-docker/)
- [ ] **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

### Verify Installation

Run these commands in your terminal:

```bash
node --version    # Should show v18.0.0 or higher
npm --version     # Should show 9.0.0 or higher
git --version     # Should show git version
docker --version  # Should show Docker version
docker-compose --version  # Should show Docker Compose version
```

- [ ] All commands above work without errors

## 🚀 Quick Setup (Automated)

### Option 1: Automated Setup Script (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd idea-verify

# Run automated setup script
./scripts/setup-dev.sh
```

- [ ] Setup script completed successfully
- [ ] All services are running (check with `docker-compose ps`)

### Option 2: Manual Setup

If the automated script doesn't work, follow the
[detailed manual setup guide](./DEVELOPMENT_SETUP.md).

## ✅ Validation Checklist

### Infrastructure Services (Docker)

Verify these containers are running with `docker-compose ps`:

- [ ] **ai-validation-postgres** (port 5432) - Database
- [ ] **ai-validation-redis** (port 6379) - Cache/Queue
- [ ] **ai-validation-localstack** (port 4566) - AWS Mock
- [ ] **ai-validation-mock-openai** (port 3001) - OpenAI Mock
- [ ] **ai-validation-mock-anthropic** (port 3002) - Anthropic Mock

### Application Services (Command Line)

Start these in separate terminals:

**Terminal 1 - Frontend:**

```bash
npm run dev:web
```

- [ ] Vite dev server starts at http://localhost:5173
- [ ] No compilation errors in terminal
- [ ] Browser loads Vue.js application

**Terminal 2 - API Gateway:**

```bash
npm run dev:api
```

- [ ] Express server starts at http://localhost:3000
- [ ] No startup errors in terminal
- [ ] Health endpoint responds: `curl http://localhost:3000/health`

**Terminal 3 - Orchestrator:**

```bash
npm run dev:orchestrator
```

- [ ] Orchestrator service starts without errors
- [ ] Connects to Redis and database successfully

### Database & Services Testing

```bash
# Test database connectivity
npm run test:db
```

- [ ] Database connection successful
- [ ] Tables created successfully
- [ ] Sample data inserted

```bash
# Test offline development mode
npm run test:offline
```

- [ ] All mock services responding
- [ ] Offline mode test passes

```bash
# Test environment setup
npm run test:env
```

- [ ] Environment validation passes

### Manual Service Verification

**Frontend (Vue.js):**

- [ ] Visit http://localhost:5173
- [ ] Page loads without errors
- [ ] No console errors in browser dev tools
- [ ] Hot reload works (make a small change and see it update)

**API Gateway:**

- [ ] `curl http://localhost:3000/health` returns success
- [ ] `curl http://localhost:3000/api/evaluations` returns data or empty array

**Mock Services:**

- [ ] `curl http://localhost:3001/v1/models` returns mock OpenAI models
- [ ] `curl http://localhost:3002/health` returns mock Anthropic health check

**Database:**

```bash
# Connect to database (optional, requires psql)
psql postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform

# Or using Docker
docker exec -it ai-validation-postgres psql -U dev_user -d ai_validation_platform
```

- [ ] Can connect to database
- [ ] Can see tables: `\dt`

## 🛠️ Development Environment Setup

### VS Code Extensions (Recommended)

- [ ] **Vue Language Features (Volar)** - Vue.js support
- [ ] **TypeScript Vue Plugin (Volar)** - TypeScript in Vue
- [ ] **ESLint** - Code linting
- [ ] **Prettier** - Code formatting
- [ ] **Docker** - Docker support
- [ ] **GitLens** - Enhanced Git capabilities

### Project Workspace

- [ ] Open project in VS Code: `code .`
- [ ] All workspace extensions installed
- [ ] TypeScript/Vue syntax highlighting works
- [ ] ESLint and Prettier working (check bottom status bar)

### Git Configuration

```bash
# Set up your Git identity (if not already done)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

- [ ] Git identity configured
- [ ] Can commit changes without issues

## 🧪 First Development Test

### Make a Small Change

1. **Edit Frontend:**
   - [ ] Open `packages/web/src/App.vue`
   - [ ] Make a small text change
   - [ ] Verify hot reload works in browser

2. **Test API:**
   - [ ] Open `packages/api/src/routes/health.ts`
   - [ ] Add a console.log statement
   - [ ] Restart API: `npm run dev:api`
   - [ ] Verify log appears in terminal

3. **Run Tests:**

   ```bash
   # Run frontend tests
   cd packages/web && npm run test

   # Run API tests
   cd packages/api && npm run test
   ```

   - [ ] Frontend tests pass
   - [ ] API tests pass

### Commit Your First Change

```bash
git add .
git commit -m "test: verify development environment setup"
```

- [ ] Commit successful (pre-commit hooks run)
- [ ] No linting or formatting errors

## 📚 Knowledge Transfer

### Project Understanding

- [ ] Read [README.md](../README.md) - Project overview
- [ ] Review [architecture.md](./architecture.md) - System architecture
- [ ] Understand package structure in `/packages`

### Development Workflow

- [ ] Bookmark [DEV_QUICK_REFERENCE.md](./DEV_QUICK_REFERENCE.md) for daily
      commands
- [ ] Understand testing strategy (unit, integration, e2e)
- [ ] Know how to start/stop services

### Team Resources

- [ ] Join team communication channels
- [ ] Access to project management tools
- [ ] Know who to ask for help
- [ ] Understand code review process

## 🔧 Troubleshooting Knowledge

### Common Issues & Solutions

- [ ] Know how to reset Docker services:
      `npm run dev:down && npm run dev:services`
- [ ] Know how to clean node_modules: `rm -rf node_modules && npm install`
- [ ] Know how to check service logs: `npm run dev:logs`
- [ ] Know how to check what's using a port: `lsof -i :3000`

### Reference Documentation

- [ ] Bookmarked [troubleshooting-runbook.md](./troubleshooting-runbook.md)
- [ ] Know where to find API docs:
      [api-documentation.md](./api-documentation.md)
- [ ] Understand how to read error logs

## ✅ Final Verification

### Complete Development Cycle

1. **Start Services:**

   ```bash
   npm run dev:services  # Infrastructure
   npm run dev:mocks     # AI mocks
   npm run dev:web       # Frontend (terminal 1)
   npm run dev:api       # API (terminal 2)
   npm run dev:orchestrator  # Orchestrator (terminal 3)
   ```

   - [ ] All services start without errors

2. **Test Full Stack:**
   - [ ] Frontend loads and is responsive
   - [ ] API endpoints return data
   - [ ] Database operations work
   - [ ] Mock AI services respond

3. **Development Workflow:**
   - [ ] Make code changes
   - [ ] Run tests: `npm test`
   - [ ] Format code: `npm run format`
   - [ ] Commit changes successfully

4. **Stop Services:**

   ```bash
   npm run dev:down  # Stop Docker services
   # Stop other terminals manually (Ctrl+C)
   ```

   - [ ] All services stop cleanly

## 🎉 You're Ready!

If all items above are checked, you're ready to start developing!

### Next Steps:

1. **Review open issues** - Find something to work on
2. **Read contribution guidelines** - Understand team standards
3. **Pick up your first task** - Start small with bug fixes or documentation
4. **Ask questions** - Don't hesitate to reach out to the team

### Daily Workflow Reference:

```bash
# Start your day
npm run dev:services && npm run dev:mocks
npm run dev:web & npm run dev:api & npm run dev:orchestrator

# End your day
npm run dev:down
```

### Emergency Reset (if things break):

```bash
npm run dev:down
docker system prune -f
rm -rf node_modules packages/*/node_modules
npm run install:all
./scripts/setup-dev.sh
```

---

**Welcome to the team! 🚀**

_If you encounter any issues during setup, please:_

1. _Check the [troubleshooting guide](./troubleshooting-runbook.md)_
2. _Ask in the team chat_
3. _Update this checklist if you find missing steps_
