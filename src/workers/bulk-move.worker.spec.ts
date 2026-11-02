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
import {
  createDeal,
  createDeals,
  enqueueBulkMove,
  getBulkJob,
  stageId,
  workspaceHeaders,
} from '../test/bulk-http';
import { runForkedSteps } from '../test/fork-workers';
import { runUntil } from '../test/run-until';
import { IWorkspaceFixture, TestFixtures } from '../test/test-fixtures';
import { JobHealth, JobStatus, SkipReason } from '../types/job-status';
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
      process.env['DATABASE_URL'] = 'postgres://app:app@localhost:5432/opportunities';
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
    const first = await enqueue(ws, 'key-1');
    const second = await enqueue(ws, 'key-1');
    expect(second.id).toBe(first.id);
    await request(app.getHttpServer())
      .post('/bulk-stage-moves')
      .set(workspaceHeaders(ws.workspaceId, 'key-1'))
      .send({ stageId: stageId(ws, 0), targetStageId: stageId(ws, 0) })
      .expect(409);
  });

  it('should finish a killed job without double-applying', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeals(app, ws, ['A', 'B', 'C']);
    process.env['APPLY_CHUNK_SIZE'] = '1'; // Getter re-reads env; one deal per step so we can kill mid-job.
    const job = await enqueue(ws, 'resume-1');
    await waitFor(ws, job.id, [JobStatus.RUNNING]);
    await worker.step();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const worker2 = moduleRef.get(BulkMoveWorker);
    await runUntil({
      worker: worker2, app, workspace: ws, jobId: job.id,
      statuses: [JobStatus.COMPLETED, JobStatus.FAILED],
    });
    await moduleRef.close();
    delete process.env['APPLY_CHUNK_SIZE'];
    const done = await getBulkJob(app, ws, job.id);
    expect(done.status).toBe(JobStatus.COMPLETED);
    expect(done.counts.moved).toBe(3);
    expect(await transitions.countForJob(job.id)).toBe(3);
  });

  it('should skip a deal a person moved after resolve', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const deal = await createDeal({ app, workspace: ws, name: 'Manual' });
    const job = await enqueue(ws, 'collide-1');
    await waitFor(ws, job.id, [JobStatus.RUNNING]);
    await request(app.getHttpServer())
      .post(`/opportunities/${deal.id}/stage`)
      .set(workspaceHeaders(ws.workspaceId))
      .send({ stageId: stageId(ws, 2), expectedVersion: deal.version })
      .expect(201);
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, job.id);
    expect(done.counts.skippedConflict).toBe(1);
    expect(done.counts.moved).toBe(0);
    expect(await transitions.countForJob(job.id)).toBe(0);
    const listed = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(ws, 2) })
      .set(workspaceHeaders(ws.workspaceId))
      .expect(200);
    const ids = (listed.body.items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(deal.id);
    expect(SkipReason.CONFLICT).toBe('conflict');
  });

  it('should not copy a deal created after the job row', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal({ app, workspace: ws, name: 'Before' });
    const job = await enqueue(ws, 'snap-1');
    const late = await createDeal({ app, workspace: ws, name: 'After' });
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, job.id);
    expect(done.counts.total).toBe(1);
    expect(done.counts.moved).toBe(1);
    const listed = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(ws, 0) })
      .set(workspaceHeaders(ws.workspaceId))
      .expect(200);
    const ids = (listed.body.items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(late.id);
  });

  it('should fail resolve over the cap and move nothing', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeals(app, ws, ['One', 'Two', 'Three']);
    process.env['MAX_BULK_MOVE_SIZE'] = '2'; // Getter re-reads env so this job hits the cap.
    const job = await enqueue(ws, 'cap-1');
    await waitFor(ws, job.id, [JobStatus.FAILED]);
    delete process.env['MAX_BULK_MOVE_SIZE'];
    const done = await getBulkJob(app, ws, job.id);
    expect(done.errorCode).toBe('SNAPSHOT_TOO_LARGE');
    expect(done.counts.moved).toBe(0);
    expect(await transitions.countForJob(job.id)).toBe(0);
  });

  it('should return 429 when a workspace already has 8 open jobs', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal({ app, workspace: ws, name: 'Cap' });
    for (let i = 0; i < 8; i += 1) {
      await enqueue(ws, `open-${i}`);
    }
    await request(app.getHttpServer())
      .post('/bulk-stage-moves')
      .set(workspaceHeaders(ws.workspaceId, 'open-8'))
      .send({ stageId: stageId(ws, 0), targetStageId: stageId(ws, 1) })
      .expect(429);
    const replay = await enqueue(ws, 'open-0');
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
    await createDeal({ app, workspace: first, name: 'A' });
    await createDeal({ app, workspace: second, name: 'B' });
    const jobA = await enqueue(first, 'fair-a');
    const jobB = await enqueue(second, 'fair-b');
    await runForkedSteps();
    const left = await getBulkJob(app, first, jobA.id);
    const right = await getBulkJob(app, second, jobB.id);
    expect(left.status).not.toBe(JobStatus.QUEUED);
    expect(right.status).not.toBe(JobStatus.QUEUED);
    await waitFor(first, jobA.id, [JobStatus.COMPLETED, JobStatus.FAILED]);
    await waitFor(second, jobB.id, [JobStatus.COMPLETED, JobStatus.FAILED]);
  });

  it('should keep a second job queued while one is active', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal({ app, workspace: ws, name: 'Queued' });
    const first = await enqueue(ws, 'q-1');
    const second = await enqueue(ws, 'q-2');
    await worker.step();
    const active = await getBulkJob(app, ws, first.id);
    const waiting = await getBulkJob(app, ws, second.id);
    expect([JobStatus.RESOLVING, JobStatus.RUNNING]).toContain(active.status);
    expect(waiting.status).toBe(JobStatus.QUEUED);
    expect(waiting.health).toBeNull();
    await waitFor(ws, first.id, [JobStatus.COMPLETED]);
    await waitFor(ws, second.id, [JobStatus.COMPLETED]);
  });

  it('should report stalled when the heartbeat is older than 30s', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal({ app, workspace: ws, name: 'Stall' });
    const job = await enqueue(ws, 'stall-1');
    await waitFor(ws, job.id, [JobStatus.RUNNING]);
    await pool.query(
      `UPDATE bulk_jobs SET heartbeat_at = now() - interval '31 seconds'
       WHERE id = $1`,
      [job.id],
    );
    const viewed = await getBulkJob(app, ws, job.id);
    expect(viewed.status).toBe(JobStatus.RUNNING);
    expect(viewed.health).toBe(JobHealth.STALLED);
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
  });

  function enqueue(ws: IWorkspaceFixture, key: string): Promise<{ id: string }> {
    return enqueueBulkMove({
      app, workspace: ws, key,
      stageId: stageId(ws, 0),
      targetStageId: stageId(ws, 1),
    });
  }

  function waitFor(
    ws: IWorkspaceFixture,
    jobId: string,
    statuses: readonly JobStatus[],
  ): Promise<void> {
    return runUntil({ worker, app, workspace: ws, jobId, statuses });
  }
});
