import { AppConfig } from '../config/app.config';
import { DatabasePool } from './database.pool';
import { StageRepository } from '../repositories/stage.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { LoggerService } from '../services/logger.service';
import { DEV_STAGES, DEV_WORKSPACE_ID } from './dev-ids';

export class DevSeeder {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly stages: StageRepository,
    private readonly logger: LoggerService,
  ) {}

  async run(): Promise<void> {
    await this.workspaces.insert(DEV_WORKSPACE_ID);
    for (const stage of DEV_STAGES) {
      await this.stages.insert({
        id: stage.id,
        workspaceId: DEV_WORKSPACE_ID,
        name: stage.name,
        position: stage.position,
      });
    }
    this.logger.info(`Seeded workspace ${DEV_WORKSPACE_ID}`);
  }
}

class SeedProcess {
  async start(): Promise<void> {
    const config = new AppConfig();
    const pool = new DatabasePool(config);
    const logger = new LoggerService();
    const seeder = new DevSeeder(
      new WorkspaceRepository(pool),
      new StageRepository(pool),
      logger,
    );
    try {
      await seeder.run();
    } finally {
      await pool.onModuleDestroy();
    }
  }
}

if (require.main === module) {
  new SeedProcess().start().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
