# v2-deployed subagent — self-report (verbatim highlights)

**Run date:** 2026-04-15
**Model:** Claude Sonnet (general-purpose subagent, default)
**Duration:** ~18 minutes
**Prompt:** ~1,900 words, see `v2-prompt.md` (to be saved)

This companion file to `v1-subagent-report.md` captures the v2-deployed subagent's most consequential finding — a **cross-artifact discrepancy** between `CLAUDE.md` and the code at the v1-tested commit that the v1 subagent did not catch, but the v2 subagent did. The finding is a Chapter 10 teaching moment about **cross-agent verification and context-file decay under contradictory instructions**.

---

## The cross-artifact discrepancy finding (the headline Ch 10 material)

The v2 subagent's report included this passage:

> "CLAUDE.md claimed these were 'fixed in v1-tested' but the actual code still had the bugs — the v1 commit updated the doc without changing the route handlers. Per the instructions ('if any are marked "fix: v1-tested" and the fix was not actually made in the v1 commit, you should fix them now as part of v2'), I applied the fixes as part of v2-deployed and documented the alignment discrepancy in CLAUDE.md under each item."

Specifically the v2 subagent found:

1. **Known Issue #3** (`code_solution` leak in lesson GET) — CLAUDE.md at `v1-tested` said *"Fixed in v1-tested via an explicit column list."* The actual `src/app/api/courses/[courseId]/lessons/[lessonId]/route.ts` at that commit was still using `SELECT *`. The v1 subagent's `lesson-answer-leak.test.ts` correctly detected the leak and failed, but the fix that would have made the test pass was never applied.
2. **Known Issue #4a** (progress endpoint no enrollment check) — same pattern.
3. **Known Issue #4b** (quiz_score client-trusted) — same pattern.
4. **Known Issue #5** (assistant `history` role injection) — same pattern.
5. **Known Issue #1** (JWT_SECRET fallback) — CLAUDE.md correctly scheduled for v2, and the v2 subagent applied the fix as planned. No discrepancy here.
6. **Known Issue #2** (vm escape) — CLAUDE.md correctly scheduled for v3, left broken. No discrepancy.

The v2 subagent applied the missing v1 fixes and documented the discrepancy in `CLAUDE.md` under a new *"Fixed as of v2-deployed"* section, preserving the original numbering for traceability.

## Why this happened — the root cause

The root cause is a **cross-artifact contradiction in the instructions the v1 subagent received.**

- **The `CLAUDE.md` context file** (written before the v1 subagent ran) scheduled issues #3, #4a, #4b, and #5 with *"Fixed in v1-tested (this chapter)"* as their fix v-tag.
- **The v1 subagent prompt** (the ~1,500-word spec) said: *"You must not fix any of the known issues. Tests that target known issues should deliberately fail with a clear assertion message. That failure is the point."*

These two instructions agreed on "write failing tests" but disagreed on "apply the fix." The v1 subagent followed the prompt (do not fix) and left the code unchanged. It also did not correct the `CLAUDE.md` scheduling claim, because the prompt told it to respect the file and correct it only when it found factual code-vs-doc discrepancies — and the `CLAUDE.md` "fix scheduled for v1-tested" claim was not a factual statement about the *current* code, it was a statement about *future* work that the prompt told the agent not to do.

**The v2 subagent resolved the contradiction by making the code match the schedule** — treating `CLAUDE.md` as the source of truth for the v-tag plan and the v1 prompt as an override that was no longer in force.

## The Chapter 10 teaching moments in this finding

Three concrete lessons the book can make from the discrepancy:

1. **Context files and task prompts can contradict each other, and when they do, the agent follows whichever it sees first or whichever is more specific.** The v1 subagent treated the prompt as authoritative. The v2 subagent treated the context file as authoritative. Both choices were defensible; neither was wrong. The failure was in letting the contradiction exist in the first place. Chapter 10 can teach: *"before running an agent, reconcile the context file and the task prompt. If they disagree, fix one of them before you launch."*
2. **A partial work product looks complete if the context file says it's complete.** The v1 commit had failing tests + a CLAUDE.md claim that the fix was done. Anyone reading CLAUDE.md at that commit would have believed the fix was in place. Anyone reading the tests would have thought "oh, they're failing because the code is broken." The two artifacts disagreed silently. Chapter 10 can teach: *"verification is cross-artifact. A test that fails is not 'fine' just because CLAUDE.md says it's been fixed. A CLAUDE.md claim that a fix is done is not credible unless the code and the tests both confirm it."*
3. **The defense is cross-agent review.** The v1 subagent did not catch its own partial state. The v2 subagent caught it because it was instructed to check — *"if any issues marked 'fix: v1-tested' were not actually made in the v1 commit, fix them now."* This is the same lesson as Chapter 10's "four levers" → verification step, applied specifically to the context-file layer: *you do not trust the file to be in sync with the code; you verify explicitly, and you instruct your next agent to do the same.*

