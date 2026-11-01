import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app.config';
import { ICreateBulkMoveInput } from '../dtos/create-bulk-move.dto';
import { IBulkItemCounts, IBulkJob } from '../entities/bulk-job';
import { ConflictError, NotFoundError, RateLimitError } from '../errors/app.error';
import { BulkItemRepository } from '../repositories/bulk-item.repository';
import { BulkJobRepository } from '../repositories/bulk-job.repository';
import { StageRepository } from '../repositories/stage.repository';
import { hashBulkBody } from '../utils/hash-bulk-body';
import { isUniqueViolation } from '../utils/pg-error';

export interface IBulkJobView {
  readonly job: IBulkJob;
  readonly counts: IBulkItemCounts;
}

@Injectable()
export class BulkMoveService {
  constructor(
    private readonly jobs: BulkJobRepository,
    private readonly items: BulkItemRepository,
    private readonly stages: StageRepository,
    private readonly config: AppConfig,
  ) {}

  async enqueue(
    workspaceId: string,
    idempotencyKey: string,
    input: ICreateBulkMoveInput,
  ): Promise<IBulkJobView> {
    await this.requireStages(workspaceId, input);
    const bodyHash = hashBulkBody(input);
    const existing = await this.jobs.findByKey(workspaceId, idempotencyKey);
    if (existing !== null) {
      // Replay the original job before the open-job cap, so a retry is not 429.
      return this.rejectOrReturn(existing, bodyHash);
    }
    await this.rejectIfBusy(workspaceId);
    return this.insertJob({
      workspaceId,
      idempotencyKey,
      bodyHash,
      input,
    });
  }

  async get(workspaceId: string, jobId: string): Promise<IBulkJobView> {
    const job = await this.jobs.findById(workspaceId, jobId);
    if (job === null) {
      throw new NotFoundError('Bulk job');
    }
    return { job, counts: await this.items.countByJob(job.id) };
  }

  private async requireStages(
    workspaceId: string,
    input: ICreateBulkMoveInput,
  ): Promise<void> {
    await this.requireStage(workspaceId, input.targetStageId);
    if (input.filter.stageId !== undefined) {
      await this.requireStage(workspaceId, input.filter.stageId);
    }
  }

  private async requireStage(
    workspaceId: string,
    stageId: string,
  ): Promise<void> {
    const stage = await this.stages.findInWorkspace(workspaceId, stageId);
    if (stage === null) {
      throw new NotFoundError('Stage');
    }
  }

  private async rejectIfBusy(workspaceId: string): Promise<void> {
    const open = await this.jobs.countOpen(workspaceId);
    if (open >= this.config.maxOpenJobsPerWorkspace) {
      throw new RateLimitError('Too many open jobs for this workspace');
    }
  }

  private async rejectOrReturn(
    existing: IBulkJob,
    bodyHash: string,
  ): Promise<IBulkJobView> {
    if (existing.bodyHash !== bodyHash) {
      throw new ConflictError('Idempotency-Key reuse with a different body');
    }
    return { job: existing, counts: await this.items.countByJob(existing.id) };
  }

  private async insertJob(options: {
    workspaceId: string;
    idempotencyKey: string;
    bodyHash: string;
    input: ICreateBulkMoveInput;
  }): Promise<IBulkJobView> {
    try {
      const job = await this.jobs.insert(options);
      return { job, counts: await this.items.countByJob(job.id) };
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Two POSTs with the same key raced; return the winner's row.
      const raced = await this.jobs.findByKey(
        options.workspaceId,
        options.idempotencyKey,
      );
      if (raced === null) {
        throw error;
      }
      return this.rejectOrReturn(raced, options.bodyHash);
    }
  }
}
