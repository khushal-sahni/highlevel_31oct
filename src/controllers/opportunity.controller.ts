import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WorkspaceId } from '../decorators/workspace-id.decorator';
import {
  CreateOpportunityDto,
  ICreateOpportunityInput,
} from '../dtos/create-opportunity.dto';
import {
  IListOpportunitiesQuery,
  ListOpportunitiesDto,
} from '../dtos/list-opportunities.dto';
import {
  IMoveOpportunityInput,
  MoveOpportunityDto,
} from '../dtos/move-opportunity.dto';
import {
  IOpportunityListResponse,
  IOpportunityResponse,
  toOpportunityResponse,
} from '../dtos/opportunity-response.dto';
import { ParseDtoPipe } from '../pipes/parse-dto.pipe';
import { OpportunityService } from '../services/opportunity.service';
import { requireUuid } from '../utils/parse';

@Controller('opportunities')
export class OpportunityController {
  constructor(private readonly opportunities: OpportunityService) {}

  @Post()
  async create(
    @WorkspaceId() workspaceId: string,
    @Body(new ParseDtoPipe(CreateOpportunityDto.fromBody))
    body: ICreateOpportunityInput,
  ): Promise<IOpportunityResponse> {
    const created = await this.opportunities.create(workspaceId, body);
    return toOpportunityResponse(created);
  }

  @Post(':id/stage')
  async moveStage(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(new ParseDtoPipe(MoveOpportunityDto.fromBody))
    body: IMoveOpportunityInput,
  ): Promise<IOpportunityResponse> {
    const moved = await this.opportunities.moveStage(
      workspaceId,
      requireUuid(id, 'id'),
      body,
    );
    return toOpportunityResponse(moved);
  }

  @Get()
  async list(
    @WorkspaceId() workspaceId: string,
    @Query(new ParseDtoPipe(ListOpportunitiesDto.fromQuery))
    query: IListOpportunitiesQuery,
  ): Promise<IOpportunityListResponse> {
    const page = await this.opportunities.listByStage(workspaceId, query);
    return {
      items: page.items.map((item) => toOpportunityResponse(item)),
      nextCursor: page.nextCursor,
    };
  }
}
