# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-10-31 | Session: #5

---

## What Works Right Now

- Part 1 and the bulk job, as before.
- Large seed: 500,000 opportunities + 5 small workspaces. `npm run seed:large`.
- Benchmarks measured and written in [BENCHMARKS.md](../BENCHMARKS.md).
- Tests: `docker compose run --rm --build api npm test` (small seed, no worker).

---

## In Progress

- Nothing. Next is M5 submission polish (README finish, DESIGN vs code, commit history), when you confirm.

---

## Known Broken / Blocked

- Host port 3000 can be taken; bench used `BENCH_API_URL=http://localhost:3010` on this machine.

---

## Where We Left Off

Session #5 seeded 500k and ran the three measurements. Numbers are in BENCHMARKS.md.

---

## Current Architecture State

```
src/db/
├── seed.ts          # small seed (API boot + tests)
├── seed-large.ts    # 500k + 5 small workspaces
└── bench.ts         # 50k wall-clock, interactive p95/p99, kill-resume
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

```bash
docker compose up --build
# API + worker + Postgres

docker compose run --rm --build api npm test
# migrate, small seed, Jest; worker is not started

DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run seed:large
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run bench
```

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
| Total sessions | 5 |
| Modules complete | Part 1 + bulk job + seed/measure |
| Hard-property tests | 7 |
| Last measured | 2026-10-31 (~2,300 rows/s on M4) |
