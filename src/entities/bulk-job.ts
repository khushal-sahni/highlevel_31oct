import { OpportunityStatus } from '../types/opportunity-status';
import { ItemState, JobStatus, SkipReason } from '../types/job-status';

export interface IBulkFilter {
  readonly stageId?: string;
  readonly ownerId?: string;
  readonly status?: OpportunityStatus;
  readonly valueMin?: number;
  readonly valueMax?: number;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

export interface IBulkJob {
  readonly id: string;
  readonly workspaceId: string;
  readonly idempotencyKey: string;
  readonly bodyHash: string;
  readonly filter: IBulkFilter;
  readonly targetStageId: string;
  readonly status: JobStatus;
  readonly resolveCursor: string | null;
  readonly heartbeatAt: Date | null;
  readonly consecutiveErrors: number;
  readonly errorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IBulkJobRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly idempotency_key: string;
  readonly body_hash: string;
  readonly filter: IBulkFilterJson;
  readonly target_stage_id: string;
  readonly status: string;
  readonly resolve_cursor: string | null;
  readonly heartbeat_at: Date | null;
  readonly consecutive_errors: number;
  readonly error_code: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface IBulkFilterJson {
  readonly stageId?: string;
  readonly ownerId?: string;
  readonly status?: string;
  readonly valueMin?: number;
  readonly valueMax?: number;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
}

export interface IBulkItemCounts {
  readonly pending: number;
  readonly moved: number;
  readonly skipped: number;
  readonly total: number;
  readonly skippedConflict: number;
  readonly skippedFilter: number;
  readonly skippedAlreadyThere: number;
}

export interface IClaimedItem {
  readonly opportunityId: string;
  readonly seenVersion: number;
}

export interface IMovedRow {
  readonly id: string;
  readonly fromStageId: string;
}

export interface IBulkItemRow {
  readonly opportunity_id: string;
  readonly seen_version: number;
  readonly state: ItemState;
  readonly skip_reason: SkipReason | null;
}
