import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AppConfig } from '../config/app.config';
import { IQueryClient } from '../types/query-client';

@Injectable()
export class DatabasePool implements IQueryClient, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: AppConfig) {
    this.pool = new Pool({ connectionString: config.databaseUrl });
  }

  async query<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
