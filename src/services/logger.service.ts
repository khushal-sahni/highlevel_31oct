import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('App');

  info(message: string): void {
    this.logger.log(message);
  }

  error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      this.logger.error(message, error.stack);
      return;
    }
    this.logger.error(message);
  }
}
