import { Injectable } from '@nestjs/common';
import { DatabasePool } from '../db/database.pool';
import {
  IBulkItemCounts,
  IBulkJob,
  IClaimedItem,
  IMovedRow,
} from '../entities/bulk-job';
import { ItemState, SkipReason } from '../types/job-status';
import { IQueryClient } from '../types/query-client';
import { bulkFilterSql } from '../utils/bulk-filter-sql';
import { requireRow } from '../utils/require-row';
import { TransitionRepository } from './transition.repository';

export interface IResolvePageResult {
  readonly scanned: number;
  readonly lastId: string | null;
  readonly inserted: number;
}

export interface ISkipMark {
  readonly opportunityId: string;
  readonly reason: SkipReason;
}

interface ICountRow {
  readonly pending: string;
  readonly moved: string;
  readonly skipped: string;
  readonly total: string;
  readonly skipped_conflict: string;
  readonly skipped_filter: string;
  readonly skipped_already_there: string;
}

@Injectable()
export class BulkItemRepository {
  constructor(
    private readonly db: DatabasePool,
    private readonly transitions: TransitionRepository,
  ) {}

  async countByJob(
    jobId: string,
    client: IQueryClient = this.db,
  ): Promise<IBulkItemCounts> {
    const result = await client.query<ICountRow>(
      `SELECT
         COUNT(*) FILTER (WHERE state = 'pending')::text AS pending,
         COUNT(*) FILTER (WHERE state = 'moved')::text AS moved,
         COUNT(*) FILTER (WHERE state = 'skipped')::text AS skipped,
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE skip_reason = 'conflict')::text AS skipped_conflict,
         COUNT(*) FILTER (WHERE skip_reason = 'filter')::text AS skipped_filter,
         COUNT(*) FILTER (WHERE skip_reason = 'already_there')::text
           AS skipped_already_there
       FROM bulk_move_items
       WHERE job_id = $1`,
      [jobId],
    );
    return BulkItemRepository.mapCounts(
      requireRow(result.rows[0], 'count items'),
    );
  }

  async resolvePage(
    client: IQueryClient,
    job: IBulkJob,
    pageSize: number,
  ): Promise<IResolvePageResult> {
    const filterSql = bulkFilterSql(job.filter, job.createdAt, 7, 'page');
    const result = await client.query<{
      scanned: string;
      last_id: string | null;
      inserted: string;
    }>(this.resolveSql(filterSql.clause), [
      job.workspaceId,
      job.filter.stageId ?? null,
      job.resolveCursor,
      pageSize,
      job.id,
      ItemState.PENDING,
      ...filterSql.values,
    ]);
    const row = requireRow(result.rows[0], 'resolve page');
    return {
      scanned: Number.parseInt(row.scanned, 10),
      lastId: row.last_id,
      inserted: Number.parseInt(row.inserted, 10),
    };
  }

  async claimPending(
    client: IQueryClient,
    jobId: string,
    limit: number,
  ): Promise<IClaimedItem[]> {
    const result = await client.query<{
      opportunity_id: string;
      seen_version: number;
    }>(
      `SELECT opportunity_id, seen_version
       FROM bulk_move_items
       WHERE job_id = $1 AND state = $2
       ORDER BY opportunity_id
       LIMIT $3
       FOR UPDATE SKIP LOCKED`,
      [jobId, ItemState.PENDING, limit],
    );
    return result.rows.map((row) => ({
      opportunityId: row.opportunity_id,
      seenVersion: row.seen_version,
    }));
  }

  async moveEligible(
    client: IQueryClient,
    job: IBulkJob,
    claimed: readonly IClaimedItem[],
  ): Promise<IMovedRow[]> {
    const filterSql = bulkFilterSql(job.filter, job.createdAt, 6, 'o');
    const result = await client.query<{ id: string; from_stage_id: string }>(
      this.moveSql(filterSql.clause),
      [
        claimed.map((item) => item.opportunityId),
        claimed.map((item) => item.seenVersion),
        job.workspaceId,
        job.createdAt,
        job.targetStageId,
        ...filterSql.values,
      ],
    );
    return result.rows.map((row) => ({
      id: row.id,
      fromStageId: row.from_stage_id,
    }));
  }

