import 'reflect-metadata';
import multipart from '@fastify/multipart';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { isAllowedExtensionOrigin } from './auth/extension-origin';
import { ApiExceptionFilter } from './common/api-exception.filter';
import {
  genRequestId,
  registerRequestIdHeader,
  REQUEST_ID_HEADER,
} from './common/request-id';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Every response carries X-Request-Id; error logs name the same id.
    new FastifyAdapter({ trustProxy: true, genReqId: genRequestId }),
  );

  const config = app.get(ConfigService<Env, true>);
  const port = config.getOrThrow('PORT', { infer: true });
  const host = config.getOrThrow('HOST', { infer: true });

  app.useGlobalFilters(new ApiExceptionFilter());
  registerRequestIdHeader(app.getHttpAdapter().getInstance());
  app.enableShutdownHooks();
  await app.register(multipart);

  // Exact origins only. The extension is bearer-token based and sends
  // `credentials: 'omit'`, so credentialed CORS is never needed.
  const appOrigin = config.getOrThrow('APP_URL', { infer: true });
  const configuredExtensionOrigins = config.get('EXTENSION_ALLOWED_ORIGINS', {
    infer: true,
  });

  app.enableCors({
    origin: (origin, callback) => {
      // A same-origin or non-browser caller sends no Origin header.
      if (!origin) return callback(null, true);
      callback(
        null,
        origin === appOrigin ||
          isAllowedExtensionOrigin(origin, configuredExtensionOrigins),
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Upilot-Extension-Origin',
    ],
    // The extension reads it to put the server's request id into its error report.
    exposedHeaders: [REQUEST_ID_HEADER],
    credentials: false,
    maxAge: 600,
  });

  // The OpenAPI document is a development tool. In production `/docs` and
  // `/docs-json` are 404.
  const serveApiDocs =
    config.get('NODE_ENV', { infer: true }) !== 'production';
  if (serveApiDocs) {
    // nestjs-zod 5 renders Zod DTOs through zod's own JSON Schema output, then
    // `cleanupOpenApiDoc` normalises the result. There is no `patchNestJsSwagger`
    // in v5 — calling the document builder without this leaves `$ref`s Swagger UI
    // cannot resolve.
    const openApiDocument = cleanupOpenApiDoc(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('upwin community API')
          .setDescription(
            'Goals, freelancer context, profile snapshots, and profile analysis.',
          )
          .setVersion('1.0')
          .addBearerAuth()
          .build(),
      ),
    );

    SwaggerModule.setup('docs', app, openApiDocument);
  }

  // HOST defaults to loopback. The env schema refuses any other interface
  // without API_TOKEN, unless compose says the port is loopback-only.
  await app.listen({ port, host });

  const logger = new Logger('Bootstrap');
  logger.log(
    serveApiDocs
      ? `API listening on ${host}:${port} — OpenAPI at /docs`
      : `API listening on ${host}:${port}`,
  );
  if (!config.get('API_TOKEN', { infer: true })) {
    logger.log(
      'API_TOKEN is not set: only requests addressed to localhost are served.',
    );
  }
}

void bootstrap();
