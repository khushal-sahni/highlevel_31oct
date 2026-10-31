# ROADMAP.md
> High-level direction. Not a sprint board — just where we're going.

---

## Goal

A runnable take-home where a filtered bulk stage move of up to 50,000 opportunities is a background job: idempotent, resumable, observably progressing, correct under concurrent edits, and isolated from other traffic. Graders can bring it up with one command, run the hard-property tests, and reproduce the measured numbers.

Done enough means Part 1 works, Part 2 holds all five properties, seed and benchmarks exist, and `README.md` / `DESIGN.md` / `BENCHMARKS.md` are honest.

---

## Milestones

### M0 — Understand `[x]`
> The brief is restated so design does not start from the PDF alone.

- [x] Read the assignment
- [x] Write `docs/THE-PROBLEM.md`
- [x] Point working docs and `AGENTS.md` at this take-home

### M1 — Design `[x]`
> Choose mechanics and write them down before code.

- [x] Answer the design questions in `docs/THE-PROBLEM.md`
- [x] Record choices in `docs/DECISIONS.md`
- [x] Write root `DESIGN.md` (the graded 2–3 page write-up)

### M2 — Foundation (Part 1) `[x]`
> Thin surface. They are not grading this beyond "it works."

- [x] Workspace scoping via `X-Workspace-Id`
- [x] Create an opportunity
- [x] Move a single opportunity to another stage and record the transition
- [x] List opportunities in a stage, simple pagination
- [x] One command that boots the app on a clean machine

### M3 — Bulk job (Part 2) `[x]`
> This is the exercise.

- [x] Enqueue a filtered bulk move (stage, owner, status, value range, date range) and return a job handle immediately
- [x] Worker processes in the background; HTTP does not loop the set
- [x] Idempotent: durable dedupe that survives restart
- [x] Resumable: kill mid-job, resume, finish correctly
- [x] Progress from committed state; slow vs stuck vs failed
- [x] Concurrent-edit collision implemented and defended
- [x] Snapshot vs live stated and implemented
- [x] Isolation mechanism implemented (same workspace interactive, other workspaces untouched)
- [x] Tests that fail if those safeties are removed

### M4 — Seed and measure `[ ]`
> They will try to reproduce these numbers.

- [ ] Seed script: 1 large workspace (500,000 opportunities, 12 uneven stages, ~18 months) and 5 small workspaces
- [ ] Small seed used by the one-command test run
- [ ] Bulk 50k: wall-clock and sustained throughput
- [ ] Interactive p95 / p99 in the same workspace and in another, during the bulk run
- [ ] Kill and resume: time to completion and proof of correctness
- [ ] Hardware and method written in `BENCHMARKS.md`

### M5 — Submission polish `[ ]`
> Real history, runnable, honest about gaps.

- [ ] Root `README.md`: how to run, seed, test, what is and is not implemented
- [ ] `DESIGN.md` matches the code, including holes and the 10× failure
- [ ] Commit history tells the story (not one squashed commit)
- [x] Ranked "another week" list in `DESIGN.md`

---

## What We're NOT Building

From the brief. Do not spend budget here.

- Any UI
- Real authentication
- A board or pipeline summary view
- Per-stage counts or value rollups
- Rich filtering and sorting beyond the bulk filter
- Downstream automation events and consumers
- Deployment, CI, Kubernetes
- Custom fields, contacts, notes, tasks
- Exhaustive validation or a perfect error taxonomy
- Extra CRM surface beyond create / single move / list-by-stage / bulk job
