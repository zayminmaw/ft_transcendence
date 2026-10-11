import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('A valid bearer token is required.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown; exp?: unknown }>(match[1]);
      if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub) || typeof payload.exp !== 'number') {
        throw new Error('Invalid token claims');
      }
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('The access token is invalid or expired.');
    }
  }
}
