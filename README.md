# avitam-teach

`avitam-teach` is the companion project for the Manning book *Engineering
Judgment When AI Writes the Code*. It is a small AI-generated teaching platform
that evolves through a sequence of reviewable Git checkpoints.

The project is evidence for the book, not a polished reference application or a
deployment guide. Its checkpoints preserve the code and dependency versions
examined in the manuscript so readers can inspect, test, and repair the real
system. No checkpoint is presented as production-ready.

## Repository map

- `spine/` contains the application used throughout the book.
- `generations/` preserves independent AI generation runs and their notes.
- `v0-generation-log.md` records how the baseline was selected.
- `scripts/` contains small research and audit helpers.

The files under `generations/` and `spine/GENERATION_NOTES.md` are generation
receipts. They describe what an AI produced at a particular point in time, so
some of their statements are intentionally stale when read from `main`.

## Book checkpoints

| Tag | Book transition | What changes |
| --- | --- | --- |
| `v0-naive` | Chapter 3 baseline | Feature-first generated application with no test, deployment, or security pass |
| `v1-tested` | Chapter 4 | Integration tests, enrollment concurrency fix, and student-response surface reduction |
| `v2-deployed` | Chapter 5 | Container build, CI gate, configuration validation, rate limiting, and basic observability |
| `v3-secured` | Chapter 6 | Isolated code execution, upload validation, session hardening, and layered assistant defenses |
| `v4-designed` | Chapter 7 | Server-side quiz grading plus storage and model-provider seams |
| `v5-evolved` | Integration checkpoint | Course-scoped retrieval over published lessons and instructor-uploaded material |

Chapter 4 begins from the intermediate `v0.1-features` tag. That checkpoint adds
instructor roles, profiles, avatar uploads, and lesson comments while retaining
the untested baseline's correctness defects. The `*-pre-v0.1` tags preserve an
earlier experimental arc and are not used by the book.

The `v2-deployed` name marks the chapter that teaches delivery mechanics. It
means that the repository gains production-shaped artifacts readers can study;
it does not mean that this sample application was deployed or certified for a
production environment.

The first five tags are discipline checkpoints. `v5-evolved` begins a second
cycle that tests whether the earlier design can absorb a substantial new
requirement. Its RAG pipeline is driven by course-wide questions over uploaded
teacher material, rather than added as an isolated demonstration.

For a redistributable sample corpus, `sample-materials/python-official/`
provides a checksum-pinned fetch script for the official Python tutorial and
preserves its PSF license and attribution.

`main` also carries an optional reader bonus and proof candidate: a standalone,
one-node Azure Kubernetes Service staging topology, digest-pinned image
workflow, migration gate, smoke test, rollback procedure, and teardown path.
The `v6-cloud-staged` tag is deliberately withheld until a real environment has
passed those checks. The exercise tests the cloud boundary; repository presence
alone is not deployment evidence.

## Start with the baseline

You need Node.js 20.16 or later and PostgreSQL. Stripe and Anthropic credentials
are optional when you use the free course and skip the teaching assistant.

```bash
git clone https://github.com/chunhui-shi/avitam-teach.git
cd avitam-teach
git checkout v0-naive
cd spine
npm install
createdb avitam_teach
psql avitam_teach < src/lib/schema.sql
```

Create `spine/.env.local` with local development values:

```dotenv
DATABASE_URL=postgres://localhost/avitam_teach
JWT_SECRET=replace-with-a-long-local-development-value
```

Then run `npm run dev` and open <http://localhost:3000>.

## Run the completed verification suite

The completed state uses integration tests against a real PostgreSQL database:

```bash
git checkout v5-evolved
cd spine
npm install
docker run -d --name at-testpg \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=avitam_test \
  -p 5432:5432 pgvector/pgvector:pg16
npm test
docker rm -f at-testpg
```

Set `TEST_DATABASE_URL` if PostgreSQL is available at a different address. The
same lint, type-check, and test commands run in `.github/workflows/ci.yml`.

## Status

`main` contains the latest verified companion checkpoint plus the unverified v6
staging candidate. The `v5-evolved` state has 47 passing tests. The repository
remains a teaching artifact, not a hosted service or a promise of deployment
readiness.

## License

MIT. See `LICENSE`.

Security expectations and reporting guidance are in `SECURITY.md`.
