# Tests

The suite introduced at `v1-tested` is the first real verification layer for
the platform. Later checkpoints extend it. These are primarily **integration
tests**: they run the actual route handlers
against a real PostgreSQL database, because the bugs that matter here only show
up against real constraints and real concurrency.

- The enrollment race (a 500 under concurrent free-enroll) needs a real `UNIQUE`
  constraint and real connections to reproduce — a mocked database can't.
- The lesson answer-leak (the API shipped `code_solution` to the browser) is a
  shape-of-the-response bug; the test asserts the field is absent.

## Running

You need a throwaway Postgres. The quickest way:

```bash
docker run -d --name at-testpg \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=avitam_test \
  -p 5432:5432 postgres:16-alpine

npm test
```

The connection string defaults to
`postgres://postgres:test@localhost:5432/avitam_test`; override it with
`TEST_DATABASE_URL`. The schema is created from `src/lib/schema.sql` before the
suite runs, and every test starts from a truncated, freshly-seeded database.

## What's here

| File | Covers |
|---|---|
| `enrollments.test.ts` | Free-enroll happy path, idempotency, auth, paid-course rejection, and the **concurrency race** (the loser of a concurrent enroll must not 500). |
| `lessons.test.ts` | The student lesson endpoint must not leak the **code reference solution** or quiz answer key. |
| `comments.test.ts` | Business rules the feature pass already got right: empty comments rejected, a reply's parent must belong to the same lesson. |
| `quiz-grade.test.ts` | Server-side quiz grading introduced at `v4-designed`. |
| `rate-limit.test.ts` | Request limiting added for deployment-shaped operation. |
| `sandbox.test.ts` | Out-of-process execution bounds and environment isolation. |
| `image-validation.test.ts` | Uploaded avatar byte and size validation. |
| `assistant.test.ts` | Assistant input boundaries and output redaction. |
| `redact.test.ts` | Secret-shaped output redaction. |
| `material-validation.test.ts` | Uploaded course-material byte and UTF-8 validation. |
| `materials.test.ts` | Course ownership, duplicate upload handling, and deletion lifecycle. |
| `ingestion.test.ts` | Idempotent chunk replacement and material status transitions. |
| `knowledge.test.ts` | Chunking, course-scoped vector retrieval, and evidence delimiters. |

At `v1-tested`, one test is intentionally skipped to keep the quiz-answer leak
visible until its design change. At `v4-designed`, server-side grading closes
that gap and all 34 tests pass with no skips.

At `v5-evolved`, the RAG lifecycle and authorization checks bring the suite to
47 passing tests with no skips. Tests stub paid model and embedding providers;
they do not make network calls.
