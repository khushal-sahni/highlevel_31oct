# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-10-31 | Session: #4

---

## What Works Right Now

- Part 1 API: create, versioned single move + transition, keyset list-by-stage.
- Bulk job: `POST /bulk-stage-moves` returns 202; worker resolves a snapshot and applies chunks.
- Idempotency-Key stored in Postgres; same key + body returns the original job.
- Resume is pending item rows. Progress is item counts. Health is heartbeat-based.
- Manual move after resolve wins (`conflict` skip). Deals created after the job are not copied.
- Snapshot over 50,000 fails before any move. One active job per workspace; others stay queued.
- Twelve integration tests against Postgres (five Part 1, seven bulk safeties).

---

## In Progress

- Nothing. Next is M4: 500k seed and benchmarks, when you confirm scope.

---

## Known Broken / Blocked

- Host port 3000 can be taken; compose still publishes 3000.

---

## Where We Left Off

Session #4 shipped the bulk job. No 500k seed, no `BENCHMARKS.md`. Next step: seed + measure.

---

## Current Architecture State

```
src/
├── controllers/     # OpportunityController, BulkMoveController
├── services/        # OpportunityService, BulkMoveService
├── repositories/    # opportunities, jobs, items, transitions
├── workers/         # BulkMoveEngine, BulkMoveWorker
├── db/              # pool, migrate, seed
└── worker.ts        # worker process entry
```

Two processes: API and worker. PostgreSQL is the store and the queue.

---

## Environment & Config

```env
DATABASE_URL=postgres://app:app@localhost:5432/opportunities
PORT=3000
DATABASE_POOL_MAX=10
MAX_BULK_MOVE_SIZE=50000
APPLY_CHUNK_SIZE=200
CHUNK_PAUSE_MS=50
```

Dev workspace: `11111111-1111-4111-8111-111111111111`

New Lead: `22222222-2222-4222-8222-000000000001`

---

## How to Run Locally

```bash
docker compose up --build
# API :3000, worker, Postgres :5432

DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm test
```

---

## Tech Debt

- Host port 3000 can collide.
- Known design holes (accepted): one shared Postgres, one global in-flight chunk, new-key idempotency slip-through.

---

## Open Questions

None on the job mechanics.

---

## Quick Stats

| Metric | Value |
|---|---|
| Total sessions | 4 |
| Modules complete | Part 1 + bulk job |
| Hard-property tests | 7 |
| Last measured | Never |
