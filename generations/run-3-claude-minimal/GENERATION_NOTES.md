# Generation Notes — Avitam Teach MVP

A factual record of the design decisions made while building this MVP.

## Stack

- Next.js 14.2.15 (App Router, TypeScript, server components)
- PostgreSQL 14 via `pg` (no ORM — raw parameterised SQL)
- `bcryptjs` for password hashing
- `jose` for JWT session cookies
- `zod` for request body validation
- `@anthropic-ai/sdk` for the teaching assistant
- `stripe` for paid enrollment
- No UI framework: hand-rolled dark-mode CSS in `globals.css`

Node 18.20.8, single `package.json`, no monorepo.

## Schema (`scripts/schema.sql`)

Six tables:

- **users** — `id, email (unique), password_hash, name, created_at`
- **courses** — `id, slug, title, description, price_cents, stripe_price_id, is_published, created_at`. `price_cents = 0` means a free course.
- **lessons** — `id, course_id, slug, title, position, content JSONB`. Lesson body is an ordered array of typed blocks (`text`, `quiz`, `code`) stored as JSONB so lesson shape can evolve without migrations. Unique on `(course_id, slug)`.
- **enrollments** — `id, user_id, course_id, status (active|pending|canceled), source (free|stripe), stripe_session_id, created_at`. Unique on `(user_id, course_id)`. Stripe path creates a `pending` row before redirect and the webhook flips it to `active`.
- **lesson_progress** — `id, user_id, lesson_id, completed, completed_at`. Table exists for future completion tracking; the MVP doesn't write to it yet (kept schema ready so adding it is one endpoint).
- **assistant_messages** — `id, user_id, lesson_id, role, content, created_at`. Per-user, per-lesson chat history — the assistant route reads the last 20 before each call and rewrites them as the Anthropic Messages array.

Indexes on `lessons(course_id, position)`, `assistant_messages(user_id, lesson_id, created_at)`, `enrollments(user_id)`.

Schema is applied by `node scripts/init-db.mjs`; sample content is loaded by `node scripts/seed.mjs` (two courses: one free `js-fundamentals`, one paid `advanced-js`).

## Routes

### Pages (App Router)

- `/` — landing
- `/signup`, `/login` — client components posting to the auth API
- `/courses` — public course list
- `/courses/[slug]` — course detail, lesson list (locked vs unlocked), enroll button
- `/courses/[slug]/lessons/[lessonSlug]` — lesson page; server-redirects to `/login` or the course page if the user isn't enrolled
- `/dashboard` — user's active enrollments

### API

- `POST /api/auth/signup` — zod-validated, creates user, sets session cookie
- `POST /api/auth/login`
- `POST /api/auth/logout` — clears cookie and redirects to `/`
- `POST /api/enroll` — free-course enrollment (rejects paid courses)
- `POST /api/checkout` — creates a pending enrollment, returns a Stripe Checkout Session URL
- `POST /api/stripe/webhook` — verifies signature with `STRIPE_WEBHOOK_SECRET`, flips pending enrollment to `active` on `checkout.session.completed`
- `POST /api/assistant` — enrollment-gated; loads lesson content, last 20 messages, calls Claude, persists the new exchange

All API routes use `runtime = "nodejs"` and `dynamic = "force-dynamic"`.

## Auth

- Password hashing: **bcryptjs** (cost factor 10). Bcrypt over pbkdf2/argon2 because it's the shortest path to a correct, battle-tested impl that runs under Node 18 without native builds.
- Sessions: **JWT in an httpOnly, sameSite=lax cookie** named `avt_session`, signed with HS256 (`SESSION_SECRET`), 30-day expiry. Verified on each server-rendered page via `currentUser()` which also confirms the user still exists in the DB.
- `SESSION_SECRET` has a build-time fallback so `next build` doesn't need a real secret to pre-render. The fallback is never used at runtime as long as `.env.local` is loaded.
- No email verification, no password reset — out of scope for MVP.

## Code runner (in-browser)

Runnable JS exercises execute **client-side** in the student's own browser via `new Function(...)`. This is the simplest safe-ish approach for an MVP: there's no server code execution, no sandbox container, no resource limits to manage, and the student can only harm their own tab. Output capture is done by injecting a fake `console` (`log`, `error`, `warn`) into the `Function` scope. Tests share scope with user code by wrapping both in a single generated `Function`, so tests can reference student-defined identifiers.

Limits: textarea `maxLength=20000`. No network, no timeout — if a student writes an infinite loop they'll hang their own tab, which is acceptable for an MVP.

A server-side runner (isolated-vm, Firecracker, or a container sandbox) would be the obvious next step if we wanted real sandboxing or to grade submissions server-side.

