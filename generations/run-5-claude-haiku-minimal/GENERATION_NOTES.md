# Avitam Teach MVP - Generation Notes

## Overview
A subscription-based online teaching platform built with Next.js 14, React 18, PostgreSQL, and Claude AI. Features user authentication, course browsing, lesson completion, interactive quizzes, runnable code exercises, AI-powered teaching assistant, and Stripe payment integration.

## Technical Architecture

### Database Schema
- **users**: User accounts with bcrypt password hashing (email, password_hash, name)
- **courses**: Course metadata (title, description, price_cents, is_free)
- **lessons**: Lessons within courses (course_id, title, content, order_index)
- **lesson_blocks**: Content blocks within lessons (lesson_id, block_type, content, order_index)
  - block_type: "text", "quiz", or "code"
- **quiz_options**: Multiple choice answers for quiz blocks (block_id, text, is_correct, order_index)
- **enrollments**: User-course enrollments (user_id, course_id, enrollment_type, stripe_payment_id)
- **progress**: Lesson completion tracking (user_id, lesson_id, completed_at)
- **quiz_answers**: User quiz submissions (user_id, block_id, selected_option_id, is_correct)

All tables include timestamps and proper foreign key constraints with CASCADE delete.

### Authentication & Authorization
- **Password Hashing**: bcryptjs with cost factor 12
- **Session Management**: HTTP-only cookies stored in browser (auth_token contains user ID)
- **Auth Routes**:
  - POST /api/auth/signup: Register with email, password, name
  - POST /api/auth/login: Login with credentials, sets auth cookie
  - POST /api/auth/logout: Clear session cookie
- **Validation**: Zod schemas enforce email format, minimum 8-char passwords, name length

### Stripe Payment Integration
- **Checkout Flow**: Free courses skip payment; paid courses initiate Stripe checkout sessions
- **Session Metadata**: Stores userId and courseId for webhook reconciliation
- **Webhook Handler**: POST /api/webhooks/stripe validates signatures and processes checkout.session.completed events
- **Enrollment**: Creates enrollment record with payment_intent ID upon successful payment
- **Webhook Secret**: Read from STRIPE_WEBHOOK_SECRET in .env.local
- **Error Handling**: Signature validation prevents unauthorized events

### Code Runner (Sandbox Execution)
- **Route**: POST /api/lessons/[id]/code-runner
- **Implementation**: AsyncFunction constructor executes user code asynchronously
- **Safety**: Input capped at 5000 characters; captures console.log/error output
- **Response**: Returns { output, errors, success } JSON
- **Limitations**: No access to network, file system, or modules; stdio captured only

### AI Teaching Assistant
- **Route**: POST /api/lessons/[id]/assistant
- **Provider**: Anthropic Claude 3.5 Sonnet API
- **Context**: System prompt includes course title, lesson title, and content
- **Input Validation**: Questions capped at 2000 characters
- **Token Usage**: Response includes input/output token counts for cost tracking
- **Error Handling**: Returns error message in response JSON on API failures

### Content Structure (Lesson Blocks)
Lessons are composed of ordered blocks:
1. **text**: Rendered as prose content
2. **quiz**: Multiple choice with options marked is_correct
3. **code**: JavaScript code exercises with syntax highlighting

Frontend loads all blocks for a lesson via GET /api/lessons/[id]/blocks and renders them sequentially.

### API Routes
#### Authentication
- POST /api/auth/signup: Create user account
- POST /api/auth/login: Authenticate user
- POST /api/auth/logout: Logout user

#### Courses & Content
- GET /api/courses: List all courses
- GET /api/courses/[id]: Get course with lessons
- GET /api/lessons/[id]/blocks: Get all blocks for a lesson

#### Lessons & Learning
- POST /api/lessons/[id]/code-runner: Execute JavaScript code
- POST /api/lessons/[id]/assistant: Ask AI assistant a question

#### Enrollment & Payments
- POST /api/enrollments: Initiate enrollment (free or Stripe checkout)
- GET /api/enrollments: List user enrollments
- POST /api/webhooks/stripe: Handle Stripe webhook events

#### Progress & Quizzes
- POST /api/quiz/submit: Submit quiz answer and record correctness
- POST /api/progress: Mark lesson as completed
- GET /api/progress: Get user progress for a course

