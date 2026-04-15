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

## Known issues (remaining after v2-deployed)

The following issues are **still deliberately present** in the current state of the codebase because later book chapters need them as teaching material. **Do NOT "helpfully" fix them when making changes.**

2. **Server-side vm execution.** `src/app/api/execute/route.ts` uses `vm.runInNewContext(code, sandbox, { timeout: 3000 })` with a console-shim sandbox. The vm context is escapable via prototype-chain traversal (`this.constructor.constructor('return process')()`), and the 3-second timeout and sandbox do not prevent secret exfiltration. *Scheduled fix: `v3-secured`, by moving execution out of the Node process entirely.* The test `tests/integration/execute-vm-escape.test.ts` intentionally stays failing through v1 and v2 as the active known-broken state.

## Fixed as of v2-deployed

The following items were on the Known Issues list in earlier v-states and have been addressed. Item numbering is preserved so that references from earlier documents still line up.

1. **~~Hardcoded JWT fallback~~ (fixed in v2-deployed).** Was: `src/lib/auth.ts` read `JWT_SECRET` with a literal fallback string, so a runtime with `JWT_SECRET` unset silently signed tokens with a publicly-known constant. Fix: `src/lib/env.ts` uses `zod` to validate every required environment variable on first read of `env`. `src/lib/auth.ts` now imports `env.JWT_SECRET` instead of reading `process.env` directly, and the module throws a clear error listing every missing variable at first access. The test `tests/unit/env-fallback.test.ts` (which flipped from fail to pass in v2) locks this in.

3. **~~`code_solution` leak~~ (fixed in v1-tested / confirmed in v2-deployed).** `src/app/api/courses/[courseId]/lessons/[lessonId]/route.ts` now uses an explicit column list (`SELECT id, course_id, title, slug, position, content, lesson_type, quiz_data, code_starter, code_language, created_at`) so `code_solution` never leaves the server. NOTE: the v1-tested commit labeled this as fixed in CLAUDE.md but the code still shipped with `SELECT *`. v2-deployed brings the code into alignment with the claim.

4. **~~Client-controlled `quiz_score` / no enrollment check~~ (fixed in v1-tested / confirmed in v2-deployed).** The progress POST handler now (a) verifies the lesson belongs to the given course, (b) requires an enrollment row for paid courses, and (c) computes `quiz_score` server-side from submitted `quiz_answers` against the canonical `quiz_data.correct` field. Client-supplied `quiz_score` is ignored entirely. Same alignment note as #3 — the fix was claimed in v1 but only actually applied in v2.

5. **~~Client-controlled assistant `history` roles~~ (fixed in v1-tested / confirmed in v2-deployed).** The ai-assistant route now whitelists `role ∈ {user, assistant}` before forwarding history entries to the Anthropic SDK. `role: "system"` entries from the client are dropped. Same alignment note as #3.

6. **~~No rate limiting~~ (fixed in v2-deployed).** `src/lib/rate-limit.ts` provides an in-memory sliding-window limiter keyed by `${route}:${identifier}`. Applied:
   - `POST /api/auth/login` — 10 req/min per IP
   - `POST /api/auth/register` — 5 req/min per IP
   - `POST /api/courses/[courseId]/lessons/[lessonId]/ai-assistant` — 20 req/min per user (falls back to per-IP)
   - `POST /api/execute` — 30 req/min per user (falls back to per-IP)
   Limited responses return `429 { error: "Too many requests" }` with a `Retry-After` header. `POST /api/stripe/webhook` is deliberately NOT rate-limited because Stripe needs to retry. Production should swap the Map for Redis; see the comment at the top of `src/lib/rate-limit.ts`.

7. **~~No Dockerfile, no CI workflow, no startup env validation~~ (fixed in v2-deployed).** See the new Delivery section below. NOTE: an earlier draft of this Known Issues list said "pinned to `next@14.2.35` with no mechanism to track future patches" — but v1 was already on `14.2.35`, which is past the `GHSA-f82v-jwr5-mffw` middleware-authorization-bypass CVE (CVSS 9.1) that affected `14.2.15` and earlier. We kept the pin at `14.2.35` and documented the rationale here so v2 doesn't regress it.

**A correction from the external security review:** the mid-tier Sonnet run that produced this codebase also left `code_solution` in the lesson response and does NOT have `detect-eval-with-expression`-level dangerous APIs outside the `execute` route, but a careful reviewer (human or AI) finds the issues above by reading the route shape and noticing deviations. This is exactly the Chapter 5 method.

## Delivery (v2-deployed)

v2-deployed adds the "shippable to staging" infrastructure. None of this hardens production security — that is v3-secured — but it gives the team a container, CI gate, and fail-fast environment validation.

