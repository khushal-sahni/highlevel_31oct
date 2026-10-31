import { IOpportunity, IOpportunityRow } from '../entities/opportunity';
import { parseOpportunityStatus } from '../types/opportunity-status';

export function mapOpportunity(row: IOpportunityRow): IOpportunity {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    stageId: row.stage_id,
    name: row.name,
    value: Number.parseInt(row.value, 10),
    status: parseOpportunityStatus(row.status),
    ownerId: row.owner_id,
    version: row.version,
    stageChangedAt: row.stage_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
