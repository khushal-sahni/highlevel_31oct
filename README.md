# Opportunities Bulk Stage Move

HighLevel SDE-3 take-home. One hard operation: move up to 50,000 filtered opportunities to another stage as a background job that stays correct under retry, restart, and concurrent edits.

**Design:** [DESIGN.md](DESIGN.md)

**Numbers:** [BENCHMARKS.md](BENCHMARKS.md)

## What works

- Part 1: create, versioned single move + transition, keyset list-by-stage
- Part 2: `POST /bulk-stage-moves` (requires `Idempotency-Key`) returns 202; a worker resolves a snapshot and applies chunks; `GET /bulk-stage-moves/:id` reports committed counts and health
- Large seed and measured 50k run (see BENCHMARKS.md)

Tenant header is `X-Workspace-Id`.

## What is not implemented

Out of scope from the brief: any UI, real authentication, a board or pipeline summary, per-stage counts or value rollups, filtering beyond the bulk filter, downstream automation events, deployment / CI / Kubernetes, custom fields / contacts / notes / tasks, and a perfect error taxonomy.

Also not in this submission — they are the ranked extra week in DESIGN.md: partition `opportunities` by workspace, an adaptive pause, a read replica, per-workspace chunk fairness, and a short same-body dedupe window.

## Run

```bash
docker compose up --build
```

API on port 3000, worker in a second container, Postgres on 5432. API boot applies migrations and the **small** seed only.

Dev workspace: `11111111-1111-4111-8111-111111111111`

New Lead: `22222222-2222-4222-8222-000000000001`

## Test

One command on a clean machine (starts Postgres, does not start the worker):

```bash
docker compose run --rm --build api npm test
```

That migrates, runs the small seed, then Jest.

## Large seed and bench

```bash
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run seed:large
docker compose up --build -d postgres worker
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run start:dev
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run bench
```

`seed:large` writes `db/benchmark-target.json` (a 50,000-row filter). If the API is not on port 3000, set `BENCH_API_URL`.

Working notes: [docs/STATUS.md](docs/STATUS.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/DECISIONS.md](docs/DECISIONS.md), [AGENTS.md](AGENTS.md).
