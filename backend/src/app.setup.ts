import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { REQUEST_ID_HEADER, requestContextMiddleware } from './common/context/request-context';
import { requestLogMiddleware } from './common/logging/request-log.middleware';

// Shared by main.ts and the HTTP tests, so tests run against the same middleware and prefix.
export function configureApp(app: NestExpressApplication, corsOrigin: string) {
  // NGINX is the one proxy in front of the API, so req.ip is the real client address.
  app.set('trust proxy', 1);
  // First, so every later middleware, guard and log line shares one request id.
  app.use(requestContextMiddleware);
  app.use(requestLogMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  // API responses can hold one company's data; never let the browser or a proxy keep a copy.
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigin,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
