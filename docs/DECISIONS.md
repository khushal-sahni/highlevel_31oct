# DECISIONS.md
> Architectural decisions and why they were made.
> The "why" is what you'll forget. Write it down.

---

## Template

Use this format for each decision:

```
### [Short title]
- **Date**: YYYY-MM-DD
- **Status**: Accepted | Superseded by [link] | Under discussion
- **Context**: What situation forced this decision?
- **Decision**: What did we decide?
- **Consequences**: What does this make easier or harder going forward?
```

---

## Decisions

### Follow AGENTS.md conventions until design chooses stack and job mechanics
- **Date**: 2026-10-31
- **Status**: Superseded by the design decisions below and by [DESIGN.md](../DESIGN.md)
- **Context**: The repo started from a generic class-based template. The assignment allows NestJS (preferred) or Go, and Mongo or Postgres. Locking a stack or job design before reading the problem would invent answers the brief wants defended later.
- **Decision**: Coding standards and layer rules in `AGENTS.md` are the working convention. Language, datastore, and job mechanics stay undecided until design.
- **Consequences**: Session #1 wrote no `DESIGN.md`. Session #2 locked the mechanics.

### Snapshot ids, later edit wins
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: A 10:00 job that runs for an hour must not override a person who moved a deal at 10:30. The filter set also changes while the job runs: new deals appear, existing ones leave the filter.
- **Decision**: The click is an intent. Resolve copies matching ids and `seen_version` into `bulk_move_items` after accept. Apply updates a row only when `version = seen_version`, `stage_changed_at <= job.created_at` (both clocks from the database), and the filter fields they actually sent still match, including value and `created_at`. Otherwise skip: no stage change, no transition. Skip reasons: `conflict`, `filter`, `already_there`.
- **Consequences**: Deals created after the job row, or that start matching after the keyset has passed them, are not in the job. A later edit keeps the person's change. Progress can finish with skips. The job is not a live re-query.

### Idempotency key is required and stored in Postgres
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: A flaky client or a gateway can replay `POST /bulk-stage-moves`. The apply rule stops a deal from moving twice. It does not stop two job rows from being created.
- **Decision**: Required `Idempotency-Key` plus a hash of the body, unique on `(workspace_id, key)`. Same key and same body returns the original job forever. Same key and a different body is 409. A new click needs a new key. The row lives in Postgres.
- **Consequences**: A process restart still sees the key. Slip-through: a retry that sends a new key creates a second job. The version check still stops a row from moving twice, but the two jobs split the set and the progress.

### Item rows are the cursor
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: A worker can die at 30,000 of 50,000. Resume must finish correctly, and progress must be committed state. A high-water id on the job row cannot record per-deal skip reasons.
- **Decision**: Resolve copies ids into `bulk_move_items`. Each apply chunk of about 200 is one transaction: claim `pending` rows with `FOR UPDATE SKIP LOCKED`, conditional update, insert the transition, mark each item `moved` or `skipped`. If the snapshot exceeds 50,000, fail the job before any move. A crash rolls the open chunk back. Resume is claiming whatever is still `pending`.
- **Consequences**: Progress counts come from those rows. The item table is extra writes at resolve time. That is accepted; a high-water cursor is the 10× fallback we are not taking.

### Heartbeat health, not a resume endpoint
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: The user must tell slow, stuck, and failed apart. A crash leaves the job `resolving` or `running`. Starting the worker again is what continues work.
- **Decision**: `health=active` when the last committed chunk is under 30s old, `health=stalled` when it is older. Status stays `running` (or `resolving`). A queued job has no stall clock. `failed` is terminal and only for a snapshot over 50,000 or 5 consecutive real chunk errors. Moves that already committed stay. There is no resume endpoint.
- **Consequences**: A stalled job is not failed. A live worker claiming pending items is the only recovery. Clients poll; they do not POST to resume.

### One chunk in flight globally
- **Date**: 2026-10-31
- **Status**: Superseded by "One chunk per workspace under a global ceiling"
- **Context**: The job must not starve interactive requests in the same workspace, and must not affect other workspaces. Chunks of 200 keep transactions short. They do not stop a busy worker from taking the pool and the disk.
- **Decision**: The worker is its own process with one database connection. One chunk is in flight in the whole system, held by a Postgres advisory lock only for the duration of that chunk.
- **Consequences**: A small workspace's bulk job waits behind a 50,000-row job.