These three lessons are **better for Chapter 10 than any abstract explanation of context engineering**, because they are grounded in a real failure mode produced by real agents on real code during the book's own research.

## The v2 subagent's `CLAUDE.md` honesty note

Just like the v1 subagent, the v2 subagent was asked to report on whether `CLAUDE.md` helped it. Its answer:

> "Yes — the Known Issues section was load-bearing. It told me exactly which four fixes to apply (3, 4a, 4b, 5) and which one to leave alone (#2). Without it I would have had to infer scope from test file contents alone."

It also reported **three additional CLAUDE.md discrepancies beyond the big scheduling one:**

- Issue #1 quoted the fallback string as `'fallback-secret-change-in-production-min-32chars'` but the actual source literal was `'fallback-secret-change-me'`. Not load-bearing, but noted.
- Issue #7 said Next was *"pinned to `next@14.2.35` with no mechanism to track future patches"* in the same sentence that described this as a v0-naive problem. But 14.2.35 is past the known CVE, so the pin was actually already correct; only the "no tracking mechanism" framing was accurate.
- The existing note about the v1 subagent's `jose` → `jsonwebtoken` correction (preserved from v1-tested).

The v2 subagent updated `CLAUDE.md` in four ways:
- Moved fixed items to a new *"Fixed as of v2-deployed"* section, preserving numbering for traceability.
- Added a new *"Delivery (v2-deployed)"* section documenting env.ts, rate-limit.ts, health, Dockerfile, compose, CI, and the Next pin rationale.
- Rewrote the test-suite-notes status list to show which tests flipped from fail to pass.
- Added a Docker path to the *"How to run"* section.

This is the pattern the book wants readers to learn: **every agent that touches the code updates the context file with what changed and what it found.** The alternative — trusting the file and moving on — is how context files drift into uselessness.

## What the v2 subagent could not verify

Three blockers the subagent documented honestly:

1. **Full `docker compose up`** — host port 5432 was already allocated to an existing Postgres instance. The subagent verified the app image in isolation (built it, ran `docker run`, curled `/api/health`, got a valid response) but did not exercise the full two-service compose startup end-to-end. **This is a real-world testing gotcha: local-port collisions with existing services block docker-compose integration testing, and the fix is usually to rename the compose project or remap the host port.**
2. **GitHub Actions workflow** was not executed (no runner available). The subagent noted that the YAML is syntactically valid and that it ran the equivalent commands successfully on the host.
3. **Schema auto-apply under compose** — the docker-compose setup does not automatically run `psql -f src/lib/schema.sql` on startup. The subagent noted this as a later-chapter migration concern and left the instruction in the "How to run" section as a manual step.

The **honesty in the "could not verify" section** is itself a Chapter 10 teaching moment. An agent that knows what it did not verify is an agent whose output you can trust. An agent that silently glosses over environment blockers is an agent whose output you cannot trust. Chapter 10 can teach: *"require your agents to tell you what they did not verify. Make it a section of the report back. An agent that never has anything in this section is either lying or not looking hard enough."*

## Test delta from v1 to v2

| | v1 tests | v2 tests |
|---|---|---|
| Test files | 15 | 17 (+2: health, rate-limit) |
| Tests | 32 | 37 (+3 from new files, +2 new in `setup-env` test flip) |
| Passing | 26 | 34 |
| Failing | 6 | 1 |
| Flipped fail → pass | — | 5 (`env-fallback`, `lesson-answer-leak`, `progress-bypass`, `quiz-score-trust`, `assistant-history-injection`) |
| Still failing | `execute-vm-escape` (+5 others) | `execute-vm-escape` (the one broken-until-v3) |

The v2 state is **one-test-failing**, and the failing test is exactly the one the Known Issues list says is scheduled for v3. Everything else is green. That is a clean v2 artifact.
