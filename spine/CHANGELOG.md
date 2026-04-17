# Changelog

All notable changes to the avitam-teach spine are tracked here. Each entry
corresponds to a v-state tag. See `CLAUDE.md` for the full teaching
narrative — this file is the engineering-log companion.

## v3-secured — 2026-04-16

Chapter 7 teaching surface. Security hardening pass. All previously-tracked
known-issue tests (v1-tested + v2-deployed) now pass; the last one
(`execute-vm-escape.test.ts`) flips green with this release.

### Added

- **`src/lib/code-runner.ts`** — out-of-process JavaScript execution. Spawns
  a fresh `node` child via `child_process.spawn(process.execPath, ['-e', …])`
  with `env: {}`, pipes user code over stdin, enforces a 3-second
  `SIGKILL` wall-clock timeout from the parent, and caps output at 64 KiB
  combined stdout+stderr. Preserves the existing `{ output, errors,
  runtimeError, result }` response shape.
- **`tests/integration/assistant-prompt-injection.test.ts`** — 8 cases
  covering system-prompt contents, output-token caps, input-length caps,
  history-turn cap, per-message clipping, regression guard on role
  filtering, secret-shape output redaction, and the classic "ignore
  previous instructions" attack. Mocks the Anthropic SDK for determinism.
- **`__Host-avitam_session`** cookie name variant in production. In
  dev/test the plain `avitam_session` name is kept so localhost and the
  cookie mock continue to work.

### Changed

- **`src/app/api/execute/route.ts`** — rewired to `runUntrustedCode()`
  from the new out-of-process runner. Route shape, rate-limit cap,
  10k-char input cap, and response shape preserved.
- **`src/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route.ts`**
  — prompt-injection defenses added:
  - Hardened system prompt that names scope, refuses to reveal the prompt
    or any env-var/secret, and refuses "ignore previous instructions"
    style attacks.
  - `MAX_QUESTION_CHARS = 2000` (over-long → 400 instead of silent clip).
  - `MAX_HISTORY_TURNS = 6`, `MAX_HISTORY_MESSAGE_CHARS = 2000`.
  - `MAX_OUTPUT_TOKENS = 512` on the SDK call.
  - `redactSecrets()` scrubs secret-shaped strings (`sk-ant-…`,
    `sk_test_…`, env-var names) from the model output before returning.
- **`src/lib/auth.ts`** — session cookie hardening:
  - `sameSite` tightened from `'lax'` to `'strict'`.
  - `__Host-` name prefix used in production (`secure:true` + `path:/` +
    no `Domain` — the browser enforces these preconditions).
  - `getSession()` accepts either cookie name so the dev/prod boundary
    does not require a coordinated cookie migration.
- **`src/app/api/auth/logout/route.ts`** — clears both cookie-name
  variants so a NODE_ENV toggle cannot leave a stale session cookie.
- **`CLAUDE.md`** — Known Issue #2 moved to "Fixed as of v3-secured".
  Added a dedicated "Security (v3-secured)" section describing each
  change, the SQL/OWASP audit result, and a "Known limitations" list of
  security work intentionally deferred to future v-states.

### Fixed

- **Known Issue #2 — vm sandbox escape (`v0-naive` / `v1-tested` /
  `v2-deployed`).** `vm.runInNewContext` is not a security boundary.
  The fix is architectural, not a patch: user code runs in a separate
  OS process with an empty environment. Even a successful
  prototype-chain escape inside the child finds nothing worth
  exfiltrating. `tests/integration/execute-vm-escape.test.ts` passes.

### Audited (no code change required)

- **SQL injection.** Every `query()` / `queryOne()` call uses `$1, $2`
  placeholders. Zero string concatenation of user input found. The `pg`
  parameterisation convention holds across all routes and server
  components.
- **CSRF.** Baseline defense is `sameSite: 'strict'` on the session
  cookie. All state-changing routes additionally require an
  authenticated session. The Stripe webhook is server-to-server and
  cryptographically signed, not cookie-based — so the `sameSite` policy
  does not apply and is not needed.
- **IDOR.** All lesson / progress / assistant routes check
  `lesson.course_id = courseId` and require enrollment for paid
  courses. No cross-user ID access paths found.
- **SSRF.** No route takes a user-supplied URL and fetches it. Outbound
  HTTP is limited to Anthropic and Stripe on fixed hostnames.

### Known limitations (carried forward)

- `dangerouslySetInnerHTML` on lesson content page renders homegrown-
  markdown HTML. Lesson content is admin-seeded; no user-write path
  today. Flagged for future review if a lesson-authoring UI lands.
- In-memory rate limiter does not survive multi-instance deploys.
- No server-side JWT revocation. 7-day tokens stay valid for their full
  lifetime once issued.
- No CSP header. Deferred until there is a user-content write surface
  that would benefit from one.
- Runner child process still shares the host kernel. A hypothetical
  V8 JIT native-code exploit would escape vm + env:{}. Real coding
  platforms wrap this layer in a container / gVisor / microVM. Out of
  scope for the teaching spine.

## v2-deployed — 2026-04

Delivery / "shippable to staging" infrastructure. Docker, CI, env
validation, rate limiting, Next.js security pin, plus v1-scheduled
fixes the v1 subagent had left incomplete. See CLAUDE.md → "Delivery
(v2-deployed)" for the full list.

## v1-tested — 2026-04

Vitest suite with six known-issue proof tests. See CLAUDE.md → "Test
suite notes (v1-tested)" for the full list.

## v0-naive — 2026-04

Canonical spine, generated by Claude Sonnet 4.6 from the minimal
feature-first prompt. See `../v0-generation-log.md` for the research
log that produced it.
