# Epic 4: Basic User Management (MVP Scope)

**Epic Goal**: Provide essential user account features and evaluation history for MVP launch, focusing on core functionality needed to satisfy functional requirements FR5 and FR9.

**MVP Scope Notes:** This epic has been streamlined for MVP delivery. Advanced features (preferences, sophisticated iteration, billing flows) have been deferred to Post-MVP Epic 6 to accelerate time-to-market by ~2 weeks while retaining all core value delivery.

## Story 4.1: Basic User Dashboard

**As a user,**
**I want to see all my past evaluations,**
**so that I can track my ideas and access previous results.**

**Acceptance Criteria:**

1. User dashboard showing evaluation list in chronological order
2. Basic evaluation cards with title, date, status, and overall score
3. Click to open full report functionality
4. Simple status indicators (Pending, In Progress, Completed, Failed)
5. Basic pagination for users with many evaluations

**Dependencies:** Requires Epic 1 Story 1.3 for user authentication and Epic 3 Story 3.5 for results data.

## Story 4.2: Simple Idea Re-evaluation

**As a user,**
**I want to modify and re-evaluate my business idea,**
**so that I can improve its viability based on feedback.**

**Acceptance Criteria:**

1. "Modify & Re-evaluate" button visible on completed evaluation results
2. Simple text area pre-populated with original idea description
3. Character limit validation (50-5000 characters) consistent with original submission
4. Submit button to start new evaluation with modified idea
5. Clear link between original evaluation and re-evaluation in dashboard
6. Ability to view both evaluations separately

**Dependencies:** Requires Story 4.1 for dashboard integration and Epic 1 Story 1.4 for idea submission API.

## Story 4.3: Basic Usage Limits & Tracking

**As a user,**
**I want to understand my current usage limits,**
**so that I know how many evaluations I have remaining.**

**Acceptance Criteria:**

1. Track evaluation count per user account
2. Display remaining evaluations on dashboard (e.g., "3 of 5 evaluations used")
3. Show usage limit in navigation or header area
4. Display "evaluation limit reached" message when limit exceeded
5. Provide contact information (email) for upgrade requests
6. Simple admin interface to adjust user limits manually

**Dependencies:** Requires Epic 1 Story 1.3 for user tracking and Story 4.1 for dashboard display.

---

## MVP User Journey Flow

### 1. **New User Registration**

```
Landing Page → Sign Up → Email Verification → Dashboard (Empty State)
```

### 2. **First Evaluation**

```
Dashboard → "Start Evaluation" → Idea Input → Progress Dashboard → Results → Dashboard (With History)
```

### 3. **Idea Iteration**

```
Dashboard → Past Evaluation → "Modify & Re-evaluate" → Idea Input (Pre-filled) → Progress Dashboard → Results
```

### 4. **Usage Limit Reached**

```
Dashboard → "Start Evaluation" → Usage Limit Modal → Contact Info → Email Request
```

---

## User Dashboard Design Specifications

### Dashboard Header

- User name and profile picture placeholder
- Usage counter: "2 of 5 evaluations used"
- "Start New Evaluation" primary action button

### Evaluation Cards

```
[Overall Score: 73] [📄 Report] [🔄 Re-evaluate]
My Food Delivery App
Status: Completed | Date: Nov 15, 2024
Recommendation: GO (with caution)
Market Score: 85 | Competition: 60 | Customer: 78
```

### Empty State (New Users)

- Welcoming message explaining the platform
- Prominent "Evaluate Your First Idea" button
- Example evaluation card showing what to expect

### Pagination

- Simple "Load More" button for >10 evaluations
- Eventually upgrade to numbered pagination

---

## Simple Admin Interface Requirements

### User Management

- List all users with registration date and evaluation count
- Search users by email
- Manually adjust user evaluation limits
- View user's evaluation history

### Usage Analytics

- Total users registered
- Total evaluations completed
- Average evaluations per user
- Most common evaluation outcomes

### Quick Actions

- Grant additional evaluations to specific users
- Reset user evaluation count
- Send promotional evaluation credits

---

## Free Tier Limitations (MVP)

### Current Limits

- **5 evaluations per month** per user
- **Standard report format** (no customization)
- **Email support only** (no chat/phone)
- **Basic analytics** in reports

### Upgrade Contact Flow

```
Limit Reached → Modal: "Upgrade for Unlimited Evaluations"
→ Contact Form (Name, Email, Company, Message)
→ "We'll contact you within 24 hours"
```

---

## Epic 4 Definition of Done

✅ **User dashboard functional** - Users can view all past evaluations  
✅ **Idea iteration working** - Users can modify and re-evaluate ideas  
✅ **Usage tracking active** - Clear limits display and enforcement  
✅ **Admin tools available** - Basic user management capabilities  
✅ **Upgrade path clear** - Contact process for limit increases  
✅ **FR5 & FR9 satisfied** - Functional requirements for iteration and evaluation history

**Success Metrics:**

- Dashboard loads in <2 seconds
- 90% of users understand their remaining evaluation count
- <5% user confusion about how to re-evaluate ideas
- Admin can adjust user limits in <30 seconds
- 80% of limit-reached users submit upgrade requests

**Deferred to Epic 6:**

- Advanced sorting/filtering of evaluations
- User preferences and industry settings
- Sophisticated iteration tools with side-by-side comparison
- Stripe integration and automated billing
- Advanced usage analytics and insights
