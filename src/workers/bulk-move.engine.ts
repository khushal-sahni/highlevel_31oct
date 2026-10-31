import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app.config';
import { IBulkJob, IClaimedItem } from '../entities/bulk-job';
import { IOpportunity } from '../entities/opportunity';
import { JobStatus, SkipReason } from '../types/job-status';
import { IQueryClient } from '../types/query-client';
import { BulkItemRepository, ISkipMark } from '../repositories/bulk-item.repository';
import { BulkJobRepository } from '../repositories/bulk-job.repository';
import { OpportunityRepository } from '../repositories/opportunity.repository';

@Injectable()
export class BulkMoveEngine {
  constructor(
    private readonly jobs: BulkJobRepository,
    private readonly items: BulkItemRepository,
    private readonly opportunities: OpportunityRepository,
  ) {}

  async findActive(client: IQueryClient): Promise<IBulkJob | null> {
    return this.jobs.findActiveForWork(client);
  }

  async promoteNext(client: IQueryClient): Promise<boolean> {
    return this.jobs.promoteNext(client);
  }

  async recordError(
    client: IQueryClient,
    jobId: string,
    config: AppConfig,
  ): Promise<void> {
    await this.jobs.recordError(client, {
      jobId,
      fatalLimit: config.fatalErrorLimit,
    });
  }

  async advance(
    client: IQueryClient,
    job: IBulkJob,
    config: AppConfig,
  ): Promise<boolean> {
    if (job.status === JobStatus.RESOLVING) {
      return this.resolvePage(client, job, config);
    }
    return this.applyChunk(client, job, config);
  }

  private async resolvePage(
    client: IQueryClient,
    job: IBulkJob,
    config: AppConfig,
  ): Promise<boolean> {
    await client.query('BEGIN');
    try {
      const page = await this.items.resolvePage(
        client,
        job,
        config.resolvePageSize,
      );
      await this.finishResolve(client, job, page, config);
      await client.query('COMMIT');
      return true;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  private async finishResolve(
    client: IQueryClient,
    job: IBulkJob,
    page: { scanned: number; lastId: string | null; inserted: number },
    config: AppConfig,
  ): Promise<void> {
    const counts = await this.items.countByJob(job.id, client);
    if (counts.total > config.maxBulkMoveSize) {
      await this.jobs.markFailed(client, job.id, 'SNAPSHOT_TOO_LARGE');
      return;
    }
    const done = page.scanned < config.resolvePageSize;
    if (page.lastId === null) {
      await this.jobs.markRunning(client, job.id);
      return;
    }
    await this.jobs.markResolvingProgress(client, {
      jobId: job.id,
      cursor: page.lastId,
      done,
    });
  }

  private async applyChunk(
    client: IQueryClient,
    job: IBulkJob,
    config: AppConfig,
  ): Promise<boolean> {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '250ms'");
      const claimed = await this.items.claimPending(
        client,
        job.id,
        config.applyChunkSize,
      );
      await this.finishApply(client, job, claimed);
      await client.query('COMMIT');
      return true;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  private async finishApply(
    client: IQueryClient,
    job: IBulkJob,
    claimed: readonly IClaimedItem[],
  ): Promise<void> {
    if (claimed.length === 0) {
      await this.jobs.markCompleted(client, job.id);
      return;
    }
    const moved = await this.items.moveEligible(client, job, claimed);
    await this.items.recordMoves(client, job, moved);
    const movedIds = new Set(moved.map((row) => row.id));
    const skipped = claimed.filter((item) => !movedIds.has(item.opportunityId));
    await this.items.markSkipped(
      client,
      job.id,
      await this.skipMarks(client, job, skipped),
    );
    await this.jobs.heartbeat(client, job.id);
  }

  private async skipMarks(
    client: IQueryClient,
    job: IBulkJob,
    skipped: readonly IClaimedItem[],
  ): Promise<readonly ISkipMark[]> {
    const rows = await this.opportunities.findByIds(
      job.workspaceId,
      skipped.map((item) => item.opportunityId),
      client,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    return skipped.map((item) => ({
      opportunityId: item.opportunityId,
      reason: this.skipReason(job, item, byId.get(item.opportunityId)),
    }));
  }

  private skipReason(
    job: IBulkJob,
    item: IClaimedItem,
    row: IOpportunity | undefined,
  ): SkipReason {
    if (row === undefined) {
      return SkipReason.FILTER;
    }
    if (row.stageId === job.targetStageId) {
      return SkipReason.ALREADY_THERE;
    }
    if (
      row.version !== item.seenVersion ||
      row.stageChangedAt.getTime() > job.createdAt.getTime()
    ) {
      return SkipReason.CONFLICT;
    }
    return SkipReason.FILTER;
  }
}
