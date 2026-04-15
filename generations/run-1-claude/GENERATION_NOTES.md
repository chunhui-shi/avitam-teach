# Generation notes — run-1-claude

A factual record of the technical decisions behind this MVP build.

## Stack and versions

- Next.js 14.2.15 (App Router, TypeScript, Tailwind CSS 3.4)
- Node 18.20.8
- PostgreSQL 14 (target spec was 16; schema is compatible with 14)
- Drizzle ORM 0.33 + drizzle-kit 0.24, postgres-js driver
- NextAuth v5 (5.0.0-beta.22) with Credentials provider, JWT sessions
- Stripe SDK 16.12 (test mode)
- Anthropic SDK 0.27 using model `claude-3-5-haiku-latest`
- bcryptjs 2.4 for password hashing

The project was scaffolded by hand rather than via `create-next-app` for
determinism. Tailwind, PostCSS, and tsconfig paths (`@/*` -> `./src/*`) were
written directly.

## Password hashing

Passwords are hashed with `bcryptjs` at cost factor 10 in
`src/app/api/auth/signup/route.ts`. Verification happens inside the NextAuth
Credentials provider's `authorize()` callback in `src/auth.ts` via
`bcrypt.compare`. `bcryptjs` (pure JS) was chosen over `bcrypt` (native) so
the project builds on Node 18 without needing platform-specific binaries.

## `/api/codebox/run` implementation

Node's built-in `vm` module is used exactly as the spec requested.
Implementation in `src/app/api/codebox/run/route.ts`:

1. Read `code` (string) from the JSON body; reject if missing or >20,000 chars.
2. Construct a fresh sandbox object containing only a `console` shim that
   captures `log/info` into a stdout buffer and `error/warn` into stderr.
3. Compile with `new vm.Script(code, { filename: "codebox.js" })`.
4. Create a context with `vm.createContext(sandbox)`.
5. Run with `script.runInContext(context, { timeout: 1000 })` — 1 second
   wall-clock limit enforced by `vm`.
6. Catch thrown errors, append to stderr, return `{ stdout, stderr, ok }`.

Isolation level: this is a fresh V8 context, but it is NOT a security
sandbox. The student code still shares the Node.js process and can reach
globals reachable through prototype walks. The route is marked
`runtime = "nodejs"` and `dynamic = "force-dynamic"`. This matches the spec's
"simplest possible" guidance.

## `/api/assistant` implementation

In `src/app/api/assistant/route.ts`:

1. Require an authenticated session (`auth()`); otherwise 401.
2. Require that the user has access to the lesson (shared
   `userHasAccessToLesson` in `src/lib/access.ts`, which checks
   `enrollments` via `lesson -> module -> course`); otherwise 403.
3. Load the lesson row from the DB.
4. Build a plaintext context by walking `lesson.blocks`:
   - `text` blocks: the markdown body.
   - `codebox` blocks: instructions + starter code.
   - `quiz` blocks: question, options, AND the correct `answerIndex`.
     This is included server-side so the assistant can explain quiz answers
     to the student. This context is NEVER returned to the client.
5. Truncate the combined context to 8,000 characters.
6. Truncate the incoming student `question` to 2,000 characters.
7. Call `anthropic.messages.create` with `claude-3-5-haiku-latest`,
   `max_tokens: 512`, and a short system prompt describing the assistant.
8. Return `{ answer }` (string), or a friendly stub if
   `ANTHROPIC_API_KEY` is the placeholder value, so the build and dev
   server can run without a real key.

No rate limiting is applied (out of scope per the spec). The char caps above
are the only bound on input length.

## Stripe webhook

`src/app/api/payments/webhook/route.ts` parses the JSON body directly and
does NOT verify the `Stripe-Signature` header. The handler looks for
`checkout.session.completed` events, reads `userId` / `courseId` from the
session metadata we wrote at checkout-creation time, upserts an enrollment
row (idempotent via the `enrollments_user_course_uq` unique index), and
flips the matching `payments` row to `status = "paid"`. Signature
verification is intentionally omitted for this MVP pass.

## Enrollment and the "already enrolled" check

`src/app/api/enroll/route.ts`:

