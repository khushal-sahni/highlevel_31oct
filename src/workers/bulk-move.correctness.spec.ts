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
  enqueueBulkMove,
  getBulkJob,
  stageId,
  workspaceHeaders,
} from '../test/bulk-http';
import { runUntil } from '../test/run-until';
import { IWorkspaceFixture, TestFixtures } from '../test/test-fixtures';
import { JobStatus } from '../types/job-status';
import { OpportunityStatus } from '../types/opportunity-status';
import { BulkMoveWorker } from './bulk-move.worker';

describe('BulkMoveWorker correctness', () => {
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
    await app.close();
  });

  it('should skip when a filter field no longer matches after resolve', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const deal = await createDeal({
      app,
      workspace: ws,
      name: 'Filter',
      ownerId: 'owner-keep',
    });
    const job = await enqueueOwner(ws, 'filter-skip', 'owner-keep');
    await waitFor(ws, job.id, [JobStatus.RUNNING]);
    await pool.query(
      `UPDATE opportunities SET owner_id = $2 WHERE id = $1`,
      [deal.id, 'owner-other'],
    );
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, job.id);
    expect(done.counts.skippedFilter).toBe(1);
    expect(done.counts.moved).toBe(0);
    expect(await transitions.countForJob(job.id)).toBe(0);
  });

  it('should skip already_there when a person moved the deal to the target', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const deal = await createDeal({ app, workspace: ws, name: 'There' });
    const job = await enqueueStage(ws, 'already-1');
    await waitFor(ws, job.id, [JobStatus.RUNNING]);
    await request(app.getHttpServer())
      .post(`/opportunities/${deal.id}/stage`)
      .set(workspaceHeaders(ws.workspaceId))
      .send({ stageId: stageId(ws, 1), expectedVersion: deal.version })
      .expect(201);
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, job.id);
    expect(done.counts.skippedAlreadyThere).toBe(1);
    expect(done.counts.moved).toBe(0);
    expect(await transitions.countForJob(job.id)).toBe(0);
    expect(await listIds(ws, 1)).toContain(deal.id);
  });

  it('should not double-move when a new idempotency key retries the same body', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const deal = await createDeal({
      app,
      workspace: ws,
      name: 'Once',
      ownerId: 'owner-retry',
    });
    const first = await enqueueOwner(ws, 'new-key-a', 'owner-retry');
    await waitFor(ws, first.id, [JobStatus.COMPLETED]);
    const second = await enqueueOwner(ws, 'new-key-b', 'owner-retry');
    expect(second.id).not.toBe(first.id);
    await waitFor(ws, second.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, second.id);
    expect(done.counts.moved).toBe(0);
    expect(done.counts.skippedAlreadyThere).toBe(1);
    expect(await transitions.countForOpportunity(ws.workspaceId, deal.id)).toBe(
      1,
    );
  });

  it('should snapshot only deals that match owner, status, and value', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    const match = await createDeal({
      app,
      workspace: ws,
      name: 'Match',
      ownerId: 'owner-1',
      status: OpportunityStatus.OPEN,
      value: 1000,
    });
    await seedNonMatches(ws);
    const job = await enqueueBulkMove({
      app,
      workspace: ws,
      key: 'filter-select',
      stageId: stageId(ws, 0),
      targetStageId: stageId(ws, 1),
      ownerId: 'owner-1',
      status: OpportunityStatus.OPEN,
      valueMax: 5000,
    });
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, job.id);
    expect(done.counts.total).toBe(1);
    expect(done.counts.moved).toBe(1);
    expect(await listIds(ws, 1)).toEqual([match.id]);
  });

  it('should complete an empty match set at zero', async () => {
    const ws = await fixtures.createWorkspaceWithStages();
    await createDeal({ app, workspace: ws, name: 'Other', ownerId: 'owner-1' });
    const job = await enqueueOwner(ws, 'empty-1', 'nobody');
    await waitFor(ws, job.id, [JobStatus.COMPLETED]);
    const done = await getBulkJob(app, ws, job.id);
    expect(done.counts.total).toBe(0);
    expect(done.counts.moved).toBe(0);
  });

  it("should return 404 for workspace A's job under workspace B", async () => {
    const workspaceA = await fixtures.createWorkspaceWithStages();
    const workspaceB = await fixtures.createWorkspaceWithStages();
    const job = await enqueueStage(workspaceA, 'tenant-job');
    await request(app.getHttpServer())
      .get(`/bulk-stage-moves/${job.id}`)
      .set(workspaceHeaders(workspaceB.workspaceId))
      .expect(404);
    await waitFor(workspaceA, job.id, [JobStatus.COMPLETED]);
  });

  async function seedNonMatches(ws: IWorkspaceFixture): Promise<void> {
    await createDeal({
      app,
      workspace: ws,
      name: 'OtherOwner',
      ownerId: 'owner-2',
      value: 1000,
    });
    await createDeal({
      app,
      workspace: ws,
      name: 'Won',
      ownerId: 'owner-1',
      status: OpportunityStatus.WON,
      value: 1000,
    });
    await createDeal({
      app,
      workspace: ws,
      name: 'Expensive',
      ownerId: 'owner-1',
      value: 99999,
    });
  }

  function enqueueStage(
    ws: IWorkspaceFixture,
    key: string,
  ): Promise<{ id: string }> {
    return enqueueBulkMove({
      app,
      workspace: ws,
      key,
      stageId: stageId(ws, 0),
      targetStageId: stageId(ws, 1),
    });
  }

  function enqueueOwner(
    ws: IWorkspaceFixture,
    key: string,
    ownerId: string,
  ): Promise<{ id: string }> {
    return enqueueBulkMove({
      app,
      workspace: ws,
      key,
      ownerId,
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

  async function listIds(
    ws: IWorkspaceFixture,
    stageIndex: number,
  ): Promise<string[]> {
    const listed = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(ws, stageIndex) })
      .set(workspaceHeaders(ws.workspaceId))
      .expect(200);
    return (listed.body.items as { id: string }[]).map((item) => item.id);
  }
});
