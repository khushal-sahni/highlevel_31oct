import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../config/app.config';
import { LoggerService } from '../services/logger.service';
import { sleep } from '../utils/sleep';
import { BenchApi, IJobView } from './bench-api';
import { HardwareReporter, IHardwareInfo } from './bench-hardware';
import { latencyReport } from './bench-metrics';
import { BenchProof, IJobProof } from './bench-proof';
import { DatabasePool } from './database.pool';
import { IBenchmarkTarget } from './large-ids';

export interface IBenchResult {
  readonly hardware: IHardwareInfo;
  readonly baselineLargeMs: number;
  readonly baselineSmallMs: number;
  readonly primary: {
    readonly jobId: string;
    readonly wallMs: number;
    readonly moved: number;
    readonly throughput: number;
    readonly sameWorkspace: { p95: number; p99: number; count: number };
    readonly otherWorkspace: { p95: number; p99: number; count: number };
  };
  readonly resume: {
    readonly jobId: string;
    readonly wallMs: number;
    readonly proof: IJobProof;
  };
}

class BenchRunner {
  constructor(
    private readonly api: BenchApi,
    private readonly target: IBenchmarkTarget,
    private readonly proof: BenchProof,
    private readonly logger: LoggerService,
  ) {}

  async run(hardware: IHardwareInfo): Promise<IBenchResult> {
    const baselineLargeMs = await this.api.listStage(
      this.target.largeWorkspaceId,
      this.target.sourceStageId,
    );
    const baselineSmallMs = await this.api.listStage(
      this.target.smallWorkspaceId,
      this.target.smallSourceStageId,
    );
    const primary = await this.measurePrimary();
    const resume = await this.measureResume();
    return { hardware, baselineLargeMs, baselineSmallMs, primary, resume };
  }

  private async measurePrimary(): Promise<IBenchResult['primary']> {
    const same: number[] = [];
    const other: number[] = [];
    const started = Date.now();
    const jobId = await this.api.enqueue({
      createdBefore: this.target.primary.createdBefore,
    });
    await this.pollWithLoad(jobId, same, other);
    const wallMs = Date.now() - started;
    const job = await this.api.getJob(jobId);
    return {
      jobId,
      wallMs,
      moved: job.counts.moved,
      throughput: job.counts.moved / (wallMs / 1000),
      sameWorkspace: latencyReport(same),
      otherWorkspace: latencyReport(other),
    };
  }

  private async measureResume(): Promise<IBenchResult['resume']> {
    const started = Date.now();
    const jobId = await this.api.enqueue({
      createdAfter: this.target.resume.createdAfter,
      createdBefore: this.target.resume.createdBefore,
    });
    await this.waitUntilMoved(jobId, 1_000);
    this.restartWorker();
    await this.waitUntilStatus(jobId, 'completed');
    return {
      jobId,
      wallMs: Date.now() - started,
      proof: await this.proof.verify(jobId, this.target.targetStageId),
    };
  }

  private async pollWithLoad(
    jobId: string,
    same: number[],
    other: number[],
  ): Promise<void> {
    let deal = await this.api.firstDeal(
      this.target.largeWorkspaceId,
      this.target.interactiveFromStageId,
    );
    let toStageId = this.target.interactiveToStageId;
    let fromStageId = this.target.interactiveFromStageId;
    while (true) {
      const job = await this.api.getJob(jobId);
      if (job.status === 'completed' || job.status === 'failed') {
        return;
      }
      same.push(
        await this.api.listStage(
          this.target.largeWorkspaceId,
          this.target.interactiveFromStageId,
        ),
      );
      other.push(
        await this.api.listStage(
          this.target.smallWorkspaceId,
          this.target.smallSourceStageId,
        ),
      );
      deal = await this.toggleDeal(deal, toStageId, same);
      const next = toStageId;
      toStageId = fromStageId;
      fromStageId = next;
      await sleep(25);
    }
  }

  private async toggleDeal(
    deal: { id: string; version: number } | null,
    toStageId: string,
    same: number[],
  ): Promise<{ id: string; version: number } | null> {
    if (deal === null) {
      return null;
    }
    const moved = await this.api.moveInteractive({
      id: deal.id,
      version: deal.version,
      toStageId,
    });
    same.push(moved.ms);
    return { id: deal.id, version: moved.version };
  }

  private async waitUntilMoved(jobId: string, minMoved: number): Promise<void> {
    while (true) {
      const job = await this.api.getJob(jobId);
      if (job.counts.moved >= minMoved || job.status === 'failed') {
        return;
      }
      await sleep(200);
    }
  }

  private async waitUntilStatus(
    jobId: string,
    status: IJobView['status'],
  ): Promise<void> {
    while (true) {
      const job = await this.api.getJob(jobId);
      if (job.status === status || job.status === 'failed') {
        return;
      }
      await sleep(200);
    }
  }

  private restartWorker(): void {
    this.logger.info('Killing worker');
    execSync('docker compose kill worker', { stdio: 'inherit' });
    execSync('docker compose up -d worker', { stdio: 'inherit' });
    this.logger.info('Worker restarted');
  }
}

class BenchProcess {
  async start(): Promise<void> {
    const target = BenchProcess.readTarget();
    const config = new AppConfig();
    const pool = new DatabasePool(config);
    const logger = new LoggerService();
    const api = new BenchApi(
      process.env['BENCH_API_URL'] ?? 'http://localhost:3000',
      target,
    );
    try {
      const hardware = await new HardwareReporter(pool).collect();
      const result = await new BenchRunner(
        api,
        target,
        new BenchProof(pool),
        logger,
      ).run(hardware);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      await pool.onModuleDestroy();
    }
  }

  private static readTarget(): IBenchmarkTarget {
    const path = join(__dirname, '../../db/benchmark-target.json');
    return JSON.parse(readFileSync(path, 'utf8')) as IBenchmarkTarget;
  }
}

if (require.main === module) {
  new BenchProcess().start().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
