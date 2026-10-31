import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BulkMoveWorker } from './bulk-move.worker';

if (process.env['DATABASE_POOL_MAX'] === undefined) {
  process.env['DATABASE_POOL_MAX'] = '1';
}

interface IParentMessage {
  readonly go?: boolean;
}

class OneStepProcess {
  async start(): Promise<void> {
    const app = await NestFactory.createApplicationContext(AppModule);
    const worker = app.get(BulkMoveWorker);
    await worker.stepHeld(() => this.waitForGo());
    await app.close();
  }

  private waitForGo(): Promise<void> {
    const send = process.send;
    if (send === undefined) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const onMessage = (message: IParentMessage): void => {
        if (message.go === true) {
          process.off('message', onMessage);
          resolve();
        }
      };
      process.on('message', onMessage);
      send.bind(process)({ ready: true });
    });
  }
}

const processEntry = new OneStepProcess();
processEntry.start().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
