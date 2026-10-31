# STATUS.md
> Weekend dashboard. Read this first. Update this last.
> Last updated: 2026-10-31 | Session: #1

---

## What Works Right Now

- Nothing implemented. No application code, datastore, or tests yet.
- The assignment is restated in [THE-PROBLEM.md](THE-PROBLEM.md).

---

## In Progress

- Docs-only pass: understand the take-home before design.

---

## Known Broken / Blocked

- None. Blocked only on reading the problem and then doing design.

---

## Where We Left Off

Session #1 rewrote the template docs to match the HighLevel SDE-3 brief. No design choices were made. Next step: you read `docs/THE-PROBLEM.md`. Design starts only when you ask for it.

---

## Current Architecture State

```
Nothing built yet.
```

Expected later (names may change in design):

```
src/
├── opportunities/     # Part 1: create, single move + transition, list-by-stage
├── bulk-move/         # Part 2: enqueue, worker, progress, safety properties
└── workspaces/        # tenant scoping via X-Workspace-Id
```

---

## Environment & Config

None yet. Stack is undecided. Env vars will be listed here after design.

---

## How to Run Locally

Not applicable. The one-command run (`docker compose up` or equivalent), small seed, and tests come after implementation. The graded README will document them.

Until then, start at [THE-PROBLEM.md](THE-PROBLEM.md).

---

## Tech Debt

- None. No code yet.

---

## Open Questions

Design questions only — listed in [THE-PROBLEM.md](THE-PROBLEM.md), not answered:

- Snapshot vs live filter set
- Manual-move vs job collision rule
- Idempotency key and durable dedupe
- Chunk / cursor / resume
- Progress as committed state; slow vs stuck vs failed
- Isolation mechanism and the hole it leaves
- Language and datastore (NestJS preferred vs Go; Postgres vs Mongo; extras)
- What fails at 10×

---

## Quick Stats

| Metric | Value |
|---|---|
| Total sessions | 1 |
| Modules complete | 0 |
| Hard-property tests | None yet |
| Last measured | Never |
