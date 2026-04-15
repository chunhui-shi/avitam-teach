# v1-tested subagent — self-report (verbatim)

**Run date:** 2026-04-15
**Model:** Claude Sonnet (general-purpose subagent, default)
**Duration:** 11 minutes
**Prompt:** see `v1-prompt.md`

This is the subagent's own report of what it built, what decisions it made, and — critically — whether the `CLAUDE.md` context file at `spine/CLAUDE.md` helped it. The honesty note in Section 4 below is the single most valuable Chapter 10 data point from the v0 research round: a real AI agent, in the middle of a real task, evaluating whether a real context file was load-bearing.

---

## 1. Test directory tree (subagent's tree)

```
tests/
├── helpers/
│   ├── db-setup.ts
│   ├── fixtures.ts
│   ├── mock-next-cookies.ts
│   ├── request.ts
│   ├── setup-env.ts
│   └── test-db.ts
├── integration/
│   ├── assistant-auth.test.ts
│   ├── assistant-history-injection.test.ts
│   ├── auth-login.test.ts
│   ├── auth-register.test.ts
│   ├── enrollments-free.test.ts
│   ├── execute-auth.test.ts
│   ├── execute-vm-escape.test.ts
│   ├── lesson-access.test.ts
│   ├── lesson-answer-leak.test.ts
│   ├── progress-bypass.test.ts
│   ├── quiz-score-trust.test.ts
│   ├── stripe-webhook-idempotency.test.ts
│   └── stripe-webhook-signature.test.ts
└── unit/
    ├── auth-helpers.test.ts
    └── env-fallback.test.ts
```

## 2. `npm test` output

```
Test Files  6 failed | 9 passed (15)
Tests       6 failed | 26 passed (32)
Duration    5.86s
```

**Passing (9 files, 26 tests):** `auth-helpers`, `auth-register`, `auth-login`, `enrollments-free`, `lesson-access`, `assistant-auth`, `execute-auth`, `stripe-webhook-signature`, `stripe-webhook-idempotency`.

