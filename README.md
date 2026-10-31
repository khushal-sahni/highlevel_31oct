# Opportunities Bulk Stage Move

HighLevel SDE-3 take-home. One hard operation: move up to 50,000 filtered opportunities to another stage as a background job that stays correct under retry, restart, and concurrent edits.

**Problem:** [docs/THE-PROBLEM.md](docs/THE-PROBLEM.md)

**Design:** [DESIGN.md](DESIGN.md)

## What works

Part 1 only: create an opportunity, move one opportunity with a version check and a transition, list a stage with a keyset cursor. Tenant header is `X-Workspace-Id`.

The bulk job is not implemented yet.

## Run

```bash
docker compose up --build
```

API listens on port 3000. Postgres is on 5432. Migrations and a tiny seed run on boot.

Dev workspace: `11111111-1111-4111-8111-111111111111`

New Lead: `22222222-2222-4222-8222-000000000001`

## Test

Postgres must be up.

```bash
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm test
```

Working notes: [docs/STATUS.md](docs/STATUS.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/DECISIONS.md](docs/DECISIONS.md), [AGENTS.md](AGENTS.md).