  async recordMoves(
    client: IQueryClient,
    job: IBulkJob,
    moved: readonly IMovedRow[],
  ): Promise<void> {
    await this.transitions.insertMany(
      moved.map((row) => ({
        workspaceId: job.workspaceId,
        opportunityId: row.id,
        fromStageId: row.fromStageId,
        toStageId: job.targetStageId,
        jobId: job.id,
      })),
      client,
    );
    await this.markMoved(
      client,
      job.id,
      moved.map((row) => row.id),
    );
  }

  async markMoved(
    client: IQueryClient,
    jobId: string,
    opportunityIds: readonly string[],
  ): Promise<void> {
    if (opportunityIds.length === 0) {
      return;
    }
    await client.query(
      `UPDATE bulk_move_items
       SET state = $3, skip_reason = NULL
       WHERE job_id = $1 AND opportunity_id = ANY($2::uuid[])`,
      [jobId, opportunityIds, ItemState.MOVED],
    );
  }

  async markSkipped(
    client: IQueryClient,
    jobId: string,
    skips: readonly ISkipMark[],
  ): Promise<void> {
    if (skips.length === 0) {
      return;
    }
    await client.query(
      `UPDATE bulk_move_items AS i
       SET state = $2, skip_reason = v.reason
       FROM UNNEST($3::uuid[], $4::text[]) AS v(opportunity_id, reason)
       WHERE i.job_id = $1 AND i.opportunity_id = v.opportunity_id`,
      [
        jobId,
        ItemState.SKIPPED,
        skips.map((skip) => skip.opportunityId),
        skips.map((skip) => skip.reason),
      ],
    );
  }

  private resolveSql(filterClause: string): string {
    return `
      WITH page AS (
        SELECT id, version, owner_id, status, value, created_at
        FROM opportunities
        WHERE workspace_id = $1
          AND ($2::uuid IS NULL OR stage_id = $2)
          AND ($3::uuid IS NULL OR id > $3)
        ORDER BY id
        LIMIT $4
      ),
      matched AS (
        SELECT id, version FROM page
        WHERE TRUE
        ${filterClause}
      ),
      ins AS (
        INSERT INTO bulk_move_items (job_id, opportunity_id, seen_version, state)
        SELECT $5, id, version, $6 FROM matched
        ON CONFLICT DO NOTHING
        RETURNING opportunity_id
      )
      SELECT
        (SELECT COUNT(*)::text FROM page) AS scanned,
        (SELECT id FROM page ORDER BY id DESC LIMIT 1) AS last_id,
        (SELECT COUNT(*)::text FROM ins) AS inserted`;
  }

  private moveSql(filterClause: string): string {
    return `
      WITH claimed(opportunity_id, seen_version) AS (
        SELECT * FROM UNNEST($1::uuid[], $2::int[])
          AS t(opportunity_id, seen_version)
      ),
      eligible AS (
        SELECT o.id, o.stage_id AS from_stage_id
        FROM opportunities o
        JOIN claimed c ON c.opportunity_id = o.id
        WHERE o.workspace_id = $3
          AND o.version = c.seen_version
          AND o.stage_changed_at <= $4
          AND o.stage_id <> $5
          ${filterClause}
      )
      UPDATE opportunities o
      SET stage_id = $5, version = version + 1,
          stage_changed_at = now(), updated_at = now()
      FROM eligible e
      WHERE o.id = e.id
      RETURNING o.id, e.from_stage_id`;
  }

  private static mapCounts(row: ICountRow): IBulkItemCounts {
    return {
      pending: Number.parseInt(row.pending, 10),
      moved: Number.parseInt(row.moved, 10),
      skipped: Number.parseInt(row.skipped, 10),
      total: Number.parseInt(row.total, 10),
      skippedConflict: Number.parseInt(row.skipped_conflict, 10),
      skippedFilter: Number.parseInt(row.skipped_filter, 10),
      skippedAlreadyThere: Number.parseInt(row.skipped_already_there, 10),
    };
  }
}
