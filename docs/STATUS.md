# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-10-31 | Session: #7

---

## What Works Right Now

- Part 1, bulk job, large seed, and measured 50k run.
- README lists how to run, seed, test, and what is not implemented.
- DESIGN.md matches the code, including health age and the worker's single connection. Mermaid diagrams in DESIGN.md show the two processes, job states, worker step, idempotency, collisions, the snapshot, and health.
- Controller handlers take parsed input types. `unknown` remains only on catch values, pg error guards, the JSON guard, and the parse pipe.
---

## In Progress

- Nothing. Submission write-up is done.

---

## Known Broken / Blocked

- Host port 3000 can be taken; bench used `BENCH_API_URL=http://localhost:3010` on this machine.

---

## Where We Left Off

Session #7 typed the JSON boundary. History is five commits plus uncommitted write-up. Do not squash. Do not push unless asked.

---

## Current Architecture State

```
src/db/
├── seed.ts          # small seed (API boot + tests)
├── seed-large.ts    # 500k + 5 small workspaces
└── bench.ts         # 50k wall-clock, interactive p95/p99, kill-resume
src/worker.ts        # DATABASE_POOL_MAX defaults to 1
```

---

## Environment & Config

```env
DATABASE_URL=postgres://app:app@localhost:5432/opportunities
PORT=3000
BENCH_API_URL=http://localhost:3000
```

---

## How to Run Locally

See [README.md](../README.md).

---

## Tech Debt

- Host port 3000 can collide.
- Accepted design holes: one shared Postgres, one global in-flight chunk, new-key idempotency slip-through.

---

## Open Questions

None.

---

## Quick Stats

| Metric | Value |
|---|---|
| Total sessions | 7 |
| Modules complete | Part 1 + bulk job + seed/measure + polish |
| Hard-property tests | 7 |
| Last measured | 2026-10-31 (~2,300 rows/s on M4) |
