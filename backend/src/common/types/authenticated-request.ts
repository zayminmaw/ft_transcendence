import type { Request } from 'express';

export interface TenantContext {
  organizationId: string;
  roleId: string;
}

export interface AuthenticatedRequest extends Request {
  // mustChangePassword comes from the access token: the account must still replace an admin-given password.
  user?: { id: string; mustChangePassword: boolean };
  tenant?: TenantContext;
}
