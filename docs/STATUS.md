# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-11-01 | Session: #10

---

## What Works Right Now

- Part 1, bulk job, large seed, and measured 50k run (N=4). N=1 floor is 21.8s.
- Worker processes take one of 4 permits and claim a job with `SKIP LOCKED`. Two tenants can progress at once.
- A ninth open job in a workspace is 429.
- Schema is listed in `ENTITIES.md` from the two migrations.
- Personal reviewer Q&A lives in `docs/REVIEW-QA.md` and is gitignored.

---

## In Progress

- Nothing.

---

## Known Broken / Blocked

- Nothing.

---

## Where We Left Off

Session #10 made 3110 the API port everywhere (compose, Docker, env, bench, docs). Session #9 re-measured the three brief scenarios with four workers. Do not squash. Do not push unless asked.

---

## Current Architecture State

```
src/worker.ts                 # one process, one connection
src/workers/worker-one-step.ts  # forked by the fairness test
ENTITIES.md                   # tables and indexes from the two migrations
```

---

## Environment & Config

```env
DATABASE_URL=postgres://app:app@localhost:5432/opportunities
PORT=3110
MAX_IN_FLIGHT_CHUNKS=4
MAX_OPEN_JOBS_PER_WORKSPACE=8
```

---

## How to Run Locally

See [README.md](../README.md).

---

## Tech Debt

- Accepted design holes: one shared Postgres, new-key idempotency slip-through.
- Same-workspace interactive p99 was 31ms on the N=4 run (N=1 floor was 9ms).

---

## Open Questions

None.

---

## Quick Stats

| Metric | Value |
|---|---|
| Total sessions | 10 |
| Modules complete | Part 1 + bulk job + seed/measure + polish + fair chunks + N=4 bench |
| Hard-property tests | 9 |
| Last measured | 2026-11-01 (~5,600 rows/s on M4, N=4; N=1 floor 21.8s) |
