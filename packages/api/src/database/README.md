# Database Infrastructure - AI Validation Platform

This directory contains the complete database infrastructure for the AI-Powered Business Idea Validation Platform, implementing Story 1.2 requirements with Prisma ORM, PostgreSQL, and comprehensive connection management.

## 🏗️ Architecture Overview

### Database Stack
- **PostgreSQL 15+**: Primary database with JSON support for flexible agent data
- **Prisma ORM**: Type-safe database client with migration management
- **Connection Pooling**: Optimized for high-concurrency evaluation workloads
- **Transaction Management**: ACID compliance for complex multi-agent operations

### Data Models

#### Core Entities
```typescript
User -> BusinessIdea -> Evaluation -> AgentResult
```

#### Model Relationships
- **User**: 1 → N BusinessIdeas
- **BusinessIdea**: 1 → N Evaluations  
- **Evaluation**: 1 → N AgentResults
- **Cascade Deletes**: Maintains referential integrity

## 📁 Directory Structure

```
src/database/
├── index.ts                 # Main database connection & health monitoring
├── migrations.ts           # Migration management utilities
├── migrate-cli.ts          # CLI tool for migration operations
├── seed.ts                 # Development seed data scripts
├── transaction-manager.ts  # Transaction utilities & bulk operations
├── test-connection.ts      # Connection testing utility
└── README.md              # This documentation
```

## 🚀 Quick Start

### Environment Setup
```bash
# Required environment variables
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform"
DATABASE_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT_MS=30000
DATABASE_POOL_TIMEOUT_MS=30000
```

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Check migration status
npm run db:migrate:status

# Reset database (development only)
npm run db:migrate:reset
```

## 📊 Data Models

### User Model
```typescript
interface User {
  id: string;           // UUID primary key
  email: string;        // Unique identifier
  password_hash: string; // Bcrypt hashed password
  name: string;         // Display name
  created_at: Date;     // Account creation
  updated_at: Date;     // Last modification
}
```

### BusinessIdea Model
```typescript
interface BusinessIdea {
  id: string;           // UUID primary key
  user_id: string;      // Foreign key to User
  title: string;        // Idea title
  description: string;  // 50-5000 character description
  status: BusinessIdeaStatus; // draft|submitted|evaluating|completed
  created_at: Date;     // Idea creation
  updated_at: Date;     // Last modification
}
```

### Evaluation Model
```typescript
interface Evaluation {
  id: string;               // UUID primary key
  business_idea_id: string; // Foreign key to BusinessIdea
  status: EvaluationStatus; // pending|analyzing|completed|failed
  priority: string;         // low|normal|high
  started_at: Date | null;  // Evaluation start time
  completed_at: Date | null;// Evaluation completion
  results: Json | null;     // Aggregated evaluation results
  error_message: string | null; // Error details if failed
  created_at: Date;         // Record creation
  updated_at: Date;         // Last modification
}
```

### AgentResult Model
```typescript
interface AgentResult {
  id: string;           // UUID primary key
  evaluation_id: string; // Foreign key to Evaluation
  agent_type: AgentType; // market-research|competitive-analysis|etc.
  status: AgentResultStatus; // pending|running|completed|failed
  input_data: Json | null;   // Agent input parameters
  output_data: Json | null;  // Agent analysis results
  score: number | null;      // 0-100 scoring
  insights: Json | null;     // Key insights and recommendations
  started_at: Date | null;   // Agent execution start
  completed_at: Date | null; // Agent execution completion
  error_message: string | null; // Error details if failed
  created_at: Date;         // Record creation
  updated_at: Date;         // Last modification
}
```

## 🔌 Connection Management

### Connection Pooling
```typescript
// Automatic connection pooling configuration
const pooledUrl = addConnectionPooling(databaseUrl);
// Adds: connection_limit=20, connect_timeout=30, pool_timeout=30
```

### Health Monitoring
```typescript
import { checkDatabaseHealth, monitorConnectionLoad } from './database';

// Basic health check
const health = await checkDatabaseHealth();
// Returns: { status: 'healthy'|'unhealthy', message: string }

// Detailed connection monitoring
const load = await monitorConnectionLoad();
// Returns: { healthy: boolean, warnings: string[], metrics: ConnectionMetrics }
```

### Connection Metrics
- **Total Connections**: Current active connections
- **Connection Utilization**: Percentage of max connections used
- **Active vs Idle Ratio**: Query execution efficiency
- **Warning Thresholds**: 80% utilization, 90% active ratio

## 🔄 Migration Management

### Migration CLI
```bash
# Check migration status
npm run db:migrate:status

# Deploy migrations (production)
npm run db:migrate:deploy

# Validate migration integrity
npm run db:migrate:validate

# Create new migration
npx tsx src/database/migrate-cli.ts create add_user_preferences

# Reset database (development)
npm run db:migrate:reset
```

### Migration Best Practices
1. **Always review generated SQL** before applying
2. **Test migrations** with existing data
3. **Use transactions** for multi-step migrations
4. **Backup production** before major schema changes
5. **Document breaking changes** in migration comments

## 🌱 Seed Data

### Development Seed Data
The seed script creates realistic test data:
- **3 Users**: Different personas (entrepreneur, innovator, founder)
- **6 Business Ideas**: Various industries and statuses
- **5 Evaluations**: Mix of completed and in-progress
- **25 Agent Results**: Comprehensive evaluation data

### Seed Data Features
- **Realistic Content**: Industry-appropriate business ideas
- **Status Variety**: All possible evaluation states represented
- **Relationship Integrity**: Proper foreign key relationships
- **Performance Optimized**: Batch operations with transactions

```bash
# Run seed script
npm run db:seed

