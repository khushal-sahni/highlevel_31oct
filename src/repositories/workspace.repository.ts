import { Injectable } from '@nestjs/common';
import { DatabasePool } from '../db/database.pool';
import { IWorkspace } from '../entities/opportunity';
import { requireRow } from '../utils/require-row';

interface IWorkspaceRow {
  readonly id: string;
}

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly db: DatabasePool) {}

  async findById(id: string): Promise<IWorkspace | null> {
    const result = await this.db.query<IWorkspaceRow>(
      'SELECT id FROM workspaces WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? null : { id: row.id };
  }

  async insert(id?: string): Promise<IWorkspace> {
    if (id === undefined) {
      const result = await this.db.query<IWorkspaceRow>(
        'INSERT INTO workspaces DEFAULT VALUES RETURNING id',
      );
      return { id: requireRow(result.rows[0], 'insert workspace').id };
    }
    const result = await this.db.query<IWorkspaceRow>(
      `INSERT INTO workspaces (id) VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET id = workspaces.id
       RETURNING id`,
      [id],
    );
    return { id: requireRow(result.rows[0], 'insert workspace').id };
  }
}
