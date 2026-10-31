import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { AppConfig } from '../config/app.config';
import { MigrationRunner } from '../db/migrate';
import { AppExceptionFilter } from '../middleware/app-exception.filter';
import { StageRepository } from '../repositories/stage.repository';
import { TransitionRepository } from '../repositories/transition.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { LoggerService } from '../services/logger.service';
import { IWorkspaceFixture, TestFixtures } from '../test/test-fixtures';
import { OpportunityStatus } from '../types/opportunity-status';

describe('OpportunityController', () => {
  let app: INestApplication;
  let fixtures: TestFixtures;
  let transitions: TransitionRepository;
  let workspaceA: IWorkspaceFixture;
  let workspaceB: IWorkspaceFixture;

  beforeAll(async () => {
    if (process.env['DATABASE_URL'] === undefined) {
      process.env['DATABASE_URL'] =
        'postgres://app:app@localhost:5432/opportunities';
    }
    const config = new AppConfig();
    await new MigrationRunner(config.databaseUrl, new LoggerService()).run();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(app.get(AppExceptionFilter));
    await app.init();
    fixtures = new TestFixtures(
      app.get(WorkspaceRepository),
      app.get(StageRepository),
    );
    transitions = app.get(TransitionRepository);
    workspaceA = await fixtures.createWorkspaceWithStages();
    workspaceB = await fixtures.createWorkspaceWithStages();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create an opportunity and list it by stage', async () => {
    const created = await createDeal(app, workspaceA, 'Acme');
    const listed = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(workspaceA, 0) })
      .set(workspaceHeader(workspaceA.workspaceId))
      .expect(200);
    const ids = (listed.body.items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(created.id);
    expect(created.version).toBe(1);
  });

  it('should write one transition and bump version on move', async () => {
    const created = await createDeal(app, workspaceA, 'Move me');
    const moved = await request(app.getHttpServer())
      .post(`/opportunities/${created.id}/stage`)
      .set(workspaceHeader(workspaceA.workspaceId))
      .send({
        stageId: stageId(workspaceA, 1),
        expectedVersion: created.version,
      })
      .expect(201);
    expect(moved.body.version).toBe(created.version + 1);
    expect(moved.body.stageId).toBe(stageId(workspaceA, 1));
    const count = await transitions.countForOpportunity(
      workspaceA.workspaceId,
      created.id,
    );
    expect(count).toBe(1);
  });

  it('should return 409 and write no transition on a stale version', async () => {
    const created = await createDeal(app, workspaceA, 'Stale');
    await request(app.getHttpServer())
      .post(`/opportunities/${created.id}/stage`)
      .set(workspaceHeader(workspaceA.workspaceId))
      .send({
        stageId: stageId(workspaceA, 1),
        expectedVersion: created.version,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/opportunities/${created.id}/stage`)
      .set(workspaceHeader(workspaceA.workspaceId))
      .send({
        stageId: stageId(workspaceA, 0),
        expectedVersion: created.version,
      })
      .expect(409);
    const count = await transitions.countForOpportunity(
      workspaceA.workspaceId,
      created.id,
    );
    expect(count).toBe(1);
  });

  it('should not repeat or skip ids across keyset pages', async () => {
    const isolated = await fixtures.createWorkspaceWithStages();
    const createdIds = [
      (await createDeal(app, isolated, 'Page A')).id,
      (await createDeal(app, isolated, 'Page B')).id,
      (await createDeal(app, isolated, 'Page C')).id,
    ];
    const first = await request(app.getHttpServer())
      .get('/opportunities')
      .query({ stageId: stageId(isolated, 0), limit: 2 })
      .set(workspaceHeader(isolated.workspaceId))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/opportunities')
      .query({
        stageId: stageId(isolated, 0),
        limit: 2,
        cursor: first.body.nextCursor,
      })
      .set(workspaceHeader(isolated.workspaceId))
      .expect(200);
    const firstIds = (first.body.items as { id: string }[]).map((item) => item.id);
    const secondIds = (second.body.items as { id: string }[]).map(
      (item) => item.id,
    );
    expect(first.body.nextCursor).toBeTruthy();
    expect(second.body.nextCursor).toBeNull();
    expect(new Set(firstIds).size).toBe(firstIds.length);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    expect([...firstIds, ...secondIds].sort()).toEqual(createdIds.slice().sort());
  });

  it("should return 404 for workspace A's opportunity under workspace B", async () => {
    const created = await createDeal(app, workspaceA, 'Hidden');
    await request(app.getHttpServer())
      .post(`/opportunities/${created.id}/stage`)
      .set(workspaceHeader(workspaceB.workspaceId))
      .send({
        stageId: stageId(workspaceB, 1),
        expectedVersion: created.version,
      })
      .expect(404);
  });
});

function workspaceHeader(workspaceId: string): Record<string, string> {
  return { 'X-Workspace-Id': workspaceId };
}

function stageId(fixture: IWorkspaceFixture, index: number): string {
  const id = fixture.stageIds[index];
  if (id === undefined) {
    throw new Error(`stage ${index} missing`);
  }
  return id;
}

async function createDeal(
  app: INestApplication,
  fixture: IWorkspaceFixture,
  name: string,
): Promise<{ id: string; version: number }> {
  const response = await request(app.getHttpServer())
    .post('/opportunities')
    .set(workspaceHeader(fixture.workspaceId))
    .send({
      name,
      value: 10000,
      status: OpportunityStatus.OPEN,
      ownerId: 'owner-1',
      stageId: stageId(fixture, 0),
    })
    .expect(201);
  return { id: response.body.id, version: response.body.version };
}