# Reset and reseed
npx tsx src/database/seed.ts
```

## 🛠️ Repository Pattern

### Data Access Layer
```typescript
import { userRepository, businessIdeaRepository } from '../repositories';

// Type-safe CRUD operations
const user = await userRepository.create({
  email: 'user@example.com',
  password_hash: hashedPassword,
  name: 'John Doe'
});

// Advanced queries with pagination
const ideas = await businessIdeaRepository.findMany(
  { status: 'evaluating' },
  { page: 1, limit: 10, sortBy: 'created_at', sortOrder: 'desc' }
);

// Complex relationships
const completeIdea = await businessIdeaRepository.findByIdComplete(ideaId);
// Returns business idea with user and evaluations with agent results
```

### Repository Features
- **Type Safety**: Full TypeScript integration
- **Query Optimization**: Proper indexing and efficient queries
- **Pagination**: Built-in cursor and offset pagination
- **Filtering**: Flexible filter system
- **Statistics**: Built-in analytics queries
- **Error Handling**: Consistent error patterns

## 🔒 Transaction Management

### Simple Transactions
```typescript
import { withTransaction } from '../database/transaction-manager';

await withTransaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const idea = await tx.businessIdea.create({ 
    data: { ...ideaData, user_id: user.id } 
  });
  return { user, idea };
});
```

### Bulk Operations
```typescript
import { bulkOperationManager } from '../database/transaction-manager';

// Bulk insert with batching
const insertedCount = await bulkOperationManager.bulkInsert(
  'user',
  userDataArray,
  1000 // batch size
);

// Bulk update with conditions
const updatedCount = await bulkOperationManager.bulkUpdate(
  'businessIdea',
  updateOperations,
  100 // batch size
);
```

## 📈 Performance Optimization

### Query Performance
- **Indexes**: Strategic indexing on frequently queried fields
- **Connection Pooling**: Optimized for concurrent operations
- **Query Planning**: Efficient JOIN strategies
- **Pagination**: Cursor-based for large datasets

### Performance Targets
- **Connection Time**: < 30 seconds
- **Query Response**: < 100ms for simple queries
- **Complex Queries**: < 500ms with JOINs
- **Bulk Operations**: 1000+ records/second

### Monitoring
```typescript
// Performance monitoring
const info = await getDatabaseInfo();
console.log(`Connections: ${info.connectionStats?.active}/${info.connectionStats?.maxConnections}`);
console.log(`Uptime: ${Math.floor(info.uptime / 60)} minutes`);
```

## 🧪 Testing

### Test Infrastructure
- **Integration Tests**: Real database operations
- **Performance Tests**: Load and concurrency testing
- **Factory Functions**: Realistic test data generation
- **Cleanup Utilities**: Automated test data cleanup

### Running Tests
```bash
# Run database integration tests
npm test tests/database/

# Run performance tests
npm test tests/database/performance.test.ts

# Run specific repository tests
npm test tests/database/user-repository.test.ts
```

### Test Factories
```typescript
import { UserFactory, BusinessIdeaFactory } from '../tests/database/test-factories';

// Generate test data
const testUser = UserFactory.create();
const testIdeas = BusinessIdeaFactory.createMany(5, { user_id: testUser.id });

// Realistic test scenarios
const scenario = TestDataSets.createRealisticScenario();
```

## 🚨 Error Handling

### Database Errors
```typescript
// Repository error patterns
try {
  const user = await userRepository.create(userData);
} catch (error) {
  if (error.message.includes('unique constraint')) {
    throw new Error('Email already exists');
  }
  throw error;
}
```

### Connection Error Recovery
- **Automatic Retries**: Exponential backoff for transient failures
- **Circuit Breaker**: Fail fast for persistent issues
- **Health Checks**: Continuous connection monitoring
- **Graceful Degradation**: Fallback strategies

## 🔧 Troubleshooting

### Common Issues

#### Connection Pool Exhaustion
```bash
# Check connection stats
npm run db:migrate:status
```
- **Symptoms**: Timeout errors, slow queries
- **Solutions**: Increase pool size, optimize query patterns

#### Migration Conflicts
```bash
# Validate migration state
npm run db:migrate:validate
```
- **Symptoms**: Migration failures, schema drift
- **Solutions**: Reset development DB, resolve conflicts

#### Performance Issues
```typescript
// Monitor connection load
const load = await monitorConnectionLoad();
if (!load.healthy) {
  console.log('Warnings:', load.warnings);
}
```

### Debug Mode
```bash
# Enable query logging
NODE_ENV=development npm run dev
# Logs all SQL queries and timing information
```

## 📋 Production Checklist

### Pre-Deployment
- [ ] Run migration validation
- [ ] Test connection pooling under load
- [ ] Verify backup procedures
- [ ] Configure monitoring alerts
- [ ] Test failover scenarios

### Deployment
- [ ] Deploy migrations with zero downtime
- [ ] Monitor connection metrics
- [ ] Validate data integrity
- [ ] Verify performance benchmarks

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check connection pool utilization
- [ ] Validate query performance
- [ ] Test backup restoration

## 🔗 Integration Points

### API Integration
```typescript
// In Express routes
import { repositories } from '../repositories';

app.get('/api/users/:id', async (req, res) => {
  const user = await repositories.user.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});
```

### Shared Type Integration
```typescript
// Types exported to shared package
import type { 
  User, 
  BusinessIdea, 
  PaginatedResponse 
} from '@ai-validation/shared';
```

### Environment Configuration
```typescript
// Integrated with Story 1.0 credential management
import { getEnvironmentConfig } from '@ai-validation/shared';

const config = getEnvironmentConfig();
const databaseUrl = config.database?.url || process.env.DATABASE_URL;
```

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Database Design Best Practices](./DESIGN_PRINCIPLES.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)