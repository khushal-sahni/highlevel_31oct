# Entities

Tables and indexes as they exist in [db/migrations/001_init.sql](db/migrations/001_init.sql) and [db/migrations/002_bulk_move.sql](db/migrations/002_bulk_move.sql). Nothing else.

---

## schema_migrations

Records which migration files have been applied.

| Column | Type |
|---|---|
| id | TEXT PRIMARY KEY |
| applied_at | TIMESTAMPTZ NOT NULL DEFAULT now() |

---

## workspaces

Tenant. Every request is scoped by `X-Workspace-Id`.

| Column | Type |
|---|---|
| id | UUID PRIMARY KEY DEFAULT uuidv7() |

---

## stages

Named columns on a workspace pipeline. Seeded rows only; there is no stage API.

| Column | Type |
|---|---|
| id | UUID PRIMARY KEY DEFAULT uuidv7() |
| workspace_id | UUID NOT NULL REFERENCES workspaces (id) |
| name | TEXT NOT NULL |
| position | INT NOT NULL |

**Indexes**

- `UNIQUE (workspace_id, position)` — one slot per position in a workspace.

---

## opportunities

The deal. Part 1 writes and lists these. The bulk job moves `stage_id`.

| Column | Type |
|---|---|
| id | UUID PRIMARY KEY DEFAULT uuidv7() |
| workspace_id | UUID NOT NULL REFERENCES workspaces (id) |
| stage_id | UUID NOT NULL REFERENCES stages (id) |
| name | TEXT NOT NULL |
| value | BIGINT NOT NULL CHECK (value >= 0) |
| status | TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost', 'abandoned')) |
| owner_id | TEXT NOT NULL |
| version | INT NOT NULL DEFAULT 1 |
| stage_changed_at | TIMESTAMPTZ NOT NULL DEFAULT now() |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now() |

**Indexes**

- `opportunities_workspace_stage_id_idx` on `(workspace_id, stage_id, id)` — list-by-stage and resolve when the filter has a stage. The keyset walks `id`.
- `opportunities_workspace_id_idx` on `(workspace_id, id)` — resolve when the filter has no stage.

---

## transitions

One row per successful stage change. A bulk move writes one per moved item; a single move writes one without a job.

| Column | Type |
|---|---|
| id | UUID PRIMARY KEY DEFAULT uuidv7() |
| workspace_id | UUID NOT NULL REFERENCES workspaces (id) |
| opportunity_id | UUID NOT NULL REFERENCES opportunities (id) |
| from_stage_id | UUID NOT NULL REFERENCES stages (id) |
| to_stage_id | UUID NOT NULL REFERENCES stages (id) |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() |
| job_id | UUID REFERENCES bulk_jobs (id) |

**Indexes**

- `transitions_opportunity_id_idx` on `(opportunity_id)` — history for one deal.
- `transitions_job_opportunity_idx` unique on `(job_id, opportunity_id) WHERE job_id IS NOT NULL` — a retried chunk cannot write a second transition for the same item.

---

## bulk_jobs

The handle returned by `POST /bulk-stage-moves`. Status, heartbeat, and the resolve cursor live here.

| Column | Type |
|---|---|
| id | UUID PRIMARY KEY DEFAULT uuidv7() |
| workspace_id | UUID NOT NULL REFERENCES workspaces (id) |
| idempotency_key | TEXT NOT NULL |
| body_hash | TEXT NOT NULL |
| filter | JSONB NOT NULL |
| target_stage_id | UUID NOT NULL REFERENCES stages (id) |
| status | TEXT NOT NULL CHECK (status IN ('queued', 'resolving', 'running', 'completed', 'failed')) |
| resolve_cursor | UUID |
| heartbeat_at | TIMESTAMPTZ |
| consecutive_errors | INT NOT NULL DEFAULT 0 |
| error_code | TEXT |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now() |

**Indexes**

- `UNIQUE (workspace_id, idempotency_key)` — the same key in the same workspace returns the existing job.
- `bulk_jobs_one_active_per_workspace` unique on `(workspace_id) WHERE status IN ('resolving', 'running')` — one active job; a second job stays `queued`.

---

## bulk_move_items

The snapshot. One row per opportunity the filter matched when resolve walked it. The apply cursor is these rows.

| Column | Type |
|---|---|
| job_id | UUID NOT NULL REFERENCES bulk_jobs (id) |
| opportunity_id | UUID NOT NULL REFERENCES opportunities (id) |
| seen_version | INT NOT NULL |
| state | TEXT NOT NULL CHECK (state IN ('pending', 'moved', 'skipped')) |
| skip_reason | TEXT CHECK (skip_reason IN ('conflict', 'filter', 'already_there')) |

Primary key `(job_id, opportunity_id)`. `skip_reason` is required when `state = 'skipped'` and forbidden otherwise.

**Indexes**

- `bulk_move_items_job_state_opp_idx` on `(job_id, state, opportunity_id)` — claim the next pending chunk with `FOR UPDATE SKIP LOCKED`.