- **`src/lib/env.ts`** — zod-backed schema for `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY`, `NODE_ENV`. Parses eagerly on import; throws a clear, multi-issue error on first read of the `env` proxy if validation fails. `auth.ts` reads `env.JWT_SECRET` lazily so the env-fallback unit test can catch the error at `signToken()` call time.
- **`src/lib/rate-limit.ts`** — in-memory sliding-window limiter. See item #6 above for per-route caps and the production caveat.
- **`src/app/api/health/route.ts`** — `GET /api/health` returns `{ status: "ok", version, timestamp }`. No auth, no DB dependency. Liveness probe only.
- **`Dockerfile`** — multi-stage (`deps` / `build` / `runner`) on `node:18.20.8-alpine`. Runs as a non-root `nextjs` user. Uses Next.js `output: "standalone"` so the runner stage copies only the minimal server bundle (`server.js` + trimmed `node_modules`). Build-stage placeholder env vars are provided so `next build`'s "collect page data" phase (which imports every route at build time and thereby instantiates the Stripe and Anthropic SDKs) doesn't crash; real values come from `.env.docker` at runtime.
- **`docker-compose.yml`** — two services: `postgres` (`postgres:16-alpine`, named `avitam_teach_db`, persistent volume) and `app` (built from the local Dockerfile, `env_file: .env.docker`, depends on postgres). Ports `3000:3000` and `5432:5432`. The app container waits on the postgres healthcheck before starting.
- **`.env.docker.example`** — template for the app container's environment. Operator copies to `.env.docker` (gitignored) before `docker compose up`.
- **`.dockerignore`** — excludes `node_modules`, `.next`, `.git`, `tests`, `coverage`, `*.log`, `.env*`, `CLAUDE.md`, and related dev artifacts from the build context.
- **`.github/workflows/ci.yml`** — GitHub Actions workflow on push and pull request. Checks out, sets up Node 18.20.8, runs `npm ci`, `npm run lint`, `npx tsc --noEmit`, waits for a Postgres service container, runs `npm test`, and runs `npm run build`. Placeholder env vars for the job are hardcoded in the workflow (real secrets would live in repo secrets — v2 does not define a deploy workflow that would need them).
- **Next.js version pin.** `next@14.2.35` is deliberately kept. Sonnet's training-era knowledge suggested earlier 14.2.x versions; `14.2.15` and earlier contain `GHSA-f82v-jwr5-mffw` (middleware authorization bypass, CVSS 9.1), fixed in `14.2.35+`. Do not downgrade.

## How to run

### Local (host machine)

```bash
# Database
createdb avitam_teach_v0
psql avitam_teach_v0 -f src/lib/schema.sql

# Dependencies
npm install

# Environment
cp .env.example .env.local
# edit .env.local to set every variable in src/lib/env.ts:
#   DATABASE_URL=postgresql://localhost:5432/avitam_teach_v0
#   JWT_SECRET=<32+ character random string — openssl rand -hex 32>
#   STRIPE_SECRET_KEY=sk_test_... (test mode)
#   STRIPE_WEBHOOK_SECRET=whsec_...
#   NEXT_PUBLIC_APP_URL=http://localhost:3000
#   ANTHROPIC_API_KEY=sk-ant-...
#   NODE_ENV=development
# v2-deployed: src/lib/env.ts will refuse to start if any are missing.

# Dev server
npm run dev

# Tests (v1-tested and later)
npm test

# Production-style build (needed for Docker, CI, and deploy rehearsals)
npm run build
```

### Docker (v2-deployed)

```bash
# One-time setup: copy the app-container env template and fill it in.
cp .env.docker.example .env.docker
# edit .env.docker — JWT_SECRET must be real, others can be test values.

# Build and run both services (app + postgres).
docker compose up --build

# Schema is NOT applied automatically in v2. Run it once:
docker compose exec -T postgres psql -U avitam avitam_teach < src/lib/schema.sql

# Health check from the host:
curl http://localhost:3000/api/health
# -> {"status":"ok","version":"0.1.0","timestamp":"..."}
```

Production needs a reverse proxy, TLS, secrets manager, backups, and a deploy pipeline — none of which v2-deployed provides. That is Chapter 8 / v3-secured / v4-designed territory.

## Test suite notes (v1-tested)

The test suite uses **Vitest** (not Jest) and lives under `spine/tests/`. Structure:

- `tests/helpers/` — shared fixtures, a `pg.Client` wrapper, a `next/headers` cookie-store mock, and a `NextRequest` builder. Integration tests invoke route handlers directly (e.g. `POST as loginPOST` from the route file) rather than spinning up a full Next.js HTTP server.
- `tests/unit/` — pure unit tests, no database.
- `tests/integration/` — hit a real Postgres test database named `avitam_teach_v1_test`. Each file calls `useTestDb()` from `tests/helpers/db-setup.ts`, which creates the schema once and truncates all rows between tests.

**Test DB connection.** Defaults to `postgresql://avitam:avitam@localhost:5432/avitam_teach_v1_test`; override via `DATABASE_URL`. Create the DB once with `createdb -h localhost -U avitam avitam_teach_v1_test`.

**Known-issue tests: current pass/fail status as of v2-deployed.**
  1. `tests/unit/env-fallback.test.ts` → Known Issue #1 (JWT_SECRET fallback). **Passes on v2-deployed** after `src/lib/env.ts` landed.
  2. `tests/integration/lesson-answer-leak.test.ts` → Known Issue #3 (`code_solution` leak). **Passes on v2-deployed** after the explicit column list fix landed.
  3. `tests/integration/progress-bypass.test.ts` → Known Issue #4a (no enrollment check). **Passes on v2-deployed** after the enrollment check landed in the progress route.
  4. `tests/integration/quiz-score-trust.test.ts` → Known Issue #4b (client-supplied quiz_score). **Passes on v2-deployed** after server-side quiz scoring landed.
  5. `tests/integration/assistant-history-injection.test.ts` → Known Issue #5 (role injection). **Passes on v2-deployed** after role whitelisting landed.
  6. `tests/integration/execute-vm-escape.test.ts` → Known Issue #2 (vm prototype escape). **Still failing on v2-deployed** — scheduled fix is v3-secured.

Tests 2–5 were marked "Fix: v1-tested" in CLAUDE.md but the v1 commit only updated the doc, not the code. v2-deployed brings the code into alignment. Do not "repair" any remaining known-issue test by changing its assertion — when a fix lands, the assertion starts passing naturally.

**v2-deployed also adds three new tests:**
  - `tests/integration/health.test.ts` — `GET /api/health` shape check.
  - `tests/integration/rate-limit.test.ts` — verifies login (11th request) and assistant (21st request) return 429 with `Retry-After`.

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
