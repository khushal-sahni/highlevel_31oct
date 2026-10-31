import { OpportunityStatus } from '../types/opportunity-status';

export interface IOpportunity {
  readonly id: string;
  readonly workspaceId: string;
  readonly stageId: string;
  readonly name: string;
  readonly value: number;
  readonly status: OpportunityStatus;
  readonly ownerId: string;
  readonly version: number;
  readonly stageChangedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IOpportunityRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly stage_id: string;
  readonly name: string;
  readonly value: string;
  readonly status: string;
  readonly owner_id: string;
  readonly version: number;
  readonly stage_changed_at: Date;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface IStage {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly position: number;
}

export interface IStageRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly name: string;
  readonly position: number;
}

export interface IWorkspace {
  readonly id: string;
}

export interface ITransition {
  readonly id: string;
  readonly workspaceId: string;
  readonly opportunityId: string;
  readonly fromStageId: string;
  readonly toStageId: string;
  readonly jobId: string | null;
  readonly createdAt: Date;
}

export interface ITransitionRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly opportunity_id: string;
  readonly from_stage_id: string;
  readonly to_stage_id: string;
  readonly job_id: string | null;
  readonly created_at: Date;
}