### One chunk per workspace under a global ceiling
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: A single global lane serializes every tenant. The brief asked for a concurrency cap, not one worker for the whole database. Arrival rate is not the scarce resource; worker slots are.
- **Decision**: Each worker process has one connection and takes one of `MAX_IN_FLIGHT_CHUNKS` permits (default 4) for a single chunk. It claims a `resolving` or `running` job with `FOR UPDATE SKIP LOCKED`, oldest `heartbeat_at` first, or promotes the oldest queued job in a workspace that has no active job. One active job per workspace. At most 8 jobs that are not `completed` or `failed`; the next POST is 429. Lock timeout 250ms is a yield. 50ms pause outside the transaction. No Redis or Kafka. No paid tiers; every workspace has the same weight.
- **Consequences**: Two worker processes can move two tenants at once. A noisy tenant cannot occupy every slot. The hole: it is still one Postgres, so WAL and cache traffic can nudge another tenant. BENCHMARKS.md is the N=4 run; the 2026-10-31 21.8s line is the N=1 floor.

### NestJS, TypeScript, node-postgres
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: The assignment prefers NestJS and allows Go. The chunk update, the item cursor, and the leases are SQL either way. Two processes share that code: API and worker.
- **Decision**: NestJS and TypeScript, with `pg` (node-postgres). Chunk SQL is written in the repositories. TypeORM and Prisma do not own the data model. Two processes, one codebase.
- **Consequences**: Review is on TypeScript and SQL we wrote. An ORM would hide the compare-and-swap and the claim.

### Two indexes
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: Apply and resolve are different scans. The brief asks for the index that makes chunking cheap. Extra indexes per filter field cost write amplification on a 500,000-row seed.
- **Decision**: Ids are time-ordered uuidv7. Chunk index: `bulk_move_items (job_id, state, opportunity_id)`. Resolve and list-by-stage: `opportunities (workspace_id, stage_id, id)`. A filter with no stage walks `(workspace_id, id)`. No extra index per owner, status, or value.
- **Consequences**: Apply is an index range plus primary-key updates. A stageless resolve walks the workspace. That walk is bounded (2,000 index entries per chunk) and is the first thing named at 10×.

### Resolve is what fails first at 10×
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: The brief asks what breaks at a 500,000-record move and at 20M opportunities in one workspace.
- **Decision**: A move over 50,000 is refused before any stage change (the stored snapshot can overshoot by at most one resolve page). If that cap were lifted, apply would still finish, slowly. The first real break is a stageless resolve across 20M rows: each chunk still scans 2,000 index entries, so a selective owner/status/value filter visits the whole workspace across many chunks, evicts the shared cache, and stays heartbeating. This submission keeps the cap and bounds every resolve chunk at 2,000 index entries, committing the cursor, heartbeating, and pausing.
- **Consequences**: Partitioning `opportunities` by `workspace_id` and a read replica are extra-week work. Locks and the version check still hold at 10×. Chunking makes the walk polite; it does not make it cheap.

### Another week, ranked
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: The brief asks what we would do with another week, ranked. Skip reasons are part of this submission, not the extra week.
- **Decision**: (1) Partition `opportunities` by `workspace_id`. (2) Adaptive pause once benchmarks show interactive latency climbing. (3) A read replica for list-by-stage only if those numbers show the cache hole; progress reads stay on the primary. (4) A short same-body dedupe window for clients that retry with a new `Idempotency-Key`. One in-flight chunk per workspace under a global ceiling is in this submission. Redis, Kafka, UI, auth, and extra CRM endpoints stay off the list.
- **Consequences**: The write-up can name the hole we are shipping and the order we would close it.

### Numbered SQL migrations and a custom runner
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: No ORM. Repositories own SQL. We needed a way to apply schema on a clean machine.
- **Decision**: Numbered files in `db/migrations`, applied by `MigrationRunner`, recorded in `schema_migrations`.
- **Consequences**: Job tables land as a later migration. No Prisma/TypeORM.

### Jest and supertest against real Postgres
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: The brief wants tests on real safety, not mocks. Part 1 only needs enough to prove it works.
- **Decision**: One integration spec hits a running Postgres. Tests create their own workspaces.
- **Consequences**: `npm test` needs `DATABASE_URL`. Hard-property tests come with the bulk job.

### HTTP contract
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: Behavior was chosen. A client, a test, and the benchmark need one surface.
- **Decision**: Every route requires `X-Workspace-Id`. Unknown workspace is 404. No stage API and no workspace API; stages are seeded rows. `POST /opportunities` takes name, value in integer cents, status, `ownerId`, `stageId`, and returns the row including `version`. `POST /opportunities/:id/stage` takes `stageId` and `expectedVersion`; a stale version is 409 and writes nothing. `GET /opportunities?stageId&limit&cursor` is a keyset page on opportunity id. `POST /bulk-stage-moves` requires `Idempotency-Key` and at least one filter field (`stageId`, `ownerId`, `status`, `valueMin`, `valueMax`, `createdAfter`, `createdBefore`) plus `targetStageId`. It returns 202 and the job id immediately. A ninth open job in that workspace is 429. `GET /bulk-stage-moves/:id` returns status, health, heartbeat, and counts. Skip counts are split into conflict, filter, and already-there.
- **Consequences**: Part 1 stays thin. An empty filter is rejected. Resolve examines at most 2,000 index entries per chunk.
