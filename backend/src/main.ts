import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Environment } from './common/config/environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }), allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
