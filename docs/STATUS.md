# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-10-31 | Session: #3

---

## What Works Right Now

- Part 1 API: create, versioned single move + transition, keyset list-by-stage.
- `X-Workspace-Id` required; unknown workspace is 404.
- Stale `expectedVersion` is 409 and writes no transition.
- Five integration tests against Postgres.
- Dev seed: one workspace and six stages.

---

## In Progress

- Nothing. Next is the bulk job (M3), when you confirm scope.

---

## Known Broken / Blocked

- `docker compose up --build` failed on this machine because host port 3000 is already taken. The image builds. Map a free host port if 3000 is busy.

---

## Where We Left Off

Session #3 shipped Part 1. No bulk job, no job tables, no 500k seed. Next step: enqueue + worker + the five safety properties.

---

## Current Architecture State

```
src/
├── controllers/     # OpportunityController
├── services/        # OpportunityService, LoggerService
├── repositories/    # workspace, stage, opportunity, transition
├── middleware/      # WorkspaceMiddleware, AppExceptionFilter
├── db/              # pool, migrate, seed
└── workers/         # not started
```

Two processes later. Only the API process exists.

---

## Environment & Config

```env
DATABASE_URL=postgres://app:app@localhost:5432/opportunities
PORT=3000
```

Dev seed workspace: `11111111-1111-4111-8111-111111111111`

New Lead stage: `22222222-2222-4222-8222-000000000001`

---

## How to Run Locally

```bash
docker compose up --build
# API :3000, Postgres :5432, migrations + tiny seed on boot

# tests (Postgres must be up)
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm test
```

---

## Tech Debt

- Host port 3000 can collide; compose still publishes 3000.
- Known design holes (accepted): one shared Postgres, one global in-flight chunk, new-key idempotency slip-through.

---

## Open Questions

None on Part 1. Bulk job mechanics stay as in [DESIGN.md](../DESIGN.md).

---

## Quick Stats

| Metric | Value |
|---|---|
| Total sessions | 3 |
| Modules complete | Part 1 |
| Hard-property tests | None yet (Part 1 only) |
| Last measured | Never |
