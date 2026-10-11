import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Guards run before interceptors: RolesGuard verifies active membership and permissions.
    if (!isPublic && !request.tenant) throw new ForbiddenException('Verified tenant context is required.');
    return next.handle();
  }
}
