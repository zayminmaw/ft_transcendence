import { SetMetadata } from '@nestjs/common';
export const IS_AUTHENTICATED_ONLY = 'isAuthenticatedOnly';
// For endpoints that need a logged-in, active user but no company (current user, logout-style account actions).
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_ONLY, true);
