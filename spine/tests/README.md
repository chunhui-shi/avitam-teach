# Tests

The suite added at `v1-tested` is the first real verification layer for the
platform. These are **integration tests**: they run the actual route handlers
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
| `lessons.test.ts` | The student lesson endpoint must not leak the **code reference solution**. One skipped test tracks the still-open quiz answer-key leak (fixing it means server-side grading). |
| `comments.test.ts` | Business rules the feature pass already got right: empty comments rejected, a reply's parent must belong to the same lesson. |

One test is intentionally `skip`ped — a known, deferred bug, kept visible in the
suite rather than dropped.
