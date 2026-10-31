import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AppConfig } from '../config/app.config';
import { DatabasePool } from '../db/database.pool';
import { IBulkJob } from '../entities/bulk-job';
import { LoggerService } from '../services/logger.service';
import { isLockTimeout } from '../utils/pg-error';
import { requireRow } from '../utils/require-row';
import { sleep } from '../utils/sleep';
import { BulkMoveEngine } from './bulk-move.engine';

@Injectable()
export class BulkMoveWorker {
  private running = true;

  constructor(
    private readonly db: DatabasePool,
    private readonly engine: BulkMoveEngine,
    private readonly config: AppConfig,
    private readonly logger: LoggerService,
  ) {}

  stop(): void {
    this.running = false;
  }

  async run(): Promise<void> {
    while (this.running) {
      await this.stepSafely();
      await sleep(this.config.chunkPauseMs);
    }
  }

  async runUntilIdle(maxSteps = 1_000): Promise<void> {
    for (let i = 0; i < maxSteps; i += 1) {
      const worked = await this.step();
      if (!worked) {
        return;
      }
    }
    throw new Error('worker ran too many steps');
  }

  async stepSafely(): Promise<boolean> {
    try {
      return await this.step();
    } catch (error: unknown) {
      this.logger.error('worker step failed', error);
      return false;
    }
  }

  async step(): Promise<boolean> {
    return this.db.withClient(async (client) => {
      const locked = await this.tryLock(client);
      if (!locked) {
        return false;
      }
      try {
        return await this.work(client);
      } finally {
        await this.unlock(client);
      }
    });
  }

  private async work(client: PoolClient): Promise<boolean> {
    const active = await this.engine.findActive(client);
    try {
      if (active === null) {
        return this.engine.promoteNext(client);
      }
      return await this.engine.advance(client, active, this.config);
    } catch (error: unknown) {
      return this.handleWorkError(client, active, error);
    }
  }

  private async handleWorkError(
    client: PoolClient,
    active: IBulkJob | null,
    error: unknown,
  ): Promise<boolean> {
    if (isLockTimeout(error)) {
      return false;
    }
    if (active !== null) {
      await this.engine.recordError(client, active.id, this.config);
    }
    throw error;
  }

  private async tryLock(client: PoolClient): Promise<boolean> {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [this.config.advisoryLockKey],
    );
    return requireRow(result.rows[0], 'advisory lock').locked;
  }

  private async unlock(client: PoolClient): Promise<void> {
    await client.query('SELECT pg_advisory_unlock($1)', [
      this.config.advisoryLockKey,
    ]);
  }
}
