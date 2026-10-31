import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfig } from './config/app.config';
import { OpportunityController } from './controllers/opportunity.controller';
import { DatabasePool } from './db/database.pool';
import { AppExceptionFilter } from './middleware/app-exception.filter';
import { WorkspaceMiddleware } from './middleware/workspace.middleware';
import { OpportunityRepository } from './repositories/opportunity.repository';
import { StageRepository } from './repositories/stage.repository';
import { TransitionRepository } from './repositories/transition.repository';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { LoggerService } from './services/logger.service';
import { OpportunityService } from './services/opportunity.service';

@Module({
  controllers: [OpportunityController],
  providers: [
    AppConfig,
    LoggerService,
    DatabasePool,
    WorkspaceRepository,
    StageRepository,
    TransitionRepository,
    OpportunityRepository,
    OpportunityService,
    AppExceptionFilter,
    WorkspaceMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WorkspaceMiddleware).forRoutes('*');
  }
}
