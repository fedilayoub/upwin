import type { User } from '../database/schema';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: User;
  }
}

export {};
