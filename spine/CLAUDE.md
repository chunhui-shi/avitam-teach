# avitam-teach spine — CLAUDE.md

This file is the orientation document for AI agents (Claude, other LLMs, Cursor, Claude Code, etc.) working on the avitam-teach spine codebase. It is read automatically by Claude Code and similar tools when they enter the repository. If you are an AI reading this before you make changes, **read this file before you read any code**.

## What this is

avitam-teach is a subscription-based online teaching platform for coding courses, built as the companion project for a Manning book about turning AI-generated code into production-ready engineering work. The spine codebase is deliberately imperfect — it was generated from scratch by Claude Sonnet 4.6 from a minimal feature-first prompt in April 2026, and it is the canonical `v0-naive` state that later chapters progressively transform into `v1-tested`, `v2-deployed`, `v3-secured`, and `v4-designed` through tagged commits.

The full research log, including the four independent AI-generated v0 variants and the external security review findings, lives at `../v0-generation-log.md`. Read it if you want to understand why specific decisions were made.

## Stack

- **Framework:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Database:** PostgreSQL, accessed through the raw `pg` driver (no ORM). Schema lives in `src/lib/schema.sql`.
- **Auth:** hand-rolled in `src/lib/auth.ts` — `bcryptjs` cost factor 12, JWT HS256 signed with `jsonwebtoken` (NOT `jose` — an earlier draft of this doc said `jose`; the actual dependency is `jsonwebtoken`). Exported helpers are `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, `getSession`, `createSessionCookie`. httpOnly / sameSite=lax cookies under the name `avitam_session`.
- **Payments:** Stripe test mode, with webhook signature verification via `stripe.webhooks.constructEvent`.
- **AI assistant:** direct Anthropic SDK call from one route (`src/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route.ts`).
- **Runtime:** Node 18.20.8.

## Architecture (one paragraph)

A single Next.js application. Twelve API route handlers live under `src/app/api/**/route.ts` and follow a consistent shape (described below). Database access goes through `src/lib/db.ts`, a ~15-line wrapper around `pg.Client` exposing `query()` and `queryOne()` helpers. Auth helpers are in `src/lib/auth.ts`. Stripe is in `src/app/api/stripe/{checkout,webhook}/route.ts`. The per-lesson AI assistant is at `src/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route.ts`. UI components live under `src/components/` and pages under `src/app/` (non-`api` routes). There is no background worker, no job queue, no Redis — everything runs in the Next.js process against Postgres.

## The route shape convention

**Every API route in this codebase follows the same four-step shape.** When you write a new route, match this shape. When you read a route, scan for all four steps — a missing step usually means a bug.

```ts
export async function POST(req: NextRequest) {
  // 1. Session check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Input validation
  const body = await req.json();
  // ... validate required fields, types, lengths ...

  // 3. Business logic
  // ... db query, external API call, etc. ...

  // 4. Response
  return NextResponse.json({ ... });
}
```

Routes that deviate from this shape are either (a) fixing a known issue, (b) adding a new step on purpose (e.g., a rate-limit middleware check in `v2-deployed`), or (c) a bug. Reviewer's job is to tell which.

## Conventions

- **SQL.** Parameterised via `pg`'s `$1, $2, $3` placeholders. Never interpolate user input into a query string. The `query()` and `queryOne()` helpers in `src/lib/db.ts` are the only database-access surface.
- **Errors.** Route handlers return `NextResponse.json({ error: "..." }, { status: N })`. They do not throw. Unhandled exceptions propagate to Next.js's default 500 handler, which is acceptable for a v0 MVP.
- **Session reads.** Always via `getSession()` from `src/lib/auth.ts`. Do not read cookies directly in route handlers. Do not re-decode JWTs outside of that helper.
- **Environment.** All secrets in `.env.local` (gitignored). `.env.example` documents required variables. The build should not require real secrets — placeholder values should let `npm run build` pass.
- **Types.** Shared types live in `src/types/index.ts`. Prefer importing from there over redeclaring inline interfaces.

## Known issues (v0-naive state, deliberately present)

The following issues are **deliberately present** in the `v0-naive` state because the book teaches readers to find and fix them. **Do NOT "helpfully" fix them when making changes.** They are the teaching material. Each is fixed in a specific later v-tag as the book's Part II chapters land.

1. **Hardcoded JWT fallback.** `src/lib/auth.ts` line 5: `const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production-min-32chars'`. If `JWT_SECRET` is unset at runtime, JWTs are signed with the literal fallback string. *Fixed in `v2-deployed` via startup env validation.*
2. **Server-side vm execution.** `src/app/api/execute/route.ts` uses `vm.runInNewContext(code, sandbox, { timeout: 3000 })` with a console-shim sandbox. The vm context is escapable via prototype-chain traversal (`this.constructor.constructor('return process')()`), and the 3-second timeout and sandbox do not prevent secret exfiltration. *Fixed in `v3-secured` by moving execution out of the Node process entirely.*
3. **`code_solution` leak.** `src/app/api/courses/[courseId]/lessons/[lessonId]/route.ts` uses `SELECT *` on the lessons table, returning the intended `code_solution` to every client that fetches the lesson. *Fixed in `v1-tested` via an explicit column list.*
4. **Client-controlled `quiz_score`.** `src/app/api/courses/[courseId]/lessons/[lessonId]/progress/route.ts` accepts `quiz_score` from the request body without server-side computation, and it accepts arbitrary `lessonId` without verifying enrollment. *Fixed in `v1-tested`.*
5. **Client-controlled assistant `history` roles.** `src/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route.ts` accepts a `history` array from the request body and forwards it to the Anthropic SDK without validating the `role` field. A client can inject `role: "system"` entries, bypassing the system prompt. *Fixed in `v1-tested`.*
6. **No rate limiting.** `/api/auth/login`, `/api/auth/register`, `/api/ai-assistant`, `/api/execute` are unthrottled. *Fixed in `v2-deployed` via middleware.*
7. **No Dockerfile, no CI workflow, no startup env validation, pinned to `next@14.2.35` with no mechanism to track future patches.** *Fixed in `v2-deployed`.*

