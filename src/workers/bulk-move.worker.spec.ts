import { fork, ChildProcess } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { AppConfig } from '../config/app.config';
import { DatabasePool } from '../db/database.pool';
import { MigrationRunner } from '../db/migrate';
import { AppExceptionFilter } from '../middleware/app-exception.filter';
import { StageRepository } from '../repositories/stage.repository';
import { TransitionRepository } from '../repositories/transition.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { LoggerService } from '../services/logger.service';
import { IWorkspaceFixture, TestFixtures } from '../test/test-fixtures';
import { JobHealth, JobStatus, SkipReason } from '../types/job-status';
import { OpportunityStatus } from '../types/opportunity-status';
import { BulkMoveWorker } from './bulk-move.worker';

describe('BulkMoveWorker', () => {
  let app: INestApplication;
  let worker: BulkMoveWorker;
  let fixtures: TestFixtures;
  let transitions: TransitionRepository;
  let pool: DatabasePool;

  beforeAll(async () => {
    process.env['CHUNK_PAUSE_MS'] = '0';
    if (process.env['DATABASE_URL'] === undefined) {
      process.env['DATABASE_URL'] =
        'postgres://app:app@localhost:5432/opportunities';
    }
    await new MigrationRunner(
      new AppConfig().databaseUrl,
      new LoggerService(),
    ).run();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(app.get(AppExceptionFilter));
    await app.init();
    worker = app.get(BulkMoveWorker);
    fixtures = new TestFixtures(
      app.get(WorkspaceRepository),
      app.get(StageRepository),
    );
    transitions = app.get(TransitionRepository);
    pool = app.get(DatabasePool);
  });

  afterAll(async () => {
    delete process.env['CHUNK_PAUSE_MS'];
    delete process.env['APPLY_CHUNK_SIZE'];
    delete process.env['MAX_BULK_MOVE_SIZE'];
    await app.close();
  });

  it('should return the same job for the same idempotency key', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const first = await enqueue(app, ws, 'key-1', stageId(ws, 0), stageId(ws, 1));
    const second = await enqueue(app, ws, 'key-1', stageId(ws, 0), stageId(ws, 1));
    expect(second.id).toBe(first.id);
    await request(app.getHttpServer())
      .post('/bulk-stage-moves')
      .set(headers(ws.workspaceId, 'key-1'))
      .send({ stageId: stageId(ws, 0), targetStageId: stageId(ws, 0) })
      .expect(409);
  });

  it('should finish a killed job without double-applying', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeals(app, ws, ['A', 'B', 'C']);
    process.env['APPLY_CHUNK_SIZE'] = '1';
    const job = await enqueue(app, ws, 'resume-1', stageId(ws, 0), stageId(ws, 1));
    await runUntil(worker, app, ws, job.id, [JobStatus.RUNNING]);
    await worker.step();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const worker2 = moduleRef.get(BulkMoveWorker);
    await runUntil(worker2, app, ws, job.id, [
      JobStatus.COMPLETED,
      JobStatus.FAILED,
    ]);
    await moduleRef.close();
    delete process.env['APPLY_CHUNK_SIZE'];
    const done = await getJob(app, ws, job.id);
    expect(done.status).toBe(JobStatus.COMPLETED);
    expect(done.counts.moved).toBe(3);
    expect(await transitions.countForJob(job.id)).toBe(3);
  });

  it('should skip a deal a person moved after resolve', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const deal = await createDeal(app, ws, 'Manual');
    const job = await enqueue(app, ws, 'collide-1', stageId(ws, 0), stageId(ws, 1));
    await runUntil(worker, app, ws, job.id, [JobStatus.RUNNING]);
    await request(app.getHttpServer())
      .post(`/opportunities/${deal.id}/stage`)
      .set(headers(ws.workspaceId))
      .send({ stageId: stageId(ws, 2), expectedVersion: deal.version })
      .expect(201);
    await runUntil(worker, app, ws, job.id, [JobStatus.COMPLETED]);
    const done = await getJob(app, ws, job.id);
    expect(done.counts.skippedConflict).toBe(1);
    expect(done.counts.moved).toBe(0);
    expect(await transitions.countForJob(job.id)).toBe(0);
    const listed = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(ws, 2) })
      .set(headers(ws.workspaceId))
      .expect(200);
    const ids = (listed.body.items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(deal.id);
    expect(SkipReason.CONFLICT).toBe('conflict');
  });

  it('should not copy a deal created after the job row', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal(app, ws, 'Before');
    const job = await enqueue(app, ws, 'snap-1', stageId(ws, 0), stageId(ws, 1));
    const late = await createDeal(app, ws, 'After');
    await runUntil(worker, app, ws, job.id, [JobStatus.COMPLETED]);
    const done = await getJob(app, ws, job.id);
    expect(done.counts.total).toBe(1);
    expect(done.counts.moved).toBe(1);
    const listed = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(ws, 0) })
      .set(headers(ws.workspaceId))
      .expect(200);
    const ids = (listed.body.items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(late.id);
  });

  it('should fail resolve over the cap and move nothing', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeals(app, ws, ['One', 'Two', 'Three']);
    process.env['MAX_BULK_MOVE_SIZE'] = '2';
    const job = await enqueue(app, ws, 'cap-1', stageId(ws, 0), stageId(ws, 1));
    await runUntil(worker, app, ws, job.id, [JobStatus.FAILED]);
    delete process.env['MAX_BULK_MOVE_SIZE'];
    const done = await getJob(app, ws, job.id);
    expect(done.errorCode).toBe('SNAPSHOT_TOO_LARGE');
    expect(done.counts.moved).toBe(0);
    expect(await transitions.countForJob(job.id)).toBe(0);
  });

  it('should return 429 when a workspace already has 8 open jobs', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal(app, ws, 'Cap');
    for (let i = 0; i < 8; i += 1) {
      await enqueue(app, ws, `open-${i}`, stageId(ws, 0), stageId(ws, 1));
    }
    await request(app.getHttpServer())
      .post('/bulk-stage-moves')
      .set(headers(ws.workspaceId, 'open-8'))
      .send({ stageId: stageId(ws, 0), targetStageId: stageId(ws, 1) })
      .expect(429);
    const replay = await enqueue(app, ws, 'open-0', stageId(ws, 0), stageId(ws, 1));
    expect(replay.id).toBeDefined();
    await pool.query(
      `UPDATE bulk_jobs SET status = $2
       WHERE workspace_id = $1 AND status IN ($3, $4, $5)`,
      [
        ws.workspaceId,
        JobStatus.FAILED,
        JobStatus.QUEUED,
        JobStatus.RESOLVING,
        JobStatus.RUNNING,
      ],
    );
  });

  it('should let two worker processes take two workspaces at once', async () => {
    const first = await fixtures.createWorkspaceWithStages();
    const second = await fixtures.createWorkspaceWithStages();
    await createDeal(app, first, 'A');
    await createDeal(app, second, 'B');
    const jobA = await enqueue(app, first, 'fair-a', stageId(first, 0), stageId(first, 1));
    const jobB = await enqueue(app, second, 'fair-b', stageId(second, 0), stageId(second, 1));
    await runForkedSteps();
    const left = await getJob(app, first, jobA.id);
    const right = await getJob(app, second, jobB.id);
    expect(left.status).not.toBe(JobStatus.QUEUED);
    expect(right.status).not.toBe(JobStatus.QUEUED);
  });

  it('should keep a second job queued while one is active', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal(app, ws, 'Queued');
    const first = await enqueue(app, ws, 'q-1', stageId(ws, 0), stageId(ws, 1));
    const second = await enqueue(app, ws, 'q-2', stageId(ws, 0), stageId(ws, 1));
    await worker.step();
    const active = await getJob(app, ws, first.id);
    const waiting = await getJob(app, ws, second.id);
    expect([JobStatus.RESOLVING, JobStatus.RUNNING]).toContain(active.status);
    expect(waiting.status).toBe(JobStatus.QUEUED);
    expect(waiting.health).toBeNull();
    await runUntil(worker, app, ws, first.id, [JobStatus.COMPLETED]);
    await runUntil(worker, app, ws, second.id, [JobStatus.COMPLETED]);
  });

  it('should report stalled when the heartbeat is older than 30s', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal(app, ws, 'Stall');
    const job = await enqueue(app, ws, 'stall-1', stageId(ws, 0), stageId(ws, 1));
    await runUntil(worker, app, ws, job.id, [JobStatus.RUNNING]);
    await pool.query(
      `UPDATE bulk_jobs SET heartbeat_at = now() - interval '31 seconds'
       WHERE id = $1`,
      [job.id],
    );
    const viewed = await getJob(app, ws, job.id);
    expect(viewed.status).toBe(JobStatus.RUNNING);
    expect(viewed.health).toBe(JobHealth.STALLED);
    await runUntil(worker, app, ws, job.id, [JobStatus.COMPLETED]);
  });
});

