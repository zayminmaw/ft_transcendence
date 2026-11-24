import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectThrottlerStorage, ThrottlerGuard, type ThrottlerStorage } from '@nestjs/throttler';

const MINUTE = 60_000;

// The public tracking page's own limit per address. It has its own options, so the sign-in limits never apply here;
// only the counter storage is shared, from the ThrottlerModule the auth module registers. Numbers can't be guessed
// from one another; this keeps anyone from trying many.
@Injectable()
export class TrackingThrottlerGuard extends ThrottlerGuard {
  // Both parameters name what they take: ThrottlerGuard's own parameter decorators (options, storage) are inherited and
  // would otherwise decide them.
  constructor(@InjectThrottlerStorage() storage: ThrottlerStorage, @Inject(Reflector) reflector: Reflector) {
    super({ throttlers: [{ name: 'tracking', ttl: MINUTE, limit: 30 }] }, storage, reflector);
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      { message: 'Too many lookups. Wait a minute and try again.', code: 'TRACKING_TOO_MANY_LOOKUPS' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
