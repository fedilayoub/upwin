import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Env } from '../config/env.schema';
import { UsersService } from '../users/users.service';
import { forbiddenHost, unauthenticated } from './auth.errors';
import './authenticated-request';
import {
  digestToken,
  extractBearerToken,
  hostnameOf,
  LOOPBACK_HOSTS,
  tokenMatches,
} from './local-access';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Single-user access control for the community edition.
 *
 * - With `API_TOKEN` set, every non-public route needs `Authorization: Bearer
 *   <API_TOKEN>`. That is the mode for an API reachable over a network.
 * - Without it, the request's `Host` header must be a loopback name. This is
 *   what stops a DNS-rebinding page from reading local data: its requests
 *   carry the attacker's host name.
 *
 * Either way the request resolves to the one local user. Cross-site browser
 * calls are refused earlier by `ExtensionOriginGuard` and CORS.
 */
@Injectable()
export class LocalAuthGuard implements CanActivate {
  private readonly tokenDigest: Buffer | null;
  private readonly allowedHosts: ReadonlySet<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
    config: ConfigService<Env, true>,
  ) {
    // A blank `API_TOKEN=` validates to undefined, but ConfigService.get then
    // falls back to process.env and returns ''. Both mean "no token".
    const token = config.get('API_TOKEN', { infer: true });
    this.tokenDigest = token ? digestToken(token) : null;
    this.allowedHosts = new Set(LOOPBACK_HOSTS);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (this.tokenDigest) {
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        throw unauthenticated(
          request.headers.authorization ? 'malformed-bearer' : 'missing-bearer',
        );
      }
      if (!tokenMatches(token, this.tokenDigest)) {
        throw unauthenticated('invalid-token');
      }
    } else {
      const host = hostnameOf(request.headers.host);
      if (host === null || !this.allowedHosts.has(host)) {
        throw forbiddenHost();
      }
    }

    request.currentUser = await this.users.ensureLocalUser();
    return true;
  }
}
