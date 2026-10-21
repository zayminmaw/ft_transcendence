import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_AUTHENTICATED_ONLY } from '../decorators/authenticated.decorator';
import { IS_PLATFORM_ADMIN } from '../decorators/platform-admin.decorator';
import { IS_PUBLIC } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    // @Authenticated() endpoints act on the account itself, and @PlatformAdmin() endpoints on the platform: no company.
    const isAccountOnly = this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY, targets);
    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ADMIN, targets);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Guards run before interceptors: RolesGuard verifies active membership and permissions.
    if (!isPublic && !isAccountOnly && !isPlatform && !request.tenant) {
      throw new ForbiddenException('Verified tenant context is required.');
    }
    return next.handle();
  }
}
