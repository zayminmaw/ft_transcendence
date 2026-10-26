import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { requestMeta } from '../auth';
import { ID_PATTERN } from './dto/tenant.dto';
import type { PlatformActor } from './types/tenant';

// URL ids are BIGINTs and stay strings.
export function tenantId(value: string): string {
  if (!ID_PATTERN.test(value)) throw new BadRequestException('The tenant id must be a positive integer.');
  return value;
}

export function userId(value: string): string {
  if (!ID_PATTERN.test(value)) throw new BadRequestException('The user id must be a positive integer.');
  return value;
}

// Who made a platform change, for its audit row.
export function actor(request: AuthenticatedRequest): PlatformActor {
  return { userId: request.user!.id, ...requestMeta(request) };
}
