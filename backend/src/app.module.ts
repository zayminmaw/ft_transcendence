import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment, type Environment } from './common/config/environment';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HealthController } from './common/health/health.controller';
import { HealthService } from './common/health/health.service';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { databaseOptions } from './database/database.config';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { OrganizationsModule } from './modules/organizations';
import { RbacModule, RolesGuard } from './modules/rbac';
import { ClientsModule } from './modules/clients';
import { StaffModule } from './modules/staff';
import { DriversModule } from './modules/drivers';
import { AssetsModule } from './modules/assets';
import { ParcelsModule } from './modules/parcels';
import { BillingModule } from './modules/billing';
import { NotificationsModule } from './modules/notifications';
import { PlatformModule } from './modules/platform';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => databaseOptions({
        DB_HOST: config.get('DB_HOST', { infer: true }),
        DB_PORT: config.get('DB_PORT', { infer: true }),
        DB_USER: config.get('DB_USER', { infer: true }),
        DB_PASS: config.get('DB_PASS', { infer: true }),
        DB_NAME: config.get('DB_NAME', { infer: true }),
      }),
    }),
    AuthModule, RbacModule, OrganizationsModule, ClientsModule, StaffModule,
    DriversModule, AssetsModule, ParcelsModule, BillingModule,
    NotificationsModule, PlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
