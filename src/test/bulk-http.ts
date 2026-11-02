import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JobHealth, JobStatus } from '../types/job-status';
import { OpportunityStatus } from '../types/opportunity-status';
import { IWorkspaceFixture } from './test-fixtures';

export interface IEnqueueBulkOptions {
  readonly app: INestApplication;
  readonly workspace: IWorkspaceFixture;
  readonly key: string;
  readonly targetStageId: string;
  readonly stageId?: string;
  readonly ownerId?: string;
  readonly status?: OpportunityStatus;
  readonly valueMin?: number;
  readonly valueMax?: number;
}

export interface ICreateDealOptions {
  readonly app: INestApplication;
  readonly workspace: IWorkspaceFixture;
  readonly name: string;
  readonly ownerId?: string;
  readonly status?: OpportunityStatus;
  readonly value?: number;
  readonly stageIndex?: number;
}

export interface IBulkJobView {
  readonly id: string;
  readonly status: JobStatus;
  readonly health: JobHealth | null;
  readonly errorCode: string | null;
  readonly counts: {
    moved: number;
    total: number;
    skipped: number;
    skippedConflict: number;
    skippedFilter: number;
    skippedAlreadyThere: number;
  };
}

export function workspaceHeaders(
  workspaceId: string,
  key?: string,
): Record<string, string> {
  const result: Record<string, string> = { 'X-Workspace-Id': workspaceId };
  if (key !== undefined) {
    result['Idempotency-Key'] = key;
  }
  return result;
}

export function stageId(fixture: IWorkspaceFixture, index: number): string {
  const id = fixture.stageIds[index];
  if (id === undefined) {
    throw new Error(`stage ${index} missing`);
  }
  return id;
}

export async function enqueueBulkMove(
  options: IEnqueueBulkOptions,
): Promise<{ id: string }> {
  const response = await request(options.app.getHttpServer())
    .post('/bulk-stage-moves')
    .set(workspaceHeaders(options.workspace.workspaceId, options.key))
    .send(enqueueBody(options))
    .expect(202);
  return { id: response.body.id };
}

export async function getBulkJob(
  app: INestApplication,
  workspace: IWorkspaceFixture,
  jobId: string,
): Promise<IBulkJobView> {
  const response = await request(app.getHttpServer())
    .get(`/bulk-stage-moves/${jobId}`)
    .set(workspaceHeaders(workspace.workspaceId))
    .expect(200);
  return response.body;
}

export async function createDeal(
  options: ICreateDealOptions,
): Promise<{ id: string; version: number }> {
  const stageIndex = options.stageIndex ?? 0;
  const response = await request(options.app.getHttpServer())
    .post('/opportunities')
    .set(workspaceHeaders(options.workspace.workspaceId))
    .send({
      name: options.name,
      value: options.value ?? 1000,
      status: options.status ?? OpportunityStatus.OPEN,
      ownerId: options.ownerId ?? 'owner-1',
      stageId: stageId(options.workspace, stageIndex),
    })
    .expect(201);
  return { id: response.body.id, version: response.body.version };
}

export async function createDeals(
  app: INestApplication,
  workspace: IWorkspaceFixture,
  names: readonly string[],
): Promise<void> {
  for (const name of names) {
    await createDeal({ app, workspace, name });
  }
}

function enqueueBody(options: IEnqueueBulkOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    targetStageId: options.targetStageId,
  };
  if (options.stageId !== undefined) {
    body['stageId'] = options.stageId;
  }
  if (options.ownerId !== undefined) {
    body['ownerId'] = options.ownerId;
  }
  if (options.status !== undefined) {
    body['status'] = options.status;
  }
  if (options.valueMin !== undefined) {
    body['valueMin'] = options.valueMin;
  }
  if (options.valueMax !== undefined) {
    body['valueMax'] = options.valueMax;
  }
  return body;
}
