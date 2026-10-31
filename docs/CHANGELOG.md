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
