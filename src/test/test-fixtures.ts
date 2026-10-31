import { StageRepository } from '../repositories/stage.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';

export interface IWorkspaceFixture {
  readonly workspaceId: string;
  readonly stageIds: readonly string[];
}

export class TestFixtures {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly stages: StageRepository,
  ) {}

  async createWorkspaceWithStages(): Promise<IWorkspaceFixture> {
    const workspace = await this.workspaces.insert();
    const first = await this.stages.insert({
      workspaceId: workspace.id,
      name: 'New Lead',
      position: 1,
    });
    const second = await this.stages.insert({
      workspaceId: workspace.id,
      name: 'Contacted',
      position: 2,
    });
    const third = await this.stages.insert({
      workspaceId: workspace.id,
      name: 'Qualified',
      position: 3,
    });
    return {
      workspaceId: workspace.id,
      stageIds: [first.id, second.id, third.id],
    };
  }
}
