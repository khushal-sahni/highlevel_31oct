# Opportunities Bulk Stage Move

HighLevel SDE-3 take-home. One job: move up to 50,000 filtered opportunities to another stage in the background. Idempotent, resumable, observably progressing, correct under concurrent edits, and well-behaved toward other traffic.

**Design:** [DESIGN.md](DESIGN.md) · **Schema:** [ENTITIES.md](ENTITIES.md) · **Numbers:** [BENCHMARKS.md](BENCHMARKS.md)

Tenant header: `X-Workspace-Id`.

## What works

**Part 1**
- Create an opportunity — `POST /opportunities`
- Move one opportunity and record the transition — `POST /opportunities/:id/stage`
- List opportunities in a stage — `GET /opportunities`

**Part 2**
- Accept a filter, return a job handle immediately — `POST /bulk-stage-moves` (`Idempotency-Key` required) → 202
- Do the work in the background
- Poll committed progress — `GET /bulk-stage-moves/:id`

Filter: stage, owner, status, value range, date range.

## What is not implemented

No UI, no auth, no board or pipeline summary, no per-stage counts or value rollups, no filters beyond the bulk filter, no automation events, no deploy / CI / Kubernetes, no custom fields / contacts / notes / tasks, no error taxonomy.

Extra week, ranked in DESIGN.md: partition `opportunities` by workspace, adaptive pause, read replica, short same-body dedupe window.

## Run

One command. Starts Postgres, API, and four workers. Migrates and applies the **small** seed only.

```bash
docker compose up --build --scale worker=4
```

API on port 3110. Postgres on 5432. Each worker has one database connection.

Dev workspace: `11111111-1111-4111-8111-111111111111`

New Lead: `22222222-2222-4222-8222-000000000001`

## Test

One command on a clean machine. Starts Postgres. Does not start a worker.

```bash
docker compose run --rm --build api npm test
```

Migrates, small seed, then Jest.

## Large seed and bench

`seed:large` does not start Postgres. Start Postgres first, then seed, then leave the API running and bench in another terminal.

```bash
npm install
docker compose up --build -d --scale worker=4 postgres worker

export DATABASE_URL=postgres://app:app@localhost:5432/opportunities
npm run seed:large
npm run start:dev
```

```bash
export DATABASE_URL=postgres://app:app@localhost:5432/opportunities
npm run bench
```

`seed:large` writes 500,000 opportunities in one workspace (12 uneven stages, ~18 months) plus five small workspaces, and `db/benchmark-target.json` (a 50,000-row filter). `bench` measures the 50k move, interactive p95/p99 in the same and another workspace, and kill-and-resume. Numbers: [BENCHMARKS.md](BENCHMARKS.md).

If the API is not on port 3110, set `BENCH_API_URL`.
