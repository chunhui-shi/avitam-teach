# avitam-teach spine — CLAUDE.md

This file is the orientation document for AI agents (Claude, other LLMs, Cursor, Claude Code, etc.) working on the avitam-teach spine codebase. It is read automatically by Claude Code and similar tools when they enter the repository. If you are an AI reading this before you make changes, **read this file before you read any code**.

## What this is

avitam-teach is a subscription-based online teaching platform for coding courses, built as the companion project for a Manning book about turning AI-generated code into production-ready engineering work. The spine codebase is deliberately imperfect — it was generated from scratch by Claude Sonnet 4.6 from a minimal feature-first prompt in April 2026, and it is the canonical `v0-naive` state that later chapters progressively transform into `v1-tested`, `v2-deployed`, `v3-secured`, and `v4-designed` through tagged commits.

The full research log, including the four independent AI-generated v0 variants and the external security review findings, lives at `../v0-generation-log.md`. Read it if you want to understand why specific decisions were made.

## Stack

- **Framework:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Database:** PostgreSQL, accessed through the raw `pg` driver (no ORM). Schema lives in `src/lib/schema.sql`.
- **Auth:** hand-rolled in `src/lib/auth.ts` — `bcryptjs` cost factor 12, JWT HS256 signed with `jsonwebtoken` (NOT `jose` — an earlier draft of this doc said `jose`; the actual dependency is `jsonwebtoken`). Exported helpers are `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, `getSession`, `createSessionCookie`. Session cookie: httpOnly + sameSite=**strict** (v3-secured; previously lax) + secure:true in production + `__Host-avitam_session` name in production / `avitam_session` in dev/test.
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

## Known issues (remaining after v3-secured)

The following issues are **still deliberately present** in the current state of the codebase because later book chapters need them as teaching material. **Do NOT "helpfully" fix them when making changes.**

_(None remaining from the original 14-flaw list. v3-secured closes the last item, Known Issue #2. Future v-states address design/UX — v4-designed — rather than new security items. See the v3-secured "Known limitations" section below for security work that is intentionally deferred.)_

## Fixed as of v3-secured

2. **~~Server-side vm execution~~ (fixed in v3-secured).** Was: `src/app/api/execute/route.ts` used `vm.runInNewContext(code, sandbox, { timeout: 3000 })` inside the Next.js process. The context was escapable via prototype-chain traversal (`this.constructor.constructor('return process')()`), letting any authenticated user read any environment variable — including every secret in `src/lib/env.ts`. Fix: an out-of-process runner. `src/lib/code-runner.ts` now `spawn`s a fresh `node` process with `env: {}`, pipes the user code over stdin, enforces a 3-second wall-clock timeout via `SIGKILL`, and caps output at 64 KiB. Even if the child's vm is escaped, the process environment is empty — there is nothing to steal. The route shape in `src/app/api/execute/route.ts` is preserved (session → validate → business → response). The test `tests/integration/execute-vm-escape.test.ts` **now passes**.

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

## Security (v3-secured)

v3-secured is the Chapter 7 teaching surface. Four changes landed, plus an audit pass that documents what did not need to change.

### 1. Out-of-process code runner — the centerpiece

`src/lib/code-runner.ts` + `src/app/api/execute/route.ts`. The vm sandbox escape was never fixable at the function level. We replaced the in-process runner with `child_process.spawn(node, ['-e', runner], { env: {}, cwd: '/tmp', stdio: 'pipe' })`. Key properties:

- The child process has an **empty environment** (`env: {}`), so a prototype-chain escape finds nothing worth exfiltrating. This is the actual defense, not the vm's `timeout:` option.
- Wall-clock timeout is enforced by the parent with `SIGKILL` after 3 seconds. The child does not own the deadline.
- Output size is capped at 64 KiB combined stdout+stderr. A `while(true) console.log('x')` is killed, not buffered to OOM.
- Response shape is preserved (`{ output, errors, runtimeError, result }`) so the `CodeEditor` UI and `execute-auth` test continue to work without change.
- Route shape is preserved (session → rate limit → input validation → business → response).

Reading order for a new engineer: read `src/app/api/execute/route.ts` first (the shape stays legible in 2 minutes), then `src/lib/code-runner.ts` for the runner itself. The inline runner source is kept as a string constant so the sandbox and the process boundary are both visible in one file.

Trade-off documented in comments: spawning a node process costs ~50–150ms. Fine for a "Run code" button; a production coding platform at high QPS would pool pre-warmed workers or use `isolated-vm` / a container. The teaching point is that the architectural fix is simple once you accept that the function-level patches all fail.

### 2. Prompt-injection defenses on the AI assistant route

`src/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route.ts`:

- **System prompt hardening.** Explicitly names scope, tells the model to refuse requests to reveal the system prompt or any environment variable / secret / key, and to refuse "ignore previous instructions" style attacks.
- **Input caps.** `MAX_QUESTION_CHARS = 2000`, `MAX_HISTORY_TURNS = 6`, `MAX_HISTORY_MESSAGE_CHARS = 2000`. Over-long questions → 400. History messages are clipped per-message before forwarding (so an attacker cannot smuggle a giant payload via the history channel that the per-message filter misses).
- **Output cap.** `MAX_OUTPUT_TOKENS = 512` on the outbound `messages.create` call.
- **Output filtering.** `redactSecrets()` scans the model response for env-var-name patterns (`*SECRET*`, `*API_KEY*`, `*_TOKEN`, explicit names like `DATABASE_URL` / `JWT_SECRET` / `ANTHROPIC_API_KEY`) and live-key shapes (`sk-ant-…`, `sk_test_…`, `sk_live_…`), replacing matches with `[REDACTED]`. This is the last line of defense — if the model is tricked into leaking something, the route scrubs it before it reaches the client.
- **Regression guard.** Role whitelisting from v1-tested (Known Issue #5) is preserved and covered by both the v1 test and the new prompt-injection test suite.

Test: `tests/integration/assistant-prompt-injection.test.ts` (8 cases) mocks the Anthropic SDK to deterministically verify each of the above.

### 3. Session cookie hardening

`src/lib/auth.ts`:

- `httpOnly: true` — kept.
- `sameSite: 'strict'` — tightened from `'lax'`. No legitimate cross-site flow in this app authenticates via top-level navigation (Stripe Checkout is a redirect OUT; the Stripe webhook is signature-verified server-to-server). This is the baseline CSRF defense for every state-changing route.
- `secure: true in production` — kept. Dev / localhost keeps `secure: false` so http:// still works.
- `__Host-avitam_session` cookie name prefix in production — added. The browser refuses any attempt to set this cookie with a `Domain` attribute or a non-root `Path`, which blocks sub-domain cookie confusion attacks on a shared-domain deploy. In dev/test the plain `avitam_session` name is kept so tests and the cookie mock continue to work.
- Session lifetime — kept at 7 days. Shorter would churn users without meaningful security gain given the httpOnly + sameSite=strict combination. Production would pair this with server-side revocation (out of scope for the teaching spine).

### 4. SQL injection audit

Every `query()` / `queryOne()` call in `src/**` was inspected. Result: **zero string-concatenation queries.** All of them use `pg`'s `$1, $2` placeholders. The full call sites audited:

- `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`
- `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`
- `src/app/api/enrollments/route.ts`
- `src/app/api/courses/route.ts`, `src/app/api/courses/[courseId]/lessons/route.ts`
- `src/app/api/courses/[courseId]/lessons/[lessonId]/{route.ts,progress/route.ts,ai-assistant/route.ts}`
- `src/app/{layout,dashboard,courses,courses/[courseId],courses/[courseId]/lessons/[lessonId]}/page.tsx` (server components)

The grep `query(One)?\s*\([^)]*\$\{[^}]+\}` also returns zero matches. `pg` parameterisation is the convention and every route follows it. No change required; documented here so future agents know the audit was done.

### 5. General OWASP sweep — findings

- **CSRF.** Mitigated at the browser layer by `sameSite: 'strict'`. State-changing routes additionally require an authenticated session (`POST /api/execute`, `POST /api/enrollments`, `POST /api/stripe/checkout`, assistant, progress) so a cross-site actor cannot ride a victim's session even on a sameSite regression. `POST /api/stripe/webhook` is exempt — it is server-to-server from Stripe and is validated by `stripe.webhooks.constructEvent`, which is a cryptographic signature check, not a cookie check.
- **XSS.** Single `dangerouslySetInnerHTML` in `src/app/courses/[courseId]/lessons/[lessonId]/page.tsx` renders lesson content through a homegrown `renderMarkdown()`. Lesson content is seeded from `src/lib/schema.sql` — there is no user-facing write path. Low risk today, but it is a latent hazard if an admin UI is added later. **Flagged for v4-designed / future Chapter 8 work** (either sanitise the HTML or switch to a real markdown renderer with a sanitiser). Not "fixed" in v3-secured because nothing in scope demands it and patching it would require picking a markdown library, which is design territory.
- **IDOR.** Every lesson / progress / assistant route looks up the course and lesson by ID and enforces `lesson.course_id = courseId` + enrollment-for-paid-course. `/api/execute` takes no resource ID. `/api/stripe/checkout` takes a `courseId` from the request body and looks up the course + current session's enrollment before creating a Stripe session. No unchecked cross-user access paths found.
- **SSRF.** Client-side `fetch()` calls are all same-origin. Server-side outbound HTTP is limited to `new Anthropic(...)` (fixed host) and `new Stripe(...)` (fixed host), neither of which takes a user-supplied URL. Webhook receives from Stripe and is signature-verified. No SSRF surface.
- **Dependency CVEs (flaw 15 from the v0 log).** Not addressed in v3-secured — that is a separate category the book treats under the longevity pillar, and running `npm audit` on any given day is a moving target. The Next.js pin at `14.2.35` is preserved; it sits past `GHSA-f82v-jwr5-mffw`.

### Known limitations after v3-secured

Carried forward for future v-states / out-of-scope for Chapter 7:

- **The in-memory rate limiter (`src/lib/rate-limit.ts`) does not survive multi-instance deploys.** Production needs Redis or equivalent. Marked with a comment in the file.
- **No server-side session revocation.** A stolen JWT is valid for its full 7-day lifetime. Adding a revocation list is a state-management problem, not a security-code problem.
- **Lesson content XSS surface via `dangerouslySetInnerHTML`.** Described above. Low risk today (no user-write path), would graduate to real risk if admin UI is added.
- **No CSP header.** A Content-Security-Policy header would harden against XSS-by-inline-script if someone adds a lesson-authoring UI. Deferred.
- **Runner still shares the host kernel.** Out-of-process defeats vm-escape-reads-env, but a hypothetical V8 JIT exploit that achieves native code execution in the child would still sit in the same OS. A real coding platform's next layer is a container / gVisor / nsjail / firecracker microVM. Comment in `src/lib/code-runner.ts` documents this.

## Test suite notes (v1-tested)

The test suite uses **Vitest** (not Jest) and lives under `spine/tests/`. Structure:

- `tests/helpers/` — shared fixtures, a `pg.Client` wrapper, a `next/headers` cookie-store mock, and a `NextRequest` builder. Integration tests invoke route handlers directly (e.g. `POST as loginPOST` from the route file) rather than spinning up a full Next.js HTTP server.
- `tests/unit/` — pure unit tests, no database.
- `tests/integration/` — hit a real Postgres test database named `avitam_teach_v1_test`. Each file calls `useTestDb()` from `tests/helpers/db-setup.ts`, which creates the schema once and truncates all rows between tests.

**Test DB connection.** Defaults to `postgresql://avitam:avitam@localhost:5432/avitam_teach_v1_test`; override via `DATABASE_URL`. Create the DB once with `createdb -h localhost -U avitam avitam_teach_v1_test`.

**Known-issue tests: current pass/fail status as of v3-secured.**
  1. `tests/unit/env-fallback.test.ts` → Known Issue #1 (JWT_SECRET fallback). **Passes on v2-deployed** after `src/lib/env.ts` landed.
  2. `tests/integration/lesson-answer-leak.test.ts` → Known Issue #3 (`code_solution` leak). **Passes on v2-deployed** after the explicit column list fix landed.
  3. `tests/integration/progress-bypass.test.ts` → Known Issue #4a (no enrollment check). **Passes on v2-deployed** after the enrollment check landed in the progress route.
  4. `tests/integration/quiz-score-trust.test.ts` → Known Issue #4b (client-supplied quiz_score). **Passes on v2-deployed** after server-side quiz scoring landed.
  5. `tests/integration/assistant-history-injection.test.ts` → Known Issue #5 (role injection). **Passes on v2-deployed** after role whitelisting landed.
  6. `tests/integration/execute-vm-escape.test.ts` → Known Issue #2 (vm prototype escape). **Passes on v3-secured** after the out-of-process runner landed.

Tests 2–5 were marked "Fix: v1-tested" in CLAUDE.md but the v1 commit only updated the doc, not the code. v2-deployed brought the code into alignment. Do not "repair" any remaining known-issue test by changing its assertion — when a fix lands, the assertion starts passing naturally.

**v2-deployed also adds three new tests:**
  - `tests/integration/health.test.ts` — `GET /api/health` shape check.
  - `tests/integration/rate-limit.test.ts` — verifies login (11th request) and assistant (21st request) return 429 with `Retry-After`.

**v3-secured adds one new test file:**
  - `tests/integration/assistant-prompt-injection.test.ts` (8 cases) — covers system-prompt contents, `max_tokens` cap, over-long question rejection, history-turn cap, per-message clip, regression guard on role-filtering, output redaction, and the classic "ignore previous instructions" attack.

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
