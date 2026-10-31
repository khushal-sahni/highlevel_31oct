import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('App');

  info(message: string): void {
    this.logger.log(message);
  }

  error(message: string, error?: Error): void {
    if (error === undefined) {
      this.logger.error(message);
      return;
    }
    this.logger.error(message, error.stack);
  }
}
