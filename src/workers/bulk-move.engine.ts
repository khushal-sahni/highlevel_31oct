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

  async claimOrPromote(client: IQueryClient): Promise<IBulkJob | null> {
    // Finish an already-active job before promoting a queued one.
    const claimed = await this.jobs.claimActiveForWork(client);
    if (claimed !== null) {
      return claimed;
    }
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
  ): Promise<void> {
    if (job.status === JobStatus.RESOLVING) {
      await this.resolvePage(client, job, config);
      return;
    }
    await this.applyChunk(client, job, config);
  }

  private async resolvePage(
    client: IQueryClient,
    job: IBulkJob,
    config: AppConfig,
  ): Promise<void> {
    const page = await this.items.resolvePage(
      client,
      job,
      config.resolvePageSize,
    );
    await this.finishResolve(client, job, page, config);
  }

  private async finishResolve(
    client: IQueryClient,
    job: IBulkJob,
    page: { scanned: number; lastId: string | null; inserted: number },
    config: AppConfig,
  ): Promise<void> {
    const counts = await this.items.countByJob(job.id, client);
    if (counts.total > config.maxBulkMoveSize) {
      // Cap check happens during resolve, before any stage change.
      await this.jobs.markFailed(client, job.id, 'SNAPSHOT_TOO_LARGE');
      return;
    }
    const done = page.scanned < config.resolvePageSize;
    if (page.lastId === null) {
      // Empty walk: nothing to copy, skip apply.
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
  ): Promise<void> {
    // Yield on row contention instead of blocking other writers.
    await client.query("SET LOCAL lock_timeout = '250ms'");
    const claimed = await this.items.claimPending(
      client,
      job.id,
      config.applyChunkSize,
    );
    await this.finishApply(client, job, claimed);
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
      // Human edit after enqueue wins even if version happened to match.
      row.stageChangedAt.getTime() > job.createdAt.getTime()
    ) {
      return SkipReason.CONFLICT;
    }
    return SkipReason.FILTER;
  }
}
