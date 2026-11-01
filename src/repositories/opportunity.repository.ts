import { Injectable } from '@nestjs/common';
import { DatabasePool } from '../db/database.pool';
import { IOpportunity, IOpportunityRow } from '../entities/opportunity';
import { ICreateOpportunityInput } from '../dtos/create-opportunity.dto';
import { IQueryClient } from '../types/query-client';
import { mapOpportunity } from '../utils/map-opportunity';
import { requireRow } from '../utils/require-row';
import { TransitionRepository } from './transition.repository';

export interface IInsertOpportunityOptions extends ICreateOpportunityInput {
  readonly workspaceId: string;
}

export interface IMoveIfVersionOptions {
  readonly workspaceId: string;
  readonly opportunityId: string;
  readonly stageId: string;
  readonly fromStageId: string;
  readonly expectedVersion: number;
}

export interface IListByStageOptions {
  readonly workspaceId: string;
  readonly stageId: string;
  readonly limit: number;
  readonly cursor?: string;
}

@Injectable()
export class OpportunityRepository {
  constructor(
    private readonly db: DatabasePool,
    private readonly transitions: TransitionRepository,
  ) {}

  async insert(options: IInsertOpportunityOptions): Promise<IOpportunity> {
    const result = await this.db.query<IOpportunityRow>(
      `INSERT INTO opportunities (
         workspace_id, stage_id, name, value, status, owner_id
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, workspace_id, stage_id, name, value::text, status,
                 owner_id, version, stage_changed_at, created_at, updated_at`,
      [
        options.workspaceId,
        options.stageId,
        options.name,
        options.value,
        options.status,
        options.ownerId,
      ],
    );
    return mapOpportunity(requireRow(result.rows[0], 'insert opportunity'));
  }

  async findById(
    workspaceId: string,
    opportunityId: string,
  ): Promise<IOpportunity | null> {
    const result = await this.db.query<IOpportunityRow>(
      `SELECT id, workspace_id, stage_id, name, value::text, status,
              owner_id, version, stage_changed_at, created_at, updated_at
       FROM opportunities
       WHERE id = $1 AND workspace_id = $2`,
      [opportunityId, workspaceId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapOpportunity(row);
  }

  async findByIds(
    workspaceId: string,
    ids: readonly string[],
    client: IQueryClient = this.db,
  ): Promise<IOpportunity[]> {
    if (ids.length === 0) {
      return [];
    }
    const result = await client.query<IOpportunityRow>(
      `SELECT id, workspace_id, stage_id, name, value::text, status,
              owner_id, version, stage_changed_at, created_at, updated_at
       FROM opportunities
       WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
      [workspaceId, ids],
    );
    return result.rows.map((row) => mapOpportunity(row));
  }

  async listByStage(options: IListByStageOptions): Promise<IOpportunity[]> {
    const result = await this.db.query<IOpportunityRow>(
      `SELECT id, workspace_id, stage_id, name, value::text, status,
              owner_id, version, stage_changed_at, created_at, updated_at
       FROM opportunities
       WHERE workspace_id = $1
         AND stage_id = $2
         AND ($3::uuid IS NULL OR id > $3)
       ORDER BY id
       LIMIT $4`,
      [
        options.workspaceId,
        options.stageId,
        options.cursor ?? null,
        options.limit,
      ],
    );
    return result.rows.map((row) => mapOpportunity(row));
  }

  async moveIfVersion(
    options: IMoveIfVersionOptions,
  ): Promise<IOpportunity | null> {
    return this.db.withTransaction(async (client) => {
      const updated = await this.updateStage(client, options);
      if (updated === null) {
        return null;
      }
      await this.transitions.insert(
        {
          workspaceId: options.workspaceId,
          opportunityId: options.opportunityId,
          fromStageId: options.fromStageId,
          toStageId: options.stageId,
        },
        client,
      );
      return updated;
    });
  }

  private async updateStage(
    client: IQueryClient,
    options: IMoveIfVersionOptions,
  ): Promise<IOpportunity | null> {
    const result = await client.query<IOpportunityRow>(
      `UPDATE opportunities
       SET stage_id = $1,
           version = version + 1,
           stage_changed_at = now(),
           updated_at = now()
       WHERE id = $2
         AND workspace_id = $3
         AND version = $4 -- CAS: a concurrent edit makes this UPDATE return 0 rows.
       RETURNING id, workspace_id, stage_id, name, value::text, status,
                 owner_id, version, stage_changed_at, created_at, updated_at`,
      [
        options.stageId,
        options.opportunityId,
        options.workspaceId,
        options.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapOpportunity(row);
  }
}
