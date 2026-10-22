import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

const MINUTE = 60_000;

function loginName(request: Record<string, unknown>): string {
  const body = request.body as { login?: unknown } | undefined;
  return typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
}

// Slow down, never lock: limits per minute, counted in memory (one server).
export const AUTH_THROTTLERS: ThrottlerOptions[] = [
  { name: 'login', ttl: MINUTE, limit: 5, getTracker: (request) => `${request.ip}|${loginName(request)}` },
  { name: 'loginIp', ttl: MINUTE, limit: 20 },
  { name: 'refresh', ttl: MINUTE, limit: 30 },
  // Changing your password checks the current one: a stolen access token mustn't be able to guess it.
  { name: 'password', ttl: MINUTE, limit: 5, getTracker: (request) => (request.user as { id?: string } | undefined)?.id ?? request.ip },
];

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      { message: 'Too many attempts. Wait a minute and try again.', code: 'AUTH_TOO_MANY_ATTEMPTS' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
