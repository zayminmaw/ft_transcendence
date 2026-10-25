import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Environment } from '../../common/config/environment';
import { OrganizationsModule } from '../organizations';
import { RbacModule } from '../rbac';
import { UsersModule } from '../users';
import { AuthAuditRepository } from './auth-audit.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_THROTTLERS, AuthThrottlerGuard } from './auth.throttler';
import { AuditLog } from './entities/audit-log.entity';
import { UserSession } from './entities/user-session.entity';
import { SameOriginGuard } from './same-origin.guard';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', expiresIn: '15m', issuer: config.get('JWT_ISSUER', { infer: true }), audience: config.get('JWT_AUDIENCE', { infer: true }) },
        verifyOptions: { algorithms: ['HS256'], issuer: config.get('JWT_ISSUER', { infer: true }), audience: config.get('JWT_AUDIENCE', { infer: true }) },
      }),
    }),
    ThrottlerModule.forRoot({ throttlers: AUTH_THROTTLERS }),
    TypeOrmModule.forFeature([UserSession, AuditLog]),
    UsersModule,
    OrganizationsModule,
    RbacModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, SessionsRepository, AuthAuditRepository, AuthThrottlerGuard, SameOriginGuard],
  exports: [JwtModule, SessionsService, AuthAuditRepository],
})
export class AuthModule {}