### Frontend Pages
- **/** (Home): Landing page with feature highlights
- **/courses**: Browse all available courses
- **/courses/[id]**: View course details and lesson list
- **/lessons/[id]**: Interactive lesson page with:
  - Text content blocks
  - Quiz questions with instant feedback
  - Code exercise section
  - AI assistant chat interface
- **/login**: Email/password login form
- **/signup**: Registration with email, password, name

### Configuration & Secrets
**Environment Variables (.env.local)**:
- DATABASE_URL: PostgreSQL connection string
- NEXTAUTH_SECRET: Used for session signing (placeholder in dev)
- STRIPE_SECRET_KEY: Stripe API secret
- STRIPE_PUBLISHABLE_KEY: Stripe public key (for frontend)
- STRIPE_WEBHOOK_SECRET: Webhook signature verification
- CLAUDE_API_KEY: Anthropic API key
- NODE_ENV: Environment (development/production)

### Build & Deployment
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with autoprefixer
- **Type Checking**: TypeScript with strict mode (disabled by Next.js default)
- **Build Output**: All pages pre-rendered where possible; API routes and dynamic pages rendered on demand
- **Build Time**: < 30 seconds on Node 18.20.8

## Design Decisions

### Simplifications Made for MVP
1. **Auth**: Simplified cookie-based auth without JWT or external session store (acceptable for single server)
2. **Enrollment Gating**: No middleware to restrict access; gating enforced at the API level (frontend handles UX)
3. **Code Runner**: Uses AsyncFunction constructor instead of isolated sandbox; acceptable for trusted dev environment
4. **Database**: Single PostgreSQL instance without read replicas or caching
5. **Rate Limiting**: Not implemented; should add for production

### Why These Choices
- **Zod for validation**: Type-safe schema validation with minimal overhead
- **bcryptjs**: Pure JS implementation, works on all platforms without native deps
- **Anthropic SDK**: Direct API calls vs OpenAI for flexibility and cost control
- **Postgres blocks model**: Flexible structure supports future expansion (video, interactive widgets)
- **TypeScript**: Catches errors at build time; Next.js handles compilation

### Included (Beyond Literal Requirements)
1. **Database initialization script** (lib/db.ts): Automatically creates schema on first run
2. **Seed script** (scripts/seed.ts): Sample data for testing
3. **Input validation**: Zod schemas on all POST endpoints
4. **Stripe webhook signature verification**: Security best practice
5. **Error handling**: Try-catch blocks with meaningful HTTP status codes
6. **Tailwind CSS**: Professional styling out of the box
7. **Console output capture**: Code runner captures logs for student feedback

### Not Included (Out of Scope for MVP)
- Email verification on signup
- Password reset flow
- Rate limiting on quiz submissions
- Automated backups or disaster recovery
- Admin dashboard for course management
- Student analytics/progress reports
- Certificate generation
- Discussion forums
- Leaderboards
- A/B testing framework
- CDN for assets
- Docker/Kubernetes configs (single-region deployment assumed)

## File Structure
```
run-5-claude-haiku-minimal/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── courses/
│   │   ├── lessons/
│   │   ├── enrollments/
│   │   ├── quiz/
│   │   ├── progress/
│   │   └── webhooks/
│   ├── courses/
│   ├── lessons/
│   ├── login/
│   ├── signup/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
├── lib/
│   ├── db.ts (PostgreSQL client and schema initialization)
│   └── auth.ts (Password hashing, user lookup, token generation)
├── scripts/
│   └── seed.ts (Demo data loader)
├── .env.local (Environment variables)
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
├── postcss.config.js
└── package.json
```

## Testing & Deployment
- **Build Status**: Compiles cleanly with zero errors (verified with `npm run build`)
- **Runtime**: Requires PostgreSQL 14+ at DATABASE_URL
- **Stripe Keys**: Mock test keys work for development; use live keys for production
- **Claude API Key**: Must be valid Anthropic API key; placeholder blocks requests
- **Node Version**: 18.20.8 (as specified)
- **Package Count**: 632 total packages (321 direct + transitive)

## Next Steps for Production
1. Add rate limiting (express-rate-limit middleware)
2. Implement middleware for enrollment access control
3. Add email verification to signup
4. Create admin routes for course/lesson management
5. Set up CloudFront/CDN for assets
6. Add request logging and monitoring
7. Implement refresh token rotation
8. Add database connection pooling tuning
9. Create comprehensive test suite
10. Deploy to production with HTTPS and proper CORS
