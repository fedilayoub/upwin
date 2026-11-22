import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Env } from '../config/env.schema';
import { forbiddenExtensionOrigin } from './auth.errors';
import {
  extensionOriginHeaderKey,
  resolveAllowedExtensionRequest,
} from './extension-origin';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ExtensionOriginGuard implements CanActivate {
  private readonly appOrigin: string;
  private readonly configuredExtensionOrigins: string | undefined;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.appOrigin = this.config.getOrThrow('APP_URL', { infer: true });
    this.configuredExtensionOrigins = this.config.get('EXTENSION_ALLOWED_ORIGINS', {
      infer: true,
    });
  }

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawBrowserOrigin = request.headers.origin;
    const rawDeclaredOrigin = request.headers[extensionOriginHeaderKey];

    if (rawBrowserOrigin === undefined && rawDeclaredOrigin === undefined) {
      return true;
    }

    const browserOrigin = singleHeader(rawBrowserOrigin);
    const declaredOrigin = singleHeader(rawDeclaredOrigin);

    if (browserOrigin === this.appOrigin && rawDeclaredOrigin === undefined) {
      return true;
    }

    if (
      resolveAllowedExtensionRequest(
        browserOrigin,
        declaredOrigin,
        this.configuredExtensionOrigins,
      )
    ) {
      return true;
    }

    throw forbiddenExtensionOrigin();
  }
}

function singleHeader(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}