function headers(
  workspaceId: string,
  key?: string,
): Record<string, string> {
  const result: Record<string, string> = { 'X-Workspace-Id': workspaceId };
  if (key !== undefined) {
    result['Idempotency-Key'] = key;
  }
  return result;
}

function stageId(fixture: IWorkspaceFixture, index: number): string {
  const id = fixture.stageIds[index];
  if (id === undefined) {
    throw new Error(`stage ${index} missing`);
  }
  return id;
}

async function enqueue(
  app: INestApplication,
  ws: IWorkspaceFixture,
  key: string,
  fromStageId: string,
  targetStageId: string,
): Promise<{ id: string }> {
  const response = await request(app.getHttpServer())
    .post('/bulk-stage-moves')
    .set(headers(ws.workspaceId, key))
    .send({ stageId: fromStageId, targetStageId })
    .expect(202);
  return { id: response.body.id };
}

async function getJob(
  app: INestApplication,
  ws: IWorkspaceFixture,
  jobId: string,
): Promise<{
  status: JobStatus;
  health: JobHealth | null;
  errorCode: string | null;
  counts: {
    moved: number;
    total: number;
    skipped: number;
    skippedConflict: number;
  };
}> {
  const response = await request(app.getHttpServer())
    .get(`/bulk-stage-moves/${jobId}`)
    .set(headers(ws.workspaceId))
    .expect(200);
  return response.body;
}

