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
      if (error instanceof Error) {
        this.logger.error('worker step failed', error);
      } else {
        this.logger.error('worker step failed');
      }
      return false;
    }
  }

  async step(): Promise<boolean> {
    return this.stepHeld(async () => undefined);
  }

  async stepHeld(wait: () => Promise<void>): Promise<boolean> {
    return this.db.withClient(async (client) => {
      const permit = await this.takePermit(client);
      if (permit === null) {
        return false;
      }
      try {
        return await this.work(client, wait);
      } finally {
        await this.releasePermit(client, permit);
      }
    });
  }

  private async work(
    client: PoolClient,
    wait: () => Promise<void>,
  ): Promise<boolean> {
    await client.query('BEGIN');
    let job: IBulkJob | null = null;
    try {
      job = await this.engine.claimOrPromote(client);
      await wait();
      if (job === null) {
        await client.query('COMMIT');
        return false;
      }
      await this.engine.advance(client, job, this.config);
      await client.query('COMMIT');
      return true;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      return this.handleWorkError(client, job, error);
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

  private async takePermit(client: PoolClient): Promise<number | null> {
    const max = this.config.maxInFlightChunks;
    for (let i = 1; i <= max; i += 1) {
      const key = this.config.permitBase + i;
      if (await this.tryLock(client, key)) {
        return key;
      }
    }
    return null;
  }

  private async tryLock(client: PoolClient, key: number): Promise<boolean> {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [key],
    );
    return requireRow(result.rows[0], 'advisory lock').locked;
  }

  private async releasePermit(client: PoolClient, key: number): Promise<void> {
    await client.query('SELECT pg_advisory_unlock($1)', [key]);
  }
}
