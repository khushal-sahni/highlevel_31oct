import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../errors/app.error';
import { LoggerService } from '../services/logger.service';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppError) {
      response
        .status(exception.statusCode)
        .json({ error: exception.message, code: exception.code });
      return;
    }
    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json({ error: exception.message, code: 'HTTP' });
      return;
    }
    if (exception instanceof Error) {
      this.logger.error('Unhandled error', exception);
    } else {
      this.logger.error('Unhandled error');
    }
    response.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
  }
}
