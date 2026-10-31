# AGENTS.md
> AI agent instructions for this project. Read this before writing any code.

---

## Project Overview

- **Name**: Opportunities Bulk Stage Move
- **Purpose**: HighLevel SDE-3 take-home. One hard operation: move up to 50,000 filtered opportunities to another stage as a background job that is idempotent, resumable, observably progressing, correct under concurrent edits, and polite to other traffic.
- **Stack**: NestJS, TypeScript, `pg` (node-postgres). Two processes: API and worker. Locked in [DESIGN.md](DESIGN.md).
- **Database**: PostgreSQL is the primary store and the queue. No Redis, Kafka, or ORM owning the chunk SQL.
- **Key External Services**: None. Do not add any unless design records a reason.

The product is the bulk job, not a CRM. Part 1 (create, single move, list-by-stage) exists only so Part 2 has somewhere to run.

Read [docs/THE-PROBLEM.md](docs/THE-PROBLEM.md) before proposing design or writing code.

---

## Architecture

### Pattern

This project uses **class-based, layered architecture**. Every piece of logic lives in a class. No free-floating functions outside of utility helpers.

Map these layers onto NestJS modules. Do not invent a second architecture. Repositories own the SQL.

### Layer Structure

```
src/
├── controllers/   # HTTP only — parse request, call service, return response
├── services/      # Business logic — domain operations live here
├── workers/       # Background job execution — the 50k move lives here, not in HTTP
├── repositories/  # Data access — all DB queries live here, nowhere else
├── entities/      # DB models
├── dtos/          # Request/response shapes
├── middleware/    # Tenant header and similar
├── decorators/    # Custom decorators
├── utils/         # Pure stateless helpers only
├── config/        # Config classes, env parsing
└── types/         # Shared TypeScript types and interfaces
```

HTTP accepts a bulk request and returns a job handle. It does not loop the matching set. The worker owns chunking, cursor, resume, and progress.

### Strict Layer Rules

- Controllers **never** touch the database directly
- Controllers **never** run the bulk move inline
- Services **never** import from controllers
- Repositories **never** contain business logic
- A service **may** call other services but keep it shallow
- Utils are **pure functions** — no side effects, no class instantiation
- Workers may call services and repositories; they do not return HTTP

---

## Coding Standards

### Classes & Decorators

- All services, repositories, controllers, and workers are **injectable classes**
- Use **constructor injection** — never instantiate dependencies manually inside a class
- Use decorators for cross-cutting concerns only. They must be **pure** — no business logic inside them

### TypeScript (if the stack is Node)

- **Strict mode is on** — no `any`, no `as unknown as`, no `!` non-null assertions unless truly unavoidable
- Every public method must have explicit **return type annotations**
- Use `interface` for shapes you don't instantiate; use `class` for things you instantiate
- Prefer `readonly` on class properties where mutation is not needed
- Use **enums** for fixed value sets (opportunity status, job status)
- Use **discriminated unions** for complex type narrowing

### Naming

| Thing | Convention | Example |
|---|---|---|
| Classes | PascalCase | `BulkMoveService` |
| Interfaces | PascalCase with `I` prefix | `IOpportunityRepository` |
| Files | kebab-case | `bulk-move.service.ts` |
| Methods | camelCase, verb-first | `enqueueBulkMove`, `moveOpportunity` |
| Constants | SCREAMING_SNAKE | `MAX_BULK_MOVE_SIZE` |
| Enums | PascalCase, singular | `OpportunityStatus.OPEN` |
| DB columns | snake_case | `created_at` |

### Error Handling

- Use a **custom error hierarchy** — never throw raw `Error` objects in services
- All errors must extend `AppError` (or equivalent base class)
- Controllers catch errors and map them to HTTP responses — services should not know about HTTP
- Async errors must always be caught — no unhandled promise rejections
- Do not build a perfect error taxonomy. The brief forbids spending budget there.

### Functions & Methods

- Max **20 lines** per method — if longer, extract
- Max **3 parameters** — if more, use an options object
- Single responsibility — if you need "and" to describe a method, split it
- No nested callbacks — use async/await throughout

---

## What NOT to Do

Assignment out of scope — if you start any of these, stop:

- Any UI
- Real authentication
- A board or pipeline summary view
- Per-stage counts or value rollups
- Rich filtering and sorting beyond the bulk filter (stage, owner, status, value range, date range)
- Downstream automation events and consumers
- Deployment, CI, Kubernetes
- Custom fields, contacts, notes, tasks
- Exhaustive validation or a perfect error taxonomy

Also:

- No business logic in controllers
- No raw SQL strings outside repositories
- No `console.log` in production code — use the logger service
- No hardcoded secrets or config values — use config classes
- No circular dependencies between modules
- No `any` type
- No mutations of input parameters inside functions
- Never catch an error and swallow it silently
- Do not invent CRM features the brief did not ask for
- Do not run the 50,000-row move inside the HTTP request
- Do not treat an in-memory counter or in-memory dedupe set as durable

---

## Testing Expectations

The brief is not a coverage number.

- Tests on the parts that are genuinely hard: **idempotency**, **resume**, **the concurrent-edit collision**
- One test that would fail if you removed the safety mechanism is worth more than fifty CRUD assertions
- Part 1 endpoints need only enough tests to prove they work
- Test files live next to the source file: `bulk-move.service.spec.ts`
- Use descriptive names: `"should not double-apply a retried bulk move with the same idempotency key"`
- Integration tests should be runnable via the one documented command on a clean machine

---

## Submission files (later)

These live at the repo root when their phase arrives. Do not invent them early.

| File | When |
|---|---|
| `README.md` | After the system runs — how to run, seed, test, what is and is not implemented |
| `DESIGN.md` | Design phase — 2–3 pages covering chunk/cursor, idempotency, collisions, snapshot vs live, isolation, 10× failure, ranked next-week list |
| `BENCHMARKS.md` | After measurement — numbers, hardware, method |

Working notes stay in `docs/`.

---

## Session Instructions for AI Agent

At the **start** of each session:

1. Read `docs/THE-PROBLEM.md` — this is the assignment
2. Read `docs/STATUS.md` — current project state
3. Read `docs/ROADMAP.md` — what is next
4. Ask the engineer to confirm scope before writing any code

Phase rules:

- **Understand / design:** no implementation code. Design decisions go in `docs/DECISIONS.md`. The graded design write-up is `DESIGN.md` and is written only in the design phase, after the engineer asks for it.
- **Implementation:** only the confirmed scope. Prefer the bulk job's safety properties over more surface area.

During the session:

- Follow all rules in this file without exception
- If a pattern you need isn't covered here, ask before inventing one
- When creating a domain module, create: entity → repository → service → controller → DTO. Workers are first-class for the bulk job.
- Keep functions small — refactor proactively, don't let files exceed 250 lines

At the **end** of every session, before closing:

1. Update `docs/STATUS.md` — current state, what works, what's pending
2. Append to `docs/CHANGELOG.md` — what was built/changed this session
3. Update `docs/DECISIONS.md` if any architectural choices were made
4. Note any new tech debt under `## Tech Debt` in STATUS.md
