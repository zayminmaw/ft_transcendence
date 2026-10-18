import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Environment } from '../../common/config/environment';

// Refresh and logout act on the cookie alone, so they also require a request from our own site.
@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (origin !== this.config.get('CORS_ORIGIN', { infer: true })) throw new ForbiddenException('Cross-site request refused.');
    return true;
  }
}
