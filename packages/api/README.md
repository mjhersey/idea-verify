# API Package - AI Validation Platform

Express.js API Gateway with comprehensive database integration, implementing Stories 1.1 and 1.2.

## 🏗️ Architecture

### Technology Stack
- **Express.js** with TypeScript for type-safe API development
- **Prisma ORM** with PostgreSQL for robust data persistence
- **Repository Pattern** for clean data access abstraction
- **Connection Pooling** for high-performance database operations
- **Transaction Management** for ACID compliance

### Package Structure
```
packages/api/
├── src/
│   ├── app.ts              # Express application setup
│   ├── server.ts           # Server entry point
│   ├── database/           # Database infrastructure (Story 1.2)
│   │   ├── index.ts        # Connection & health monitoring
│   │   ├── migrations.ts   # Migration management
│   │   ├── seed.ts         # Development seed data
│   │   └── transaction-manager.ts # Transaction utilities
│   ├── repositories/       # Data access layer
│   │   ├── user-repository.ts
│   │   ├── business-idea-repository.ts
│   │   └── index.ts
│   ├── routes/             # API route definitions
│   │   ├── health.ts       # Health check endpoints
│   │   ├── database-health.ts # Database monitoring
│   │   └── evaluations.ts  # Business evaluation APIs
│   ├── middleware/         # Express middleware
│   ├── controllers/        # Request handlers
│   └── types/              # TypeScript type definitions
├── tests/                  # Test suites
│   ├── database/           # Database integration tests
│   ├── unit/               # Unit tests
│   └── integration/        # API integration tests
├── prisma/                 # Prisma configuration
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Migration history
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (via Docker)
- npm or yarn

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure database connection
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform"
```

### Development Workflow
```bash
# Install dependencies
npm install

# Start PostgreSQL (from project root)
docker compose up -d postgres

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start development server
npm run dev
```

## 💾 Database Integration

### Story 1.2 Implementation
Complete database infrastructure with:
- **Prisma ORM Setup**: Type-safe database client with migration management
- **Data Models**: User, BusinessIdea, Evaluation, AgentResult with proper relationships
- **Migration System**: CLI tools for schema management and deployment
- **Connection Pooling**: Optimized for concurrent evaluation workloads
- **Seed Data**: Realistic development data for testing
- **Repository Pattern**: Clean data access with CRUD operations
- **Testing Infrastructure**: Integration and performance tests

### Database Schema
```typescript
// Core entity relationships
User (1) → (N) BusinessIdea (1) → (N) Evaluation (1) → (N) AgentResult

// With cascade deletes and referential integrity
```

### Available Scripts
```bash
# Database Operations
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (development)
npm run db:migrate:deploy # Deploy migrations (production)
npm run db:migrate:status # Check migration status
npm run db:migrate:reset  # Reset database (development)
npm run db:seed          # Populate with test data
npm run db:studio        # Open Prisma Studio

# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run start            # Start production server
npm run test             # Run test suite
npm run test:watch       # Run tests in watch mode
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
```

## 🛠️ API Endpoints

### Health & Monitoring
```bash
GET  /health                    # Basic API health check
GET  /api/database/health       # Database health check
GET  /api/database/status       # Comprehensive database status
GET  /api/database/metrics      # Connection pool metrics
GET  /api/database/migrations   # Migration status
```

### Core API (Future Implementation)
```bash
# Users
POST   /api/users               # Create user
GET    /api/users/:id           # Get user by ID
PUT    /api/users/:id           # Update user
DELETE /api/users/:id           # Delete user

# Business Ideas
GET    /api/business-ideas      # List business ideas (paginated)
POST   /api/business-ideas      # Create business idea
GET    /api/business-ideas/:id  # Get business idea
PUT    /api/business-ideas/:id  # Update business idea
DELETE /api/business-ideas/:id  # Delete business idea

# Evaluations
POST   /api/evaluations         # Start evaluation
GET    /api/evaluations/:id     # Get evaluation status
GET    /api/evaluations/:id/results # Get evaluation results
```

## 🗃️ Repository Usage

### User Operations
```typescript
import { userRepository } from './repositories';

// Create user
const user = await userRepository.create({
  email: 'user@example.com',
  password_hash: hashedPassword,
  name: 'John Doe'
});

// Find with pagination
const users = await userRepository.findMany(
  { name: 'John' },           // filters
  { page: 1, limit: 10 }      // pagination
);

// Get user statistics
const stats = await userRepository.getStats();
```

### Business Idea Operations
```typescript
import { businessIdeaRepository } from './repositories';

// Create business idea
const idea = await businessIdeaRepository.create({
  user_id: userId,
  title: 'AI-Powered Recipe App',
  description: 'A smart recipe recommendation system...',
  status: 'draft'
});

// Search business ideas
const searchResults = await businessIdeaRepository.search('AI');

// Get complete data with relationships
const completeIdea = await businessIdeaRepository.findByIdComplete(ideaId);
// Returns: idea + user + evaluations + agent results
```

## 🔄 Transaction Management

### Simple Transactions
```typescript
import { withTransaction } from './database/transaction-manager';

const result = await withTransaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const idea = await tx.businessIdea.create({ 
    data: { ...ideaData, user_id: user.id } 
  });
  return { user, idea };
});
```

