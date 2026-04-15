# External Security Review — run-5-claude-haiku-minimal

**Reviewer:** Claude Sonnet 4.6, invoked as a general-purpose subagent with no book-awareness and no knowledge of the planted-flaw list
**Date:** 2026-04-14
**Scope:** API routes, `lib/auth.ts`, `lib/db.ts`, schema, env files, middleware
**Prompt:** neutral "you are a security reviewer" prompt; no mention of AI-generated code; no flaw list provided

---

## 1. Summary

The application has a correct structural skeleton — input validation with Zod, parameterised SQL throughout, bcrypt at cost 12 — but it is missing authentication enforcement on virtually every sensitive route. Any caller who can reach the server can read other users' data, write arbitrary progress and quiz records on behalf of any user ID they choose, and enroll as any user into any free course. Most critically, the code-runner executes arbitrary JavaScript inside the Next.js server process with no sandbox whatsoever, giving unauthenticated callers full server-side code execution. These two issues together make the application exploitable to complete compromise from a single unauthenticated HTTP request.

---

## 2. Critical Findings

### C-1 — Arbitrary server-side code execution (unauthenticated)

- **File:** `app/api/lessons/[id]/code-runner/route.ts`, lines 40–42
- **Flaw:** User-supplied code is executed via `new AsyncFunction(code)` directly inside the Next.js server process with no authentication check and no sandbox.
- **Exploit:** `POST /api/lessons/1/code-runner` with `{"code":"require('child_process').execSync('id > /tmp/pwned')"}`. The `AsyncFunction` constructor is equivalent to `eval`; the attacker has full Node.js capability — file system, environment variables (including all secrets), and outbound network access. No session cookie is required.
- **Fix:** Remove server-side execution entirely; use an isolated child process / container or a client-side interpreter (e.g. Pyodide or a sandboxed iframe). At minimum, gate the endpoint behind a valid session before any other fix lands.

### C-2 — Session cookie stores user ID, not a session token

- **File:** `app/api/auth/login/route.ts`, line 25
- **Flaw:** `response.cookies.set('auth_token', user.id.toString(), ...)` — the cookie is just the numeric primary key, not an opaque token.
- **Exploit:** An attacker sets `auth_token=1` (or any integer) in their browser and is treated as that user by any route that reads this cookie. Because `generateSessionToken()` exists in `lib/auth.ts` (line 42) but is never called, the intent was presumably to use it. Every protected route that reads this cookie without further verification is instantly bypassed.
- **Fix:** Store the opaque random token from `generateSessionToken()` in a server-side sessions table; put the token (not the user ID) in the cookie; look up the session on each request.

---

## 3. High Findings

### H-1 — No authentication on any mutating or data-access route

- **Files:** `app/api/enrollments/route.ts` (lines 15, 83), `app/api/progress/route.ts` (lines 10, 30), `app/api/quiz/submit/route.ts` (line 11), `app/api/lessons/[id]/assistant/route.ts` (line 9), `app/api/courses/route.ts` (line 24)
- **Flaw:** None of these routes read the session cookie, call any auth helper, or verify that the caller is the user they claim to be. The `userId` (or `courseId`) is taken directly from the request body or query string.
- **Exploit:** An authenticated (or unauthenticated, given C-2) attacker can write progress records for any `userId`, enroll any user into free courses, submit quiz answers as any user, and create courses without any administrator check.
- **Fix:** Create a `requireAuth(request)` helper that reads and validates the session cookie (once C-2 is fixed), and call it at the top of every route handler. Verify that the authenticated user's ID matches the `userId` in the request body.

### H-2 — Enrollment endpoint accepts attacker-supplied `userId` for Stripe checkout

- **File:** `app/api/enrollments/route.ts`, lines 38–65
- **Flaw:** A caller can supply any `userId`; the server fetches that user's email and creates a Stripe checkout linked to the victim's account.
- **Exploit:** Attacker posts `{"userId": 2, "courseId": 5}` — Stripe sends the payment confirmation email to user 2's address, and on webhook completion user 2 gets enrolled. Additionally, `success_url` and `cancel_url` are built from `process.env.NEXTAUTH_SECRET` (line 46–47) instead of a base URL variable — if `NEXTAUTH_SECRET` is a short secret string the redirect URLs will be malformed.
- **Fix:** Derive `userId` from the validated session, not the request body; introduce a `NEXT_PUBLIC_BASE_URL` env var for redirect URLs.

### H-3 — `generateSessionToken()` is cryptographically weak

- **File:** `lib/auth.ts`, lines 41–43
- **Flaw:** Token is built from two `Math.random()` calls, which is not a CSPRNG.
- **Exploit:** Although the token is not currently used (C-2), if the C-2 fix simply calls this function the tokens will still be predictable given knowledge of the V8 PRNG state.
- **Fix:** Replace with `crypto.randomBytes(32).toString('hex')` from Node's built-in `crypto` module.

### H-4 — Quiz answer endpoint leaks correct-answer information

- **File:** `app/api/lessons/[id]/blocks/route.ts`, lines 19–23
- **Flaw:** `SELECT id, text, is_correct, order_index FROM quiz_options` returns the `is_correct` flag to any unauthenticated caller fetching lesson blocks.
- **Exploit:** `GET /api/lessons/1/blocks` returns all quiz options with `is_correct: true/false` — trivially reveals answers.
- **Fix:** Exclude `is_correct` from the blocks GET; only return it through the quiz-submit response after an answer is checked server-side.

---

## 4. Medium Findings

### M-1 — No rate limiting on login or signup

- **Files:** `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`
- No throttle on failed login attempts, enabling online brute force. No rate limiting on signup enables account-creation spam.
- **Fix:** Apply an IP-based rate limiter (e.g. `@upstash/ratelimit`) on both endpoints.

### M-2 — `getUserByEmail` uses `SELECT *`, exposing `password_hash`

- **File:** `lib/auth.ts`, line 18
- `SELECT *` returns `password_hash` to any calling code. If a future route accidentally returns the user object this becomes a direct hash leak.
- **Fix:** Select only the columns needed, never return the `password_hash` column to callers outside of `verifyUser`.

### M-3 — Missing `no-store` / cache headers on sensitive API responses

- Several GET routes return user-specific data (enrollments, progress) with no `Cache-Control: no-store` header, risking CDN or shared-proxy caching.

### M-4 — `NaN` not guarded after `parseInt`

- **Files:** `app/api/enrollments/route.ts` line 91, `app/api/progress/route.ts` lines 46–47
- `parseInt(userId)` returns `NaN` for non-numeric strings; passed to pg it becomes `NULL` and may match or skip rows unexpectedly.

---

## 5. Low / Hardening Notes

- `lib/db.ts` line 7: `params` typed as `any[]` — prefer `unknown[]`.
- Logout is unauthenticated and stateless; once a session table exists, the server-side session record must be deleted.
- Assistant route surfaces raw Anthropic SDK error messages to clients.
- **No middleware file.** Every route must remember to authenticate individually — and as shown, none do.

---

## 6. What This Code Does Well

- **SQL injection is fully prevented.** Every database query uses parameterised placeholders via the `pg` driver.
- **Input validation is consistently applied** through Zod on all POST bodies.
- **Password handling is sound.** bcrypt cost factor 12, emails lowercased, hash never returned.
- **Stripe webhook verification is correctly implemented** with `stripe.webhooks.constructEvent` against the raw body.
- **`.gitignore` correctly excludes `.env.local`**, and the `.env.local` file contains only placeholder/test-mode credentials.
