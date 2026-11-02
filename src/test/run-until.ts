import { INestApplication } from '@nestjs/common';
import { JobStatus } from '../types/job-status';
import { BulkMoveWorker } from '../workers/bulk-move.worker';
import { getBulkJob } from './bulk-http';
import { IWorkspaceFixture } from './test-fixtures';

export interface IRunUntilOptions {
  readonly worker: BulkMoveWorker;
  readonly app: INestApplication;
  readonly workspace: IWorkspaceFixture;
  readonly jobId: string;
  readonly statuses: readonly JobStatus[];
}

export async function runUntil(options: IRunUntilOptions): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const job = await getBulkJob(options.app, options.workspace, options.jobId);
    if (options.statuses.includes(job.status)) {
      return;
    }
    await options.worker.step();
  }
  throw new Error(`job ${options.jobId} did not reach ${options.statuses.join(',')}`);
}
