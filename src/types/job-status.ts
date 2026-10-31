export enum JobStatus {
  QUEUED = 'queued',
  RESOLVING = 'resolving',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum JobHealth {
  ACTIVE = 'active',
  STALLED = 'stalled',
}

export enum ItemState {
  PENDING = 'pending',
  MOVED = 'moved',
  SKIPPED = 'skipped',
}

export enum SkipReason {
  CONFLICT = 'conflict',
  FILTER = 'filter',
  ALREADY_THERE = 'already_there',
}

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.RESOLVING,
  JobStatus.RUNNING,
];
