import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppLogger } from './common/logging/app-logger';
import type { Environment } from './common/config/environment';

async function bootstrap() {
  // Buffer startup logs until the JSON logger is in place, so every line has the same shape.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Environment, true>);
  app.useLogger(new AppLogger({
    level: config.get('LOG_LEVEL', { infer: true }),
    format: config.get('LOG_FORMAT', { infer: true }),
    includeStack: config.get('NODE_ENV', { infer: true }) !== 'production',
  }));
  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
