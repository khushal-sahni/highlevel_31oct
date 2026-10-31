import { cpus, totalmem, type } from 'os';
import { DatabasePool } from './database.pool';

export interface IHardwareInfo {
  readonly os: string;
  readonly cpuModel: string;
  readonly cpuCount: number;
  readonly memoryGb: number;
  readonly node: string;
  readonly postgres: string;
}

export class HardwareReporter {
  constructor(private readonly db: DatabasePool) {}

  async collect(): Promise<IHardwareInfo> {
    const cpu = cpus()[0];
    const pg = await this.db.query<{ version: string }>('SELECT version()');
    const version = pg.rows[0]?.version ?? 'unknown';
    return {
      os: `${type()} ${process.platform}`,
      cpuModel: cpu?.model ?? 'unknown',
      cpuCount: cpus().length,
      memoryGb: Math.round((totalmem() / 1024 / 1024 / 1024) * 10) / 10,
      node: process.version,
      postgres: version,
    };
  }
}
