import type { Request } from 'express';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(request: Request): RequestMeta {
  const userAgent = request.headers['user-agent'];
  return { ip: request.ip ?? null, userAgent: userAgent ? userAgent.slice(0, 255) : null };
}
