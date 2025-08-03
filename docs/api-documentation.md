# API Documentation - Business Idea Validation Platform

Welcome to our API! This documentation will help you integrate with our
AI-powered business validation platform programmatically.

## 🔗 Base URL

```
https://api.idea-validation-platform.com
```

**Development/Testing:**

```
https://dev-api.idea-validation-platform.com
```

---

## 🔑 Authentication

All API endpoints require authentication using JWT (JSON Web Tokens).

### Getting Started with Authentication

1. **Register an Account**: Create an account through our web interface or API
2. **Get Your Tokens**: Use login endpoint to receive access and refresh tokens
3. **Include in Requests**: Add the access token to your request headers

### Authentication Headers

```http
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
Content-Type: application/json
```

---

## 📋 Authentication Endpoints

### Register New Account

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Validation Rules:**

- Email must be valid format
- Password minimum 8 characters
- Name must be 2-50 characters

---

### Login

Authenticate and receive access tokens.

**Endpoint:** `POST /api/auth/login`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900
  },
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Token Lifetimes:**

- Access Token: 15 minutes
- Refresh Token: 7 days

---

### Refresh Access Token

Get a new access token using your refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Request Body:**

```json
{
  "refresh_token": "your_refresh_token_here"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "access_token": "new_access_token_here",
  "expires_in": 900
}
```

---

### Get User Profile

Retrieve current user information.

**Endpoint:** `GET /api/auth/profile`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:30:00Z",
    "idea_count": 5,
    "last_login": "2024-01-20T14:22:00Z"
  }
}
```

---

## 💡 Business Ideas Endpoints

### Submit Business Idea

Submit a business idea for AI evaluation.

**Endpoint:** `POST /api/ideas`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**

```json
{
  "title": "Smart Pet Feeding Assistant",
  "description": "A smart pet feeder that uses AI to monitor pet eating habits and health indicators. Pet owners struggle with knowing if they're feeding their pets the right amount..."
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "idea": {
    "id": "idea-uuid-here",
    "title": "Smart Pet Feeding Assistant",
    "description": "A smart pet feeder that uses AI to monitor...",
    "status": "submitted",
    "user_id": "user-uuid-here",
    "created_at": "2024-01-20T15:30:00Z",
    "submission_limits": {
      "requests_remaining": 9,
      "reset_time": "2024-01-20T15:31:00Z"
    }
  }
}
```

**Validation Rules:**

- Description: 50-5,000 characters (required)
- Title: 5-100 characters (optional - auto-generated if not provided)
- Content sanitized for XSS prevention

---

### Get Your Business Ideas

Retrieve all business ideas you've submitted.

**Endpoint:** `GET /api/ideas`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `status` (optional): Filter by status (submitted, evaluating, completed)

**Response (200 OK):**

```json
{
  "success": true,
  "ideas": [
    {
      "id": "idea-uuid-1",
      "title": "Smart Pet Feeding Assistant",
      "description": "A smart pet feeder that uses AI...",
      "status": "completed",
      "created_at": "2024-01-20T15:30:00Z",
      "evaluation_id": "eval-uuid-1"
    },
    {
      "id": "idea-uuid-2",
      "title": "Productivity App for Remote Workers",
      "description": "An app that helps remote workers...",
      "status": "evaluating",
      "created_at": "2024-01-20T16:45:00Z",
      "evaluation_id": "eval-uuid-2"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_items": 25,
    "items_per_page": 10
  }
}
```

---

### Get Single Business Idea

Retrieve details for a specific business idea.

**Endpoint:** `GET /api/ideas/{idea_id}`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200 OK):**

```json
{
  "success": true,
  "idea": {
    "id": "idea-uuid-here",
    "title": "Smart Pet Feeding Assistant",
    "description": "A smart pet feeder that uses AI to monitor pet eating habits...",
    "status": "completed",
    "user_id": "user-uuid-here",
    "created_at": "2024-01-20T15:30:00Z",
    "updated_at": "2024-01-20T15:45:00Z",
    "evaluation_id": "eval-uuid-here"
  }
}
```

---

## 📊 Evaluation Endpoints

### Start Evaluation

Trigger an evaluation for a submitted business idea.

**Endpoint:** `POST /api/evaluations`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**

```json
{
  "business_idea_id": "idea-uuid-here",
  "priority": "normal"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "evaluation": {
    "id": "eval-uuid-here",
    "business_idea_id": "idea-uuid-here",
    "status": "pending",
    "priority": "normal",
    "created_at": "2024-01-20T15:32:00Z",
    "estimated_completion": "2024-01-20T16:02:00Z"
  }
}
```

**Priority Options:**

- `low`: Lower priority, may take longer
- `normal`: Standard processing (default)
- `high`: Higher priority (premium feature)

---

### Get Evaluation Status

Check the status of an ongoing evaluation.

**Endpoint:** `GET /api/evaluations/{evaluation_id}/status`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200 OK):**

```json
{
  "success": true,
  "evaluation": {
    "id": "eval-uuid-here",
    "status": "analyzing",
    "progress": {
      "percentage": 65,
      "current_stage": "market_research",
      "stages_completed": ["initialization", "data_gathering"],
      "estimated_time_remaining": "8 minutes"
    },
    "started_at": "2024-01-20T15:32:00Z",
    "updated_at": "2024-01-20T15:40:00Z"
  }
}
```

**Status Values:**

- `pending`: Queued for processing
- `analyzing`: AI analysis in progress
- `completed`: Analysis finished, results available
- `failed`: Analysis failed (rare)

---

### Get Evaluation Results

Retrieve the complete evaluation results.

**Endpoint:** `GET /api/evaluations/{evaluation_id}/results`

**Headers Required:**

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200 OK):**

```json
{
  "success": true,
  "evaluation": {
    "id": "eval-uuid-here",
    "business_idea_id": "idea-uuid-here",
    "status": "completed",
    "overall_score": 78,
    "recommendation": "GO",
    "completed_at": "2024-01-20T15:58:00Z",
    "results": {
      "market_research": {
        "agent_type": "market-research",
        "score": 78,
        "analysis": {
          "market_size": "Large addressable market of $2.1B in pet care technology",
          "competition": "Moderate competition with differentiation opportunities",
          "trends": "Growing pet humanization trend supports smart pet products",
          "barriers": "Moderate barriers - requires hardware development expertise"
        },
        "insights": [
          "Pet owners increasingly willing to pay premium for health monitoring",
          "Subscription model viable - similar products show 65% retention",
          "Partnership with veterinarians could accelerate adoption"
        ],
        "recommendations": [
          "Focus on health monitoring features as primary value proposition",
          "Consider B2B2C model through veterinary partnerships",
          "Develop mobile app with rich analytics dashboard"
        ]
      }
    }
  }
}
```

---

## 📈 Rate Limits

To ensure fair usage and system stability:

### Current Limits

**Free Tier:**

- **Ideas Submission**: 10 requests per minute
- **API Calls**: 100 requests per hour
- **Evaluations**: 5 per day

**Authentication Endpoints:**

- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 5 attempts per 15 minutes per IP
- **Token Refresh**: 10 requests per minute

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642689600
X-RateLimit-Type: ideas-submission
```

### Handling Rate Limits

When you exceed rate limits, you'll receive:

**Response (429 Too Many Requests):**

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60,
  "limit_type": "ideas-submission"
}
```

---

## ❌ Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error description here",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific_error_info"
  }
}
```

