import { IBulkItemCounts, IBulkJob } from '../entities/bulk-job';
import { JobHealth, JobStatus } from '../types/job-status';

export interface IBulkJobResponse {
  readonly id: string;
  readonly status: JobStatus;
  readonly health: JobHealth | null;
  readonly heartbeatAt: string | null;
  readonly targetStageId: string;
  readonly errorCode: string | null;
  readonly counts: IBulkJobCountsResponse;
}

export interface IBulkJobCountsResponse {
  readonly pending: number;
  readonly moved: number;
  readonly skipped: number;
  readonly total: number;
  readonly skippedConflict: number;
  readonly skippedFilter: number;
  readonly skippedAlreadyThere: number;
}

export function toBulkJobResponse(
  job: IBulkJob,
  counts: IBulkItemCounts,
  staleMs: number,
): IBulkJobResponse {
  return {
    id: job.id,
    status: job.status,
    health: jobHealth(job, staleMs),
    heartbeatAt: job.heartbeatAt === null ? null : job.heartbeatAt.toISOString(),
    targetStageId: job.targetStageId,
    errorCode: job.errorCode,
    counts: {
      pending: counts.pending,
      moved: counts.moved,
      skipped: counts.skipped,
      total: counts.total,
      skippedConflict: counts.skippedConflict,
      skippedFilter: counts.skippedFilter,
      skippedAlreadyThere: counts.skippedAlreadyThere,
    },
  };
}

// Derived from heartbeat age — not a stored column.
function jobHealth(job: IBulkJob, staleMs: number): JobHealth | null {
  if (job.status !== JobStatus.RESOLVING && job.status !== JobStatus.RUNNING) {
    return null;
  }
  if (job.heartbeatAt === null) {
    return JobHealth.STALLED;
  }
  const age = Date.now() - job.heartbeatAt.getTime();
  return age < staleMs ? JobHealth.ACTIVE : JobHealth.STALLED;
}
