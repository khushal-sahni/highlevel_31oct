import { writeFileSync } from 'fs';
import { join } from 'path';
import { DatabasePool } from './database.pool';
import { LoggerService } from '../services/logger.service';
import {
  IBenchmarkTarget,
  LARGE_SEED_START,
  LARGE_STAGE_COUNTS,
  LARGE_STAGE_NAMES,
  LARGE_WORKSPACE_ID,
  SMALL_STAGE_COUNTS,
  SMALL_WORKSPACE_IDS,
  largeStageId,
  smallStageId,
} from './large-ids';

const BATCH = 2_000;
const SLICE = 50_000;

export class LargeSeeder {
  constructor(
    private readonly db: DatabasePool,
    private readonly logger: LoggerService,
  ) {}

  async run(): Promise<void> {
    await this.ensureWorkspaces();
    await this.ensureStages();
    await this.clearOpportunities();
    await this.insertLarge();
    await this.insertSmall();
    const target = await this.buildTarget();
    this.writeTarget(target);
    this.logger.info('Large seed complete');
  }

  private async ensureWorkspaces(): Promise<void> {
    const ids = [LARGE_WORKSPACE_ID, ...SMALL_WORKSPACE_IDS];
    for (const id of ids) {
      await this.db.query(
        `INSERT INTO workspaces (id) VALUES ($1)
         ON CONFLICT (id) DO NOTHING`,
        [id],
      );
    }
  }

  private async ensureStages(): Promise<void> {
    await this.insertNamedStages(LARGE_WORKSPACE_ID, largeStageId);
    for (let w = 0; w < SMALL_WORKSPACE_IDS.length; w += 1) {
      const workspaceId = SMALL_WORKSPACE_IDS[w];
      if (workspaceId === undefined) {
        continue;
      }
      await this.insertNamedStages(workspaceId, (pos) => smallStageId(w + 1, pos));
    }
  }

  private async insertNamedStages(
    workspaceId: string,
    idFor: (position: number) => string,
  ): Promise<void> {
    for (let i = 0; i < LARGE_STAGE_NAMES.length; i += 1) {
      const name = LARGE_STAGE_NAMES[i];
      const position = i + 1;
      if (name === undefined) {
        continue;
      }
      await this.db.query(
        `INSERT INTO stages (id, workspace_id, name, position)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, position) DO UPDATE SET name = EXCLUDED.name`,
        [idFor(position), workspaceId, name, position],
      );
    }
  }

  private async clearOpportunities(): Promise<void> {
    const ids = [LARGE_WORKSPACE_ID, ...SMALL_WORKSPACE_IDS];
    await this.db.query(
      `DELETE FROM bulk_move_items
       WHERE job_id IN (SELECT id FROM bulk_jobs WHERE workspace_id = ANY($1::uuid[]))`,
      [ids],
    );
    await this.db.query(
      'DELETE FROM transitions WHERE workspace_id = ANY($1::uuid[])',
      [ids],
    );
    await this.db.query(
      'DELETE FROM bulk_jobs WHERE workspace_id = ANY($1::uuid[])',
      [ids],
    );
    await this.db.query(
      'DELETE FROM opportunities WHERE workspace_id = ANY($1::uuid[])',
      [ids],
    );
  }

  private async insertLarge(): Promise<void> {
    for (let i = 0; i < LARGE_STAGE_COUNTS.length; i += 1) {
      const count = LARGE_STAGE_COUNTS[i];
      if (count === undefined) {
        continue;
      }
      await this.insertStage(LARGE_WORKSPACE_ID, largeStageId(i + 1), count);
      this.logger.info(`Large stage ${i + 1}: ${count} rows`);
    }
  }

  private async insertSmall(): Promise<void> {
    for (let w = 0; w < SMALL_WORKSPACE_IDS.length; w += 1) {
      const workspaceId = SMALL_WORKSPACE_IDS[w];
      if (workspaceId === undefined) {
        continue;
      }
      await this.insertSmallWorkspace(workspaceId, w + 1);
    }
  }

  private async insertSmallWorkspace(
    workspaceId: string,
    workspaceIndex: number,
  ): Promise<void> {
    for (let i = 0; i < SMALL_STAGE_COUNTS.length; i += 1) {
      const count = SMALL_STAGE_COUNTS[i];
      if (count === undefined) {
        continue;
      }
      await this.insertStage(
        workspaceId,
        smallStageId(workspaceIndex, i + 1),
        count,
      );
    }
  }

  private async insertStage(
    workspaceId: string,
    stageId: string,
    count: number,
  ): Promise<void> {
    for (let start = 1; start <= count; start += BATCH) {
      const end = Math.min(start + BATCH - 1, count);
      await this.insertBatch(workspaceId, stageId, start, end);
    }
  }

  private async insertBatch(
    workspaceId: string,
    stageId: string,
    start: number,
    end: number,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO opportunities (
         workspace_id, stage_id, name, value, status, owner_id,
         created_at, updated_at, stage_changed_at
       )
       SELECT
         $1, $2, 'Deal ' || i,
         (10000 + (i % 250000))::bigint,
         CASE
           WHEN i % 23 = 0 THEN 'won'
           WHEN i % 29 = 0 THEN 'lost'
           WHEN i % 31 = 0 THEN 'abandoned'
           ELSE 'open'
         END,
         'owner-' || (i % 50),
         $5::timestamptz + (i * INTERVAL '90 seconds'),
         $5::timestamptz + (i * INTERVAL '90 seconds'),
         $5::timestamptz + (i * INTERVAL '90 seconds')
       FROM generate_series($3::int, $4::int) AS i`,
      [workspaceId, stageId, start, end, LARGE_SEED_START],
    );
  }

  private async buildTarget(): Promise<IBenchmarkTarget> {
    const t1 = await this.nthCreatedAt(SLICE);
    const t2 = await this.nthCreatedAt(SLICE + 1);
    const t3 = await this.nthCreatedAt(SLICE * 2);
    return {
      largeWorkspaceId: LARGE_WORKSPACE_ID,
      smallWorkspaceId: SMALL_WORKSPACE_IDS[0] ?? LARGE_WORKSPACE_ID,
      smallSourceStageId: smallStageId(1, 1),
      sourceStageId: largeStageId(1),
      targetStageId: largeStageId(12),
      interactiveFromStageId: largeStageId(11),
      interactiveToStageId: largeStageId(12),
      primary: { createdBefore: t1 },
      resume: { createdAfter: t2, createdBefore: t3 },
    };
  }

  private async nthCreatedAt(n: number): Promise<string> {
    const result = await this.db.query<{ created_at: Date }>(
      `SELECT created_at FROM opportunities
       WHERE workspace_id = $1 AND stage_id = $2
       ORDER BY created_at, id
       OFFSET $3 LIMIT 1`,
      [LARGE_WORKSPACE_ID, largeStageId(1), n - 1],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error(`missing row ${n} on large New Lead`);
    }
    return row.created_at.toISOString();
  }

  private writeTarget(target: IBenchmarkTarget): void {
    const path = join(__dirname, '../../db/benchmark-target.json');
    writeFileSync(path, `${JSON.stringify(target, null, 2)}\n`);
    this.logger.info(`Wrote ${path}`);
  }
}
