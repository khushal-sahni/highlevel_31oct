import { Injectable } from '@nestjs/common';
import { DatabasePool } from '../db/database.pool';
import { IQueryClient } from '../types/query-client';
import { ITransition, ITransitionRow } from '../entities/opportunity';
import { requireRow } from '../utils/require-row';

export interface IInsertTransitionOptions {
  readonly workspaceId: string;
  readonly opportunityId: string;
  readonly fromStageId: string;
  readonly toStageId: string;
  readonly jobId?: string;
}

@Injectable()
export class TransitionRepository {
  constructor(private readonly db: DatabasePool) {}

  async insert(
    options: IInsertTransitionOptions,
    client: IQueryClient = this.db,
  ): Promise<ITransition> {
    const result = await client.query<ITransitionRow>(
      `INSERT INTO transitions (
         workspace_id, opportunity_id, from_stage_id, to_stage_id, job_id
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, workspace_id, opportunity_id, from_stage_id,
                 to_stage_id, job_id, created_at`,
      [
        options.workspaceId,
        options.opportunityId,
        options.fromStageId,
        options.toStageId,
        options.jobId ?? null,
      ],
    );
    return TransitionRepository.mapRow(
      requireRow(result.rows[0], 'insert transition'),
    );
  }

  async insertMany(
    rows: readonly IInsertTransitionOptions[],
    client: IQueryClient,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await client.query(
      `INSERT INTO transitions (
         workspace_id, opportunity_id, from_stage_id, to_stage_id, job_id
       )
       SELECT * FROM UNNEST(
         $1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[], $5::uuid[]
       )
       ON CONFLICT (job_id, opportunity_id) WHERE job_id IS NOT NULL
         DO NOTHING`,
      [
        rows.map((row) => row.workspaceId),
        rows.map((row) => row.opportunityId),
        rows.map((row) => row.fromStageId),
        rows.map((row) => row.toStageId),
        rows.map((row) => row.jobId ?? null),
      ],
    );
  }

  async countForOpportunity(
    workspaceId: string,
    opportunityId: string,
  ): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM transitions
       WHERE workspace_id = $1 AND opportunity_id = $2`,
      [workspaceId, opportunityId],
    );
    return Number.parseInt(
      requireRow(result.rows[0], 'count transitions').count,
      10,
    );
  }

  async countForJob(jobId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM transitions WHERE job_id = $1`,
      [jobId],
    );
    return Number.parseInt(
      requireRow(result.rows[0], 'count job transitions').count,
      10,
    );
  }

  private static mapRow(row: ITransitionRow): ITransition {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      opportunityId: row.opportunity_id,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      jobId: row.job_id,
      createdAt: row.created_at,
    };
  }
}
