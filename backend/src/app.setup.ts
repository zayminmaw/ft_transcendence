import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Shared by main.ts and the HTTP tests, so tests run against the same middleware and prefix.
export function configureApp(app: NestExpressApplication, corsOrigin: string) {
  // NGINX is the one proxy in front of the API, so req.ip is the real client address.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  // API responses can hold one company's data; never let the browser or a proxy keep a copy.
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigin, allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
