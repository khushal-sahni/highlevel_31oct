# Opportunities Bulk Stage Move

HighLevel SDE-3 take-home. One hard operation: move up to 50,000 filtered opportunities to another stage as a background job that stays correct under retry, restart, and concurrent edits.

**Start here:** [docs/THE-PROBLEM.md](docs/THE-PROBLEM.md)

That file is the assignment in plain language. Read it before design or code.

## Status

Nothing is implemented yet. Stack and job design are not chosen.

Working notes:

- [docs/STATUS.md](docs/STATUS.md) — current state
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestones
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisions (none on stack or job mechanics yet)
- [AGENTS.md](AGENTS.md) — how this repo is built when implementation starts

## Later (not written yet)

The brief asks for these at submission time:

- This README, filled in: how to run, how to seed, how to test, what is and is not implemented
- `DESIGN.md` — the 2–3 page write-up (the most important submission file)
- `BENCHMARKS.md` — measured numbers, hardware, method

Do not expect `docker compose up` or tests in this commit.
