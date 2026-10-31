import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfig } from './config/app.config';
import { BulkMoveController } from './controllers/bulk-move.controller';
import { OpportunityController } from './controllers/opportunity.controller';
import { DatabasePool } from './db/database.pool';
import { AppExceptionFilter } from './middleware/app-exception.filter';
import { WorkspaceMiddleware } from './middleware/workspace.middleware';
import { BulkItemRepository } from './repositories/bulk-item.repository';
import { BulkJobRepository } from './repositories/bulk-job.repository';
import { OpportunityRepository } from './repositories/opportunity.repository';
import { StageRepository } from './repositories/stage.repository';
import { TransitionRepository } from './repositories/transition.repository';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { BulkMoveService } from './services/bulk-move.service';
import { LoggerService } from './services/logger.service';
import { OpportunityService } from './services/opportunity.service';
import { BulkMoveEngine } from './workers/bulk-move.engine';
import { BulkMoveWorker } from './workers/bulk-move.worker';

@Module({
  controllers: [OpportunityController, BulkMoveController],
  providers: [
    AppConfig,
    LoggerService,
    DatabasePool,
    WorkspaceRepository,
    StageRepository,
    TransitionRepository,
    OpportunityRepository,
    OpportunityService,
    BulkJobRepository,
    BulkItemRepository,
    BulkMoveService,
    BulkMoveEngine,
    BulkMoveWorker,
    AppExceptionFilter,
    WorkspaceMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WorkspaceMiddleware).forRoutes('*');
  }
}
