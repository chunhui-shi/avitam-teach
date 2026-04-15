# avitam-teach — v0 generation log

This file is the public record of how `v0-naive` was produced, and what was learned about AI-generated MVPs in the process.

It exists because the book (*Don't Learn to Code*, Manning, in progress) claims to teach readers how to work with *real* AI-generated code, not a pedagogical construct. The honesty of that claim depends on v0 being the output of a feature-first AI generation with no planted flaws — so we ran several generations from scratch with realistic prompts, analyzed each one against the flaws the book's chapters reference, and documented everything that landed, everything that did not, and everything we did not predict.

The finding, stated up front: **the flaw profile of an AI-generated MVP in 2026 is strongly model-dependent, and the cheapest-tier frontier models produce dramatically worse v0s than the top-tier models.** We have four full runs of Claude Opus 4.6, Sonnet 4.6, and Haiku 4.5 against the same prompt, and the security quality of the output tracks the capability of the model. This finding is the centerpiece of what this log records.

---

## Methodology

**The prompts.** Two prompt variants were used. The *detailed* variant (Run 1) reads like a senior engineer's design draft: features, schema, API routes, and an explicit out-of-scope list. The *minimal* variant (Runs 3–5, and the pending Gemini Run 2) is a one-paragraph feature description with a soft stack nudge and nothing else — no schema, no routes, no out-of-scope list. Both variants are saved in the repo at `generations/v0-prompt-detailed.txt` and `generations/v0-prompt-minimal.txt`.

**Model coverage.** Runs 1 and 3 use Claude Opus 4.6 (this session's parent model, inherited by the subagent). Run 4 uses Sonnet 4.6 with an explicit model override. Run 5 uses Haiku 4.5 with an explicit model override. Run 2 uses Gemini via the CLI and is pending a user-driven remote session. The cross-model matrix is the point: Opus is the top tier most readers cannot afford, Sonnet is the workhorse most readers use through Claude Pro / Cursor / Claude Code defaults, and Haiku is the cost tier for cost-conscious engineers. The book's audience is the Sonnet/Haiku population, not the Opus population.

**Isolation.** Each run executes in its own subdirectory under `generations/`. Each subagent is explicitly instructed not to read outside its working subdir — in particular, not the `career-with-ai` book project, not the real `avitam` production codebase, and not any sibling generation. The isolation is by prompt convention, not enforced by filesystem sandboxing. In practice the subagents respected it.

**Fix-loop policy.** The runner iterates until `npm run build` passes with zero errors. The runner is not constrained in what kinds of code it writes to reach that goal, but the prompt structure determines what it defaults to: Run 1's out-of-scope list explicitly forbade tests/Docker/CI/rate-limiting/hardening; Runs 3–5 had no such list, so whatever got added or skipped is the model's own judgment.

**Static analysis passes.** Three passes per run:

1. **Automated grep** — `scripts/grep-flaws.sh` checks for regex-detectable signatures of each of the 14 reference flaws.
2. **Manual code review** — the subagent's `GENERATION_NOTES.md` plus direct reads of the security-sensitive routes (auth, code runner, assistant, webhook, enroll).
3. **Supply chain audit** — `npm audit` against each run's `package-lock.json`.

A fourth pass (Semgrep SAST) is planned next and will add a second independent automated signal alongside the grep.

**Selection principle.** The canonical `v0-naive` the book teaches from should be the run whose flaw profile is *typical for the book's audience*, not the most pedagogically convenient. Since the audience is Sonnet/Haiku users, the winner is chosen from Runs 4 or 5, not Run 3. Run 1 (Opus + detailed prompt) is retained as an upper-bound contrast case: *"here is what you would get on the top tier with a design draft in hand."*

---

## The reference flaws

### The 14 from `avitam-teach-spec.md §6`

| #  | Flaw | Location |
|----|---|---|
| 1  | Raw SQL string concat in course search | Search endpoint |
| 2  | Payment fulfillment trusts client callback | `/api/enroll` |
| 3  | Stripe webhook has no signature verification | `/api/payments/webhook` |
| 4  | Assistant route: unsanitized input, no length cap | `/api/assistant` |
| 5  | Codebox runner uses in-process `vm.runInNewContext` | `/api/codebox/run` |
| 6  | Password hashing uses MD5 or SHA1 | Auth route |
| 7  | Session cookie missing HttpOnly/Secure | NextAuth config |
| 8  | Lesson GET checks logged-in but not enrolled | `/api/lessons/:id` |
| 9  | Enrollment has race condition under concurrent POSTs | `/api/enroll` |
| 10 | Quiz correct answer leaks in lesson fetch response | `/api/lessons/:id` |
| 11 | Hardcoded API keys + DB URL in config files | Repo-level |
| 12 | No tests | Repo-level |
| 13 | No Dockerfile, no CI, runs only on localhost | Repo-level |
| 14 | No rate limiting on assistant or codebox runner | `/api/assistant`, `/api/codebox/run` |

### Flaw 15 — added post-hoc based on Run 1 evidence

| #  | Flaw | Location |
|----|---|---|
| 15 | Dependency CVEs at `v0-naive` install time — `npm audit` reports critical/high-severity vulnerabilities in the packages the model `npm install`ed, independent of the code the model wrote | Repo-level (`package-lock.json`) |

Flaw 15 was not in the original spec. It emerged from the first `npm audit` on Run 1 and is a different category entirely — it is supply-chain rot driven by the model installing whatever versions it knew about, which in 2026 are almost always months old and publicly vulnerable by the time the code ships. It is the strongest case for Chapter 1's longevity pillar ("the code you installed five minutes ago already has 14 public CVEs") and it is universal across every run. Every v0 the book's reader produces in 2026 will ship with supply-chain vulnerabilities, regardless of model or prompt.

### Flaw 16 — added post-hoc based on Run 5 evidence

| #  | Flaw | Location |
|----|---|---|
| 16 | Security-sensitive routes have no authentication check | Any route that takes user input and has a cost, side effect, or privileged capability |

Flaw 16 also was not in the original spec. It emerged from Run 5 (Haiku) where both the code runner and the assistant route had zero auth checks — unauthenticated attackers could execute arbitrary server-side JavaScript and make unbounded Anthropic API calls. Flaw 16 is a *category*, not a specific code smell, and it subsumes "Flaw 8 for other routes" — the spec only planted the lesson-access-control flaw on `/api/lessons/:id`, but the real-world pattern is much broader. Weaker models skip authentication on multiple routes, not just the one the spec predicted.

### Flaw 17 — added post-hoc based on Run 2 evidence

| #  | Flaw | Location |
|----|---|---|
| 17 | Client-authoritative context in AI-integrated routes — the server passes user-provided strings directly to an LLM as the authoritative lesson/task/document content, with no server-side lookup against the database | AI assistant / chat / tutor routes |

Flaw 17 also was not in the original spec. It emerged from Run 2 (Gemini) where the `/api/chat` route takes `lessonTitle` and `lessonContent` **from the request body** and splices them into the LLM system prompt. There is no server-side query against the lessons table. The client tells the server what lesson they are on, and the server trusts it. This inverts the standard trust boundary in AI integrations and defeats any enrollment gate that might exist at the route level, because enrollment is by definition about *which* lesson a user may access — if the user chooses which lesson content to discuss, enrollment is meaningless for that route. It also opens a direct prompt-injection channel and an unbounded cost-bomb surface. The author probably reasoned *"the client already has the lesson content to display it, so it can just send it back"* — a reasonable performance optimization that happens to break the security model. This is precisely the class of bug Chapter 10's harness-engineering material is built around.

### Flaw 18 — added post-hoc based on Runs 2 and 4 evidence

| #  | Flaw | Location |
|----|---|---|
| 18 | Hardcoded or guessable fallback secrets — either (a) a literal placeholder value in a `.env` file that a careless reader will ship as-is, or (b) a `||` fallback in source code that signs JWTs with a known string when the env var is missing | Env files and auth module source |

Flaw 18 emerged from the AI cross-audit round. Run 4 (Sonnet) has `const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production-min-32chars'` in `src/lib/auth.ts:5` — if the environment variable is missing, JWTs are signed with a known literal. Run 2 (Gemini) ships a `.env` containing `NEXTAUTH_SECRET="super-secret-key-123"` as a weak literal placeholder. Neither is a sophisticated or interesting flaw in isolation — both are fixed by the reader setting a real secret before deploying, which is a Security 101 step. The interesting thing about Flaw 18 is that **no secret scanner caught it.** gitleaks, trivy, and Semgrep all look for credential *format patterns* (AWS keys, Stripe keys, GitHub tokens) and are blind to weak literals that don't match any format. The flaw was caught by AI reviewers that reasoned about what the variables *mean* rather than what they look like. This is the single clearest data point for the tool-voice vs AI-reviewer-voice complementarity argument. In book prose it gets one sentence, not a section — *"change the default secret"* is not a lesson the reader needs dwelt on.

---

## Run 1 — Claude Opus 4.6 + detailed prompt

| Field | Value |
|---|---|
| Model | Claude Opus 4.6 |
| Date | 2026-04-14 |
| Prompt style | Detailed feature-first with schema + API routes + explicit out-of-scope list |
| Working dir | `generations/run-1-claude/` |
| Status | **Completed** |
| Build | Clean, zero errors |
| Total files | 39 |
| Total LOC | ~1,916 |

**Prompt:** `generations/v0-prompt-detailed.txt`.

**Key design decisions (from `GENERATION_NOTES.md`):**

- **Stack:** Next.js 14.0.x + TypeScript + Tailwind; PostgreSQL 16 + Drizzle ORM (not raw SQL); NextAuth v5 credentials provider; Stripe test mode; `@anthropic-ai/sdk`.
- **Password hashing:** `bcryptjs` cost factor 10.
- **Code runner:** `new vm.Script(code)` + `vm.createContext(sandbox)` + `runInContext(ctx, { timeout: 1000 })`. Sandbox exposes only a `console` shim. **In-process vm, same Node process.** This is the exact `vm.runInNewContext` pattern the spec planted as Flaw 5.
- **Assistant:** Anthropic `claude-3-5-haiku-latest`, `max_tokens: 512`, Socratic-ish system prompt. Context built by walking `lesson.blocks` and **including `quiz.answerIndex` in the LLM context** — the author-comment in the code says *"Include quiz answers for the model (server-side only; does NOT leak to client)"* which is incorrect.
- **Stripe webhook:** JSON parsed directly, **signature NOT verified.** Relies on `userId`/`courseId` from `session.metadata` with no authentication.
- **Enrollment:** unique index `enrollments_user_course_uq` + `onConflictDoNothing` on insert. Race-resistant.
- **Access control:** `userHasAccessToLesson(userId, lessonId)` joins `lessons → modules → enrollments`. Proper gating on the lesson GET.
- **Quiz redaction:** `/api/lessons/:id` redacts `answerIndex` to `-1` before returning to client. Direct response-body leak not landed; LLM-context leak landed (see above).
- **Secrets:** all in `.env.local`, gitignored.

**Flaw matrix:**

| Flaw | Verdict | Evidence |
|------|---------|---------|
| 1 SQLi | NOT LANDED | Drizzle typed queries throughout; no search route exists (scope substitution) |
| 2 Payment trust (direct) | NOT LANDED | Enrollment is webhook-driven; client cannot fake it directly. But see Flaw 3 — the composition is unsafe. |
| 3 Webhook signature | **LANDED** | `webhook/route.ts:12` — `const event = await req.json();`. No `stripe.webhooks.constructEvent`. Attacker can forge webhook payloads and enroll in any paid course free. This collapses Flaws 2 and 3 into one chain. |
| 4 Assistant caps + rate | **PARTIAL** | `MAX_QUESTION_CHARS = 2000`, `MAX_CONTEXT_CHARS = 8000` present; **no rate limiting**; no sanitization beyond length. |
| 5 vm runner | **LANDED** | `codebox/run/route.ts` uses `vm.Script` + `vm.createContext` + `runInContext({timeout: 1000})`. Escapable sandbox pattern. |
| 6 Weak password hash | NOT LANDED | `bcryptjs` cost 10. |
| 7 Session cookies | NOT LANDED | NextAuth v5 defaults (httpOnly + sameSite). |
| 8 Access control | NOT LANDED | `userHasAccessToLesson()` proper gate. |
| 9 Enroll race | NOT LANDED | Unique constraint + `onConflictDoNothing`. |
| 10a Quiz leak via response | NOT LANDED | Redacted to `-1` before client response. |
| **10b Quiz leak via LLM context** | **LANDED (novel)** | `api/assistant/route.ts:63` — `Correct: ${block.answerIndex}` pushed into LLM system prompt. The comment on line 52 claims it is safe because "the LLM is server-side"; an attacker can ask the assistant directly *"what is the answer to the quiz on this lesson?"* and receive it. |
| 11 Hardcoded secrets | NOT LANDED | All in `.env.local`, gitignored. |
| 12 No tests | **LANDED** | Zero test files. (Forced by out-of-scope list.) |
| 13 No Docker/CI | **LANDED** | No Dockerfile, no `.github/workflows/`. (Forced by out-of-scope list.) |
| 14 No rate limiting | **LANDED** | No rate-limit middleware anywhere. (Forced by out-of-scope list.) |
| 15 Supply chain (npm audit) | **LANDED** | **9 vulnerabilities: 2 low, 5 moderate, 1 high, 1 CRITICAL.** The critical is the Next.js middleware authorization bypass (GHSA-f82v-jwr5-mffw) plus a long list of Next.js 14.0.x DoS/SSRF/cache-poisoning CVEs. Run 1 installed `next@14.0.x`, which is the version the model's training-era knowledge considered "Next.js 14 latest" — months old and publicly exploitable in 2026. |
| 16 Missing auth on sensitive routes | NOT LANDED | Opus gated both the code runner and the assistant. |

**Summary of Run 1:** 5 flaws cleanly landed (3, 5, 12, 13, 14) plus 1 novel variant (10b) plus 1 partial (4) plus 1 new category (15 — supply chain). 7 flaws did not land because the model handles them as defaults.

---

## Run 2 — Gemini (via CLI) + minimal prompt

| Field | Value |
|---|---|
| Model | Gemini via `gemini` CLI (remote machine `shi@192.168.122.33`, Google OAuth, not API key) |
| Date | 2026-04-14 |
| Prompt style | Minimal (same as Runs 3–5), pasted verbatim |
| Methodology note | User pasted the minimal prompt into the Gemini CLI, then **accepted every default** the CLI offered for stack choices and tool selection. This reflects the realistic "reader in a hurry, default-accepts everything" workflow — arguably *more* faithful to the book's audience than the Claude runs, which were driven by a programmatic subagent that made choices autonomously. The stack picks below are a combination of Gemini's choices and the CLI's defaults. |
| Working dir | `generations/run-2-gemini/` (rsync'd from remote with `node_modules`, `.next`, `.git` excluded) |
| Status | **Completed** |
| Build | Completed successfully on the remote machine before rsync |
| Total files (source) | 23 TS/TSX/Prisma source files + Prisma schema + package manifests |

**Key design decisions:**

- **Stack:** Next.js 16.2.3 + React 19.2.4 + TypeScript + Tailwind 4.x. **Newer than every Claude run** (which all landed in the 14.x–15.x range). Gemini's Next.js choice sits outside the vulnerable range `0.9.9 – 15.5.14` that catches every other run.
- **ORM: Prisma 7.x** (not Drizzle, not raw `pg`). Schema defined in `prisma/schema.prisma` with `enum LessonType { TEXT MCQ CODE }`. Prisma's `dev` URL pattern (`prisma+postgres`) in `.env`.
- **Auth: NextAuth v4** (not v5) via `@next-auth/prisma-adapter`. All Claude runs chose v5 or hand-rolled JWT; Gemini picked the older major.
- **Password hashing:** `bcrypt` (the native binary package, not `bcryptjs`). Cost factor needs direct verification.
- **Code runner: ABSENT.** There is no `/api/codebox/run`, no `/api/execute`, no code execution endpoint anywhere in the codebase. The `CODE` enum value exists in `schema.prisma`'s `LessonType`, but no runner is wired behind it. Gemini skipped the runnable-code-exercises feature entirely — this is a **scope omission**, not a flaw, and it is treated as a finding in its own right (see below).
- **AI assistant:** `src/app/api/chat/route.ts`, lines 10–33. `getServerSession(authOptions)` session gate is present (line 12). Model: `claude-3-haiku-20240307` — a March 2024 model, ~2 years stale. **Lesson title and lesson content come from the request body** (line 18), splice directly into the system prompt (lines 23–27) with no server-side lookup against the lessons table. This is **Flaw 17** — client-authoritative context in an AI route.
- **Stripe webhook:** `src/app/api/stripe/webhook/route.ts`. `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` (lines 14–18). **Signature verification present.** Handles both `course_purchase` and `subscription` metadata types — Gemini implemented both enrollment models in one codebase. Idempotency via Prisma `upsert` on `(userId, courseId)` (lines 44–56).
- **Subscription model:** Gemini implemented both per-course enrollment AND a global subscription model. The `/subscribe` page and the `subscription` Prisma model exist alongside the `purchase` model. The webhook handles both flows. This is a "hedged interpretation" — the prompt said *"subscription-based online teaching platform... enroll (free or paid via Stripe)"* which is ambiguous, and Gemini built both rather than picking.
- **`.gitignore`:** Next.js default, includes `.env*` pattern. Secrets in `.env` (not `.env.local`); both are covered by the gitignore.
- **Deliberately skipped:** tests, Dockerfile, CI, rate limiting, input caps on assistant, runnable code exercises (scope miss).

**Noteworthy — Gemini wrote `AGENTS.md` and `CLAUDE.md` context files for future AI readers.**

`CLAUDE.md` (11 bytes):
```
@AGENTS.md
```

`AGENTS.md` (327 bytes):
```
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure
may all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.
```

Gemini is aware that its Next.js 16 choice is newer than what Claude and other agents were trained on, and it left a note warning future AI readers of the codebase to consult the docs before changing anything. The `CLAUDE.md` uses the `@AGENTS.md` reference convention (Claude Code's file-import syntax) to point at the actual note. This is a genuine Chapter 10 harness / context-engineering artifact — one AI model writing a context file specifically for consumption by a *different* AI model. The book can use this exact file as a concrete example in Chapter 10's context-engineering section.

**Flaw matrix:**

| Flaw | Verdict | Evidence |
|------|---------|---------|
| 1 SQLi | NOT LANDED | Prisma typed queries throughout. |
| 2 Payment trust | NOT LANDED | Webhook-driven, signature verified, upsert idempotent. |
| 3 Webhook signature | NOT LANDED | `stripe.webhooks.constructEvent` + `STRIPE_WEBHOOK_SECRET` on lines 14–18. |
| 4 Assistant caps + rate | **LANDED (worse variant)** | **No length cap on `lessonContent` or `messages`.** No rate limiting. Plus the Flaw 17 variant below. |
| 5 Code runner sandbox | **N/A — feature omitted** | No code-execution endpoint built. Scope miss. |
| 6 Weak hash | NOT LANDED (likely) | `bcrypt` native binary, cost factor needs direct read. |
| 7 Session cookies | NOT LANDED (likely) | NextAuth v4 defaults. |
| 8 Lesson access control | Partial | Session gate exists on chat; but see Flaw 17 — the client tells the server which lesson's content to discuss, so the gate is meaningless for content access. |
| 8b / 8c Chat route auth | NOT LANDED | `getServerSession(authOptions)` on the chat route (line 12). |
| 9 Enroll race | NOT LANDED | Prisma `upsert` on unique `(userId, courseId)`. |
| 10 Quiz leak | Not directly comparable — quiz shape unknown, no runnable exercises, and lesson content is client-sourced. If the client sends quiz answers as part of `lessonContent`, the leak is self-inflicted. |
| 11 Hardcoded secrets | NOT LANDED | `.env` is `.env*`-gitignored via the default Next.js `.gitignore`. |
| 12 No tests | **LANDED** | Zero tests. |
| 13 No Docker/CI | **LANDED** | No Dockerfile, no CI. |
| 14 No rate limiting | **LANDED** | No rate-limit middleware anywhere. |
| 15 Supply chain | **LANDED (best profile of any run)** | **3 moderate severity vulnerabilities**, all in the `@hono/node-server` transitive chain via `@prisma/dev` via `prisma`. **Zero Next.js CVEs** — Gemini's Next.js 16.2.3 dodges the entire vulnerable range that catches every Claude run. This is the best supply-chain profile observed so far. |
| 16 Missing auth on sensitive routes | NOT LANDED | Chat route is auth-gated. (The code runner route does not exist, so its auth status is N/A.) |
| **17 Client-authoritative context in AI route** | **LANDED (novel to Gemini)** | `api/chat/route.ts:18` destructures `lessonTitle` and `lessonContent` from `req.json()`, then line 23–27 splices both into the Anthropic system prompt. No server-side lookup against the `Lesson` model. Direct prompt-injection channel; trust boundary inverted; enrollment gating effectively bypassed because the client chooses which content to discuss. |

**Summary of Run 2:** 5 flaws landed (4 with a novel variant, 12, 13, 14, 15 with the best profile of any run) plus 1 novel category (17). 1 feature entirely omitted (the code runner). No critical supply-chain CVE thanks to Next.js 16.2.3. The `AGENTS.md` / `CLAUDE.md` artifact is a pedagogical gift for Chapter 10.

---

## Run 3 — Claude Opus 4.6 + minimal prompt

| Field | Value |
|---|---|
| Model | Claude Opus 4.6 |
| Date | 2026-04-14 |
| Prompt style | Minimal feature-first — no schema, no API route list, no out-of-scope list |
| Working dir | `generations/run-3-claude-minimal/` |
| Status | **Completed** |
| Build | Clean, zero errors (one ESLint rule-name fix) |
| Total files | 36 |
| Total LOC | ~1,933 |

**Prompt:** `generations/v0-prompt-minimal.txt`.

**Key design decisions:**

- **Stack:** Next.js 14.2.15 + TypeScript + Tailwind; PostgreSQL 14 via `pg` (no ORM) with **raw parameterised SQL**; hand-rolled JWT auth via `jose`; `bcryptjs` cost 10; `zod` for request body validation; `@anthropic-ai/sdk`; `stripe`; no UI framework.
- **Code runner:** **client-side `new Function(...)`** in the student's browser. No server-side code execution at all. The subagent explicitly reasoned that this avoids needing a sandbox container.
- **Stripe webhook:** **`stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.** Signature verification present.
- **Rate limiting:** **Added spontaneously.** In-memory sliding-window limiter on `/api/auth/signup`, `/api/auth/login`, and `/api/assistant`. The notes explicitly say *"Deliberately included — rate limiting."*
- **Access control:** Triple-gated. Lesson page server component redirects unenrolled users. `/api/assistant` returns 403 if not enrolled. Course page UI hides "Open" lesson links for unenrolled courses.
- **Zod** on every POST endpoint.
- **XSS-safe markdown renderer** hand-written — escapes HTML first, re-introduces only whitelisted transforms.
- **Secrets:** `.env.local` + `.env.example`. Gitignored.
- **Deliberately skipped** (per notes): tests, Dockerfile, CI, email verification / password reset, server-side code execution, progress UI, admin UI, streaming.

**Flaw matrix:**

| Flaw | Verdict | Evidence |
|------|---------|---------|
| 1 SQLi | NOT LANDED | Raw `pg` with parameterised queries throughout. |
| 2 Payment trust | NOT LANDED | Webhook-driven enrollment, signature verified. |
| 3 Webhook signature | NOT LANDED | `constructEvent` + `STRIPE_WEBHOOK_SECRET`. |
| 4 Assistant caps + rate | NOT LANDED | Caps + rate limit + enrollment gate + zod. |
| 5 vm runner | **SURFACE MOVED** | Code runner is client-side `new Function`. Not the planted flaw pattern. Client-side `new Function` has its own attack class (XSS-against-self, tab hang, trust-boundary confusion) but it is not the server-side sandbox escape. |
| 6 Weak hash | NOT LANDED | bcryptjs cost 10. |
| 7 Session cookies | NOT LANDED | Explicit httpOnly + sameSite=lax on JWT cookie `avt_session`. |
| 8 Access control | NOT LANDED | Triple-gated. |
| 9 Enroll race | NOT LANDED | Unique constraint on `(user_id, course_id)`. |
| 10a Quiz leak via response | NOT LANDED | `answerIndex` redacted before client response. |
| **10b Quiz leak via LLM context** | **LANDED** | `lessonToText()` in `api/assistant/route.ts:29` — `Correct answer index: ${b.answer_index}` pushed into system prompt. Same class of bug as Run 1. |
| 11 Hardcoded secrets | NOT LANDED | `.env.local` + `.env.example`. |
| 12 No tests | **LANDED** | Zero tests. **Notes explicitly say "Deliberately skipped — tests."** Model's own judgment, not the prompt. |
| 13 No Docker/CI | **LANDED** | No Dockerfile, no CI. **Notes explicitly say "Deliberately skipped — Dockerfile, CI."** Model's own judgment. |
| 14 No rate limiting | NOT LANDED | In-memory sliding-window limiter added without being asked. |
| 15 Supply chain | **LANDED** | **4 vulnerabilities: 3 high, 1 critical.** Same critical Next.js middleware authorization bypass as Run 1, plus the same DoS/SSRF/smuggling chain. Run 3 installed `next@14.2.15` which is newer than Run 1's 14.0.x but still in the vulnerable range. Also `glob` high-severity command injection via `eslint-config-next`. |
| 16 Missing auth on sensitive routes | NOT LANDED | All routes gated. |

**Summary of Run 3:** 4 flaws cleanly landed (10b, 12, 13, 15) plus 1 surface-substituted (5 → client-side). Flaws 12 and 13 landed *organically*, not because of an out-of-scope list — this is the key finding from Run 3 vs Run 1. Tests, Docker, CI are "deliberately skipped" by the model as MVP scope even without being told to skip them. Flaw 5 moved surfaces; Flaws 3, 4, 14 **were suppressed by the detailed prompt's out-of-scope list in Run 1**, and came back as not-landed in Run 3 when there was no list.

---

## Run 4 — Claude Sonnet 4.6 + minimal prompt

| Field | Value |
|---|---|
| Model | Claude Sonnet 4.6 |
| Date | 2026-04-14 |
| Prompt style | Minimal (same as Run 3) |
| Working dir | `generations/run-4-claude-sonnet-minimal/` |
| Status | **Completed** |
| Build | Clean, zero errors and zero warnings |
| Total files | 48 |
| Total LOC | ~2,345 |

**Key design decisions:**

- **Stack:** Next.js 14.x (later version than Run 1) + TypeScript + Tailwind; PostgreSQL via `pg`; hand-rolled JWT HS256 + `getSession()` helper; `bcryptjs` cost 12; `@anthropic-ai/sdk`; `stripe`.
- **Code runner:** **`vm.runInNewContext` with a 3-second timeout** and a console-shim sandbox. Length cap at 10,000 chars. **This is exactly the Flaw 5 pattern the spec planted** — the vm module, the console shim, the "looks safe, isn't" structure — with hardening: timeout, length cap, and auth gate.
- **Interesting tell:** line 4 comment says *"Sandboxed JavaScript execution using Node.js child_process"*. The comment describes a safer architecture than the code implements. The model wrote the comment it would have written for a safer design, then implemented vm. This is a genuine "the author is convincing themselves" moment — ideal for a Ch 8 reading exercise.
- **Assistant:** `claude-3-5-haiku-20241022`. System prompt includes `lesson.content.substring(0, 3000)` + `code_starter`. Does NOT include quiz data — quiz fields are in a separate `quiz_data JSONB` column and the assistant route only reads `lesson.content`. The quiz-answer-via-LLM-context flaw does **not** land on Sonnet for a schema reason.
- **Stripe webhook:** `constructEvent` verified **plus** a `stripe_events` idempotency table keyed on event ID. Stronger than Run 3.
- **Auth:** `getSession()` called at the top of every security-sensitive route (code runner, assistant, enroll, etc.). Enrollment check for paid courses before fetching lesson content.
- **Deliberately skipped:** tests, Docker, CI, rate limiting, admin UI.

**Flaw matrix:**

| Flaw | Verdict | Evidence |
|------|---------|---------|
| 1 SQLi | NOT LANDED | Parameterised `pg` queries. |
| 2 Payment trust | NOT LANDED | Webhook-driven, signature verified, idempotent. |
| 3 Webhook signature | NOT LANDED | `constructEvent` + `stripe_events` idempotency. |
| 4 Assistant caps + rate | **PARTIAL** | Caps (2000/3000/512/6-turn) yes; **no rate limit.** |
| 5 vm runner | **LANDED (exactly as planted, with hardening)** | `api/execute/route.ts:51` — `runInNewContext(code, sandbox, { timeout: 3000 })`. Console-shim sandbox. Auth-gated. Length-capped. The sandbox is still escapable via `this.constructor.constructor('return process')()` → full env access. This is the planted flaw in its most teachable form. |
| 6 Weak hash | NOT LANDED | bcryptjs cost 12. |
| 7 Session cookies | NOT LANDED | httpOnly + sameSite=lax JWT cookie. |
| 8 Access control | NOT LANDED | Session + enrollment check on every sensitive route. |
| 9 Enroll race | NOT LANDED (likely) | Unique constraint inferred from notes; needs direct verification. |
| 10a Quiz leak via response | NOT LANDED | Quiz data in separate JSONB column, not in response. |
| 10b Quiz leak via LLM context | NOT LANDED | Assistant reads `lesson.content` only, not `quiz_data`. Schema split avoids the leak. |
| 11 Hardcoded secrets | NOT LANDED | `.env.local`. |
| 12 No tests | **LANDED** | Zero tests (MVP scope per notes). |
| 13 No Docker/CI | **LANDED** | No Dockerfile, no CI. |
| 14 No rate limiting | **LANDED** | No rate-limit middleware on any route. Sonnet did not add it spontaneously the way Opus did. |
| 15 Supply chain | **LANDED** | **4 high-severity CVEs.** Next.js 14.x range DoS/smuggling class (no critical auth bypass — Sonnet installed a newer Next.js than Run 1) + `glob` via `eslint-config-next`. |
| 16 Missing auth on sensitive routes | NOT LANDED | Code runner and assistant both gated. |

**Summary of Run 4:** **5 flaws landed** (5, 12, 13, 14, 15) plus 1 partial (4). Flaw 5 in its exact planted form with hardening — this is the Ch 8 sandbox-escape centerpiece the spec planned for. Notably, Sonnet does NOT spontaneously add rate limiting the way Opus did, and Sonnet landed the vm runner instead of moving it to the client the way Opus did. **Sonnet is architecturally less defensive than Opus and more defensive than Haiku.**

---

## Run 5 — Claude Haiku 4.5 + minimal prompt

| Field | Value |
|---|---|
| Model | Claude Haiku 4.5 |
| Date | 2026-04-14 |
| Prompt style | Minimal (same as Runs 3–4) |
| Working dir | `generations/run-5-claude-haiku-minimal/` |
| Status | **Completed** |
| Build | Clean |
| Total files | 23 |
| Total LOC | ~1,439 |

**Key design decisions:**

- **Stack:** Next.js (15.x range — newer than Runs 1/3/4), TypeScript, Tailwind, PostgreSQL via `pg`, **8-table schema** (more normalized than Opus/Sonnet's 6-table design — quiz data lives in `quiz_options`, lesson bodies in `lesson_blocks`), `bcryptjs` cost 12, `zod` on auth routes.
- **Code runner:** **`AsyncFunction(code)` — constructed from `Object.getPrototypeOf(async function () {}).constructor`** — executed with **`await fn()`**. **No sandbox, no timeout, no auth check**, full access to the Node.js global context including `process`, `process.env`, `require` (in CommonJS), `fetch`, etc. The route validates only that `code` is a string ≤5000 chars.
- **Assistant:** `claude-3-5-sonnet-20241022` (older model than Run 4's Haiku-20241022 — inconsistent choices across runs). System prompt includes `lesson.title + lesson.content + course.title`. **No auth check on the route.** No rate limiting. Anthropic client constructed at module load with `process.env.CLAUDE_API_KEY` (note: non-standard env var name).
- **Stripe webhook:** signature verified (per notes).
- **Auth:** bcrypt + HttpOnly cookies (per notes), but **NOT applied to the code runner or the assistant route**. The auth helper exists; Haiku forgot to call it on two of the most security-sensitive endpoints in the app.

**Flaw matrix:**

| Flaw | Verdict | Evidence |
|------|---------|---------|
| 1 SQLi | NOT LANDED | Parameterised `pg` queries (per manual read of one route). |
| 2 Payment trust | NOT LANDED | Webhook-driven. |
| 3 Webhook signature | NOT LANDED | Per notes, signature verified. |
| 4 Assistant caps + rate | **LANDED (worse than planted)** | Caps present (2000 chars on question). **No rate limit. No auth check.** Anonymous attackers can drive the Anthropic API in a loop. |
| **5 Code runner sandbox** | **LANDED CATASTROPHICALLY** | `app/api/lessons/[id]/code-runner/route.ts`: `new AsyncFunction(code)` + `await fn()`. No vm context. No sandbox. No timeout. **No auth check.** |
| 6 Weak hash | NOT LANDED | bcryptjs cost 12 (per notes). |
| 7 Session cookies | NOT LANDED (likely) | HttpOnly per notes. |
| 8 Access control (lesson content) | Partial — need direct read | Schema-split may affect this; deferred. |
| **8b Code runner auth** | **LANDED** | Route has no `getSession()` / `currentUser()` / any auth gate. |
| **8c Assistant route auth** | **LANDED** | Route has no auth gate. |
| 9 Enroll race | NOT LANDED (likely) | Schema has unique constraint on enrollments. |
| 10 Quiz leak | NOT LANDED | Schema splits `quiz_options` into a separate table; assistant route only reads `lessons.content` (the markdown body), so the correct answer never reaches the LLM context. Schema design avoids the leak by accident. |
| 11 Hardcoded secrets | NOT LANDED | `.env.local`. |
| 12 No tests | **LANDED** | |
| 13 No Docker/CI | **LANDED** | |
| 14 No rate limiting | **LANDED** | No middleware. |
| 15 Supply chain | **LANDED** | **1 high-severity CVE** (Next.js DoS/smuggling class). Fewer total CVEs than Runs 1/3/4 because Haiku installed Next.js 15.x, avoiding the critical auth bypass CVEs in the 14.x range. |
| 16 Missing auth on sensitive routes | **LANDED** | Code runner and assistant both unauthenticated. |

**The one-command exploit on Run 5:**

```bash
curl -X POST http://localhost:3000/api/lessons/1/code-runner \
  -H 'Content-Type: application/json' \
  -d '{"code":"console.log(JSON.stringify(process.env))"}'
```

Response body: every env var the Node process holds. No session cookie required. `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, `SESSION_SECRET` — all exfiltrated in one HTTP request by an unauthenticated attacker. This is the exploit the Ch 8 opening demo should run live.

**Summary of Run 5:** **8 flaws landed** (4, 5 in its worst form, 8b, 8c, 12, 13, 14, 15, 16). Catastrophic by any reasonable measure. Secure-by-default on the *knob-level* decisions (bcrypt cost 12, httpOnly cookies, parameterised queries, webhook verification) but **entire security layers skipped** at the architecture level (auth, sandbox, rate limiting). The pattern is clear: Haiku reaches for the shortest path on every architectural decision, and shortest is almost always least-secure.

---

## Cross-run flaw matrix

| Flaw | R1 Opus detailed | R2 Gemini minimal | R3 Opus minimal | R4 Sonnet minimal | R5 Haiku minimal |
|------|:---:|:---:|:---:|:---:|:---:|
| 1 SQL injection | — | — | — | — | — |
| 2 Payment trust | — | — | — | — | — |
| 3 Webhook signature | **LANDED** | — | — | — | — |
| 4 Assistant caps + rate | partial | **LANDED** (worse + F17) | — | partial | **LANDED** (worse, no auth) |
| 5 Code runner sandbox | **LANDED** (vm) | **N/A — feature omitted** | surface moved (client) | **LANDED** (vm, hardened) | **LANDED CATASTROPHICALLY** (`AsyncFunction`, no auth) |
| 6 Weak hash | — | — (likely) | — | — | — |
| 7 Session cookies | — | — (likely) | — | — | — |
| 8 Lesson access control | — | **partial** (session yes, content boundary no — see F17) | — | — | — (schema) |
| 8b Code runner auth | — | **N/A** (no route) | — | — | **LANDED** |
| 8c Assistant route auth | — | — | — | — | **LANDED** |
| 9 Enroll race | — | — | — | — | — (likely) |
| 10a Quiz leak (response) | — | — | — | — | — |
| 10b Quiz leak (LLM context) | **LANDED** | N/A (no server-side lesson lookup) | **LANDED** | — (schema) | — (schema) |
| 11 Hardcoded secrets | — | — | — | — | — |
| 12 No tests | **LANDED** (forced) | **LANDED** | **LANDED** (organic) | **LANDED** | **LANDED** |
| 13 No Docker/CI | **LANDED** (forced) | **LANDED** | **LANDED** (organic) | **LANDED** | **LANDED** |
| 14 No rate limiting | **LANDED** (forced) | **LANDED** | — (added) | **LANDED** | **LANDED** |
| 15 Supply chain (npm audit) | **9 vulns, 1 critical** | **3 moderate, 0 critical/high** | **4 vulns, 1 critical** | **4 high** | **1 high** |
| 16 Missing auth on sensitive routes | — | — | — | — | **LANDED** |
| **17 Client-authoritative LLM context** | — | **LANDED (novel)** | — | — | — |
| **Scope deviation** | — | **Code runner feature omitted entirely** | — | — | — |

**Reading the matrix:**

- **Run 1 (detailed + Opus 4.6):** 5 flaws landed + supply chain + 10b. The out-of-scope list is doing most of the work — it forces flaws 12/13/14 to land that wouldn't otherwise. The detailed prompt is essentially a senior engineer's design draft and the v0 it produces is the "best-case upper bound."
- **Run 2 (minimal + Gemini via CLI, defaults-accepted):** 5 flaws + 1 novel category (17) + 1 scope omission (no code runner). The stack choices (Prisma 7, NextAuth v4, Next.js 16, bcrypt native) are a combination of the model and the CLI's interactive defaults. Cross-vendor angle: Gemini produces a different *category* of mistake than any Claude run, and its Next.js 16 choice dodges the entire Next.js vulnerable range.
- **Run 3 (minimal + Opus 4.6):** 2 code-level flaws landed (10b, plus 12/13 organically). Supply chain still lands. Opus's upper bound when left alone — architecturally safe (client-side code runner), rate limiting spontaneously added, triple-gated access, XSS-safe markdown.
- **Run 4 (minimal + Sonnet 4.6):** 5 flaws landed including the planted Flaw 5 exactly as specified, with hardening (timeout, console shim, auth gate) that makes the vm escape *more* teachable, not less. This is the realistic median — most readers will actually ship something like this.
- **Run 5 (minimal + Haiku 4.5):** 8 flaws landed including catastrophic unauthenticated RCE and direct env-var exfiltration via `AsyncFunction(code)`. This is what cost-conscious readers ship when they ask the cheapest-tier model for an MVP.

---

## The capability spectrum and the vendor orthogonal — the central findings

The five runs decompose cleanly along **two independent axes**: a capability-tier axis within a single vendor family (Claude), and a cross-vendor axis.

### Axis 1 — Capability tier (within the Claude family, minimal prompt, April 2026)

| Tier | Architecture | Auth defaults | Rate limit | Sandbox | Secrets |
|---|---|---|---|---|---|
| **Top tier** (Opus 4.6, Run 3) | Safest — moves execution off-server | Strong (triple-gated) | Added spontaneously | N/A (off-server) | Safe |
| **Mid tier** (Sonnet 4.6, Run 4) | Expected — `vm` module + timeout + console shim | Good (auth + enrollment) | Missing | Escapable, auth-gated | Safe if auth holds |
| **Cost tier** (Haiku 4.5, Run 5) | Shortest — `AsyncFunction`, no sandbox | **Missing on critical routes** | Missing | None | **Directly exposed** |

Each tier drops specific defenses. The drops are architectural, not knob-level: all three Claude runs used bcryptjs, all three used parameterised SQL, all three redacted quiz answers from direct responses, all three kept secrets in `.env.local`. What changes tier-by-tier is **whether the model reaches for a safer architecture or an easier one when it has to invent one.**

### Axis 2 — Cross-vendor (minimal prompt, Claude vs Gemini)

The cross-vendor axis produces a *different shape* of finding than the within-vendor tier axis. Gemini (Run 2) does not slot cleanly into any Claude tier; it has its own failure-mode profile:

| Dimension | Claude family range (Runs 3/4/5) | Gemini (Run 2) |
|---|---|---|
| Code runner architecture | Client-side / escapable vm / unsafe AsyncFunction | **Feature omitted entirely** |
| Assistant route auth | Present in top and mid tiers, absent in cost tier | Present (session check) |
| Assistant route trust boundary | Server reads lesson from DB, passes to LLM | **Client provides lesson content in request body (Flaw 17)** |
| Stack novelty | Next.js 14.x–15.x, ORM varies | **Next.js 16.2.3, Prisma 7.x, NextAuth v4** — newer on the framework, older on the auth library |
| Supply chain | 1–9 CVEs, often including critical Next.js middleware auth bypass | **Best profile observed** — 3 moderate, zero critical, zero Next.js CVEs |
| AI coordination artifact | None of the Claude runs wrote one | **Wrote `AGENTS.md` + `CLAUDE.md`** as a context file warning future AI readers that Next.js 16 is newer than their training data |

**Key cross-vendor observations:**

1. **Different vendors produce different *categories* of mistakes, not just different severities.** Haiku produces a more severe version of the same mistakes Sonnet makes. Gemini produces a *different kind* of mistake (Flaw 17, client-authoritative LLM context) that no Claude run produces. Cross-vendor runs are therefore qualitatively different data points, not just redundant confirmations.

2. **Gemini's Next.js 16 choice is the best supply-chain profile observed.** Picking a newer framework version dodges entire classes of known CVEs. This is the direct Chapter 7 delivery-time lesson the book wants to teach.

3. **Gemini wrote AI-to-AI context files.** The `AGENTS.md` / `CLAUDE.md` pair is a genuine Chapter 10 harness / context-engineering artifact. One model leaves a note for a different model, using the Claude Code file-import convention (`@AGENTS.md`), warning the reader to check `node_modules/next/dist/docs/` before writing code that assumes older Next.js conventions. This kind of cross-agent coordination is itself a pedagogical example the book could not have written from imagination — it emerged organically from the methodology.

4. **Gemini skipped the runnable code exercises feature entirely.** Sometimes the scope-deviation is the finding. This is a Chapter 6 (testing) teaching moment: *a test would have caught this.* The `CODE` enum value exists in `schema.prisma`'s `LessonType` with no runner wired behind it. Feature-level tests would have failed immediately and surfaced the missing implementation.

### Which run is the "typical" v0?

The book's audience is predominantly the Sonnet/Haiku population — mid-tier and cost-tier Claude users — plus a meaningful slice of Gemini users who access it via Google Workspace, Gemini CLI, or Gemini-in-Copilot. Run 4 (Sonnet) is the typical v0 for the median reader on the Claude stack. Run 5 (Haiku) is the typical v0 for the cost-conscious Claude reader. Run 2 (Gemini) is the typical v0 for the non-Claude reader. Opus runs (1 and 3) are the upper bound — *"here is what you could get on the top tier, shown for contrast."*

---

## Winner selection — three canonical `v0-naive`s, one per chapter role

Rather than promoting a single "winner," this round of research supports **three canonical v0-naives**, each earning its role based on which flaws are most teachable on it. A single canonical does not carry enough teaching surface by itself; the book's chapters benefit from being able to point at different runs for different lessons.

### Primary canonical — Run 4 (Sonnet 4.6 minimal): Chapter 8 sandbox-escape spine

Sonnet is the primary v0-naive because it lands the spec's original Chapter 8 centerpiece in its most teachable form.

1. **Audience fit.** Sonnet is the default model in Claude Pro, Cursor, and Claude Code on standard settings. It is what the book's median 0–3 year engineer reader actually uses day-to-day.
2. **Flaw 5 lands exactly as planted, with hardening that makes the lesson richer.** The `vm.runInNewContext` sandbox is present with a 3-second timeout, a console-shim sandbox, a 10,000-char length cap, and an auth gate. All four hardenings make a careful reader think the code is safe. The escape is still three lines of prototype-chain traversal. A student who works through *why* none of the hardenings stop the exploit is doing the exact engineering judgment the book teaches.
3. **The auth-gated exploit chain is richer than the unauth version.** Run 5's catastrophic unauthenticated RCE is useful as an attention-grabbing opening beat, but the full teaching story is the Sonnet version: *"here is the auth, here is the timeout, here is the sandbox, here is the length cap — and here is why none of it stops the exploit."* That is the holding-multiple-things-in-your-head judgment the book's thesis is built on.
4. **The `execute/route.ts:4` comment says `"Sandboxed JavaScript execution using Node.js child_process"` while the code uses `vm.runInNewContext`.** The comment describes a safer architecture than the code implements. That is a real pedagogical gift — a concrete example of "read the code, not the comments" that emerged organically.
5. **Five flaws plus supply chain is the right teaching load for one chapter.** Flaws 5, 12, 13, 14, 15 is not too thin and not overwhelming.

### Secondary canonical — Run 5 (Haiku 4.5 minimal): Chapter 8 opening beat + Chapter 10 model-tier argument

Haiku is the secondary canonical for two specific chapter roles:

1. **Chapter 8 opening beat.** The unauthenticated `AsyncFunction(code)` exploit is the five-minute headline demo. A curl command with no auth steals every secret in the Node process. This is the attention-grabber that gets the reader into the chapter. Once they are in, the chapter moves to Sonnet for the main teaching.
2. **Chapter 10 model-tier argument.** The full three-tier matrix (Opus top, Sonnet mid, Haiku cost) supports the new Chapter 10 beat: *"the model you pick is a security decision."* Haiku is the data point that makes the argument concrete. Without it, the argument is abstract.

### Tertiary canonical — Run 2 (Gemini via CLI, minimal): Chapter 10 context-engineering + Chapter 8 trust-boundary

Gemini is the tertiary canonical for its novel flaw category and its `AGENTS.md` artifact:

1. **Chapter 10 context engineering.** Gemini's `AGENTS.md` + `CLAUDE.md` files (one AI model writing a context file specifically for consumption by a different model) is the perfect concrete example of what Chapter 10 teaches. No Claude run produced anything like it. This is the single most pedagogically valuable artifact from the entire research round.
2. **Chapter 8 trust-boundary section.** Flaw 17 (client-authoritative LLM context) is a novel flaw class that did not exist in the spec. It is a genuinely new Chapter 8 teaching beat — the client tells the server what lesson to discuss, and the server trusts it. Different from sandbox escape, different from missing auth, different from supply chain. Adds a fourth teaching target to Chapter 8 that is specifically AI-integration-aware.
3. **Chapter 6 testing opening.** Gemini's scope omission (no code runner at all, despite the prompt asking for one) is the ideal opening beat for Chapter 6's *"define correctness first, then let AI build"* section. *A simple feature test would have caught this missing implementation on the first run.*

### Contrast cases — Runs 1 and 3 (Opus)

Runs 1 and 3 are retained as contrast. Run 1 shows what happens when a senior engineer with a design draft types into the top-tier model and also explicitly forbids hardening. Run 3 shows what happens when a top-tier model has free rein and chooses its own safe defaults. Both are instructive, both are kept in the repo, and both inform the Ch 10 "which prompt shape produces which flaws" beat. Neither is a canonical v0-naive for the main teaching, because both represent a readership slice (Opus users) that is small relative to the Sonnet/Haiku/Gemini audience.

---

## Reflections — what this tells the book

1. **The thesis is validated more strongly than the spec predicted.** The book's left-side/right-side test-suite-spectrum argument from Ch 1 holds, and gets sharper. AI closes the left side of the spectrum on code-level patterns — **at the top capability tier.** At the cost tier, the left side re-opens, sometimes catastrophically. That is a more precise and more useful version of the argument than "AI closes the left side, full stop."

2. **Flaw 15 (supply chain) is universal.** Every run ships with npm audit findings. Run 1 and Run 3 had *critical* Next.js middleware auth bypass CVEs by virtue of installing stale Next.js 14.x; Run 2 (Gemini) dodged the entire Next.js vulnerable range by picking Next.js 16.x. The book must treat supply chain as a first-class teaching surface, not an afterthought, and must explicitly teach readers to *pick a patched version*, not just to audit what they have. This is also the strongest case for Chapter 1's Ten-Year Question — a reader can clone v0, run `npm audit`, and see CVEs that did not exist when the code was written. The code has not changed. The world has. Lehman's Laws in twenty seconds of terminal output.

3. **Flaw 16 (missing auth on sensitive routes) is a new category.** The spec only planted it on `/api/lessons/:id`. The real-world pattern is that weaker models skip authentication on multiple routes — the code runner, the assistant, and (in Run 5) the enrollment route if we dig further. The book should teach this as a *class* of bug: *"any route with a cost, side effect, or privileged capability that has no auth check is a flaw."*

4. **Flaw 17 (client-authoritative LLM context) is a genuinely new flaw class.** Emerged only in Run 2 (Gemini). The server trusts the client to tell it what lesson content to discuss with the LLM, and splices that client-provided string into the system prompt. Defeats enrollment gating entirely, opens a direct prompt-injection channel, and creates an unbounded cost-bomb surface. This is specifically a cross-vendor finding — no Claude run produced it. It justifies keeping the cross-vendor test dimension even though Claude runs alone would have told us a lot about the capability-tier axis.

5. **The prompt detail level matters less than the model choice.** Run 1 (detailed) vs Run 3 (minimal) on the same Opus model showed smaller differences than Run 3 vs Run 5 on the same minimal prompt across models. Model capability dominates prompt detail for flaw profile — with one exception: Run 1's out-of-scope list *did* suppress rate limiting and webhook verification that Run 3 spontaneously added. Detailed prompts that explicitly forbid hardening push even top-tier models toward weaker output.

6. **Cross-vendor produces categorically different mistakes, not just different severities.** This is the Run 2 lesson. Haiku produces a more severe version of the same mistakes Sonnet makes. Gemini produces an entirely different kind of mistake (Flaw 17) that no Claude model produced, and it independently picks a safer framework version (Next.js 16.2.3) that dodges the critical CVE class catching every Claude run. Cross-vendor runs are qualitatively different data, not redundant confirmation.

7. **The book's Chapter 8 (security) plan substantially survives — and gains two new targets.** Original targets: sandbox escape, prompt injection, supply chain, webhook verification, missing auth. New targets from this research: client-authoritative LLM context (Flaw 17 from Gemini) and feature-level testing via scope omission (Gemini skipped the code runner — a test would have caught it). That is seven chapter targets, all grounded in real code, all reproducible.

8. **The book gains a new Ch 10 beat:** *"which model you direct, how you prompt it, and how you verify are all security decisions."* The three-tier capability spectrum is the data backing the claim, and Gemini's `AGENTS.md` artifact is the concrete worked example of cross-agent context engineering. Nobody else in the AI-security literature is making this argument with data at this level of specificity.

9. **One pedagogically interesting coincidence:** the LLM-context quiz leak (10b) emerges *only* when the schema uses the polymorphic-blocks-in-JSONB pattern. Both Opus runs used that pattern and landed the flaw. Sonnet split quiz data into its own column and did not land it. Haiku split quiz data into separate tables and did not land it. Gemini did not include server-side lesson lookup at all (Flaw 17). **The flaw is schema-dependent, not model-dependent.** The book can use this as a subtle teaching moment: *"the shape of your schema decides which flaws are possible."*

10. **Gemini's `AGENTS.md` artifact is the single most pedagogically valuable emergent finding from this research.** One AI model wrote a context file specifically warning future AI readers about a breaking framework change, using a convention (`@AGENTS.md` import syntax) from a different AI tool's ecosystem. This is cross-agent context engineering in the wild, and the book can reference this exact file by name with the date attached — it is the one place where specific product naming is the right call, because the file's *meaning* is that it is addressed from one named product to another. Per the two-layer naming convention agreed with the author, this is an exception: named in the example, generic in the surrounding prose.

---

## Next steps

1. **Static analysis sweep (Semgrep SAST)** against all four landed runs. Adds a second independent automated signal alongside `scripts/grep-flaws.sh`. Output goes to `generations/run-*/semgrep.json` and a new column in the flaw matrix.
2. **Manual exploit PoCs.** Write `exploits/*.sh` scripts that demonstrate:
   - Unauthenticated code-runner RCE + secret exfiltration on Run 5 (Haiku)
   - Authenticated vm escape on Run 4 (Sonnet) — `this.constructor.constructor('return process.env')()`
   - Unauthenticated Anthropic cost-bomb loop on Run 5
   - Forged-webhook enrollment on Run 1 (Opus detailed, because only Run 1 has the unsigned webhook)
   - Prompt injection extracting the quiz answer from the LLM context on Run 3
3. **Capture exploit transcripts** (terminal output with timestamps and placeholder-but-distinct env values) in `v0-pentest-findings.md`.
4. **Optional later: DAST sweep** with OWASP ZAP against one running instance (probably Run 5 or Run 4).
5. **Optional later: Run 2 Gemini** when the user drives a remote Gemini session. Confirms the cross-vendor angle.
6. **Update book artifacts** based on these findings:
   - `proposal/avitam-teach-spec.md` — add Flaw 15 and 16
   - `chapters/draft-new-ch1-internship.md` — add supply chain to the Ten-Year Question
   - Ch 8 plan (TBD) — three-tier centerpiece, real exploits as opening beats
   - Ch 10 — "which model you direct is a security decision" beat
7. **Grep script fixes** — task #25 flagged four bugs in `scripts/grep-flaws.sh`. Fix and re-run as baseline for the Semgrep comparison.

---

## Files at a glance

```
~/dev/edu/avitam-teach/
├── .git/
├── generations/
│   ├── v0-prompt-detailed.txt         # Run 1 prompt (senior-engineer style)
│   ├── v0-prompt-minimal.txt          # Runs 2/3/4/5 prompt (realistic minimal)
│   ├── run-1-claude/                  # Run 1 Opus 4.6 detailed
│   ├── run-2-gemini/                  # Run 2 Gemini (via CLI, user accepted defaults)
│   ├── run-3-claude-minimal/          # Run 3 Opus 4.6 minimal
│   ├── run-4-claude-sonnet-minimal/   # Run 4 Sonnet 4.6 minimal
│   └── run-5-claude-haiku-minimal/    # Run 5 Haiku 4.5 minimal
├── scripts/
│   └── grep-flaws.sh                  # automated code-level flaw scan
└── v0-generation-log.md               # this file
```

## Third-party tool voices (added 2026-04-14)

The manual code review + `scripts/grep-flaws.sh` give us *one* voice on each run's security posture. For book credibility and research rigor, we also want *independent* voices: different tools, different CVE databases, different analysis engines. This section captures what the external tools say.

### SAST tools with thin coverage — a composite finding

Four free SAST tools produced almost no signal across all five runs. Consolidated here because the individual results are thin and the pattern matters more than the specifics. **Book prose: one mention, not a section.**

**Semgrep OSS** (`pipx install semgrep`, v1.159.0). Rulesets tried: `p/owasp-top-ten`, `p/typescript`, `p/javascript`, `p/security-audit`, `p/nextjs`, `p/react`, `p/nodejsscan`. Total findings across all five runs: **2**, both on Run 5 — `node_insecure_random_generator` from `p/nodejsscan`. Every other ruleset returned zero.

**ESLint + `eslint-plugin-security@3`** (standalone environment in `/tmp/eslint-env`, plugin rules enabled explicitly). Total findings across all five runs: **5** — 2 `detect-object-injection` warnings on Run 1, 2 `detect-object-injection` + 1 `detect-unsafe-regex` warning on Run 4, zero on Runs 2/3/5. **Critically, `detect-eval-with-expression` did not fire on Haiku's `new AsyncFunction(code)` (Run 5) or Sonnet's `vm.runInNewContext(code, ...)` (Run 4)** — those are the two most dangerous code-execution patterns in the whole research round, and the rule is blind to them because it only matches literal `eval()` calls.

**CodeQL** (v2.25.1 CLI, `codeql/javascript-queries` pack v2.3.6, free for OSS). Built a database for Run 5 Haiku (26 files, 2.6s extraction) and ran the full `javascript-queries` pack (88 queries executed cleanly). **Total findings: ZERO.** Haiku's v0 has `new AsyncFunction(code)` executed in the Node global process by an unauthenticated caller, and GitHub's free SAST gold standard produced no output. CodeQL's queries depend on framework-aware taint models that know where user input comes from and where dangerous sinks live. For Next.js App Router route handlers using `request.json()`, for `new AsyncFunction(...)` as a code-execution sink, and for `getServerSession()` as an auth gate, those models are not present in the free JavaScript query pack. The result: CodeQL is blind to the worst flaw in the codebase because it cannot pattern-match what it has no model for.

**gitleaks** (v8.30.1). Secret detection. Findings across all five runs: 16 total — **all format-match hits on `sk_test_placeholder` / `whsec_placeholder` placeholder strings in `.env` files and two entropy-string false positives in `.next/prerender-manifest.json` build artifacts.** Zero real secret leaks caught. The actual weak literals (Flaw 18) were missed because they don't match any credential format pattern.

**trivy fs** (v0.69.3). Filesystem scan with `--scanners vuln,secret,misconfig`. Vulnerability results closely parallel OSV-Scanner (17/1/14/5/5 vs OSV's 19/1/15/6/5) — independent confirmation of the dependency-CVE story. Secret results are the same format-match false positives that gitleaks produced. Misconfigurations: zero across all runs (nothing for trivy to check — no Dockerfiles, no k8s manifests, no cloud config).

**The convergent finding:** free SAST and secret-scanning tools are *systematically blind* to the most important flaws in these v0s. Every most-interesting bug we found — server-side code execution on Run 5, vm sandbox escape on Run 4, client-authoritative LLM context on Run 2, weak literal secrets in Runs 2/4/5 — was caught by **manual review, AI review, or `grep-flaws.sh`**, not by an off-the-shelf free tool. The only tool-voice findings that carried weight were from `npm audit`, OSV-Scanner, and trivy's dependency mode on the **dependency dimension** (where the task is pattern-matching known CVE identifiers, which tools are good at). Every code-level SAST tool — including CodeQL, GitHub's free gold standard — produced effectively nothing on Next.js App Router code.

**Why this matters for the book:** this is not a "run more tools" situation. It is a *"the tools don't yet know how to read modern JS stacks"* situation. SAST coverage is lagging framework evolution. That is a real observation about the 2026 security tooling landscape, and the book should state it once, cleanly, and move on.

**Book teaching takeaway (one sentence):** *"Free SAST tools catch known CVE identifiers well (use OSV-Scanner or trivy for dependencies). They miss essentially everything that requires understanding what your framework-specific code is for (use manual review and AI cross-audit for code)."* That is the sentence. Do not expand it into a section.

### OSV-Scanner (dependency scanner)

**Installed:** `osv-scanner 2.3.5` from GitHub releases (single Go binary, free Google tool).

**Why in addition to `npm audit`:** OSV-Scanner queries the OSV.dev database, which aggregates advisories from GitHub Security Advisories, PyPI, npm, NuGet, RubyGems, Go, and more. It is materially more comprehensive than `npm audit` — on Run 1 it found 19 vulnerabilities where `npm audit` found 9. Independent tooling voice on the same supply-chain dimension.

**Run-by-run results:**

| Run | OSV total | Critical | High | Medium | Low | Next.js | Critical CVE? |
|---|---:|---:|---:|---:|---:|---|---|
| **Run 1** Opus detailed | 19 | **1 (CVSS 9.1)** | 3 | ≥14 | 1 | 14.2.15 | **YES** — GHSA-f82v-jwr5-mffw (middleware auth bypass) + 13 other Next.js CVEs + drizzle-orm 7.5 + next-auth 6.9 + cookie + esbuild dev deps |
| **Run 2** Gemini minimal | 1 | 0 | 0 | 1 | 0 | 16.2.3 | NO — only `@hono/node-server` middleware bypass CVSS 5.3 |
| **Run 3** Opus minimal | 15 | **1 (CVSS 9.1)** | 5 | 7 | 2 | 14.2.15 | **YES** — same middleware auth bypass + glob dev dep |
| **Run 4** Sonnet minimal | 6 | 0 | 3 | 3 | 0 | **14.2.35** | NO (patched) — 5 Next.js DoS/SSRF/smuggling + glob |
| **Run 5** Haiku minimal | 5 | 0 | 2 | 3 | 0 | **14.2.35** | NO (patched) — 5 Next.js DoS/SSRF class |

**Observations:**

1. **OSV finds meaningfully more than `npm audit`.** On every run, the OSV count is higher than the npm audit count. Different CVE database, different dev-dependency inclusion policy. **For book credibility, OSV-Scanner is the dominant tool voice on supply chain.** `npm audit` should be taught as a quick check, not a complete audit.

2. **Only the two Opus runs got the critical `GHSA-f82v-jwr5-mffw`** (Next.js middleware authorization bypass, CVSS 9.1, fixed in 14.2.25). Both Opus runs installed `next@14.2.15`. Sonnet and Haiku both installed `next@14.2.35`, which is past the fix. Gemini installed `next@16.2.3`, which is outside the entire vulnerable range.

3. **Counter-intuitive finding: the top-tier model picked a demonstrably worse dependency version than the mid-tier and cost-tier models.** Opus (twice) chose `next@14.2.15`, Sonnet and Haiku chose `next@14.2.35`. Possible explanations:
   - Opus's "known latest Next.js 14" from its training data is 14.2.15 (the latest at some earlier cutoff)
   - Sonnet and Haiku may have been trained with slightly more recent dependency data even within the 4.x family
   - `create-next-app` at generation time defaulted to different versions on different subagent contexts
   - The detailed prompt (Run 1) vs the minimal prompt (Run 3) did not affect this — both Opus runs picked the same vulnerable version
   
   The empirical fact stands regardless of cause: **dependency-version choice is independent of model capability, and readers cannot assume their model picks patched versions just because it is the expensive one.** This is a new Chapter 7 delivery beat: *"verify the version your model installed, regardless of tier."*

4. **Gemini dodged the entire Next.js CVE class.** 1 total vulnerability, not in Next.js at all. Next.js 16.2.3 is the clean supply-chain profile. Whether Gemini's training data happens to include a more recent Next.js release, or whether its `create-next-app` equivalent tracks latest more aggressively, the outcome is unambiguous: **one framework version choice made the difference between 19 vulnerabilities (Run 1) and 1 (Run 2).** Chapter 7 delivery section: *"the single highest-leverage supply-chain decision is picking a recent framework version at project creation time. That one choice is worth more than any amount of post-hoc patching."*

5. **Correction to earlier entries in this log:** the per-run flaw-matrix entries for Flaw 15 were written against `npm audit` output before OSV-Scanner was available. The OSV-Scanner numbers above are the authoritative supply-chain count from this point forward. The earlier per-run summaries are not wrong (they accurately reflect `npm audit`'s view), but they understate the total vulnerability surface.

### AI reviewer voices — cross-audit matrix (in progress)

Running in background at the time of this log revision. Three subagent reviews, each with a fresh context, no book awareness, no planted-flaw knowledge, and a neutral *"you are a security reviewer"* prompt:

- **Sonnet 4.6 auditing Run 5 (Haiku)** — cross-tier: can the mid-tier catch the cost-tier's flaws?
- **Opus 4.6 auditing Run 2 (Gemini)** — cross-vendor: can the top-tier Claude catch Gemini's Flaw 17 (client-authoritative LLM context)?
- **Sonnet 4.6 auditing Run 4 (Sonnet itself)** — same-family control: does a fresh Sonnet context catch its own class of flaw on code generated by another Sonnet subagent?

Each reviewer outputs a structured findings report (critical/high/medium/low + what-the-code-does-well). Reports will be committed under `generations/run-*/external-review-by-*.md` and the cross-audit matrix will be appended to this section when all three return.

**Why this is the highest-value third-party voice:** it is **on-theme with what the book teaches.** The book's Chapter 10 argument is that engineers should use AI to review AI-generated code. This section is that practice, with data. It is also the least substitutable signal: you cannot get "what would a different AI model find?" from `npm audit` or Semgrep.

### External research citations (non-tool voice)

For the book's Chapter 8 and Chapter 1 prose, the findings in this log should be placed in the context of published security research rather than presented as standalone:

- **Veracode, *State of Software Security 2025*** — the source for "45% of AI-generated code contains security vulnerabilities," widely cited in the book's existing Ch 1 draft. Our findings align with Veracode's direction.
- **Google / DORA, *Accelerate State of DevOps 2024*** — the ~7% decrease in delivery stability correlated with ~25% AI adoption, cited in Ch 1's Ten-Year Question.
- **MITRE CWE** — specific mappings for each flaw class: CWE-94 (Code Injection) for Flaw 5, CWE-285 (Improper Authorization) for Flaw 16, CWE-20 (Improper Input Validation) for Flaw 17, CWE-1104 (Use of Unmaintained Third Party Components) for Flaw 15.
- **OWASP ASVS (Application Security Verification Standard)** — specific requirement sections that each flaw fails: V5 (Validation, Sanitization, Encoding), V7 (Error Handling and Logging), V8 (Data Protection), V9 (Communications).
- **Pearce et al. (USENIX Security 2022)** — "Asleep at the Keyboard? Assessing the Security of GitHub Copilot's Code Contributions." Academic precedent for this kind of empirical study. Our methodology differs (we test v0 feature-first generations, they tested completions on planted prompts), but our findings are consistent: AI-generated code frequently contains well-understood security flaws, and the frequency depends on the prompt shape.
- **Perry et al. (CCS 2023)** — "Do Users Write More Insecure Code with AI Assistants?" Stanford study on user-AI collaboration outcomes. Again, methodologically different but directionally consistent with our model-tier findings.

These citations are not tool output — they are academic and industry anchors that show our findings are part of a broader conversation. When the book's Chapter 8 cites our flaw counts, it should cite these alongside for context.

---

## Naming convention note (for when these findings move into book prose)

Per agreement with the author on 2026-04-14, the book will use a two-layer naming convention:

- **Methodology sections** (book preface, Chapter 1 data-sources paragraph, "about the research" notes): fully named — *"Claude Opus 4.6, Sonnet 4.6, Haiku 4.5, and Gemini via its CLI, April 2026."*
- **Teaching prose** (Part II chapters 5–10 in particular): generic tier / vendor-family language — *"top-tier frontier model"*, *"mid-tier workhorse"*, *"cost-tier model"*, *"a leading non-Claude frontier alternative"*.
- **Exception:** the Gemini `AGENTS.md` / `CLAUDE.md` artifact in Chapter 10 can be referenced specifically (one vendor named, with date) because the example's *meaning* depends on naming the vendor that wrote it. The surrounding prose stays generic.
- **This file (`v0-generation-log.md`)** is an internal research artifact and stays fully named throughout. It is the reproducibility record, not the manuscript body.
- **Manning editorial preference** may override this convention if they have a house style. Flagged for Simon in the Round 3 reply.

See also: `~/.claude/projects/-home-cshi-dev-edu/memory/feedback_book_model_naming_convention.md` for the durable version of this convention.
