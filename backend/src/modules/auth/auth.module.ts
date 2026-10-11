import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Environment } from '../../common/config/environment';

@Module({
  imports: [JwtModule.registerAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<Environment, true>) => ({
      secret: config.get('JWT_SECRET', { infer: true }),
      signOptions: { algorithm: 'HS256', expiresIn: '15m', issuer: config.get('JWT_ISSUER', { infer: true }), audience: config.get('JWT_AUDIENCE', { infer: true }) },
      verifyOptions: { algorithms: ['HS256'], issuer: config.get('JWT_ISSUER', { infer: true }), audience: config.get('JWT_AUDIENCE', { infer: true }) },
    }),
  })],
  exports: [JwtModule],
})
export class AuthModule {}
