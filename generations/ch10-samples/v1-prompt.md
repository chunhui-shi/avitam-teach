# v1-tested subagent prompt (verbatim)

**Launched:** 2026-04-15
**Model:** Claude Sonnet (via general-purpose subagent, default model)
**Background:** yes
**Duration:** ~11 minutes
**Result:** 22 new files, ~1,470 LOC, 9 test files passing, 6 test files deliberately failing

---

## Purpose

This is the exact prompt given to the v1-tested subagent, preserved verbatim as a Chapter 10 worked example of precise task specification. Two of Chapter 10's "four levers" — specification quality and context provision — get their concrete demonstration from this prompt. Length: approximately 1,500 words.

Key structural moves the prompt makes:

1. **Mandatory first read.** Opens with a non-negotiable instruction to read `CLAUDE.md` before any other action. This forces the context layer into the agent's working memory at step zero.
2. **Strict isolation list.** Names specific directories the agent may not read, rather than a vague "stay in scope." Strict lists outperform vague scopes for agents.
3. **Framework choice with rationale.** Specifies Vitest (not Jest) with a one-line justification. Precludes ambiguity.
4. **Per-file test plan with expected pass/fail outcomes.** Each of the 14 test files is named with its expected result (pass/fail) on v1, so the agent cannot accidentally "fix" a test that should fail.
5. **Explicit "do not fix known issues" constraint.** Repeated three times in different contexts — at the top, in Step 4, and in Step 5.
6. **Diagnostic message requirement.** Failing tests must report *why* they fail and which v-tag fixes them, so the teaching path is visible when a reader runs the suite.
7. **Report-back spec with five required sections.** Asks for a tree, test output, non-obvious decisions, CLAUDE.md honesty note, and LOC count. The honesty note is the load-bearing Chapter 10 question: "did the context file help you?"

---

## The prompt verbatim