**Failing (6 files, all expected):** `env-fallback` (Known Issue #1), `lesson-answer-leak` (#3), `progress-bypass` (#4a), `quiz-score-trust` (#4b), `assistant-history-injection` (#5), `execute-vm-escape` (#2).

Each failing test carries a diagnostic assertion message naming the issue and the scheduled fix v-tag.

**The vm-escape test confirmed the exploit.** The test marker `PWNED_BY_TEST_<uuid>` set on `process.env.TEST_SECRET_MARKER` appeared in the response body when the agent posted `this.constructor.constructor('return process.env.TEST_SECRET_MARKER')()` as the `code` field, proving the `vm.runInNewContext` sandbox does not isolate the prototype chain.

## 3. Non-obvious decisions (the agent's own words)

### Cookie mocking

> "Next.js's `cookies()` from `next/headers` reads from an async request context that only exists inside a real Next.js server runtime. Rather than booting a full Next server per test file, `tests/helpers/mock-next-cookies.ts` installs a module-level `vi.mock('next/headers', ...)` exposing an in-memory `Map`-backed cookie store. Tests call `installCookieMock()` *before* any route/lib import so the mock is in place when `src/lib/auth.ts` resolves the module. They then `setCookie('avitam_session', signToken({...}))` to simulate an authenticated user. This avoids standing up an HTTP server and keeps every test a direct function call to the route handler."

**Chapter 6 relevance:** concrete example of a testing-in-Next.js gotcha that a reader would hit on their own code.

### SDK mocks before import

> "Both the Anthropic SDK and Stripe SDK are `new`ed at module-load time in their respective routes. Tests use `vi.mock('@anthropic-ai/sdk' | 'stripe', ...)` at the very top of the file and place the route `import` below the mock call. No real Anthropic or Stripe API traffic occurs."

**Chapter 6 relevance:** module-load-time construction is a class of testing gotcha that the book can teach explicitly.

### Schema seed-strip

> "`schema.sql` ships with `INSERT` statements for three sample courses + lessons. `tests/helpers/test-db.ts::initSchema()` reads the file and truncates everything from the first `-- Seed` comment onward before executing, so the test database only contains tables, never seed rows that would collide with fixtures."

**Chapter 6 relevance:** test fixtures vs production seeds are different things; the book can name the distinction.

### Single-fork, no parallelism

> "`vitest.config.ts` sets `fileParallelism: false` + `pool: 'forks'` + `singleFork: true`. Integration tests all hit the same Postgres DB and truncate between tests; running files in parallel would create race conditions. The trade-off: ~6s serialised runtime, which is fine."

**Chapter 6 relevance:** test parallelism has a cost; if tests share state, serialize.

### Path alias fallback

> "I initially added `vite-tsconfig-paths`, but it's ESM-only and crashed on vitest's CJS loader. Replaced with a plain `resolve.alias` mapping `@` → `./src`. No functional difference."

**Chapter 6 relevance:** tooling mismatches at framework intersections are real; write the boring manual version first, reach for the smart plugin only if needed.

### Pool cleanup

> "The `src/lib/db.ts` `pg.Pool` has idle connections that can keep the event loop alive. `tests/helpers/setup-env.ts` installs a `process.on('beforeExit', ...)` that `process.exit(0)`s after a 50ms unref'd timer if vitest's own teardown has completed. In practice vitest exits on its own in ~6s; the hook is defensive."

**Chapter 6 relevance:** minor but worth noting.

## 4. CLAUDE.md honesty note (the Chapter 10 load-bearing quote)

> "Reading `CLAUDE.md` before the code was a clear time-saver. Two specific wins:
>
> - The **Known Issues** list told me exactly which tests should fail and why, with v-tag mappings I'd otherwise have had to guess or miss entirely. Without it, I would likely have 'fixed' at least `code_solution` on sight.
> - The **route shape convention** (session → validate → business → response) let me predict what I'd find in each route before reading it, and gave me confidence that the `lessons/[lessonId]/progress/route.ts` *deliberately* skips step 2.5 (enrollment check).
>
> One CLAUDE.md guidance I **corrected, not ignored**: CLAUDE.md said JWTs are signed with `jose`, but the real code uses `jsonwebtoken` (it's the dependency in `package.json`, and the import at line 1 of `src/lib/auth.ts`). It also referred to helpers as `signJwt`/`verifyJwt` in the test spec, but the real exports are `signToken`/`verifyToken`. I matched the real code and documented the discrepancy in `CLAUDE.md` for the next agent. I did not spot any other CLAUDE.md claim that disagreed with the code.
>
> Context that I could *not* have derived from the code in 5 minutes: the v-tag narrative (what's fixed when), the 'things tried and rejected' section's reasoning about ORMs and NextAuth, and the note that `code_solution` staying in responses is intentional v0 material, not a bug."

### Chapter 10 takeaways from this paragraph

1. **Context files can prevent wrong "fixes."** *"Without it, I would likely have 'fixed' at least `code_solution` on sight."* This is the strongest single ROI statement for context engineering produced by the research round. The value was not speed; it was **error prevention**, on a class of error the agent would not have recognized as wrong.
2. **Pattern priors transfer through text.** *"The route shape convention let me predict what I'd find in each route before reading it."* The same pattern-recognition shortcut that makes a human reader fast also makes an AI agent fast, and the transfer medium is a single paragraph in a context file.
3. **Deviation-as-signal.** *"Gave me confidence that the progress route *deliberately* skips step 2.5."* The agent used the pattern as a null hypothesis and treated the deviation as an intentional signal, not a bug. This is Chapter 5's pattern-recognition discipline re-applied inside Chapter 10's context-engineering discipline.
4. **Context files age the moment they are written.** *"CLAUDE.md said `jose`, but the real code uses `jsonwebtoken`."* Same failure mode as comment drift at the inline-comment level (Chapter 5's Flaw), at the file-meta level. A disciplined agent does not blindly trust the context file; it cross-checks against the code, catches the discrepancy, corrects the context file, and documents the correction for the next reader. The behavior is the ideal; the tooling to enforce it is nonexistent. This is a Chapter 10 teaching moment about how to **write** context files you can trust: include a "last verified" date, tie updates to commits, treat the file as a living artifact.
5. **Irreducible context.** *"Context that I could not have derived from the code in 5 minutes: the v-tag narrative, the tried-and-rejected reasoning, the note that the leak is intentional."* This is the irreducible core of context engineering — information that is **not** latent in the code and must be made explicit somewhere. The agent correctly identifies three classes: (a) temporal (what changes when), (b) negative design space (why other options were rejected), and (c) pedagogical intent (what looks like a bug but is on purpose).

## 5. Changes the subagent made to CLAUDE.md

- **Stack bullet corrected.** `jose` → `jsonwebtoken`. Added actual exported helper names (`signToken`/`verifyToken`, not `signJwt`/`verifyJwt`), and the session cookie name (`avitam_session`).
- **New "Test suite notes (v1-tested)" section** appended after "How to run". Documents test location, `DATABASE_URL` default, cookie-mock and SDK-mock pattern, and enumerates the six known-issue tests with their scheduled fix v-tags.

These edits are in the committed v1-tested state. The corrected CLAUDE.md is what a future agent reading the spine at `v1-tested` will see.

## 6. Files and LOC

- **22 files created** (1 config, 6 helpers, 2 unit tests, 13 integration tests)
- **~1,470 LOC** across new files (`wc -l` actual: 1,466)
- **2 files modified**: `package.json` (added `"test"` and `"test:ui"` scripts + 4 devDependencies), `CLAUDE.md` (two edits above)