**A correction from the external security review:** the mid-tier Sonnet run that produced this codebase also left `code_solution` in the lesson response and does NOT have `detect-eval-with-expression`-level dangerous APIs outside the `execute` route, but a careful reviewer (human or AI) finds the issues above by reading the route shape and noticing deviations. This is exactly the Chapter 5 method.

## How to run

```bash
# Database
createdb avitam_teach_v0
psql avitam_teach_v0 -f src/lib/schema.sql

# Dependencies
npm install

# Environment
cp .env.example .env.local
# edit .env.local to set:
#   JWT_SECRET=<any long random string>
#   DATABASE_URL=postgresql://localhost:5432/avitam_teach_v0
#   STRIPE_SECRET_KEY=sk_test_... (test mode)
#   STRIPE_WEBHOOK_SECRET=whsec_...
#   ANTHROPIC_API_KEY=sk-ant-...

# Dev server
npm run dev

# Tests (v1-tested and later)
npm test
```

## Test suite notes (v1-tested)

The test suite uses **Vitest** (not Jest) and lives under `spine/tests/`. Structure:

- `tests/helpers/` — shared fixtures, a `pg.Client` wrapper, a `next/headers` cookie-store mock, and a `NextRequest` builder. Integration tests invoke route handlers directly (e.g. `POST as loginPOST` from the route file) rather than spinning up a full Next.js HTTP server.
- `tests/unit/` — pure unit tests, no database.
- `tests/integration/` — hit a real Postgres test database named `avitam_teach_v1_test`. Each file calls `useTestDb()` from `tests/helpers/db-setup.ts`, which creates the schema once and truncates all rows between tests.

**Test DB connection.** Defaults to `postgresql://avitam:avitam@localhost:5432/avitam_teach_v1_test`; override via `DATABASE_URL`. Create the DB once with `createdb -h localhost -U avitam avitam_teach_v1_test`.

