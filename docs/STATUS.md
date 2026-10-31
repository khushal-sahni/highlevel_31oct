# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-10-31 | Session: #8

---

## What Works Right Now

- Part 1, bulk job, large seed, and measured 50k run (N=1).
- Worker processes take one of 4 permits and claim a job with `SKIP LOCKED`. Two tenants can progress at once.
- A ninth open job in a workspace is 429.
- Personal reviewer Q&A lives in `docs/REVIEW-QA.md` and is gitignored.

---

## In Progress

- Nothing.

---

## Known Broken / Blocked

- Host port 3000 can be taken; bench used `BENCH_API_URL=http://localhost:3010` on this machine.

---

## Where We Left Off

Session #8 replaced the global chunk lane with per-workspace claim and a permit ceiling. History is five commits plus uncommitted work. Do not squash. Do not push unless asked.

---

## Current Architecture State

```
src/worker.ts                 # one process, one connection
src/workers/worker-one-step.ts  # forked by the fairness test
```

---

## Environment & Config

```env
DATABASE_URL=postgres://app:app@localhost:5432/opportunities
PORT=3000
MAX_IN_FLIGHT_CHUNKS=4
MAX_OPEN_JOBS_PER_WORKSPACE=8
```

---

## How to Run Locally

See [README.md](../README.md).

---

## Tech Debt

- Host port 3000 can collide.
- Accepted design holes: one shared Postgres, new-key idempotency slip-through.
- Published bench is still one worker.

---

## Open Questions

None.

---

## Quick Stats

| Metric | Value |
|---|---|
| Total sessions | 8 |
| Modules complete | Part 1 + bulk job + seed/measure + polish + fair chunks |
| Hard-property tests | 9 |
| Last measured | 2026-10-31 (~2,300 rows/s on M4, N=1) |
