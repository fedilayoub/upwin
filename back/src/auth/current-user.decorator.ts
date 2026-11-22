import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { User } from '../database/schema';
import { unauthenticated } from './auth.errors';
import './authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (!request.currentUser) {
      throw unauthenticated();
    }

    return request.currentUser;
  },
);
