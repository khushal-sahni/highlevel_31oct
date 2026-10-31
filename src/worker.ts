import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './services/logger.service';
import { BulkMoveWorker } from './workers/bulk-move.worker';

class WorkerProcess {
  async start(): Promise<void> {
    const app = await NestFactory.createApplicationContext(AppModule);
    const worker = app.get(BulkMoveWorker);
    const logger = app.get(LoggerService);
    const shutdown = async (): Promise<void> => {
      worker.stop();
      await app.close();
    };
    process.on('SIGINT', () => {
      void shutdown();
    });
    process.on('SIGTERM', () => {
      void shutdown();
    });
    logger.info('Worker started');
    await worker.run();
  }
}

const processEntry = new WorkerProcess();
processEntry.start().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
