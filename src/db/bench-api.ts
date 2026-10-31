import { randomUUID } from 'crypto';
import { IBenchmarkTarget } from './large-ids';

export interface IJobView {
  readonly id: string;
  readonly status: string;
  readonly counts: { readonly moved: number; readonly total: number };
}

export interface ILatencySample {
  readonly name: string;
  readonly ms: number;
}

interface IMoveStageBody {
  readonly stageId: string;
  readonly expectedVersion: number;
}

export class BenchApi {
  constructor(
    private readonly baseUrl: string,
    private readonly target: IBenchmarkTarget,
  ) {}

  async enqueue(filter: Record<string, string>): Promise<string> {
    const body = {
      ...filter,
      stageId: this.target.sourceStageId,
      targetStageId: this.target.targetStageId,
    };
    const response = await this.request({
      method: 'POST',
      path: '/bulk-stage-moves',
      workspaceId: this.target.largeWorkspaceId,
      body,
      idempotencyKey: randomUUID(),
    });
    const json = (await response.json()) as { id: string };
    return json.id;
  }

  async getJob(jobId: string): Promise<IJobView> {
    const response = await this.request({
      method: 'GET',
      path: `/bulk-stage-moves/${jobId}`,
      workspaceId: this.target.largeWorkspaceId,
    });
    return (await response.json()) as IJobView;
  }

  async listStage(workspaceId: string, stageId: string): Promise<number> {
    const started = Date.now();
    await this.request({
      method: 'GET',
      path: `/opportunities?stageId=${stageId}&limit=20`,
      workspaceId,
    });
    return Date.now() - started;
  }

  async moveInteractive(deal: {
    id: string;
    version: number;
    toStageId: string;
  }): Promise<{ version: number; ms: number }> {
    const started = Date.now();
    const response = await this.request({
      method: 'POST',
      path: `/opportunities/${deal.id}/stage`,
      workspaceId: this.target.largeWorkspaceId,
      body: { stageId: deal.toStageId, expectedVersion: deal.version },
    });
    const json = (await response.json()) as { version: number };
    return { version: json.version, ms: Date.now() - started };
  }

  async firstDeal(
    workspaceId: string,
    stageId: string,
  ): Promise<{ id: string; version: number } | null> {
    const response = await this.request({
      method: 'GET',
      path: `/opportunities?stageId=${stageId}&limit=1`,
      workspaceId,
    });
    const json = (await response.json()) as {
      items: { id: string; version: number }[];
    };
    return json.items[0] ?? null;
  }

  private async request(options: {
    readonly method: string;
    readonly path: string;
    readonly workspaceId: string;
    readonly body?: Record<string, string> | IMoveStageBody;
    readonly idempotencyKey?: string;
  }): Promise<Response> {
    const headers: Record<string, string> = {
      'X-Workspace-Id': options.workspaceId,
    };
    if (options.idempotencyKey !== undefined) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${this.baseUrl}${options.path}`, {
      method: options.method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      throw new Error(`${options.method} ${options.path} -> ${response.status}`);
    }
    return response;
  }
}
