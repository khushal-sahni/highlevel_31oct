import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ValidationError } from '../errors/app.error';

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (request.workspaceId === undefined) {
      throw new ValidationError('X-Workspace-Id is required');
    }
    return request.workspaceId;
  },
);
