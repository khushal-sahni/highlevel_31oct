import { Injectable } from '@nestjs/common';
import { ICreateOpportunityInput } from '../dtos/create-opportunity.dto';
import { IListOpportunitiesQuery } from '../dtos/list-opportunities.dto';
import { IMoveOpportunityInput } from '../dtos/move-opportunity.dto';
import { IOpportunity } from '../entities/opportunity';
import { ConflictError, NotFoundError, ValidationError } from '../errors/app.error';
import { OpportunityRepository } from '../repositories/opportunity.repository';
import { StageRepository } from '../repositories/stage.repository';

export interface IOpportunityPage {
  readonly items: readonly IOpportunity[];
  readonly nextCursor: string | null;
}

@Injectable()
export class OpportunityService {
  constructor(
    private readonly opportunities: OpportunityRepository,
    private readonly stages: StageRepository,
  ) {}

  async create(
    workspaceId: string,
    input: ICreateOpportunityInput,
  ): Promise<IOpportunity> {
    await this.requireStage(workspaceId, input.stageId);
    return this.opportunities.insert({ workspaceId, ...input });
  }

  async moveStage(
    workspaceId: string,
    opportunityId: string,
    input: IMoveOpportunityInput,
  ): Promise<IOpportunity> {
    const current = await this.requireOpportunity(workspaceId, opportunityId);
    await this.requireStage(workspaceId, input.stageId);
    this.assertDifferentStage(current.stageId, input.stageId);
    return this.applyMove(current, input);
  }

  async listByStage(
    workspaceId: string,
    query: IListOpportunitiesQuery,
  ): Promise<IOpportunityPage> {
    await this.requireStage(workspaceId, query.stageId);
    const rows = await this.opportunities.listByStage({
      workspaceId,
      stageId: query.stageId,
      limit: query.limit + 1, // Extra row tells us whether a nextCursor exists.
      cursor: query.cursor,
    });
    return this.toPage(rows, query.limit);
  }

  private async applyMove(
    current: IOpportunity,
    input: IMoveOpportunityInput,
  ): Promise<IOpportunity> {
    const moved = await this.opportunities.moveIfVersion({
      workspaceId: current.workspaceId,
      opportunityId: current.id,
      stageId: input.stageId,
      fromStageId: current.stageId,
      expectedVersion: input.expectedVersion,
    });
    if (moved === null) {
      throw new ConflictError('Opportunity version mismatch');
    }
    return moved;
  }

  private async requireStage(
    workspaceId: string,
    stageId: string,
  ): Promise<void> {
    const stage = await this.stages.findInWorkspace(workspaceId, stageId);
    if (stage === null) {
      throw new NotFoundError('Stage');
    }
  }

  private async requireOpportunity(
    workspaceId: string,
    opportunityId: string,
  ): Promise<IOpportunity> {
    const opportunity = await this.opportunities.findById(
      workspaceId,
      opportunityId,
    );
    if (opportunity === null) {
      throw new NotFoundError('Opportunity');
    }
    return opportunity;
  }

  private assertDifferentStage(fromStageId: string, toStageId: string): void {
    if (fromStageId === toStageId) {
      throw new ValidationError('Opportunity is already in that stage');
    }
  }

  private toPage(
    rows: readonly IOpportunity[],
    limit: number,
  ): IOpportunityPage {
    if (rows.length <= limit) {
      return { items: rows, nextCursor: null };
    }
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items, nextCursor: last === undefined ? null : last.id };
  }
}
