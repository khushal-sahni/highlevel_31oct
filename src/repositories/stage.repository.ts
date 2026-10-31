import { Injectable } from '@nestjs/common';
import { DatabasePool } from '../db/database.pool';
import { IStage, IStageRow } from '../entities/opportunity';
import { requireRow } from '../utils/require-row';

export interface IInsertStageOptions {
  readonly id?: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly position: number;
}

@Injectable()
export class StageRepository {
  constructor(private readonly db: DatabasePool) {}

  async findInWorkspace(
    workspaceId: string,
    stageId: string,
  ): Promise<IStage | null> {
    const result = await this.db.query<IStageRow>(
      `SELECT id, workspace_id, name, position
       FROM stages
       WHERE id = $1 AND workspace_id = $2`,
      [stageId, workspaceId],
    );
    const row = result.rows[0];
    return row === undefined ? null : StageRepository.mapRow(row);
  }

  async insert(options: IInsertStageOptions): Promise<IStage> {
    const result = await this.db.query<IStageRow>(
      `INSERT INTO stages (id, workspace_id, name, position)
       VALUES (COALESCE($1::uuid, uuidv7()), $2, $3, $4)
       ON CONFLICT (workspace_id, position) DO UPDATE
         SET name = EXCLUDED.name
       RETURNING id, workspace_id, name, position`,
      [options.id ?? null, options.workspaceId, options.name, options.position],
    );
    return StageRepository.mapRow(requireRow(result.rows[0], 'insert stage'));
  }

  private static mapRow(row: IStageRow): IStage {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      position: row.position,
    };
  }
}
