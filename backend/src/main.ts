import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Environment } from './common/config/environment';
import { CorsIoAdapter } from './modules/notifications';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));
  app.useWebSocketAdapter(new CorsIoAdapter(app, config.get('CORS_ORIGIN', { infer: true })));
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
