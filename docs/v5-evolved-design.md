# v5-evolved: course knowledge assistant

## Requirement

Instructors can upload reference material to a course. Enrolled students can
ask questions across published lessons and ready instructor material. Answers
must be grounded in sources the caller is authorized to read and must identify
those sources.

The existing assistant puts at most 3,000 characters from the current lesson
into a prompt. That is sufficient for one small lesson, but it cannot select
useful evidence from a growing course corpus. Retrieval is introduced because
the requirement changed, not because the application needed an AI feature in
the abstract.

## Behavioral contract

- Instructors and admins can upload UTF-8 text, Markdown, and PDF material to a
  course they manage.
- Uploads are bounded by type and size and stored before ingestion begins.
- Ingestion is asynchronous and exposes `pending`, `processing`, `ready`, and
  `failed` states.
- Published lesson content and ready uploaded material are chunked and indexed.
- A repeated ingestion job replaces a source's chunks atomically instead of
  duplicating them.
- Replacing or deleting material removes stale chunks.
- Retrieval is scoped by `course_id` in the database query. Authorization is
  established before retrieval, not applied to already-retrieved results.
- Retrieved text is untrusted reference data. It cannot replace system
  instructions.
- An answer returns source identifiers and titles. When retrieval produces no
  adequate evidence, the assistant says so.

## Architecture

```text
upload or lesson change
        |
        v
stored source + ingestion_jobs row
        |
        v
claim job -> parse -> chunk -> embed -> replace knowledge_chunks -> ready
        |
        v
student question -> authorize course -> embed query -> course-scoped search
        |
        v
bounded evidence prompt -> assistant provider -> answer + cited sources
```

PostgreSQL owns the queue as well as the vector index. Workers claim jobs with
`FOR UPDATE SKIP LOCKED`, which gives this small system a real concurrency
boundary without adding a second coordination service. The embedding provider
is isolated behind an interface. The default API implementation uses OpenAI's
`text-embedding-3-small` with a reduced vector dimension; tests use a
deterministic provider and make no network calls.

## What v4 got right and wrong

The assistant-provider seam remains useful: retrieval changes how context is
assembled, not how a completion is requested. The storage seam is useful but
insufficient. `BlobStorage.save()` returns a URL and offers no way to read or
delete a private object. v5 revises that interface around object identity and
lifecycle. This is the intended lesson: designing for change reduces the blast
radius, but the next real requirement still gets to correct the abstraction.

## Verification priorities

1. Course-management authorization on upload, list, retry, and delete.
2. Paid-course enrollment before retrieval.
3. Course scoping inside vector search.
4. Idempotent ingestion and stale-chunk removal.
5. Failed-job recovery.
6. Source citations and insufficient-evidence behavior.
7. Indirect prompt-injection text remains delimited reference material.

## Explicit limits

- PDF text extraction does not perform OCR.
- The evaluation set demonstrates known retrieval behaviors; it does not claim
  general answer accuracy.
- This checkpoint is locally runnable and is not a cloud deployment.
