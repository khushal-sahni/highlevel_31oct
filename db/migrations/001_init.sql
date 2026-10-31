CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuidv7()
);

CREATE TABLE stages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id),
  name TEXT NOT NULL,
  position INT NOT NULL,
  UNIQUE (workspace_id, position)
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id),
  stage_id UUID NOT NULL REFERENCES stages (id),
  name TEXT NOT NULL,
  value BIGINT NOT NULL CHECK (value >= 0),
  status TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost', 'abandoned')),
  owner_id TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX opportunities_workspace_stage_id_idx
  ON opportunities (workspace_id, stage_id, id);

CREATE INDEX opportunities_workspace_id_idx
  ON opportunities (workspace_id, id);

CREATE TABLE transitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id),
  opportunity_id UUID NOT NULL REFERENCES opportunities (id),
  from_stage_id UUID NOT NULL REFERENCES stages (id),
  to_stage_id UUID NOT NULL REFERENCES stages (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transitions_opportunity_id_idx
  ON transitions (opportunity_id);