> You are being asked to add a test suite to an existing Next.js codebase at `/home/cshi/dev/edu/avitam-teach/spine/`. This builds the `v1-tested` state of the codebase.
>
> ## Step 0 — Read the context file first
>
> Before anything else, read `/home/cshi/dev/edu/avitam-teach/spine/CLAUDE.md` in full. It describes what this codebase is, its conventions, and — critically — a list of **Known issues** that are *deliberately present* as teaching material. **You must not fix any of the known issues.** Tests that target known issues should deliberately *fail* with a clear assertion message. That failure is the point.
>
> ## Step 1 — Working directory
>
> Your working directory is `/home/cshi/dev/edu/avitam-teach/spine/`. Do not read, write, or modify anything outside this directory except:
>
> - You may check environment versions (`node --version`, `psql --version`).
> - You may run `npm install` (this downloads packages into `spine/node_modules/`, which is fine).
> - You may create and drop a throwaway Postgres database named `avitam_teach_v1_test`.
>
> Do NOT read:
> - `/home/cshi/dev/edu/avitam-teach/generations/` (sibling research runs)
> - `/home/cshi/dev/edu/avitam-teach/v0-generation-log.md` (research artifact)
> - `/home/cshi/dev/edu/career-with-ai/` (book project, should not influence your test code)
>
> ## Step 2 — Test framework
>
> Install Vitest (not Jest). Commands:
>
> ```bash
> cd /home/cshi/dev/edu/avitam-teach/spine
> npm install --save-dev vitest @vitest/ui
> ```
>
> Create `vitest.config.ts` at the project root. Configure:
> - Test files matched: `tests/**/*.test.ts`
> - Test environment: `node` (not jsdom)
> - Single process, no parallelism across files if that is simpler (avoids DB-race issues)
> - TypeScript path aliases matching `tsconfig.json` (so tests can `import { getSession } from "@/lib/auth"` same as production code)
>
> Add `"test": "vitest run"` to `package.json` scripts.
>
> ## Step 3 — Test database setup
>
> Create a small helper at `tests/helpers/test-db.ts` that:
> - Connects to `avitam_teach_v1_test` (reads `DATABASE_URL` from env, but defaults to `postgresql://localhost:5432/avitam_teach_v1_test` if unset)
> - Runs `src/lib/schema.sql` on setup
> - Truncates all tables between tests
> - Exposes a `getTestDb()` function that returns a `pg.Client` for use in integration tests
>
> Also create `tests/helpers/fixtures.ts` with small helpers to create users, courses, and enrollments in the test DB — whatever your tests need to share.
>
> ## Step 4 — Tests to write
>
> Write exactly these 14 test files. Each is described with purpose and expected outcome. **Some tests are DELIBERATELY going to fail** — those prove the known issues are real. That is the whole point of v1-tested.
>
> [The prompt then enumerates all 14 test files with purpose, expected outcome, and the specific assertions each should make. The unit tests are auth-helpers.test.ts (pass) and env-fallback.test.ts (fail, proves Known Issue #1). The integration tests cover auth-register, auth-login, enrollments-free, lesson-access (pass), lesson-answer-leak (fail, proves #3), progress-bypass (fail, proves #4a), quiz-score-trust (fail, proves #4b), assistant-auth (pass), assistant-history-injection (fail, proves #5), execute-auth (pass), execute-vm-escape (fail, proves #2), stripe-webhook-signature (pass), stripe-webhook-idempotency (pass). See the actual prompt text in the session transcript for the full per-file specifications.]
>
> ## Step 5 — Make the tests that should pass, pass
>
> Once you write a test, run it. If a test that should PASS on v1 is failing for a reason unrelated to the teaching content, fix the test. Do NOT fix the route — unless the route has a bug that is not on the Known Issues list, in which case you may fix it and note the fix in your report.
>
> The 6 tests that should FAIL on v1 should each fail with a clear, diagnostic assertion message when you run `npm test`. That message is what a reader will see, so write it carefully.
>
> ## Step 6 — Report back
>
> When the work is done, report back with:
>
> 1. Tree of the `spine/tests/` directory (`tree -L 3`)
> 2. `npm test` output — final run with pass/fail summary
> 3. Contents of any test file that required non-obvious choices — judgment calls on test scope, mock strategy, or DB setup
> 4. An **honest note on CLAUDE.md**: did reading it save you time? Did you learn something from it that you could not have derived from the code in 5 minutes? Did you ignore any of its guidance?
> 5. Any changes you made to `CLAUDE.md`
> 6. Total files created and approximate LOC added
>
> ## Constraints
>
> - Do not fix the Known Issues. Tests that target them should fail with diagnostic messages.
> - Do not create a Dockerfile, docker-compose.yml, GitHub Actions workflow, rate limiting middleware, or startup env validation. Those are v2-deployed work.
> - Do not edit the existing route files or lib files to make passing tests pass. Use the code as-is.
> - Work inside the spine directory only.
> - Keep report under 1500 words.
>
> Work methodically.

---

## What this prompt demonstrates for Chapter 10

- **Specification quality:** the prompt is long because it is precise, not because it is padded. Every section has a single, unambiguous outcome. The agent did not ask a single clarifying question and ran for 11 minutes straight.
- **Context provision:** the mandatory-read-CLAUDE.md instruction is the context layer. Without it, the agent would have relied on whatever priors its training gave it about Next.js + Postgres MVPs. With it, the agent inherited the author's intent for the codebase on step zero.
- **Constraint clarity:** "do not fix the known issues" appears three times in different contexts. For an agent whose default disposition is to be helpful, negative constraints must be explicit and repeated.
- **Report-back as a verification layer:** the five-section report requirement is itself a verification step — the agent's output is evaluated against a fixed rubric, not against open-ended "tell me how it went."

These are the same four moves Chapter 10's context-engineering section teaches in the abstract. The prompt is the concrete example.