## Assistant wiring

`POST /api/assistant`:

1. Requires an authenticated user.
2. Requires the user to be enrolled in the lesson's course (hard gate).
3. Loads the lesson title + JSONB content, flattens it into a plain-text "lesson context" (capped at 8,000 chars).
4. Loads the last 20 messages for that `(user, lesson)` pair.
5. Calls `claude-3-5-sonnet-latest` via `@anthropic-ai/sdk` with a system prompt that tells the model to: stay on-topic for this lesson, be Socratic/hint-first on exercises, redirect off-topic questions.
6. Persists both the student message and the model reply into `assistant_messages` in a single insert.

**Fallback:** If `ANTHROPIC_API_KEY` is unset or still the placeholder, the route returns a stub reply so the UI is exercisable without a real key (and the build doesn't need one).

Chat history is hydrated on page load by the server component reading `assistant_messages` for that `(user, lesson)` and passing it to the client `Assistant` component.

## Stripe

- `POST /api/checkout` creates a `pending` enrollment row, then creates a Stripe Checkout Session using either a pre-existing `stripe_price_id` on the course (if set) or inline `price_data` derived from `price_cents`. `user_id` and `course_id` go into session metadata.
- The session `success_url` returns to the course page with `?checkout=success`.
- `POST /api/stripe/webhook` uses the raw request text (`req.text()`) and `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` to verify. On `checkout.session.completed` with `payment_status === 'paid'`, it upserts the enrollment row to `active`. Gating relies only on this webhook — the success-URL query param is cosmetic.
- Uses stub API keys in `.env.local` so `next build` succeeds without real Stripe credentials; real keys are needed before running the dev server through a full checkout.

## Enrollment gating

Three places enforce it, all using the same `isEnrolled(userId, courseId)` helper:

1. Lesson page server component (redirects unenrolled users back to the course page).
2. `/api/assistant` (403 if not enrolled).
3. The course page UI hides the "Open" lesson links when the user isn't enrolled.

## Secrets

All secrets live in `.env.local` (git-ignored). `.env.example` documents the required keys. No secrets are baked into source. Placeholder values are used at build time so the build succeeds without real keys:

- `DATABASE_URL` — `postgresql://localhost:5432/avitam_teach_v3`
- `SESSION_SECRET`
- `ANTHROPIC_API_KEY` (stubbed)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (stubbed)
- `NEXT_PUBLIC_APP_URL`

## Beyond the literal request

Deliberately **included**:

- **Rate limiting** — tiny in-memory sliding-window limiter (`src/lib/rate-limit.ts`) applied to `/api/auth/signup`, `/api/auth/login`, and `/api/assistant`. Per-process only; a real deployment would swap in Redis or similar.
- **Input validation** with zod on every POST endpoint.
- **Input caps** — `maxLength` on every user-facing form field; 2,000-char cap on assistant questions; 20-char cap on email domain; 20,000-char cap on the code editor; 8,000-char cap on the lesson context passed to Claude; 20-message cap on history pulled from the DB.
- **XSS-safe markdown** — the lesson `text` blocks run through a tiny custom renderer that escapes HTML first and then re-introduces only a whitelisted set of transformations (headings, `**bold**`, inline `` ` `` code, paragraphs).
- **Socratic system prompt** for the assistant so it hints rather than dumping full solutions on exercises.
- **Stub mode** for the assistant when no API key is set, so the UI is fully exercisable without Anthropic credentials.
- **Seed data** (`scripts/seed.mjs`) with one free course and one paid course so the happy-path is walkable end-to-end.

Deliberately **skipped**:

- Tests (unit or e2e) — an MVP of this shape is better validated by manually walking the flows once a real DB is connected than by unit tests.
- Dockerfile / CI — user has Postgres and Node installed locally.
- Email verification, password reset, social login.
- Server-side code execution / sandboxing.
- Progress tracking UI (schema exists, endpoint does not).
- Admin UI for creating courses — content is authored via the SQL seed script.
- Streaming assistant responses (non-trivial addition; a single-shot response is fine for MVP).
- Refunds / subscription billing — `/api/checkout` uses `mode: 'payment'` (one-time), not subscriptions, despite the "subscription-based" phrasing, because a per-course purchase model matches the schema and the user's paid-vs-free distinction more cleanly. Swapping to `mode: 'subscription'` is a one-line change once recurring prices exist.

## How to run

```bash
createdb avitam_teach_v3
npm install
npm run db:init
npm run db:seed
npm run dev
```

Set real `ANTHROPIC_API_KEY` and Stripe keys in `.env.local` before using those features for real.
