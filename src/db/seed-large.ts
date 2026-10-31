import { AppConfig } from '../config/app.config';
import { DatabasePool } from './database.pool';
import { LargeSeeder } from './large-seeder';
import { LoggerService } from '../services/logger.service';

class SeedLargeProcess {
  async start(): Promise<void> {
    const pool = new DatabasePool(new AppConfig());
    try {
      await new LargeSeeder(pool, new LoggerService()).run();
    } finally {
      await pool.onModuleDestroy();
    }
  }
}

if (require.main === module) {
  new SeedLargeProcess().start().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