### Common Error Codes

**Authentication Errors:**

- `INVALID_CREDENTIALS`: Email/password incorrect
- `TOKEN_EXPIRED`: Access token has expired
- `TOKEN_INVALID`: Malformed or invalid token
- `UNAUTHORIZED`: Authentication required

**Validation Errors:**

- `VALIDATION_ERROR`: Request data validation failed
- `MISSING_REQUIRED_FIELD`: Required field not provided
- `INVALID_FORMAT`: Data format incorrect

**Business Logic Errors:**

- `IDEA_NOT_FOUND`: Business idea doesn't exist or not owned by user
- `EVALUATION_IN_PROGRESS`: Cannot start new evaluation while one is running
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions

**System Errors:**

- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

---

## 🔧 SDKs and Tools

### Official SDKs

**JavaScript/Node.js** (Coming Soon)

```bash
npm install @idea-validation/api-client
```

**Python** (Coming Soon)

```bash
pip install idea-validation-api
```

### Postman Collection

Import our [Postman Collection](postman-collection-link) for easy API testing.

### OpenAPI Specification

Download our [OpenAPI/Swagger specification](openapi-spec-link) for automated
code generation.

---

## 🚀 Getting Started Quick Example

Here's a complete example of submitting and tracking an idea evaluation:

```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'your@email.com',
    password: 'yourpassword',
  }),
})
const { tokens } = await loginResponse.json()

// 2. Submit business idea
const ideaResponse = await fetch('/api/ideas', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${tokens.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My Awesome Business Idea',
    description: 'A detailed description of my business concept...',
  }),
})
const { idea } = await ideaResponse.json()

// 3. Start evaluation
const evalResponse = await fetch('/api/evaluations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${tokens.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    business_idea_id: idea.id,
  }),
})
const { evaluation } = await evalResponse.json()

// 4. Poll for results (or use webhooks in production)
const pollResults = async () => {
  const statusResponse = await fetch(
    `/api/evaluations/${evaluation.id}/status`,
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  )
  const status = await statusResponse.json()

  if (status.evaluation.status === 'completed') {
    // Get full results
    const resultsResponse = await fetch(
      `/api/evaluations/${evaluation.id}/results`,
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )
    const results = await resultsResponse.json()
    console.log('Evaluation complete!', results)
  } else {
    // Check again in 30 seconds
    setTimeout(pollResults, 30000)
  }
}

pollResults()
```

---

## 📞 Support

**Technical Support:**

- Email: api-support@[platform-domain].com
- Response time: Within 12 hours
- Include your request ID when possible

**API Updates:**

- Subscribe to our [developer newsletter](newsletter-link)
- Follow [@DevUpdates](twitter-link) for real-time notifications
- Check our [status page](status-link) for service updates

**Community:**

- [Developer Discord](discord-link)
- [Stack Overflow](stackoverflow-link) - Tag with `idea-validation-api`
- [GitHub Issues](github-link) for bug reports

---

_Built with ❤️ for entrepreneurs. Happy building!_
