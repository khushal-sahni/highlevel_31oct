import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../errors/app.error';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { requireUuid } from '../utils/parse';

@Injectable()
export class WorkspaceMiddleware implements NestMiddleware {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async use(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      request.workspaceId = await this.resolveWorkspaceId(request);
      next();
    } catch (error: unknown) {
      next(error);
    }
  }

  private async resolveWorkspaceId(request: Request): Promise<string> {
    const raw = request.header('x-workspace-id');
    if (raw === undefined || raw.trim().length === 0) {
      throw new ValidationError('X-Workspace-Id is required');
    }
    const id = requireUuid(raw.trim(), 'X-Workspace-Id');
    const workspace = await this.workspaces.findById(id);
    if (workspace === null) {
      throw new NotFoundError('Workspace');
    }
    return workspace.id;
  }
}