**Known-issue tests are expected to FAIL on v1.** Six of the tests target items on the Known Issues list above and assert the *desired* behaviour the fix will deliver. They fail with a diagnostic message naming the issue and the scheduled fix v-tag. Do not "repair" them by changing the assertion — when a fix lands, the assertion starts passing naturally. The six are:
  1. `tests/unit/env-fallback.test.ts` → Known Issue #1 (JWT_SECRET fallback). Fix: v2-deployed.
  2. `tests/integration/lesson-answer-leak.test.ts` → Known Issue #3 (`code_solution` leak). Fix: v1-tested (this chapter).
  3. `tests/integration/progress-bypass.test.ts` → Known Issue #4a (no enrollment check). Fix: v1-tested.
  4. `tests/integration/quiz-score-trust.test.ts` → Known Issue #4b (client-supplied quiz_score). Fix: v1-tested.
  5. `tests/integration/assistant-history-injection.test.ts` → Known Issue #5 (role injection). Fix: v1-tested.
  6. `tests/integration/execute-vm-escape.test.ts` → Known Issue #2 (vm prototype escape). Fix: v3-secured — stays failing through v1 and v2 as an active known-broken state.

**SDK mocking.** Tests that touch the Anthropic or Stripe SDKs use `vi.mock('@anthropic-ai/sdk', ...)` / `vi.mock('stripe', ...)` at the top of the file, *before* importing the route under test, so the route's module-load-time `new Anthropic(...)` / `new Stripe(...)` picks up the fake. No real API calls are made by the suite.

**Cookies.** Route handlers read the session via `cookies()` from `next/headers`, which only works inside the Next.js server runtime. Tests install an in-memory cookie store mock (`tests/helpers/mock-next-cookies.ts`) at the top of every integration test file that needs a session. Call `installCookieMock()` *before* importing any route/lib that transitively imports `next/headers`, then use `setCookie('avitam_session', signToken({...}))` to simulate an authenticated user.

## Things tried and rejected (do not re-propose)

- **ORM (Drizzle, Prisma).** Considered for v0, rejected. Raw `pg` + `schema.sql` keeps every query visible to the reader. An ORM would hide the SQL and make Chapter 5's reading exercise less instructive. Also, the project is small enough that an ORM adds dependency weight without earning it.
- **NextAuth.** Considered for v0, rejected in favor of hand-rolled JWT in ~50 lines. NextAuth is what a production app should use; hand-rolled is what a teaching app should use because it makes the mechanics visible.
- **Docker for v0.** Deliberately skipped. Introduced in `v2-deployed` as part of the Chapter 7 delivery discipline. The reader should experience the "it only runs on my laptop" stage before they experience the "we containerized it" stage.
- **A test framework at `v0-naive`.** Deliberately skipped. Tests arrive at `v1-tested` as part of the Chapter 6 teaching arc. The reader should see v0 with no tests at all, so they feel the contrast when v1 adds them.

## Agents working on this codebase

When making changes:

1. **Read this file first.** Do not skim. The known-issues list is load-bearing — if you "fix" something on the list you break the teaching.
2. **Respect the route shape convention.** Session → validate → business → response. If your change needs an additional layer, add it in a separate commit and update the Conventions section.
3. **Add tests before you change code** (once `v1-tested` exists). Modifying existing code without a test is a regression risk.
4. **Write for the next agent.** If you learn something about this codebase that this file does not say, add it here. This file is the channel between you and the agent that arrives after you.
5. **If you complete a v-state transition,** update the v-tag status in this file and document what changed and why. The transitions are how the book teaches; they must be legible after the fact.

## References

- **Research log:** `../v0-generation-log.md` — the full story of how v0 was produced and what five AI variants (Opus detailed, Opus minimal, Sonnet minimal, Haiku minimal, Gemini minimal) produced from the same prompt.
- **Security review:** `../generations/run-4-claude-sonnet-minimal/external-review-by-claude-sonnet.md` — a second Claude session's independent audit of this exact codebase. Most of the Known Issues list above comes from that review.
- **Spec:** `../../career-with-ai/proposal/avitam-teach-spec.md` — the original Phase 1 project specification.