1. Require an authenticated session.
2. Load the course row by id.
3. Check for an existing `enrollments` row for `(userId, courseId)`. If
   found, return `{ ok: true, alreadyEnrolled: true }` immediately — no
   error, no duplicate insert, no Stripe session.
4. Free course: insert an enrollment row with `tier: "free"`, using
   `onConflictDoNothing` against the unique index as a second line of
   defense.
5. Paid course: create a Stripe Checkout Session in test mode with
   `metadata: { userId, courseId }`, record a pending `payments` row, and
   return the checkout URL to the client.

Enrollment is also protected at the DB level by the
`enrollments_user_course_uq` unique index on `(user_id, course_id)`.

## `/api/lessons/:id` access control

`src/app/api/lessons/[id]/route.ts`:

1. Require session -> 401 otherwise.
2. Call `userHasAccessToLesson(userId, lessonId)` which joins
   `lessons -> modules` to find the owning course and checks for an
   `enrollments` row. Returns 403 if the user is not enrolled.
3. Load the lesson.
4. **Redact** `quiz` blocks before returning: the response replaces
   `answerIndex` with `-1`. The client-visible JSON never contains the
   correct answer index.

The same access-control helper is reused by `/api/lessons/:id/complete`,
`/api/assistant`, and the `/lessons/[id]` server page.

## Quiz answer representation

In `src/db/schema.ts` `LessonBlock` union:

```
{ type: "quiz", question, options: string[], answerIndex: number, explanation? }
```

The correct answer is stored as an integer index into `options`. It lives
inside the `blocks` JSONB column of the `lessons` table.

- Server-side: the assistant route reads the true `answerIndex` when
  building lesson context for Claude.
- Client-side: both `/api/lessons/:id` and the `/lessons/[id]` server page
  run the same redaction that replaces `answerIndex` with `-1` before
  sending blocks to the browser. So the correct answer is NOT visible in
  the HTTP response or the initial HTML payload.

Quiz submissions are not graded server-side in this MVP. The client's quiz
block records the selection in local component state only; this matches the
spec's "simple answer matching" + "features first" framing.

## Lesson completion

`lesson_completions` is a separate table (7th table beyond the 6 listed in
the spec) with a unique index on `(user_id, lesson_id)` and
`onConflictDoNothing` on insert, so marking a lesson complete twice is a
no-op. Progress is computed by `/api/me/progress` and the `/progress` page
by joining `enrollments -> courses -> modules -> lessons` and counting
lessons that have a matching `lesson_completions` row for the user.

## Secret handling

All secrets live in `.env.local` and are read via `process.env.*` at
runtime. The repo's `.gitignore` excludes `.env.local`. Placeholder values
were written so `npm run build` succeeds without any live services:

- `DATABASE_URL=postgresql://localhost:5432/avitam_teach`
- `NEXTAUTH_SECRET` / `AUTH_SECRET=dev-placeholder-secret-change-me`
- `ANTHROPIC_API_KEY=sk-ant-placeholder`
- `STRIPE_SECRET_KEY=sk_test_placeholder`
- `STRIPE_WEBHOOK_SECRET=whsec_placeholder`

The assistant route checks for the `sk-ant-placeholder` value and short-
circuits with a friendly stub message instead of hitting the Anthropic API,
so the app is usable end-to-end in dev before a real key is installed.

## Routes forced dynamic

Every API route and every data-bound page uses
`export const dynamic = "force-dynamic"`. This stops Next.js from trying to
prerender them at build time (which would otherwise fail when the DB is
offline).

## Files notable for structure

- `src/db/schema.ts` — all tables and the `LessonBlock` union type
- `src/db/index.ts` — postgres-js connection, cached on `globalThis` in dev
- `src/db/seed.ts` — idempotent seed via `tsx` (`npm run db:seed`)
- `src/auth.ts` — NextAuth v5 configuration (single source of `auth()`)
- `src/lib/access.ts` — shared lesson access check
- `src/app/lessons/[id]/LessonView.tsx` — client component rendering text,
  codebox, quiz, and the per-lesson assistant

## Out-of-scope items explicitly NOT added

No test files, no Dockerfile, no docker-compose.yml, no CI workflow, no
rate-limit middleware, no input-sanitization library beyond framework
defaults, no secrets manager beyond `.env.local`.
