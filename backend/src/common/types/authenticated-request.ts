import type { Request } from 'express';

export interface TenantContext {
  organizationId: string;
  roleId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
  tenant?: TenantContext;
}
