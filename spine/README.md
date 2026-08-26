# avitam-teach application

This directory contains the Next.js application used as the running example in
*Engineering Judgment When AI Writes the Code*. Start at the repository-level
README for the book checkpoint map and safety warning.

## Requirements

- Node.js 20.16 or later
- PostgreSQL 14 or later with the pgvector extension
- Docker and Docker Compose when following the Chapter 5 deployment path

## Local development

Install dependencies and create a local database:

```bash
npm install
createdb avitam_teach
psql avitam_teach < src/lib/schema.sql
```

Create `.env.local`:

```dotenv
DATABASE_URL=postgres://localhost/avitam_teach
JWT_SECRET=replace-with-a-long-local-development-value
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Required when using course-material retrieval:
OPENAI_API_KEY=replace-with-an-api-key
```

The free course works without Stripe or Anthropic credentials. Add
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `ANTHROPIC_API_KEY` only when
exercising those integrations.

Run the application with `npm run dev` and open <http://localhost:3000>.

The knowledge assistant has a separate ingestion process. After applying the
schema, queue existing lessons once and run the worker in another terminal:

```bash
npm run knowledge:backfill
npm run worker
```

The embedding request follows the [official OpenAI embeddings API][embeddings]
and defaults to `text-embedding-3-small` with 256 dimensions. Override
`EMBEDDING_MODEL` only with a model that supports the configured dimensions.

[embeddings]: https://developers.openai.com/api/docs/guides/embeddings

## Verification

The integration suite requires a throwaway PostgreSQL database. See
`tests/README.md` for setup and coverage details.

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Historical generation notes

`GENERATION_NOTES.md` is the receipt for the selected AI generation run. It
describes the original generated application, not every improvement present at
the current tag.
