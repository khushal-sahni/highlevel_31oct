import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WorkspaceId } from '../decorators/workspace-id.decorator';
import { CreateOpportunityDto } from '../dtos/create-opportunity.dto';
import { ListOpportunitiesDto } from '../dtos/list-opportunities.dto';
import { MoveOpportunityDto } from '../dtos/move-opportunity.dto';
import {
  IOpportunityListResponse,
  IOpportunityResponse,
  toOpportunityResponse,
} from '../dtos/opportunity-response.dto';
import { OpportunityService } from '../services/opportunity.service';
import { requireUuid } from '../utils/parse';

@Controller('opportunities')
export class OpportunityController {
  constructor(private readonly opportunities: OpportunityService) {}

  @Post()
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() body: unknown,
  ): Promise<IOpportunityResponse> {
    const created = await this.opportunities.create(
      workspaceId,
      CreateOpportunityDto.fromBody(body),
    );
    return toOpportunityResponse(created);
  }

  @Post(':id/stage')
  async moveStage(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<IOpportunityResponse> {
    const moved = await this.opportunities.moveStage(
      workspaceId,
      requireUuid(id, 'id'),
      MoveOpportunityDto.fromBody(body),
    );
    return toOpportunityResponse(moved);
  }

  @Get()
  async list(
    @WorkspaceId() workspaceId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<IOpportunityListResponse> {
    const page = await this.opportunities.listByStage(
      workspaceId,
      ListOpportunitiesDto.fromQuery(query),
    );
    return {
      items: page.items.map((item) => toOpportunityResponse(item)),
      nextCursor: page.nextCursor,
    };
  }
}
