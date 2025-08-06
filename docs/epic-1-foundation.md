# Epic 1: Foundation & Core Evaluation Engine

**Epic Goal**: Establish all external dependencies and technical foundation
while delivering a basic working evaluation system. This epic creates secure
external service integration, project scaffold, development environments, and
implements a simple evaluation flow to validate the technical approach.

## Story 1.0: External Service Setup & Environment Foundation

**As a development team,** **I want to establish all external service
dependencies and secure credential management,** **so that development can
proceed without external service blockers and with proper security practices in
place.**

**Acceptance Criteria:**

#### **External Service Account Setup (User Responsibility)**

1. **LLM Provider Accounts Created:**
   - User creates OpenAI account with API access enabled
   - User creates Anthropic account with Claude API access
   - User documents account details and tier limits in shared secure location
   - User obtains initial API credits/billing setup for development phase

2. **AWS Account Preparation:**
   - User creates AWS account or confirms existing account access
   - User sets up billing alerts and cost monitoring
   - User creates IAM user with programmatic access for development
   - User documents AWS account ID and initial access credentials

#### **API Key & Credential Management (User → Agent Handoff)**

3. **Secure Credential Provision:**
   - User generates API keys for OpenAI and Anthropic
   - User creates AWS access keys for development IAM user
   - User provides credentials through secure channel (encrypted file, password
     manager, etc.)
   - User confirms understanding of credential rotation schedule (monthly)

4. **Development Environment Secrets Setup:**
   - Development team configures local .env files with provided credentials
   - AWS Secrets Manager configured for credential storage
   - Environment variable templates created for all required services
   - Credential validation scripts created to test all external connections

#### **Development Resilience & Offline Support**

5. **Mock Services for Development:**
   - Mock OpenAI API service created returning realistic evaluation data
   - Mock Anthropic API service created with similar response formats
   - Mock S3 service (localstack) configured for local development
   - Development environment can run completely offline using mocks

6. **Rate Limiting & Quota Management:**
   - API rate limiting configurations documented for each service
   - Request retry logic with exponential backoff implemented
   - API quota monitoring and alerting configured
   - Fallback strategies defined when quotas are exceeded

#### **Service Integration Validation**

7. **Connection Testing & Validation:**
   - Automated test suite validates all external service connections
   - Health check endpoints created for each external service
   - Error handling tested for each external service failure scenario
   - Service degradation strategies tested (e.g., single LLM provider failure)

8. **Documentation & Runbooks:**
   - External service integration guide created
   - Troubleshooting runbook for connection issues
   - Credential rotation procedures documented
   - Service outage response procedures defined

**Dependencies:** None (foundation story)

**Related Documents:**
[User Responsibility Matrix](./user-responsibility-matrix.md)

---

## Story 1.1: Project Initialization & Development Environment

**As a developer,** **I want to set up the project structure and development
environment,** **so that the team can begin development with consistent tooling
and configuration.**

**Acceptance Criteria:**

1. Monorepo structure created with package organization for web, api, agents,
   shared, and infrastructure
2. Vue.js application scaffolded with Vite, TypeScript, and testing setup
3. Express API server initialized with TypeScript and basic middleware
4. Docker Compose configuration for local development (PostgreSQL, Redis)
5. Git repository initialized with .gitignore, README, and branch protection
6. ESLint and Prettier configured with consistent rules across packages
7. Basic CI pipeline (GitHub Actions) running tests and linting on PR
8. Integration with credentials from Story 1.0 validated

**Dependencies:** Requires completion of Story 1.0 for secure credential
management setup.

## Story 1.2: Database Design & Setup

**As a developer,** **I want to implement the data models and database
infrastructure,** **so that we can persist business ideas, evaluations, and
results.**

**Acceptance Criteria:**

1. PostgreSQL database running in Docker with initialization scripts
2. Prisma ORM configured with TypeScript models for User, BusinessIdea,
   Evaluation, AgentResult
