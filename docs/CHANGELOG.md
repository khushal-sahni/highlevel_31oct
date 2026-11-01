# CHANGELOG.md
> Written by the AI agent at the end of every session.
> One entry per session. Most recent at the top.

---

## Template

```
## Session #N — YYYY-MM-DD (~Xhr)

### Built
- [What was created from scratch]

### Changed
- [What was modified or refactored]

### Fixed
- [What was broken and is now working]

### Deferred / Not Done
- [What was planned for this session but not completed, and why]

### New Tech Debt
- [Any shortcuts taken, with a note on what the proper fix would be]
```

---

## Sessions

## Session #9 — 2026-11-01
> N=4 bench, entities, stale write-up.

### Built
- [ENTITIES.md](../ENTITIES.md) from `001_init.sql` and `002_bulk_move.sql`

### Changed
- Re-measured the three brief scenarios against four worker containers
- [BENCHMARKS.md](../BENCHMARKS.md) is the N=4 run; 2026-10-31 21.8s / p95 4ms / 3ms is the N=1 floor
- DESIGN isolation cites the new interactive p95/p99
- README large-seed block and bench restart use `--scale worker=4`
- DECISIONS, REVIEW-QA, STATUS aligned to the published N=4 numbers

### Fixed
- Resume in `bench.ts` now brings four workers back after `docker compose kill worker`

### Deferred
- Nothing from this plan

### New Tech Debt
- Same-workspace p99 climbed to 31ms at N=4; the hole is still one WAL

## Session #8 — 2026-10-31
> Fair multi-worker chunks.

### Built
- Permit ceiling (`MAX_IN_FLIGHT_CHUNKS`, default 4)
- `SKIP LOCKED` job claim and fair promote
- 429 when a workspace already has 8 open jobs
- Forked two-process fairness test

### Changed
- One process does one chunk. Compose scales workers to 4.
- DESIGN and DECISIONS supersede the global lane.

### Fixed
- A small tenant's job no longer waits behind another workspace's 50k move.

### Deferred
- Re-bench at N=4

### New Tech Debt
- Published numbers are still the one-worker run

## Session #7 — 2026-10-31
> Type the JSON boundary. No new product behavior.

### Built
- `ParseDtoPipe` so controllers receive parsed input types
- `IJsonObject` and `SqlValue`

### Changed
- HTTP bodies and queries are typed after the pipe
- SQL binds use `SqlValue`
- Logger takes `Error`; catch sites pass it only after `instanceof Error`

### Fixed
- Controllers no longer annotate raw JSON as the handler type

### Deferred
- Nothing

### New Tech Debt
- None

## Session #6 — 2026-10-31
> Submission polish. No new product behavior.

### Built
- Nothing new in the product

### Changed
- README drops the gitignored problem-brief link and lists what is not implemented
- DESIGN.md states how health age is computed
- Worker process defaults `DATABASE_POOL_MAX` to 1
- ROADMAP M5 complete
- DESIGN.md carries Mermaid diagrams for processes, job states, worker step, idempotency, collisions, the snapshot, and health

### Fixed
- `npm run start:worker` now matches the one-connection write-up

### Deferred
- Nothing

### New Tech Debt
- None

## Session #5 — 2026-10-31
> Seed and measure.

### Built
- `npm run seed:large` — 500k opportunities, 12 uneven stages, 5 small workspaces, `db/benchmark-target.json`
- `npm run bench` — 50k wall-clock, interactive p95/p99, kill-and-resume with SQL proof
- [BENCHMARKS.md](../BENCHMARKS.md) from a real run on Apple M4

### Changed
- `npm test` now migrates, small-seeds, then Jest
- `docker compose run --rm --build api npm test` is the one-command test path
- Dockerfile copies `jest.config.js`

### Fixed
- Docker Jest failed without `jest.config.js`

### Deferred
- Submission polish (M5): commit history, DESIGN vs code pass

### New Tech Debt
- None

## Session #4 — 2026-10-31
> Bulk job. No 500k seed.

### Built
- `bulk_jobs` and `bulk_move_items`; `transitions.job_id`
- `POST /bulk-stage-moves` and `GET /bulk-stage-moves/:id`
- Worker process: resolve pages, apply chunks, advisory lock, 50ms pause
- Seven hard-property tests: idempotency, resume, collision, snapshot, cap, queue, stalled health
- Compose `worker` service

### Changed
- `transitions` insert accepts optional `job_id`
- README documents the two bulk routes and the worker

### Fixed
- Nothing carried from Part 1

### Deferred
- 500k seed and `BENCHMARKS.md` — M4
- Full submission README polish

### New Tech Debt
- None beyond accepted design holes

## Session #3 — 2026-10-31
> Part 1 foundation. No bulk job.

### Built
- NestJS API + PostgreSQL 18, `pg`, numbered SQL migrations
- Schema: workspaces, stages, opportunities, transitions, list/resolve indexes
- `POST /opportunities`, `POST /opportunities/:id/stage`, `GET /opportunities`
- Versioned single move in one transaction with a transition
- Dev seed and five integration tests

### Changed
- `.gitignore` for `node_modules`, `dist`, `.env`
- `README.md` — how to boot Part 1

### Fixed
- `ts-node` request typing so `npm run start:dev` compiles

### Deferred
- Bulk job, job tables, worker process — M3
- 500k seed and `BENCHMARKS.md`
- Full submission README

### New Tech Debt
- Compose publishes host 3000; this machine already had that port taken

## Session #2 — 2026-10-31
> Design recorded. No application code.

### Built
- `DESIGN.md` — graded write-up: chunk/cursor/index, idempotency, collisions, snapshot, isolation hole, 10×, ranked week
- ADRs in `docs/DECISIONS.md` for each locked choice

### Changed
- `docs/STATUS.md`, `docs/ROADMAP.md` — M1 complete, implementation not started
- `AGENTS.md`, `README.md` — stack and design pointers now match DESIGN.md

### Fixed
- Nothing (no application yet)

### Deferred
- Implementation (Part 1, then the bulk job) — next phase, when asked
- `BENCHMARKS.md` — after there is a system to measure
- Full `README.md` (run / seed / test) — after implementation

### New Tech Debt
- None in code. Accepted holes are named in DESIGN.md.

## Session #1 — 2026-10-31
> Docs only. No design, no code.

### Built
- `docs/THE-PROBLEM.md` — plain-language restatement of the HighLevel SDE-3 brief
- Thin root `README.md` pointing at that brief

### Changed
- `AGENTS.md` — take-home purpose, undecided stack, job-first scope, out-of-scope list, hard-property tests
- `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md` — reset from the generic template to this assignment

### Fixed
- Nothing (no application yet)

### Deferred
- `DESIGN.md`, stack, and job mechanics — next phase, when asked
- `BENCHMARKS.md` — after there is a system to measure
- Full `README.md` (run / seed / test) — after implementation

### New Tech Debt
- None
