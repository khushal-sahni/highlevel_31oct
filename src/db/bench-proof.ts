import { DatabasePool } from './database.pool';

export interface IJobProof {
  readonly itemsTotal: number;
  readonly moved: number;
  readonly skipped: number;
  readonly sumMatchesTotal: boolean;
  readonly transitions: number;
  readonly transitionsMatchMoved: boolean;
  readonly movedOnTarget: number;
  readonly allMovedOnTarget: boolean;
}

export class BenchProof {
  constructor(private readonly db: DatabasePool) {}

  async verify(jobId: string, targetStageId: string): Promise<IJobProof> {
    const counts = await this.db.query<{
      total: string;
      moved: string;
      skipped: string;
    }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE state = 'moved')::text AS moved,
              COUNT(*) FILTER (WHERE state = 'skipped')::text AS skipped
       FROM bulk_move_items WHERE job_id = $1`,
      [jobId],
    );
    const row = counts.rows[0];
    const transitions = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM transitions WHERE job_id = $1',
      [jobId],
    );
    const onTarget = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM bulk_move_items i
       JOIN opportunities o ON o.id = i.opportunity_id
       WHERE i.job_id = $1 AND i.state = 'moved' AND o.stage_id = $2`,
      [jobId, targetStageId],
    );
    const total = Number.parseInt(row?.total ?? '0', 10);
    const moved = Number.parseInt(row?.moved ?? '0', 10);
    const skipped = Number.parseInt(row?.skipped ?? '0', 10);
    const transitionCount = Number.parseInt(
      transitions.rows[0]?.count ?? '0',
      10,
    );
    const movedOnTarget = Number.parseInt(onTarget.rows[0]?.count ?? '0', 10);
    return {
      itemsTotal: total,
      moved,
      skipped,
      sumMatchesTotal: moved + skipped === total,
      transitions: transitionCount,
      transitionsMatchMoved: transitionCount === moved,
      movedOnTarget,
      allMovedOnTarget: movedOnTarget === moved,
    };
  }
}