### Bulk Operations
```typescript
import { bulkOperationManager } from './database/transaction-manager';

// Bulk insert with automatic batching
const count = await bulkOperationManager.bulkInsert(
  'businessIdea',
  ideaDataArray,
  1000 // batch size
);
```

## 🧪 Testing

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Database and API endpoint testing
- **Performance Tests**: Load testing and optimization validation

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm test tests/database/
npm test tests/unit/
npm test tests/integration/

# Run tests in watch mode
npm run test:watch

# Run performance tests
npm test tests/database/performance.test.ts
```

### Test Factories
```typescript
import { UserFactory, BusinessIdeaFactory } from '../tests/database/test-factories';

// Generate realistic test data
const testUser = UserFactory.create();
const testIdeas = BusinessIdeaFactory.createMany(5);
```

## 📊 Performance Monitoring

### Database Health Monitoring
```typescript
import { 
  checkDatabaseHealth, 
  monitorConnectionLoad,
  getDatabaseInfo 
} from './database';

// Basic health check
const health = await checkDatabaseHealth();

// Detailed monitoring
const load = await monitorConnectionLoad();
if (!load.healthy) {
  console.log('Database warnings:', load.warnings);
}

// Connection statistics
const info = await getDatabaseInfo();
console.log(`Active connections: ${info.connectionStats?.active}`);
```

### Performance Targets
- **API Response Time**: < 200ms for simple endpoints
- **Database Queries**: < 100ms for indexed lookups
- **Complex Queries**: < 500ms with JOINs
- **Connection Pool**: 80% utilization threshold

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://user:password@host:port/database"
DATABASE_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT_MS=30000
DATABASE_POOL_TIMEOUT_MS=30000

# Integration with Story 1.0 (Optional)
AWS_REGION=us-east-1
SECRETS_OPENAI_NAME=ai-validation-platform/openai
USE_MOCK_SERVICES=true
```

### Development vs Production
```typescript
// Automatic configuration based on NODE_ENV
const isDevelopment = process.env.NODE_ENV === 'development';

// Development: Detailed logging, test data, relaxed security
// Production: Minimal logging, secure headers, optimized performance
```

## 🚨 Error Handling

### Database Errors
```typescript
// Repository error patterns
try {
  const user = await userRepository.create(userData);
} catch (error) {
  if (error.message.includes('unique constraint')) {
    throw new ValidationError('Email already exists');
  }
  throw new DatabaseError('Failed to create user');
}
```

### API Error Response Format
```typescript
{
  "error": "ValidationError",
  "message": "Email already exists",
  "statusCode": 400,
  "timestamp": "2025-08-02T12:00:00.000Z"
}
```

## 🔗 Integration Points

### Shared Package Integration
```typescript
// Types and utilities from @ai-validation/shared
import { 
  User, 
  BusinessIdea, 
  getEnvironmentConfig,
  RateLimiter 
} from '@ai-validation/shared';
```

### Frontend Integration (Future)
```typescript
// RESTful API endpoints for Vue.js frontend
// JSON responses with consistent error handling
// CORS configured for cross-origin requests
```

### Agent Integration (Future)
```typescript
// Database models designed for agent orchestration
// Evaluation and AgentResult entities for multi-agent workflows
// Transaction support for atomic agent operations
```

## 📈 Scalability Considerations

### Database Scaling
- **Connection Pooling**: Configured for high concurrency
- **Query Optimization**: Strategic indexing and efficient JOINs
- **Read Replicas**: Architecture ready for read scaling
- **Caching Layer**: Repository pattern supports caching integration

### Application Scaling
- **Stateless Design**: No session state in application
- **Horizontal Scaling**: Load balancer ready
- **Resource Optimization**: Efficient memory and CPU usage
- **Monitoring**: Built-in performance metrics

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations deployed
- [ ] Connection pool sized appropriately
- [ ] Monitoring and alerting configured
- [ ] Error logging integrated
- [ ] Security headers enabled
- [ ] Rate limiting configured

### Docker Support
```dockerfile
# Optimized multi-stage build
FROM node:20-alpine AS builder
# Build application with dependencies

FROM node:20-alpine AS runtime
# Lightweight runtime image
```

## 📚 Additional Documentation

- [Database Infrastructure](./src/database/README.md) - Comprehensive database documentation
- [Repository Patterns](./docs/REPOSITORIES.md) - Data access layer guide
- [API Design Guidelines](./docs/API_DESIGN.md) - REST API conventions
- [Performance Optimization](./docs/PERFORMANCE.md) - Optimization strategies
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment

## 🤝 Contributing

### Development Guidelines
1. **Type Safety**: All code must be fully typed with TypeScript
2. **Testing**: Minimum 90% code coverage for business logic
3. **Documentation**: Update README for significant changes
4. **Database Changes**: Always create migrations for schema changes
5. **Performance**: Monitor query performance and connection usage

### Code Quality
```bash
# Before committing
npm run lint          # Check code style
npm run test          # Run test suite
npm run build         # Verify build process
```

This API package serves as the central data access layer for the AI Validation Platform, providing robust database operations, performance optimization, and comprehensive monitoring capabilities.