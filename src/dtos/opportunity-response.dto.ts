import { IOpportunity } from '../entities/opportunity';

export interface IOpportunityResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly stageId: string;
  readonly name: string;
  readonly value: number;
  readonly status: string;
  readonly ownerId: string;
  readonly version: number;
  readonly stageChangedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IOpportunityListResponse {
  readonly items: readonly IOpportunityResponse[];
  readonly nextCursor: string | null;
}

export function toOpportunityResponse(
  opportunity: IOpportunity,
): IOpportunityResponse {
  return {
    id: opportunity.id,
    workspaceId: opportunity.workspaceId,
    stageId: opportunity.stageId,
    name: opportunity.name,
    value: opportunity.value,
    status: opportunity.status,
    ownerId: opportunity.ownerId,
    version: opportunity.version,
    stageChangedAt: opportunity.stageChangedAt.toISOString(),
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  };
}
