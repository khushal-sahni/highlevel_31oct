CREATE TABLE bulk_jobs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id),
  idempotency_key TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  filter JSONB NOT NULL,
  target_stage_id UUID NOT NULL REFERENCES stages (id),
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'resolving', 'running', 'completed', 'failed')
  ),
  resolve_cursor UUID,
  heartbeat_at TIMESTAMPTZ,
  consecutive_errors INT NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key) -- Same key + workspace is the same job.
);

-- At most one resolving/running job per workspace; queued jobs wait.
CREATE UNIQUE INDEX bulk_jobs_one_active_per_workspace
  ON bulk_jobs (workspace_id)
  WHERE status IN ('resolving', 'running');

CREATE TABLE bulk_move_items (
  job_id UUID NOT NULL REFERENCES bulk_jobs (id),
  opportunity_id UUID NOT NULL REFERENCES opportunities (id),
  seen_version INT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'moved', 'skipped')),
  skip_reason TEXT CHECK (skip_reason IN ('conflict', 'filter', 'already_there')),
  PRIMARY KEY (job_id, opportunity_id), -- Snapshot: one item row per deal per job.
  CHECK (
    (state = 'skipped' AND skip_reason IS NOT NULL)
    OR (state <> 'skipped' AND skip_reason IS NULL)
  )
);

-- Claim is a short range on pending items, then PK updates on opportunities.
CREATE INDEX bulk_move_items_job_state_opp_idx
  ON bulk_move_items (job_id, state, opportunity_id);

ALTER TABLE transitions
  ADD COLUMN job_id UUID REFERENCES bulk_jobs (id);

-- A replayed chunk cannot insert a second transition for the same deal.
CREATE UNIQUE INDEX transitions_job_opportunity_idx
  ON transitions (job_id, opportunity_id)
  WHERE job_id IS NOT NULL;
