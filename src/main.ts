import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { AppExceptionFilter } from './middleware/app-exception.filter';
import { LoggerService } from './services/logger.service';

class ApiProcess {
  async start(): Promise<void> {
    const app = await NestFactory.create(AppModule);
    app.useGlobalFilters(app.get(AppExceptionFilter));
    const config = app.get(AppConfig);
    const logger = app.get(LoggerService);
    await app.listen(config.port);
    logger.info(`API listening on ${config.port}`);
  }
}

const processEntry = new ApiProcess();
processEntry.start().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
