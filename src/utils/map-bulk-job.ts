import { IBulkFilter, IBulkFilterJson, IBulkJob, IBulkJobRow } from '../entities/bulk-job';
import { JobStatus } from '../types/job-status';
import { isOpportunityStatus } from '../types/opportunity-status';

export function mapBulkJob(row: IBulkJobRow): IBulkJob {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    idempotencyKey: row.idempotency_key,
    bodyHash: row.body_hash,
    filter: mapFilter(row.filter),
    targetStageId: row.target_stage_id,
    status: parseJobStatus(row.status),
    resolveCursor: row.resolve_cursor,
    heartbeatAt: row.heartbeat_at,
    consecutiveErrors: row.consecutive_errors,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function filterToJson(filter: IBulkFilter): IBulkFilterJson {
  return {
    stageId: filter.stageId,
    ownerId: filter.ownerId,
    status: filter.status,
    valueMin: filter.valueMin,
    valueMax: filter.valueMax,
    createdAfter: filter.createdAfter?.toISOString(),
    createdBefore: filter.createdBefore?.toISOString(),
  };
}

function mapFilter(raw: IBulkFilterJson): IBulkFilter {
  return {
    stageId: raw.stageId,
    ownerId: raw.ownerId,
    status:
      raw.status !== undefined && isOpportunityStatus(raw.status)
        ? raw.status
        : undefined,
    valueMin: raw.valueMin,
    valueMax: raw.valueMax,
    createdAfter: parseOptionalDate(raw.createdAfter),
    createdBefore: parseOptionalDate(raw.createdBefore),
  };
}

function parseOptionalDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

function parseJobStatus(value: string): JobStatus {
  const match = Object.values(JobStatus).find((status) => status === value);
  if (match === undefined) {
    throw new Error(`invalid job status: ${value}`);
  }
  return match;
}
