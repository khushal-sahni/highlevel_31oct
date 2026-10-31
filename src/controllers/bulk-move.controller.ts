import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { AppConfig } from '../config/app.config';
import { WorkspaceId } from '../decorators/workspace-id.decorator';
import {
  IBulkJobResponse,
  toBulkJobResponse,
} from '../dtos/bulk-job-response.dto';
import { CreateBulkMoveDto } from '../dtos/create-bulk-move.dto';
import { ValidationError } from '../errors/app.error';
import { BulkMoveService } from '../services/bulk-move.service';
import { requireUuid } from '../utils/parse';

@Controller('bulk-stage-moves')
export class BulkMoveController {
  constructor(
    private readonly bulkMoves: BulkMoveService,
    private readonly config: AppConfig,
  ) {}

  @Post()
  @HttpCode(202)
  async enqueue(
    @WorkspaceId() workspaceId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<IBulkJobResponse> {
    const key = BulkMoveController.requireKey(idempotencyKey);
    const view = await this.bulkMoves.enqueue(
      workspaceId,
      key,
      CreateBulkMoveDto.fromBody(body),
    );
    return toBulkJobResponse(view.job, view.counts, this.config.heartbeatStaleMs);
  }

  @Get(':id')
  async get(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<IBulkJobResponse> {
    const view = await this.bulkMoves.get(workspaceId, requireUuid(id, 'id'));
    return toBulkJobResponse(view.job, view.counts, this.config.heartbeatStaleMs);
  }

  private static requireKey(value: string | undefined): string {
    if (value === undefined || value.trim().length === 0) {
      throw new ValidationError('Idempotency-Key is required');
    }
    return value.trim();
  }
}