async function createDeal(
  app: INestApplication,
  ws: IWorkspaceFixture,
  name: string,
): Promise<{ id: string; version: number }> {
  const response = await request(app.getHttpServer())
    .post('/opportunities')
    .set(headers(ws.workspaceId))
    .send({
      name,
      value: 1000,
      status: OpportunityStatus.OPEN,
      ownerId: 'owner-1',
      stageId: stageId(ws, 0),
    })
    .expect(201);
  return { id: response.body.id, version: response.body.version };
}

async function createDeals(
  app: INestApplication,
  ws: IWorkspaceFixture,
  names: readonly string[],
): Promise<void> {
  for (const name of names) {
    await createDeal(app, ws, name);
  }
}

async function runForkedSteps(): Promise<void> {
  const children = await Promise.all([forkOneStep(), forkOneStep()]);
  for (const child of children) {
    child.send({ go: true });
  }
  await Promise.all(children.map((child) => waitForExit(child)));
}

function forkOneStep(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    let ready = false;
    const child = fork(join(__dirname, 'worker-one-step.ts'), [], {
      execArgv: ['-r', 'ts-node/register/transpile-only'],
      env: { ...process.env, DATABASE_POOL_MAX: '1', CHUNK_PAUSE_MS: '0' },
    });
    child.on('message', (message: unknown) => {
      if (ready || !isReady(message)) {
        return;
      }
      ready = true;
      resolve(child);
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (!ready) {
        reject(new Error(`one-step worker exited ${code}`));
      }
    });
  });
}

function isReady(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  return 'ready' in message;
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`one-step worker exited ${code}`));
    });
  });
}

async function runUntil(
  worker: BulkMoveWorker,
  app: INestApplication,
  ws: IWorkspaceFixture,
  jobId: string,
  statuses: readonly JobStatus[],
): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const job = await getJob(app, ws, jobId);
    if (statuses.includes(job.status)) {
      return;
    }
    await worker.step();
  }
  throw new Error(`job ${jobId} did not reach ${statuses.join(',')}`);
}
