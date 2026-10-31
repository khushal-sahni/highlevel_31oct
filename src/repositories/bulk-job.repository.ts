import { Injectable } from '@nestjs/common';
import { DatabasePool } from '../db/database.pool';
import { IBulkJob, IBulkJobRow } from '../entities/bulk-job';
import { ICreateBulkMoveInput } from '../dtos/create-bulk-move.dto';
import { JobStatus } from '../types/job-status';
import { IQueryClient } from '../types/query-client';
import { filterToJson, mapBulkJob } from '../utils/map-bulk-job';
import { isUniqueViolation } from '../utils/pg-error';
import { requireRow } from '../utils/require-row';

export interface IInsertJobOptions {
  readonly workspaceId: string;
  readonly idempotencyKey: string;
  readonly bodyHash: string;
  readonly input: ICreateBulkMoveInput;
}

const JOB_COLUMNS = `id, workspace_id, idempotency_key, body_hash, filter,
  target_stage_id, status, resolve_cursor, heartbeat_at, consecutive_errors,
  error_code, created_at, updated_at`;

@Injectable()
export class BulkJobRepository {
  constructor(private readonly db: DatabasePool) {}

  async insert(options: IInsertJobOptions): Promise<IBulkJob> {
    const result = await this.db.query<IBulkJobRow>(
      `INSERT INTO bulk_jobs (
         workspace_id, idempotency_key, body_hash, filter, target_stage_id, status
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING ${JOB_COLUMNS}`,
      [
        options.workspaceId,
        options.idempotencyKey,
        options.bodyHash,
        JSON.stringify(filterToJson(options.input.filter)),
        options.input.targetStageId,
        JobStatus.QUEUED,
      ],
    );
    return mapBulkJob(requireRow(result.rows[0], 'insert bulk job'));
  }

  async findById(workspaceId: string, jobId: string): Promise<IBulkJob | null> {
    const result = await this.db.query<IBulkJobRow>(
      `SELECT ${JOB_COLUMNS} FROM bulk_jobs
       WHERE id = $1 AND workspace_id = $2`,
      [jobId, workspaceId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapBulkJob(row);
  }

  async findByKey(workspaceId: string, key: string): Promise<IBulkJob | null> {
    const result = await this.db.query<IBulkJobRow>(
      `SELECT ${JOB_COLUMNS} FROM bulk_jobs
       WHERE workspace_id = $1 AND idempotency_key = $2`,
      [workspaceId, key],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapBulkJob(row);
  }

  async countOpen(workspaceId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM bulk_jobs
       WHERE workspace_id = $1 AND status IN ($2, $3, $4)`,
      [
        workspaceId,
        JobStatus.QUEUED,
        JobStatus.RESOLVING,
        JobStatus.RUNNING,
      ],
    );
    return Number.parseInt(requireRow(result.rows[0], 'count open jobs').count, 10);
  }

  async claimActiveForWork(client: IQueryClient): Promise<IBulkJob | null> {
    const result = await client.query<IBulkJobRow>(
      `SELECT ${JOB_COLUMNS} FROM bulk_jobs
       WHERE status IN ($1, $2)
       ORDER BY heartbeat_at NULLS FIRST, created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [JobStatus.RESOLVING, JobStatus.RUNNING],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapBulkJob(row);
  }

  async promoteNext(client: IQueryClient): Promise<IBulkJob | null> {
    try {
      const id = await this.pickQueuedJob(client);
      if (id === null) {
        return null;
      }
      return this.markPromoted(client, id);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  private async pickQueuedJob(client: IQueryClient): Promise<string | null> {
    const picked = await client.query<{ id: string }>(
      `SELECT j.id FROM bulk_jobs j
       JOIN (
         SELECT DISTINCT ON (q.workspace_id) q.id
         FROM bulk_jobs q
         WHERE q.status = $1
           AND NOT EXISTS (
             SELECT 1 FROM bulk_jobs a
             WHERE a.workspace_id = q.workspace_id
               AND a.status IN ($2, $3)
           )
         ORDER BY q.workspace_id, q.created_at
       ) c ON c.id = j.id
       ORDER BY j.created_at
       LIMIT 1
       FOR UPDATE OF j SKIP LOCKED`,
      [JobStatus.QUEUED, JobStatus.RESOLVING, JobStatus.RUNNING],
    );
    return picked.rows[0]?.id ?? null;
  }

  private async markPromoted(
    client: IQueryClient,
    jobId: string,
  ): Promise<IBulkJob | null> {
    const result = await client.query<IBulkJobRow>(
      `UPDATE bulk_jobs
       SET status = $2, heartbeat_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING ${JOB_COLUMNS}`,
      [jobId, JobStatus.RESOLVING],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapBulkJob(row);
  }

  async markResolvingProgress(
    client: IQueryClient,
    options: { jobId: string; cursor: string; done: boolean },
  ): Promise<void> {
    const status = options.done ? JobStatus.RUNNING : JobStatus.RESOLVING;
    await client.query(
      `UPDATE bulk_jobs
       SET resolve_cursor = $2, status = $3, heartbeat_at = now(),
           consecutive_errors = 0, updated_at = now()
       WHERE id = $1`,
      [options.jobId, options.cursor, status],
    );
  }

  async heartbeat(client: IQueryClient, jobId: string): Promise<void> {
    await client.query(
      `UPDATE bulk_jobs
       SET heartbeat_at = now(), consecutive_errors = 0, updated_at = now()
       WHERE id = $1`,
      [jobId],
    );
  }

  async markRunning(client: IQueryClient, jobId: string): Promise<void> {
    await client.query(
      `UPDATE bulk_jobs
       SET status = $2, heartbeat_at = now(), consecutive_errors = 0,
           updated_at = now()
       WHERE id = $1`,
      [jobId, JobStatus.RUNNING],
    );
  }

  async markCompleted(client: IQueryClient, jobId: string): Promise<void> {
    await client.query(
      `UPDATE bulk_jobs
       SET status = $2, heartbeat_at = now(), consecutive_errors = 0,
           updated_at = now()
       WHERE id = $1`,
      [jobId, JobStatus.COMPLETED],
    );
  }

  async markFailed(
    client: IQueryClient,
    jobId: string,
    errorCode: string,
  ): Promise<void> {
    await client.query(
      `UPDATE bulk_jobs
       SET status = $2, error_code = $3, heartbeat_at = now(), updated_at = now()
       WHERE id = $1`,
      [jobId, JobStatus.FAILED, errorCode],
    );
  }

  async recordError(
    client: IQueryClient,
    options: { jobId: string; fatalLimit: number },
  ): Promise<void> {
    await client.query(
      `UPDATE bulk_jobs
       SET consecutive_errors = consecutive_errors + 1,
           status = CASE
             WHEN consecutive_errors + 1 >= $2 THEN $3
             ELSE status
           END,
           error_code = CASE
             WHEN consecutive_errors + 1 >= $2 THEN 'CHUNK_FAILED'
             ELSE error_code
           END,
           updated_at = now()
       WHERE id = $1`,
      [options.jobId, options.fatalLimit, JobStatus.FAILED],
    );
  }
}
