import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool, PoolClient } from 'pg';
import { AppConfig } from '../config/app.config';
import { LoggerService } from '../services/logger.service';

export class MigrationRunner {
  constructor(
    private readonly connectionString: string,
    private readonly logger: LoggerService,
  ) {}

  async run(): Promise<void> {
    const pool = new Pool({ connectionString: this.connectionString });
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           id TEXT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      );
      for (const file of this.listFiles()) {
        await this.applyIfNeeded(pool, file);
      }
    } finally {
      await pool.end();
    }
  }

  private listFiles(): string[] {
    const dir = join(__dirname, '../../db/migrations');
    return readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort();
  }

  private async applyIfNeeded(pool: Pool, file: string): Promise<void> {
    const applied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE id = $1',
      [file],
    );
    if ((applied.rowCount ?? 0) > 0) {
      return;
    }
    const client = await pool.connect();
    try {
      await this.applyFile(client, file);
      this.logger.info(`Applied migration ${file}`);
    } finally {
      client.release();
    }
  }

  private async applyFile(client: PoolClient, file: string): Promise<void> {
    const sql = readFileSync(
      join(__dirname, '../../db/migrations', file),
      'utf8',
    );
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [
        file,
      ]);
      await client.query('COMMIT');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

class MigrateProcess {
  async start(): Promise<void> {
    const config = new AppConfig();
    const logger = new LoggerService();
    await new MigrationRunner(config.databaseUrl, logger).run();
  }
}

if (require.main === module) {
  new MigrateProcess().start().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
