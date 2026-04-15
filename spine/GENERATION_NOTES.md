# Generation Notes — run-4-claude-sonnet-minimal

## Schema

Six tables in PostgreSQL 14:

- **users** — id, email (unique), password_hash, name, stripe_customer_id, created_at
- **courses** — id, slug (unique), title, description, price_cents (0 = free), image_url, published, created_at
- **lessons** — id, course_id, title, slug, position, content (markdown text), lesson_type (text|quiz|code), quiz_data (JSONB array of {id,question,options[],correct}), code_starter, code_solution, code_language, created_at
- **enrollments** — id, user_id, course_id, stripe_payment_intent_id, enrolled_at; UNIQUE(user_id, course_id)
- **lesson_progress** — id, user_id, lesson_id, completed, quiz_score, code_submission (capped at 10k chars), completed_at; UNIQUE(user_id, lesson_id)
- **stripe_events** — id (Stripe event id, PK), type, processed_at — used for idempotency

Schema SQL lives at `src/lib/schema.sql`. It includes seed data: 3 courses (1 free, 2 paid) and 3 lessons for the intro course (one of each type).

## Routes Built

**Auth API**
- POST /api/auth/register — validate, bcrypt hash, issue JWT cookie
- POST /api/auth/login — verify password, issue JWT cookie
- POST /api/auth/logout — clear cookie

**Courses API**
- GET /api/courses — list published courses; includes enrolled flag when authenticated

**Lessons API**
- GET /api/courses/[courseId]/lessons — list lessons; gated for paid courses
- GET /api/courses/[courseId]/lessons/[lessonId] — single lesson; gated
- POST /api/courses/[courseId]/lessons/[lessonId]/progress — upsert progress (completed, quiz_score, code_submission)
- POST /api/courses/[courseId]/lessons/[lessonId]/ai-assistant — AI assistant for lesson

**Enrollment API**
- POST /api/enrollments — free-course enrollment
- GET /api/enrollments — list user's enrolled courses with progress

**Stripe API**
- POST /api/stripe/checkout — create Stripe Checkout session, store/reuse Stripe customer
- POST /api/stripe/webhook — receive events, grant enrollment on checkout.session.completed

**Code execution API**
- POST /api/execute — run JS code in sandbox

**Pages**
- / — landing page
- /courses — course browser
- /courses/[courseId] — course detail with lesson list, enroll button, progress bar
- /courses/[courseId]/lessons/[lessonId] — lesson view with sidebar nav, content, interactive widgets, AI assistant
- /auth/login, /auth/register — auth forms
- /dashboard — enrolled courses with progress

## Password Hashing

bcryptjs with cost factor 12. Passwords validated: minimum 8 characters, email format checked server-side. Password hash never returned to client.

## Authentication

JWT (jsonwebtoken, 7-day expiry, HS256) stored in an HttpOnly, SameSite=lax cookie named `avitam_session`. No refresh token mechanism in MVP. Token is verified server-side via `getSession()` which reads the cookie in server components and API routes.

## Code Runner

Node.js built-in `vm` module (`runInNewContext`) with a 3-second timeout. The sandbox exposes only a limited `console` object (log, error, warn). Code is capped at 10,000 characters before being accepted. This is a lightweight sandbox adequate for a coding education context; a production deployment would use a proper isolated container (Firecracker/gVisor) or a managed code execution service.

## AI Assistant Route

`POST /api/courses/[courseId]/lessons/[lessonId]/ai-assistant` uses `@anthropic-ai/sdk` with model `claude-3-5-haiku-20241022` (fast, cost-effective). System prompt includes the lesson title, content (first 3k chars), and any code starter. Conversation history is accepted from the client (last 6 turns, to bound context). Response is capped at 512 tokens. The route verifies authentication and enrollment before calling the API.

## Stripe Webhooks

Webhook handler at `POST /api/stripe/webhook`:
1. Verifies Stripe signature using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.
2. Checks `stripe_events` table for idempotency — skips if already processed.
3. On `checkout.session.completed` + `payment_status === 'paid'`: inserts enrollment using `userId` and `courseId` from session metadata.
4. Records event in `stripe_events`.

Checkout session embeds `userId` and `courseId` in `metadata` so the webhook can grant access without a lookup by payment intent.

## Enrollment Gating

- Free courses: any authenticated user can enroll via POST /api/enrollments.
- Paid courses: checkout flow creates a Stripe Checkout session; enrollment is granted only after the webhook confirms payment.
- Lesson pages and API routes check enrollment status before returning lesson content for paid courses. Unauthenticated users are redirected to /auth/login.

## Where Secrets Live

`.env.local` (gitignored by Next.js default). Variables:
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — at least 32 chars for production
- `STRIPE_SECRET_KEY` — sk_live_... or sk_test_...
- `STRIPE_WEBHOOK_SECRET` — whsec_... from Stripe dashboard
- `ANTHROPIC_API_KEY` — sk-ant-...
- `NEXT_PUBLIC_APP_URL` — used in Stripe redirect URLs
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — not currently used client-side (server-side checkout flow)

## Beyond the Literal Request

- **Seeded sample data**: 3 courses and 3 lessons (one text, one quiz, one code) so the app is usable immediately after `psql < src/lib/schema.sql`.
- **Lesson progress tracking**: per-user completion state, quiz scores stored in DB, progress bar on course detail page.
- **Input caps**: code submissions capped at 10k chars; AI questions capped at 2k chars; code_submission stored truncated at 10k.
- **Idempotent Stripe webhook**: stripe_events deduplication table prevents double-enrollments on retried webhooks.
- **Basic markdown renderer**: inline renderer in the lesson page handles headers, bold, code blocks, inline code, tables — no external markdown library needed.
- **Stripe customer reuse**: first checkout creates a Stripe customer and stores the ID in users.stripe_customer_id; subsequent checkouts reuse it.

## What Was Omitted

- No tests (unit or integration) — added test infrastructure would double the build complexity for an MVP.
- No Dockerfile or CI — not needed for a local MVP.
- No rate limiting — a real deployment would add rate limiting in middleware or at the edge.
- No email verification or password reset flow.
- No admin interface for content management — courses/lessons are seeded via SQL.
- No image uploads — image_url column accepts external URLs.