3. Database migrations created and tested
4. Seed data scripts for development/testing
5. Database connection pooling configured
6. Basic CRUD operations tested for all models
7. Database connection uses secure credential management from Story 1.0

**Dependencies:** Requires Story 1.1 for Docker infrastructure.

## Story 1.3: Authentication & User Management

**As a user,** **I want to create an account and log in,** **so that I can save
and access my business evaluations.**

**Acceptance Criteria:**

1. User registration endpoint with email/password
2. JWT-based authentication implemented
3. Login endpoint returning access and refresh tokens
4. Protected route middleware functioning
5. Password hashing with bcrypt
6. Basic user profile endpoint
7. Token refresh mechanism working

**Dependencies:** Requires Story 1.2 for User data model.

## Story 1.4: Basic Idea Submission API

**As a user,** **I want to submit my business idea through the API,** **so that
it can be evaluated by the system.**

**Acceptance Criteria:**

1. POST /api/ideas endpoint accepting text descriptions
2. Input validation (50-5000 characters)
3. Business idea saved to database with user association
4. Response includes idea ID and initial status
5. Rate limiting implemented (10 requests/minute for free tier)
6. Input sanitization to prevent XSS/injection

**Dependencies:** Requires Story 1.3 for user authentication and Story 1.2 for
data persistence.

## Story 1.5: Simple Evaluation Engine (Single Agent)

**As a developer,** **I want to implement a basic evaluation flow with one
agent,** **so that we can validate the orchestration architecture.**

**Acceptance Criteria:**

1. LangChain configured with OpenAI/Anthropic provider using credentials from
   Story 1.0
2. Basic orchestrator service that receives evaluation requests
3. Single "Market Research" agent that performs simple analysis
4. BullMQ job queue configured for agent communication
5. Agent results saved to database
6. Basic scoring algorithm (0-100)
7. Graceful fallback to mock services when external APIs unavailable

**Dependencies:** Requires Story 1.0 for LLM provider access, Story 1.2 for data
persistence, and Story 1.4 for idea submission API.

## Story 1.6: Minimal Frontend - Idea Input

**As a user,** **I want a simple interface to submit my business idea,** **so
that I can start the evaluation process.**

**Acceptance Criteria:**

1. Vue.js landing page with idea submission form
2. Text area with character counter (50-5000)
3. Submit button triggering API call
4. Loading state while submission processes
5. Success/error messaging
6. Responsive design for mobile/desktop
7. Integration with authentication from Story 1.3

**Dependencies:** Requires Story 1.1 for Vue.js setup, Story 1.4 for API
integration, and Story 1.3 for authentication.

## Story 1.7: Basic Infrastructure & Deployment Foundation

**As a DevOps engineer,** **I want basic deployment infrastructure
established,** **so that the team can deploy and test the application early in
development.**

**Acceptance Criteria:**

1. Basic AWS infrastructure provisioned using CDK
2. Development environment deployment pipeline configured
3. Health check endpoints implemented for all services
4. Basic monitoring and logging configured
5. Environment separation (local/dev) established
6. Integration testing framework setup for deployed environment
7. Uses secure credential management from Story 1.0

**Dependencies:** Requires Story 1.0 for AWS credentials and Story 1.5 for
services to deploy.

---

## Epic 1 Definition of Done

✅ **All external dependencies resolved** - LLM providers, AWS accounts,
credentials  
✅ **Development environment fully functional** - Monorepo, Docker, CI/CD  
✅ **Basic evaluation flow working** - Single agent can process ideas
end-to-end  
✅ **Frontend can submit ideas** - Simple Vue.js interface connected to API  
✅ **Early deployment capability** - Can deploy to development environment  
✅ **Security foundations in place** - Credential management, authentication,
input validation

**Success Metrics:**

- Development team can run complete system locally
- Single evaluation completes end-to-end in <5 minutes
- External API failures gracefully handled with mock fallbacks
- All credentials stored securely with rotation procedures documented
