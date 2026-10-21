import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Environment } from '../../common/config/environment';

// Login, refresh and logout must come from our own site: the browser's Origin is CORS_ORIGIN, or exactly the origin
// the request was sent to (the app opened by IP or another local name). Other sites, and other apps on the same host
// with another port or scheme, are refused.
@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (origin && (origin === this.config.get('CORS_ORIGIN', { infer: true }) || origin === ownOrigin(request))) return true;
    throw new ForbiddenException({ message: 'Requests must come from this site.', code: 'AUTH_FORBIDDEN_ORIGIN' });
  }
}

// NGINX sets X-Forwarded-Proto (read by request.protocol with trust proxy) and passes the browser's Host. Only the
// Host header counts, never X-Forwarded-Host, which a client could set itself.
function ownOrigin(request: Request): string | undefined {
  return request.headers.host ? `${request.protocol}://${request.headers.host}` : undefined;
}
