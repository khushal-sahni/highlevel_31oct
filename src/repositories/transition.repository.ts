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
         workspace_id, opportunity_id, from_stage_id, to_stage_id
       ) VALUES ($1, $2, $3, $4)
       RETURNING id, workspace_id, opportunity_id, from_stage_id,
                 to_stage_id, created_at`,
      [
        options.workspaceId,
        options.opportunityId,
        options.fromStageId,
        options.toStageId,
      ],
    );
    return TransitionRepository.mapRow(
      requireRow(result.rows[0], 'insert transition'),
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

  private static mapRow(row: ITransitionRow): ITransition {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      opportunityId: row.opportunity_id,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      createdAt: row.created_at,
    };
  }
}
